import {
  Injectable,
  Inject,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { assertWrite, audit, type Actor } from '../common/domain/access.js';
import { retryable } from './transaction.js';
@Injectable()
export class CancellationService {
  constructor(@Inject(PrismaService) private readonly db: PrismaService) {}
  async cancel(actor: Actor, id: string, reason: string) {
    if (actor.role !== 'admin') throw new ForbiddenException();
    for (let attempt = 0; ; attempt++) {
      try {
        return await this.db.client.$transaction(
          async (tx) => {
            const reference = await tx.attendance.findUnique({
              where: { id },
              select: {
                userId: true,
                planId: true,
                sessionId: true,
                membershipId: true,
              },
            });
            if (!reference) throw new NotFoundException();
            // Same ordering as live check-in/backfill, membership edits and account revocation.
            const admin = await assertWrite(tx, actor, reference.userId);
            await tx.$queryRaw`SELECT id FROM plans WHERE id=${reference.planId} FOR UPDATE`;
            await tx.$queryRaw`SELECT id FROM meetup_sessions WHERE id=${reference.sessionId} FOR UPDATE`;
            await tx.$queryRaw`SELECT id FROM memberships WHERE id=${reference.membershipId} FOR UPDATE`;
            await tx.$queryRaw`SELECT id FROM attendance WHERE id=${id} FOR UPDATE`;
            const current = await tx.attendance.findUniqueOrThrow({
              where: { id },
            });
            const refundApplied = current.cancelledAt === null;
            if (refundApplied) {
              const [{ now }] = await tx.$queryRaw<
                { now: Date }[]
              >`SELECT clock_timestamp() AS now`;
              await tx.attendance.update({
                where: { id },
                data: {
                  cancelledAt: now!,
                  cancelledById: admin.id,
                  cancellationReason: reason,
                },
              });
            }
            const record = await tx.attendance.findUniqueOrThrow({
              where: { id },
              select: {
                cancelledAt: true,
                cancellationReason: true,
                canceller: { select: { id: true, name: true } },
              },
            });
            const membership = await tx.membership.findUniqueOrThrow({
              where: { id: reference.membershipId },
              select: { id: true, totalVisits: true, usedVisits: true },
            });
            if (refundApplied)
              await audit(
                tx,
                admin,
                'Attendance',
                id,
                'attendance.cancelled',
                reason,
                { status: 'effective' },
                {
                  status: 'cancelled',
                  membershipId: membership.id,
                  sessionId: reference.sessionId,
                  usedVisits: membership.usedVisits,
                  remainingVisits:
                    membership.totalVisits - membership.usedVisits,
                },
              );
            return {
              outcome: refundApplied
                ? ('CANCELLED' as const)
                : ('ALREADY_CANCELLED' as const),
              attendanceId: id,
              refundApplied,
              cancellation: {
                at: record.cancelledAt!.toISOString(),
                reason: record.cancellationReason!,
                by: record.canceller!,
              },
              membership: {
                ...membership,
                remainingVisits: membership.totalVisits - membership.usedVisits,
              },
            };
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
