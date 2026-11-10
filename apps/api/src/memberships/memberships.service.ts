import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { Membership, Prisma } from '../generated/prisma/client.js';
import { assertWrite, audit, type Actor } from '../common/domain/access.js';
import {
  dates,
  conflict,
  membershipStatus,
  yangonToday,
} from '../common/domain/rules.js';
const include = {
  user: {
    select: {
      id: true,
      name: true,
      phone: true,
      profile: { select: { memberNumber: true } },
    },
  },
  plan: true,
} as const;
type Item = Prisma.MembershipGetPayload<{ include: typeof include }>;
function view(item: Item) {
  return {
    ...item,
    startDate: item.startDate.toISOString().slice(0, 10),
    endDate: item.endDate.toISOString().slice(0, 10),
    status: membershipStatus(item),
    remainingVisits: item.totalVisits - item.usedVisits,
  };
}
function snapshot(item: Membership) {
  return {
    userId: item.userId,
    planId: item.planId,
    startDate: item.startDate.toISOString().slice(0, 10),
    endDate: item.endDate.toISOString().slice(0, 10),
    totalVisits: item.totalVisits,
    usedVisits: item.usedVisits,
    version: item.version,
    cancelledAt: item.cancelledAt?.toISOString() || null,
    cancellationReason: item.cancellationReason,
    renewedFromId: item.renewedFromId,
  };
}
export type AssignInput = {
  userId: string;
  planId: string;
  planVersion: number;
  startDate: string;
  endDate: string;
  reason: string;
};
@Injectable()
export class MembershipsService {
  constructor(@Inject(PrismaService) private readonly db: PrismaService) {}
  private statusWhere(status?: string): Prisma.MembershipWhereInput {
    const today = new Date(`${yangonToday()}T00:00:00.000Z`);
    const total = this.db.client.membership.fields.totalVisits;
    if (!status) return {};
    if (status === 'Cancelled') return { cancelledAt: { not: null } };
    if (status === 'Completed')
      return { cancelledAt: null, usedVisits: { gte: total } };
    const available = { cancelledAt: null, usedVisits: { lt: total } };
    return status === 'Expired'
      ? { ...available, endDate: { lt: today } }
      : status === 'Upcoming'
        ? { ...available, startDate: { gt: today } }
        : { ...available, startDate: { lte: today }, endDate: { gte: today } };
  }
  async list(
    query: {
      limit: number;
      cursor?: string;
      search?: string;
      planId?: string;
      userId?: string;
      status?: string;
    },
    owner?: string,
  ) {
    const items = await this.db.client.membership.findMany({
      where: {
        ...this.statusWhere(query.status),
        ...(owner || query.userId ? { userId: owner || query.userId } : {}),
        ...(query.planId ? { planId: query.planId } : {}),
        ...(query.search
          ? {
              OR: [
                {
                  user: {
                    name: {
                      contains: query.search,
                      mode: 'insensitive' as const,
                    },
                  },
                },
                { user: { phone: { contains: query.search } } },
                {
                  plan: {
                    name: {
                      contains: query.search,
                      mode: 'insensitive' as const,
                    },
                  },
                },
              ],
            }
          : {}),
      },
      include,
      orderBy: { id: 'asc' },
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });
    const more = items.length > query.limit;
    return {
      items: items.slice(0, query.limit).map(view),
      nextCursor: more ? items[query.limit - 1]!.id : null,
    };
  }
  async get(id: string, owner?: string) {
    const item = await this.db.client.membership.findFirst({
      where: { id, ...(owner ? { userId: owner } : {}) },
      include,
    });
    if (!item) throw new NotFoundException();
    return view(item);
  }
  async assign(actor: Actor, input: AssignInput, renewedFromId?: string) {
    const period = dates(input.startDate, input.endDate);
    return this.db.client.$transaction(
      async (tx) => {
        const admin = await assertWrite(tx, actor, input.userId);
        await tx.$queryRaw`SELECT id FROM plans WHERE id=${input.planId} FOR UPDATE`;
        const plan = await tx.plan.findUnique({ where: { id: input.planId } });
        const user = await tx.authUser.findUnique({
          where: { id: input.userId },
        });
        if (!plan || !user) throw new NotFoundException();
        if (user.role !== 'member')
          conflict(
            'INVALID_MEMBER_ROLE',
            'Memberships can only be assigned or renewed for member accounts.',
          );
        if (!user.enabled)
          conflict(
            'INVALID_STATE',
            'Cannot assign a membership to a disabled account.',
          );
        if (plan.archived || plan.trashedAt)
          conflict(
            'PLAN_ARCHIVED',
            'This plan is archived. Choose an available plan.',
          );
        if (plan.version !== input.planVersion)
          conflict(
            'PLAN_CHANGED',
            'The plan changed. Refresh and review its quota before assigning.',
          );
        if (renewedFromId) {
          await tx.$queryRaw`SELECT id FROM memberships WHERE id=${renewedFromId} FOR UPDATE`;
          const original = await tx.membership.findUnique({
            where: { id: renewedFromId },
          });
          if (
            !original ||
            original.userId !== input.userId ||
            original.planId !== input.planId
          )
            throw new NotFoundException();
        }
        const item = await tx.membership.create({
          data: {
            userId: input.userId,
            planId: input.planId,
            ...period,
            totalVisits: plan.totalVisits,
            renewedFromId: renewedFromId || null,
          },
          include,
        });
        await audit(
          tx,
          admin,
          'Membership',
          item.id,
          renewedFromId ? 'membership.renewed' : 'membership.assigned',
          input.reason,
          undefined,
          snapshot(item),
        );
        return view(item);
      },
      { maxWait: 5000, timeout: 15000 },
    );
  }
  async renew(
    actor: Actor,
    id: string,
    input: {
      startDate: string;
      endDate: string;
      planVersion: number;
      reason: string;
    },
  ) {
    const original = await this.db.client.membership.findUnique({
      where: { id },
      select: { userId: true, planId: true },
    });
    if (!original) throw new NotFoundException();
    return this.assign(actor, { ...input, ...original }, id);
  }
  async update(
    actor: Actor,
    id: string,
    input: {
      startDate: string;
      endDate: string;
      totalVisits: number;
      version: number;
      reason: string;
    },
  ) {
    const period = dates(input.startDate, input.endDate);
    const reference = await this.db.client.membership.findUnique({
      where: { id },
      select: { userId: true, planId: true },
    });
    if (!reference) throw new NotFoundException();
    return this.db.client.$transaction(
      async (tx) => {
        const admin = await assertWrite(tx, actor, reference.userId);
        await tx.$queryRaw`SELECT id FROM plans WHERE id=${reference.planId} FOR UPDATE`;
        await tx.$queryRaw`SELECT id FROM memberships WHERE id=${id} FOR UPDATE`;
        const before = await tx.membership.findUnique({ where: { id } });
        if (!before) throw new NotFoundException();
        if (before.cancelledAt)
          conflict(
            'INVALID_STATE',
            'Cancelled memberships cannot be edited. Create a replacement.',
          );
        if (before.version !== input.version)
          conflict(
            'VERSION_CONFLICT',
            'This membership changed. Refresh before editing.',
          );
        if (input.totalVisits < before.usedVisits)
          conflict(
            'QUOTA_BELOW_USED',
            'Total visits cannot be less than visits already used.',
          );
        const outside = await tx.attendance.count({
          where: {
            membershipId: id,
            cancelledAt: null,
            session: {
              OR: [
                { meetupDate: { lt: period.startDate } },
                { meetupDate: { gt: period.endDate } },
              ],
            },
          },
        });
        if (outside)
          conflict(
            'ATTENDANCE_OUTSIDE_PERIOD',
            'The period cannot exclude existing attendance.',
          );
        const after = await tx.membership.update({
          where: { id },
          data: {
            ...period,
            totalVisits: input.totalVisits,
            version: { increment: 1 },
            updatedAt: new Date(),
          },
          include,
        });
        await audit(
          tx,
          admin,
          'Membership',
          id,
          'membership.updated',
          input.reason,
          snapshot(before),
          snapshot(after),
        );
        return view(after);
      },
      { maxWait: 5000, timeout: 15000 },
    );
  }
  async cancel(
    actor: Actor,
    id: string,
    input: { version: number; reason: string },
  ) {
    const reference = await this.db.client.membership.findUnique({
      where: { id },
      select: { userId: true, planId: true },
    });
    if (!reference) throw new NotFoundException();
    return this.db.client.$transaction(
      async (tx) => {
        const admin = await assertWrite(tx, actor, reference.userId);
        await tx.$queryRaw`SELECT id FROM plans WHERE id=${reference.planId} FOR UPDATE`;
        await tx.$queryRaw`SELECT id FROM memberships WHERE id=${id} FOR UPDATE`;
        const before = await tx.membership.findUnique({
          where: { id },
          include,
        });
        if (!before) throw new NotFoundException();
        if (before.cancelledAt) return view(before);
        if (before.version !== input.version)
          conflict(
            'VERSION_CONFLICT',
            'This membership changed. Refresh before cancelling.',
          );
        const after = await tx.membership.update({
          where: { id },
          data: {
            cancelledAt: new Date(),
            cancellationReason: input.reason,
            version: { increment: 1 },
            updatedAt: new Date(),
          },
          include,
        });
        await audit(
          tx,
          admin,
          'Membership',
          id,
          'membership.cancelled',
          input.reason,
          snapshot(before),
          snapshot(after),
        );
        return view(after);
      },
      { maxWait: 5000, timeout: 15000 },
    );
  }
  async history(id: string) {
    await this.get(id);
    return {
      items: await this.db.client.domainAudit.findMany({
        where: { entityType: 'Membership', entityId: id },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 100,
      }),
    };
  }
}
