import {
  Injectable,
  Inject,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import { assertWrite, audit, type Actor } from '../common/domain/access.js';
import { conflict } from '../common/domain/rules.js';
const select = {
  id: true,
  name: true,
  planId: true,
  meetupDate: true,
  open: true,
  version: true,
  createdAt: true,
  updatedAt: true,
  plan: { select: { id: true, name: true, archived: true } },
  assignments: {
    select: {
      user: { select: { id: true, name: true, enabled: true, role: true } },
    },
    orderBy: { userId: 'asc' as const },
  },
} as const;
type Item = Prisma.MeetupSessionGetPayload<{ select: typeof select }>;
function view(item: Item, admin: boolean) {
  const { assignments, ...data } = item;
  return {
    ...data,
    meetupDate: item.meetupDate.toISOString().slice(0, 10),
    ...(admin ? { staff: assignments.map((value) => value.user) } : {}),
  };
}
function snapshot(item: Item) {
  return {
    name: item.name,
    planId: item.planId,
    meetupDate: item.meetupDate.toISOString().slice(0, 10),
    open: item.open,
    version: item.version,
    staffIds: item.assignments.map((value) => value.user.id),
    staffNames: item.assignments.map((value) => value.user.name),
  };
}
export type SessionQuery = {
  limit: number;
  cursor?: string;
  search?: string;
  planId?: string;
  open?: boolean;
  from?: string;
  to?: string;
};
export type SessionCreate = {
  name: string;
  planId: string;
  meetupDate: string;
  open: boolean;
  staffIds: string[];
  reason: string;
};
@Injectable()
export class MeetupSessionsService {
  constructor(@Inject(PrismaService) private readonly db: PrismaService) {}
  private scope(actor: Actor): Prisma.MeetupSessionWhereInput {
    if (actor.role === 'admin') return {};
    if (actor.role === 'staff')
      return { assignments: { some: { userId: actor.id } } };
    throw new ForbiddenException();
  }
  async list(actor: Actor, query: SessionQuery) {
    const items = await this.db.client.meetupSession.findMany({
      where: {
        ...this.scope(actor),
        ...(query.search
          ? {
              OR: [
                { name: { contains: query.search, mode: 'insensitive' } },
                {
                  plan: {
                    name: { contains: query.search, mode: 'insensitive' },
                  },
                },
              ],
            }
          : {}),
        ...(query.planId ? { planId: query.planId } : {}),
        ...(query.open === undefined ? {} : { open: query.open }),
        ...(query.from || query.to
          ? {
              meetupDate: {
                ...(query.from
                  ? { gte: new Date(query.from + 'T00:00Z') }
                  : {}),
                ...(query.to ? { lte: new Date(query.to + 'T00:00Z') } : {}),
              },
            }
          : {}),
      },
      select: {
        ...select,
        assignments: {
          ...select.assignments,
          ...(actor.role === 'admin' ? {} : { where: { userId: actor.id } }),
        },
      },
      orderBy: { id: 'asc' },
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });
    return {
      items: items
        .slice(0, query.limit)
        .map((item) => view(item, actor.role === 'admin')),
      nextCursor:
        items.length > query.limit ? items[query.limit - 1]!.id : null,
    };
  }
  async get(actor: Actor, id: string) {
    const item = await this.db.client.meetupSession.findFirst({
      where: { id, ...this.scope(actor) },
      select: {
        ...select,
        assignments: {
          ...select.assignments,
          ...(actor.role === 'admin' ? {} : { where: { userId: actor.id } }),
        },
      },
    });
    if (!item) throw new NotFoundException();
    return view(item, actor.role === 'admin');
  }
  private async lockStaff(
    tx: Prisma.TransactionClient,
    actor: Actor,
    ids: string[],
  ) {
    for (const id of [...new Set([actor.id, ...ids])].sort())
      await tx.$queryRaw`SELECT id FROM moe_auth_user WHERE id=${id} FOR UPDATE`;
    const admin = await assertWrite(tx, actor);
    const count = await tx.authUser.count({
      where: { id: { in: ids }, role: 'staff', enabled: true },
    });
    if (count !== ids.length)
      conflict(
        'INVALID_STAFF',
        'Choose enabled staff accounts only. Refresh the staff list.',
      );
    return admin;
  }
  async create(actor: Actor, input: SessionCreate) {
    return this.db.client.$transaction(
      async (tx) => {
        const admin = await this.lockStaff(tx, actor, input.staffIds);
        await tx.$queryRaw`SELECT id FROM plans WHERE id=${input.planId} FOR UPDATE`;
        const plan = await tx.plan.findUnique({ where: { id: input.planId } });
        if (!plan) throw new NotFoundException();
        if (plan.archived || plan.trashedAt)
          conflict(
            'PLAN_ARCHIVED',
            'This plan is archived. Choose an available plan.',
          );
        const item = await tx.meetupSession.create({
          data: {
            name: input.name,
            planId: input.planId,
            meetupDate: new Date(input.meetupDate + 'T00:00Z'),
            open: input.open,
            assignments: {
              create: input.staffIds.map((userId) => ({ userId })),
            },
          },
          select,
        });
        await audit(
          tx,
          admin,
          'MeetupSession',
          item.id,
          'session.created',
          input.reason,
          undefined,
          snapshot(item),
        );
        return view(item, true);
      },
      { maxWait: 5000, timeout: 15000 },
    );
  }
  async changeState(
    actor: Actor,
    id: string,
    input: { open: boolean; version: number; reason: string },
  ) {
    return this.db.client.$transaction(
      async (tx) => {
        const admin = await assertWrite(tx, actor);
        await tx.$queryRaw`SELECT id FROM meetup_sessions WHERE id=${id} FOR UPDATE`;
        const before = await tx.meetupSession.findUnique({
          where: { id },
          select,
        });
        if (!before) throw new NotFoundException();
        if (before.version !== input.version)
          conflict(
            'VERSION_CONFLICT',
            'This session changed. Refresh before editing.',
          );
        if (before.open === input.open) return view(before, true);
        const after = await tx.meetupSession.update({
          where: { id },
          data: {
            open: input.open,
            version: { increment: 1 },
            updatedAt: new Date(),
          },
          select,
        });
        await audit(
          tx,
          admin,
          'MeetupSession',
          id,
          input.open ? 'session.opened' : 'session.closed',
          input.reason,
          snapshot(before),
          snapshot(after),
        );
        return view(after, true);
      },
      { maxWait: 5000, timeout: 15000 },
    );
  }
  async replaceStaff(
    actor: Actor,
    id: string,
    input: { staffIds: string[]; version: number; reason: string },
  ) {
    return this.db.client.$transaction(
      async (tx) => {
        const admin = await this.lockStaff(tx, actor, input.staffIds);
        await tx.$queryRaw`SELECT id FROM meetup_sessions WHERE id=${id} FOR UPDATE`;
        const before = await tx.meetupSession.findUnique({
          where: { id },
          select,
        });
        if (!before) throw new NotFoundException();
        if (before.version !== input.version)
          conflict(
            'VERSION_CONFLICT',
            'This session changed. Refresh before editing.',
          );
        if (
          JSON.stringify(
            before.assignments.map((value) => value.user.id).sort(),
          ) === JSON.stringify([...input.staffIds].sort())
        )
          return view(before, true);
        await tx.meetupStaff.deleteMany({ where: { sessionId: id } });
        await tx.meetupStaff.createMany({
          data: input.staffIds.map((userId) => ({ sessionId: id, userId })),
        });
        const after = await tx.meetupSession.update({
          where: { id },
          data: { version: { increment: 1 }, updatedAt: new Date() },
          select,
        });
        await audit(
          tx,
          admin,
          'MeetupSession',
          id,
          'session.staff_changed',
          input.reason,
          snapshot(before),
          snapshot(after),
        );
        return view(after, true);
      },
      { maxWait: 5000, timeout: 15000 },
    );
  }
  async history(actor: Actor, id: string) {
    if (actor.role !== 'admin') throw new ForbiddenException();
    await this.get(actor, id);
    return {
      items: await this.db.client.domainAudit.findMany({
        where: { entityType: 'MeetupSession', entityId: id },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 100,
      }),
    };
  }
}
