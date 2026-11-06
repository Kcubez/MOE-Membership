import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client.js';
import type { AuthenticatedRequest } from '../../auth/session.guard.js';
export type Actor = AuthenticatedRequest['actor'];
export async function assertWrite(
  tx: Prisma.TransactionClient,
  actor: Actor,
  targetId = actor.id,
) {
  for (const id of [...new Set([actor.id, targetId])].sort())
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
  if (!user.enabled || user.role !== 'admin' || user.mustChangePassword)
    throw new ForbiddenException();
  return user;
}
export async function audit(
  tx: Prisma.TransactionClient,
  actor: { id: string; name: string },
  entityType:
    'Plan' | 'Membership' | 'MeetupSession' | 'MemberQr' | 'Attendance',
  entityId: string,
  action: string,
  reason: string,
  before: Prisma.InputJsonValue | undefined,
  after: Prisma.InputJsonValue,
) {
  await tx.domainAudit.create({
    data: {
      entityType,
      entityId,
      actorId: actor.id,
      actorName: actor.name,
      action,
      reason,
      ...(before ? { before } : {}),
      after,
    },
  });
}
