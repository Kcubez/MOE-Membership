import {
  Injectable,
  Inject,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { z } from 'zod';
import { PrismaService } from '../prisma/prisma.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import type { Actor } from '../common/domain/access.js';
import { dateOnly, parse } from '../common/domain/rules.js';
export const historyQuery = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(20),
    cursor: z.string().max(512).optional(),
    search: z.string().trim().max(120).optional(),
    from: dateOnly.optional(),
    to: dateOnly.optional(),
    status: z.enum(['effective', 'cancelled']).optional(),
    method: z.enum(['scan', 'backfill']).optional(),
    planId: z.string().min(1).max(128).optional(),
    sessionId: z.string().min(1).max(128).optional(),
    membershipId: z.string().min(1).max(128).optional(),
    userId: z.string().min(1).max(128).optional(),
  })
  .strict()
  .refine((q) => !q.from || !q.to || q.from <= q.to, 'Invalid date range');
type Query = z.infer<typeof historyQuery>;
@Injectable()
export class HistoryService {
  constructor(@Inject(PrismaService) private readonly db: PrismaService) {}
  async list(actor: Actor, q: Query, scope: 'admin' | 'staff' | 'own') {
    const own = scope === 'own';
    if (!own && actor.role !== scope) throw new ForbiddenException();
    if (own && q.userId !== undefined)
      throw new BadRequestException({
        code: 'INVALID_INPUT',
        message: 'Owner is determined by the authenticated account.',
      });
    let after: { at: string; id: string } | undefined;
    if (q.cursor) {
      try {
        after = parse(
          z
            .object({ at: z.iso.datetime(), id: z.string().min(1).max(128) })
            .strict(),
          JSON.parse(Buffer.from(q.cursor, 'base64url').toString()),
        );
      } catch {
        throw new BadRequestException({
          code: 'INVALID_INPUT',
          message: 'Invalid history cursor.',
        });
      }
    }
    const where: Prisma.AttendanceWhereInput = {
      ...(own ? { userId: actor.id } : q.userId ? { userId: q.userId } : {}),
      ...(q.planId ? { planId: q.planId } : {}),
      ...(q.sessionId ? { sessionId: q.sessionId } : {}),
      ...(q.membershipId ? { membershipId: q.membershipId } : {}),
      ...(q.method ? { method: q.method } : {}),
      ...(q.status
        ? { cancelledAt: q.status === 'effective' ? null : { not: null } }
        : {}),
      ...(q.from || q.to
        ? {
            session: {
              meetupDate: {
                ...(q.from ? { gte: new Date(q.from + 'T00:00:00Z') } : {}),
                ...(q.to ? { lte: new Date(q.to + 'T00:00:00Z') } : {}),
              },
            },
          }
        : {}),
      AND: [
        ...(scope === 'staff'
          ? [{ session: { assignments: { some: { userId: actor.id } } } }]
          : []),
        ...(after
          ? [
              {
                OR: [
                  { occurredAt: { lt: new Date(after.at) } },
                  { occurredAt: new Date(after.at), id: { lt: after.id } },
                ],
              },
            ]
          : []),
        ...(q.search
          ? [
              {
                OR: [
                  {
                    member: {
                      name: {
                        contains: q.search,
                        mode: 'insensitive' as const,
                      },
                    },
                  },
                  ...(/^(?:MOE-)?[0-9]{1,9}$/i.test(q.search)
                    ? [
                        {
                          member: {
                            profile: {
                              memberNumber: Number(
                                q.search.replace(/^MOE-/i, ''),
                              ),
                            },
                          },
                        },
                      ]
                    : []),
                  {
                    session: {
                      name: {
                        contains: q.search,
                        mode: 'insensitive' as const,
                      },
                    },
                  },
                  {
                    membership: {
                      plan: {
                        name: {
                          contains: q.search,
                          mode: 'insensitive' as const,
                        },
                      },
                    },
                  },
                ],
              },
            ]
          : []),
      ],
    };
    const rows = await this.db.client.attendance.findMany({
      where,
      take: q.limit + 1,
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
      select: {
        id: true,
        membershipId: true,
        occurredAt: true,
        recordedAt: true,
        method: true,
        cancelledAt: true,
        cancellationReason: true,
        member: {
          select: {
            id: true,
            name: true,
            profile: { select: { memberNumber: true } },
          },
        },
        membership: { select: { plan: { select: { id: true, name: true } } } },
        session: { select: { id: true, name: true, meetupDate: true } },
        recorder: { select: { id: true, name: true } },
        canceller: { select: { id: true, name: true } },
      },
    });
    const page = rows.slice(0, q.limit),
      last = page.at(-1);
    return {
      items: page.map((r) => ({
        id: r.id,
        membershipId: r.membershipId,
        occurredAt: r.occurredAt.toISOString(),
        recordedAt: r.recordedAt.toISOString(),
        method: r.method,
        status: r.cancelledAt ? 'cancelled' : 'effective',
        member: {
          id: r.member.id,
          name: r.member.name,
          memberNumber: r.member.profile
            ? `MOE-${String(r.member.profile.memberNumber).padStart(6, '0')}`
            : '',
        },
        plan: r.membership.plan,
        session: {
          ...r.session,
          meetupDate: r.session.meetupDate.toISOString().slice(0, 10),
        },
        recordedBy: r.recorder,
        cancellation: r.cancelledAt
          ? {
              at: r.cancelledAt.toISOString(),
              reason: r.cancellationReason,
              by: r.canceller,
            }
          : null,
      })),
      nextCursor:
        rows.length > q.limit && last
          ? Buffer.from(
              JSON.stringify({
                at: last.occurredAt.toISOString(),
                id: last.id,
              }),
            ).toString('base64url')
          : null,
    };
  }
}
