import { retryable } from './transaction.js';
import {
  Injectable,
  Inject,
  ForbiddenException,
  UnauthorizedException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import { type Actor, audit } from '../common/domain/access.js';
import { conflict, yangonToday } from '../common/domain/rules.js';
import { qrLookupId, qrMatches } from '../qr/qr-codec.js';
import { qrSigningSecret } from '../qr/qr.config.js';
export type CheckInInput = { requestId: string; qrPayload: string };
export type BackfillInput = {
  requestId: string;
  userId: string;
  occurredAt: string;
  reason: string;
};
export type CheckInResult = {
  outcome: 'CHECKED_IN' | 'ALREADY_CHECKED_IN' | 'CANCELLED';
  replayed: boolean;
  attendanceId: string;
  checkedInAt: string;
  member: { name: string; memberNumber: string };
  plan: { id: string; name: string };
  session: { id: string; name: string; meetupDate: string };
  membership: {
    id: string;
    totalVisits: number;
    usedVisits: number;
    remainingVisits: number;
  };
};
@Injectable()
export class AttendanceService {
  constructor(@Inject(PrismaService) private readonly db: PrismaService) {}
  private async actor(
    tx: Prisma.TransactionClient,
    actor: Actor,
    target: string,
  ) {
    for (const id of [...new Set([actor.id, target])].sort())
      await tx.$queryRaw`SELECT id FROM moe_auth_user WHERE id=${id} FOR UPDATE`;
    const user = await tx.authUser.findUnique({ where: { id: actor.id } });
    const session = await tx.authSession.findUnique({
      where: { id: actor.sessionId },
    });
    if (
      !user ||
      !session ||
      session.userId !== user.id ||
      session.expiresAt <= new Date() ||
      session.authVersion !== user.authVersion ||
      actor.authVersion !== user.authVersion
    )
      throw new UnauthorizedException();
    if (
      !user.enabled ||
      user.mustChangePassword ||
      !['admin', 'staff'].includes(user.role)
    )
      throw new ForbiddenException();
    return user;
  }
  async checkIn(
    actor: Actor,
    id: string,
    input: CheckInInput,
  ): Promise<CheckInResult> {
    return this.record(actor, id, input);
  }
  async backfill(
    actor: Actor,
    id: string,
    input: BackfillInput,
  ): Promise<CheckInResult> {
    if (actor.role !== 'admin') throw new ForbiddenException();
    return this.record(
      actor,
      id,
      { requestId: input.requestId, qrPayload: '' },
      input,
    );
  }
  private async record(
    actor: Actor,
    id: string,
    input: CheckInInput,
    backfill?: BackfillInput,
  ): Promise<CheckInResult> {
    if (!['admin', 'staff'].includes(actor.role))
      throw new ForbiddenException();
    const fingerprint = createHash('sha256')
      .update(
        JSON.stringify(
          backfill
            ? [
                'backfill',
                id,
                backfill.userId,
                new Date(backfill.occurredAt).toISOString(),
                backfill.reason,
              ]
            : [id, input.qrPayload],
        ),
      )
      .digest('hex');
    for (let attempt = 0; ; attempt++) {
      try {
        return await this.db.client.$transaction(
          async (tx) => {
            // No member lookup/disclosure before the caller's visible-session scope is checked.
            const visible = await tx.meetupSession.findFirst({
              where: {
                id,
                ...(actor.role === 'staff'
                  ? { assignments: { some: { userId: actor.id } } }
                  : {}),
              },
              select: { id: true },
            });
            if (!visible) throw new NotFoundException();
            let reference: { userId: string };
            if (backfill) {
              reference = { userId: backfill.userId };
            } else {
              const lookup = qrLookupId(input.qrPayload);
              if (!lookup)
                conflict(
                  'INVALID_QR',
                  'This QR is invalid or has been replaced.',
                );
              const found = await tx.memberQr.findUnique({
                where: { credentialId: lookup },
                select: { userId: true },
              });
              if (!found)
                conflict(
                  'INVALID_QR',
                  'This QR is invalid or has been replaced.',
                );
              reference = found;
            }
            const scanner = await this.actor(tx, actor, reference.userId);
            if (backfill && scanner.role !== 'admin')
              throw new ForbiddenException();
            if (!backfill) {
              await tx.$queryRaw`SELECT "userId" FROM member_qr WHERE "userId"=${reference.userId} FOR UPDATE`;
              const qr = await tx.memberQr.findUnique({
                where: { userId: reference.userId },
              });
              if (!qr || !qrMatches(input.qrPayload, qr, qrSigningSecret()))
                conflict(
                  'INVALID_QR',
                  'This QR is invalid or has been replaced.',
                );
            }
            const member = await tx.authUser.findUnique({
              where: { id: reference.userId },
              select: {
                id: true,
                name: true,
                enabled: true,
                profile: { select: { memberNumber: true } },
              },
            });
            if (!member?.enabled)
              conflict('ACCOUNT_DISABLED', 'This account cannot check in.');
            if (!member.profile)
              throw new ServiceUnavailableException(
                'Member profile temporarily unavailable',
              );
            const initial = await tx.meetupSession.findUnique({
              where: { id },
              select: { planId: true },
            });
            if (!initial) throw new NotFoundException();
            await tx.$queryRaw`SELECT id FROM plans WHERE id=${initial.planId} FOR UPDATE`;
            await tx.$queryRaw`SELECT id FROM meetup_sessions WHERE id=${id} FOR UPDATE`;
            const meetup = await tx.meetupSession.findUnique({
              where: { id },
              include: { plan: { select: { id: true, name: true } } },
            });
            if (!meetup) throw new NotFoundException();
            if (
              scanner.role === 'staff' &&
              !(await tx.meetupStaff.findUnique({
                where: {
                  sessionId_userId: { sessionId: id, userId: actor.id },
                },
              }))
            )
              throw new NotFoundException();
            const previous = await tx.checkInOperation.findUnique({
              where: {
                actorId_requestId: {
                  actorId: actor.id,
                  requestId: input.requestId,
                },
              },
              include: { attendance: { select: { cancelledAt: true } } },
            });
            if (previous) {
              if (previous.fingerprint !== fingerprint)
                conflict(
                  'IDEMPOTENCY_CONFLICT',
                  'This request ID was already used for a different operation.',
                );
              const result = previous.result as unknown as CheckInResult;
              return {
                ...result,
                replayed: true,
                ...(previous.attendance.cancelledAt
                  ? { outcome: 'CANCELLED' as const }
                  : {}),
              };
            }
            const [{ now }] = await tx.$queryRaw<
              { now: Date }[]
            >`SELECT clock_timestamp() AS now`;
            const day = meetup.meetupDate.toISOString().slice(0, 10);
            const occurredAt = backfill ? new Date(backfill.occurredAt) : now!;
            if (backfill) {
              if (
                day >= yangonToday(now!) ||
                yangonToday(occurredAt) !== day ||
                occurredAt > now!
              )
                conflict(
                  'BACKFILL_DATE_INVALID',
                  'Backfill requires a historical session and matching attendance date in Myanmar time.',
                );
            } else {
              if (!meetup.open)
                conflict('SESSION_CLOSED', 'This session is closed.');
              if (day !== yangonToday(now!))
                conflict(
                  'SESSION_DATE_MISMATCH',
                  'Live check-in is only available on the meetup date.',
                );
            }
            const date = new Date(day + 'T00:00Z');
            const term = await tx.membership.findFirst({
              where: {
                userId: member.id,
                planId: meetup.planId,
                cancelledAt: null,
                startDate: { lte: date },
                endDate: { gte: date },
              },
            });
            if (!term)
              conflict(
                'NO_ELIGIBLE_MEMBERSHIP',
                'No eligible membership for this session.',
              );
            await tx.$queryRaw`SELECT id FROM memberships WHERE id=${term.id} FOR UPDATE`;
            const current = await tx.membership.findUniqueOrThrow({
              where: { id: term.id },
            });
            if (
              current.cancelledAt ||
              current.startDate > date ||
              current.endDate < date
            )
              conflict(
                'NO_ELIGIBLE_MEMBERSHIP',
                'No eligible membership for this session.',
              );
            const old = await tx.attendance.findFirst({
              where: {
                membershipId: term.id,
                sessionId: id,
                cancelledAt: null,
              },
            });
            if (!old && current.usedVisits >= current.totalVisits)
              conflict(
                'VISITS_EXHAUSTED',
                'No visits remain for this membership.',
              );
            const attendance =
              old ||
              (await tx.attendance.create({
                data: {
                  userId: member.id,
                  planId: meetup.planId,
                  membershipId: term.id,
                  sessionId: id,
                  occurredAt,
                  recordedAt: now!,
                  recordedById: actor.id,
                  method: backfill ? 'backfill' : 'scan',
                },
              }));
            const balance = await tx.membership.findUniqueOrThrow({
              where: { id: term.id },
            });
            const result: CheckInResult = {
              outcome: old ? 'ALREADY_CHECKED_IN' : 'CHECKED_IN',
              replayed: false,
              attendanceId: attendance.id,
              checkedInAt: attendance.occurredAt.toISOString(),
              member: {
                name: member.name,
                memberNumber: `MOE-${String(member.profile.memberNumber).padStart(6, '0')}`,
              },
              plan: meetup.plan,
              session: { id: meetup.id, name: meetup.name, meetupDate: day },
              membership: {
                id: term.id,
                totalVisits: balance.totalVisits,
                usedVisits: balance.usedVisits,
                remainingVisits: balance.totalVisits - balance.usedVisits,
              },
            };
            await tx.checkInOperation.create({
              data: {
                actorId: actor.id,
                requestId: input.requestId,
                fingerprint,
                attendanceId: attendance.id,
                result: result as unknown as Prisma.InputJsonValue,
              },
            });
            if (!old)
              await audit(
                tx,
                scanner,
                'Attendance',
                attendance.id,
                backfill ? 'attendance.backfilled' : 'attendance.checked_in',
                backfill ? backfill.reason : 'Live QR check-in',
                undefined,
                {
                  membershipId: term.id,
                  sessionId: id,
                  occurredAt: attendance.occurredAt.toISOString(),
                  method: attendance.method,
                  usedVisits: balance.usedVisits,
                  remainingVisits: result.membership.remainingVisits,
                },
              );
            return result;
          },
          { maxWait: 5000, timeout: 10000 },
        );
      } catch (error) {
        if (attempt >= 2 || !retryable(error)) throw error;
        await new Promise((resolve) => setTimeout(resolve, 25 * (attempt + 1)));
      }
    }
  }
}
