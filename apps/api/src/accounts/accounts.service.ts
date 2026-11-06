import {
  Injectable,
  Inject,
  ForbiddenException,
  UnauthorizedException,
  NotFoundException,
  ConflictException,
  HttpException,
  BadRequestException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuthService } from '../auth/auth.service.js';
import { normalizePhone, phoneIdentity } from '../auth/phone.js';
import type { AuthenticatedRequest } from '../auth/session.guard.js';
import type { Prisma } from '../generated/prisma/client.js';

type Actor = AuthenticatedRequest['actor'];
const publicFields = {
  id: true,
  name: true,
  phone: true,
  role: true,
  enabled: true,
  mustChangePassword: true,
} as const;
@Injectable()
export class AccountsService {
  constructor(
    @Inject(PrismaService) private readonly db: PrismaService,
    @Inject(AuthService) private readonly auth: AuthService,
  ) {}
  private async limit(actorId: string) {
    const now = BigInt(Date.now());
    const rows = await this.db.client.$queryRaw<
      { count: number }[]
    >`INSERT INTO moe_auth_rate_limit (id,key,count,"lastRequest") VALUES (${randomUUID()},${'account-write:' + actorId},1,${now}) ON CONFLICT (key) DO UPDATE SET count=CASE WHEN moe_auth_rate_limit."lastRequest" < ${now - 60000n} THEN 1 ELSE moe_auth_rate_limit.count+1 END, "lastRequest"=CASE WHEN moe_auth_rate_limit."lastRequest" < ${now - 60000n} THEN ${now} ELSE moe_auth_rate_limit."lastRequest" END RETURNING count`;
    if (rows[0]!.count > 20)
      throw new HttpException('Too many account changes', 429);
  }
  private async authorize(
    tx: Prisma.TransactionClient,
    actor: Actor,
    admin: boolean,
    targetId = actor.id,
  ) {
    const ids = [...new Set([actor.id, targetId])].sort();
    for (const id of ids)
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
      (admin && (user.role !== 'admin' || user.mustChangePassword))
    )
      throw new ForbiddenException();
    return user;
  }
  async summary() {
    const groups = await this.db.client.authUser.groupBy({
      by: ['role', 'enabled', 'mustChangePassword'],
      _count: { _all: true },
    });
    return groups.reduce(
      (result, group) => ({
        total: result.total + group._count._all,
        enabled: result.enabled + (group.enabled ? group._count._all : 0),
        staff: result.staff + (group.role === 'staff' ? group._count._all : 0),
        passwordChangesRequired:
          result.passwordChangesRequired +
          (group.mustChangePassword ? group._count._all : 0),
      }),
      { total: 0, enabled: 0, staff: 0, passwordChangesRequired: 0 },
    );
  }
  async list(
    limit: number,
    cursor?: string,
    search?: string,
    role?: 'admin' | 'staff' | 'member',
    enabled?: boolean,
  ) {
    const users = await this.db.client.authUser.findMany({
      select: publicFields,
      take: limit + 1,
      orderBy: { id: 'asc' },
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      where: {
        ...(role ? { role } : {}),
        ...(enabled !== undefined ? { enabled } : {}),
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' as const } },
                { phone: { contains: search } },
              ],
            }
          : {}),
      },
    });
    const hasMore = users.length > limit;
    const items = users.slice(0, limit);
    return { items, nextCursor: hasMore ? items[items.length - 1]!.id : null };
  }
  async create(
    actor: Actor,
    input: {
      name: string;
      phone: string;
      temporaryPassword: string;
      role: 'member' | 'staff';
      reason: string;
    },
  ) {
    await this.limit(actor.id);
    let phone: string;
    try {
      phone = normalizePhone(input.phone);
    } catch {
      throw new BadRequestException('Use a valid Myanmar phone number');
    }
    const context = await this.auth.getRuntime().auth.$context;
    const password = await context.password.hash(input.temporaryPassword);
    try {
      return await this.db.client.$transaction(async (tx) => {
        await this.authorize(tx, actor, true);
        // Serialize normalized-phone reuse, including two admin requests.
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${phone},0))::text`;
        const existing = await tx.authUser.findUnique({
          where: { phone },
          select: publicFields,
        });
        if (existing) return { user: existing, created: false };
        const id = randomUUID();
        const user = await tx.authUser.create({
          data: {
            id,
            name: input.name,
            phone,
            email: phoneIdentity(phone),
            emailVerified: false,
            role: input.role,
            enabled: true,
            mustChangePassword: true,
          },
          select: publicFields,
        });
        await tx.authAccount.create({
          data: {
            id: randomUUID(),
            userId: id,
            accountId: id,
            providerId: 'credential',
            password,
            updatedAt: new Date(),
          },
        });
        await tx.accountAudit.create({
          data: {
            actorId: actor.id,
            targetId: id,
            action: 'account.created',
            reason: input.reason,
            after: {
              role: input.role,
              enabled: true,
              mustChangePassword: true,
            },
          },
        });
        return { user, created: true };
      });
    } catch (error) {
      if (
        typeof error === 'object' &&
        error &&
        'code' in error &&
        error.code === 'P2002'
      )
        throw new ConflictException(
          'Phone already exists; retry to reuse existing account',
        );
      throw error;
    }
  }
  async changePassword(
    actor: Actor,
    currentPassword: string,
    newPassword: string,
  ) {
    await this.limit(actor.id);
    if (currentPassword === newPassword)
      throw new ConflictException('Choose a different password');
    const context = await this.auth.getRuntime().auth.$context;
    const hash = await context.password.hash(newPassword);
    await this.db.client.$transaction(
      async (tx) => {
        await this.authorize(tx, actor, false);
        const credential = await tx.authAccount.findFirst({
          where: { userId: actor.id, providerId: 'credential' },
        });
        if (
          !credential?.password ||
          !(await context.password.verify({
            hash: credential.password,
            password: currentPassword,
          }))
        )
          throw new UnauthorizedException('Current password is incorrect');
        await tx.authAccount.update({
          where: { id: credential.id },
          data: { password: hash, updatedAt: new Date() },
        });
        await tx.authUser.update({
          where: { id: actor.id },
          data: {
            mustChangePassword: false,
            authVersion: { increment: 1 },
            updatedAt: new Date(),
          },
        });
        await tx.authSession.deleteMany({ where: { userId: actor.id } });
        await tx.accountAudit.create({
          data: {
            actorId: actor.id,
            targetId: actor.id,
            action: 'password.changed',
            reason: 'User changed own password',
          },
        });
      },
      { timeout: 15000 },
    );
    return { success: true, signInRequired: true };
  }
  async reset(
    actor: Actor,
    targetId: string,
    temporaryPassword: string,
    reason: string,
  ) {
    await this.limit(actor.id);
    const context = await this.auth.getRuntime().auth.$context;
    const hash = await context.password.hash(temporaryPassword);
    await this.db.client.$transaction(
      async (tx) => {
        await this.authorize(tx, actor, true, targetId);
        const target = await tx.authUser.findUnique({
          where: { id: targetId },
        });
        if (!target) throw new NotFoundException();
        const credential = await tx.authAccount.findFirst({
          where: { userId: targetId, providerId: 'credential' },
        });
        if (!credential)
          throw new ConflictException('Credential account missing');
        if (
          credential.password &&
          (await context.password.verify({
            hash: credential.password,
            password: temporaryPassword,
          }))
        )
          throw new ConflictException('Choose a different temporary password');
        await tx.authAccount.update({
          where: { id: credential.id },
          data: { password: hash, updatedAt: new Date() },
        });
        await tx.authUser.update({
          where: { id: targetId },
          data: {
            mustChangePassword: true,
            authVersion: { increment: 1 },
            updatedAt: new Date(),
          },
        });
        await tx.authSession.deleteMany({ where: { userId: targetId } });
        await tx.accountAudit.create({
          data: {
            actorId: actor.id,
            targetId,
            action: 'password.reset',
            reason,
            after: { mustChangePassword: true, identityVerified: true },
          },
        });
      },
      { timeout: 15000 },
    );
    return { success: true };
  }
  async access(
    actor: Actor,
    targetId: string,
    enabled: boolean,
    role: 'member' | 'staff',
    reason: string,
  ) {
    await this.limit(actor.id);
    return this.db.client.$transaction(async (tx) => {
      await this.authorize(tx, actor, true, targetId);
      const target = await tx.authUser.findUnique({ where: { id: targetId } });
      if (!target) throw new NotFoundException();
      if (target.role === 'admin' || targetId === actor.id)
        throw new ForbiddenException(
          'Cannot alter an Admin through this endpoint',
        );
      const user = await tx.authUser.update({
        where: { id: targetId },
        data: {
          enabled,
          role,
          authVersion: { increment: 1 },
          updatedAt: new Date(),
        },
        select: publicFields,
      });
      await tx.authSession.deleteMany({ where: { userId: targetId } });
      await tx.accountAudit.create({
        data: {
          actorId: actor.id,
          targetId,
          action: 'account.access_changed',
          reason,
          before: { enabled: target.enabled, role: target.role },
          after: { enabled, role },
        },
      });
      return { user };
    });
  }
}
