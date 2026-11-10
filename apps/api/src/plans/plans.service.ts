import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { assertWrite, audit, type Actor } from '../common/domain/access.js';
import { conflict } from '../common/domain/rules.js';
export type PlanInput = {
  name: string;
  description: string;
  benefits: string;
  totalVisits: number;
  reason: string;
};
@Injectable()
export class PlansService {
  constructor(@Inject(PrismaService) private readonly db: PrismaService) {}
  async list(query: {
    limit: number;
    cursor?: string;
    search?: string;
    archived?: boolean;
    trash?: 'true';
  }) {
    const items = await this.db.client.plan.findMany({
      where: {
        trashedAt: query.trash ? { not: null } : null,
        ...(query.search
          ? { name: { contains: query.search, mode: 'insensitive' as const } }
          : {}),
        ...(query.archived !== undefined ? { archived: query.archived } : {}),
      },
      include: {
        _count: { select: { memberships: true, meetupSessions: true } },
      },
      orderBy: { id: 'asc' },
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });
    const more = items.length > query.limit;
    return {
      items: items.slice(0, query.limit),
      nextCursor: more ? items[query.limit - 1]!.id : null,
    };
  }
  async get(id: string) {
    const plan = await this.db.client.plan.findUnique({
      where: { id },
      include: {
        _count: { select: { memberships: true, meetupSessions: true } },
      },
    });
    if (!plan) throw new NotFoundException();
    return plan;
  }
  async create(actor: Actor, input: PlanInput) {
    return this.db.client.$transaction(async (tx) => {
      const admin = await assertWrite(tx, actor);
      const { reason, ...data } = input;
      const plan = await tx.plan.create({ data });
      await audit(
        tx,
        admin,
        'Plan',
        plan.id,
        'plan.created',
        reason,
        undefined,
        JSON.parse(JSON.stringify(plan)),
      );
      return plan;
    });
  }
  async update(
    actor: Actor,
    id: string,
    input: PlanInput & { version: number },
  ) {
    return this.db.client.$transaction(async (tx) => {
      const admin = await assertWrite(tx, actor);
      await tx.$queryRaw`SELECT id FROM plans WHERE id=${id} FOR UPDATE`;
      const before = await tx.plan.findUnique({ where: { id } });
      if (!before) throw new NotFoundException();
      if (before.trashedAt)
        conflict('PLAN_IN_TRASH', 'Restore this plan from Trash first.');
      if (before.version !== input.version)
        conflict(
          'VERSION_CONFLICT',
          'This plan changed. Refresh before editing.',
        );
      const { reason, version: _version, ...data } = input;
      void _version;
      const after = await tx.plan.update({
        where: { id },
        data: { ...data, version: { increment: 1 }, updatedAt: new Date() },
      });
      await audit(
        tx,
        admin,
        'Plan',
        id,
        'plan.updated',
        reason,
        JSON.parse(JSON.stringify(before)),
        JSON.parse(JSON.stringify(after)),
      );
      return after;
    });
  }
  async availability(
    actor: Actor,
    id: string,
    input: { archived: boolean; version: number; reason: string },
  ) {
    return this.db.client.$transaction(async (tx) => {
      const admin = await assertWrite(tx, actor);
      await tx.$queryRaw`SELECT id FROM plans WHERE id=${id} FOR UPDATE`;
      const before = await tx.plan.findUnique({ where: { id } });
      if (!before) throw new NotFoundException();
      if (before.trashedAt)
        conflict('PLAN_IN_TRASH', 'Restore this plan from Trash first.');
      if (before.archived === input.archived) return before;
      if (before.version !== input.version)
        conflict(
          'VERSION_CONFLICT',
          'This plan changed. Refresh before editing.',
        );
      const after = await tx.plan.update({
        where: { id },
        data: {
          archived: input.archived,
          version: { increment: 1 },
          updatedAt: new Date(),
        },
      });
      await audit(
        tx,
        admin,
        'Plan',
        id,
        input.archived ? 'plan.archived' : 'plan.restored',
        input.reason,
        JSON.parse(JSON.stringify(before)),
        JSON.parse(JSON.stringify(after)),
      );
      return after;
    });
  }
  async trash(
    actor: Actor,
    id: string,
    input: {
      action: 'move' | 'restore' | 'delete';
      version: number;
      reason: string;
    },
  ) {
    return this.db.client.$transaction(async (tx) => {
      const admin = await assertWrite(tx, actor);
      await tx.$queryRaw`SELECT id FROM plans WHERE id=${id} FOR UPDATE`;
      const before = await tx.plan.findUnique({
        where: { id },
        include: {
          _count: { select: { memberships: true, meetupSessions: true } },
        },
      });
      if (!before) throw new NotFoundException();
      if (before.version !== input.version)
        conflict(
          'VERSION_CONFLICT',
          'This plan changed. Refresh before editing.',
        );
      if (input.action === 'move' ? before.trashedAt : !before.trashedAt)
        conflict(
          'INVALID_TRASH_STATE',
          'This action is unavailable for the current plan state.',
        );
      const deleting = input.action === 'delete';
      if (
        deleting &&
        (before._count.memberships || before._count.meetupSessions)
      )
        conflict(
          'PLAN_IN_USE',
          'Plans linked to memberships or meetup sessions cannot be permanently deleted.',
        );
      const after = deleting
        ? null
        : await tx.plan.update({
            where: { id },
            data: {
              trashedAt: input.action === 'move' ? new Date() : null,
              version: { increment: 1 },
              updatedAt: new Date(),
            },
          });
      if (deleting) await tx.plan.delete({ where: { id } });
      await audit(
        tx,
        admin,
        'Plan',
        id,
        `plan.trash.${input.action}`,
        input.reason,
        JSON.parse(JSON.stringify(before)),
        after ? JSON.parse(JSON.stringify(after)) : undefined,
      );
      return { success: true };
    });
  }
  async history(id: string) {
    await this.get(id);
    return {
      items: await this.db.client.domainAudit.findMany({
        where: { entityType: 'Plan', entityId: id },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 100,
      }),
    };
  }
}
