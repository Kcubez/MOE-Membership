import { qrSigningSecret } from './qr.config.js';
import {
  Injectable,
  Inject,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { assertWrite, audit, type Actor } from '../common/domain/access.js';
import { conflict } from '../common/domain/rules.js';
import { qrPayload } from './qr-codec.js';
@Injectable()
export class QrService {
  constructor(@Inject(PrismaService) private readonly db: PrismaService) {}
  async own(userId: string) {
    const row = await this.db.client.memberQr.findUnique({
      where: { userId },
      include: {
        user: {
          select: { name: true, profile: { select: { memberNumber: true } } },
        },
      },
    });
    if (!row || !row.user.profile)
      throw new ServiceUnavailableException('QR temporarily unavailable');
    const secret = qrSigningSecret();
    return {
      payload: qrPayload(row, secret),
      format: 'moe-member-v1' as const,
      version: row.version,
      updatedAt: row.updatedAt,
      name: row.user.name,
      memberNumber: `MOE-${String(row.user.profile.memberNumber).padStart(6, '0')}`,
    };
  }
  async metadata(userId: string) {
    const row = await this.db.client.memberQr.findUnique({
      where: { userId },
      select: { userId: true, version: true, updatedAt: true },
    });
    if (!row) throw new NotFoundException();
    return row;
  }
  async regenerate(
    actor: Actor,
    userId: string,
    input: { version: number; reason: string },
  ) {
    return this.db.client.$transaction(
      async (tx) => {
        const admin = await assertWrite(tx, actor, userId);
        await tx.$queryRaw`SELECT "userId" FROM member_qr WHERE "userId"=${userId} FOR UPDATE`;
        const before = await tx.memberQr.findUnique({
          where: { userId },
          select: { userId: true, version: true, updatedAt: true },
        });
        if (!before) throw new NotFoundException();
        if (before.version !== input.version)
          conflict(
            'VERSION_CONFLICT',
            'This QR changed. Refresh before regenerating.',
          );
        const after = await tx.memberQr.update({
          where: { userId },
          data: {
            credentialId: randomUUID(),
            version: { increment: 1 },
            updatedAt: new Date(),
          },
          select: { userId: true, version: true, updatedAt: true },
        });
        await audit(
          tx,
          admin,
          'MemberQr',
          userId,
          'qr.regenerated',
          input.reason,
          {
            version: before.version,
            updatedAt: before.updatedAt.toISOString(),
          },
          { version: after.version, updatedAt: after.updatedAt.toISOString() },
        );
        return after;
      },
      { maxWait: 5000, timeout: 15000 },
    );
  }
  async history(userId: string) {
    await this.metadata(userId);
    return {
      items: await this.db.client.domainAudit.findMany({
        where: { entityType: 'MemberQr', entityId: userId },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 100,
      }),
    };
  }
}
