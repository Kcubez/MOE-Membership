import { createHmac, timingSafeEqual } from 'node:crypto';
import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { z } from 'zod';
import QRCode from 'qrcode';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { QrService } from '../qr/qr.service.js';
import { MembershipsService } from '../memberships/memberships.service.js';
import { HistoryService } from '../attendance/history.service.js';
import type { Actor } from '../common/domain/access.js';

export const telegramAction = z.enum(['qr', 'plan', 'history']);
type Action = z.infer<typeof telegramAction>;
const labels = {
  qr: 'Show my QR code',
  plan: 'My plan',
  history: 'Attendance history',
} as const;
const telegramId = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const update = z.object({
  update_id: z.number().int(),
  message: z
    .object({
      text: z.string().optional(),
      chat: z.object({ type: z.string(), id: z.number().int() }),
      from: z.object({ id: telegramId, is_bot: z.boolean() }).optional(),
    })
    .optional(),
});

function config() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const linkUrl = process.env.TELEGRAM_LINK_URL;
  if (!token || !secret || !linkUrl || !/^https:\/\//.test(linkUrl))
    throw new ServiceUnavailableException('Telegram bot is not configured.');
  return { token, secret, linkUrl };
}

function equal(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function verifyTelegramUser(initData: string, token: string) {
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  const authDate = Number(params.get('auth_date'));
  const age = Math.floor(Date.now() / 1000) - authDate;
  if (
    !hash ||
    !Number.isSafeInteger(authDate) ||
    age < -30 ||
    age > 300 ||
    new Set(params.keys()).size !== params.size
  )
    throw new UnauthorizedException();
  params.delete('hash');
  params.sort();
  const key = createHmac('sha256', 'WebAppData').update(token).digest();
  const signed = Array.from(params, ([name, value]) => name + '=' + value).join(
    '\n',
  );
  if (!equal(hash, createHmac('sha256', key).update(signed).digest('hex')))
    throw new UnauthorizedException();
  try {
    return String(telegramId.parse(JSON.parse(params.get('user') || '').id));
  } catch {
    throw new UnauthorizedException();
  }
}

@Injectable()
export class TelegramService {
  constructor(
    @Inject(PrismaService) private readonly db: PrismaService,
    @Inject(QrService) private readonly qr: QrService,
    @Inject(MembershipsService)
    private readonly memberships: MembershipsService,
    @Inject(HistoryService) private readonly history: HistoryService,
  ) {}

  async webhook(secret: string | undefined, body: unknown) {
    if (!secret || !equal(secret, config().secret))
      throw new ForbiddenException();
    const result = update.safeParse(body);
    const message = result.success ? result.data.message : undefined;
    if (
      message?.chat.type !== 'private' ||
      !message.from ||
      message.from.is_bot ||
      message.chat.id !== message.from.id ||
      !message.text
    )
      return { ok: true };
    const id = String(message.from.id);
    const action = telegramAction.options.find(
      (key) => labels[key] === message.text,
    );
    if (message.text === '/start') {
      await this.send(id, 'Choose what you want to see.', {
        keyboard: [[labels.qr, labels.plan], [labels.history]],
        resize_keyboard: true,
        is_persistent: true,
      });
    } else if (message.text === '/unlink') {
      await this.db.client.telegramMemberLink.deleteMany({
        where: { telegramId: id },
      });
      await this.send(id, 'Your MOE account is disconnected from Telegram.');
    } else if (action && !(await this.deliver(id, action))) {
      const url = new URL(config().linkUrl);
      url.searchParams.set('action', action);
      await this.send(id, 'Sign in to MOE once to link your member account.', {
        inline_keyboard: [
          [{ text: 'Link MOE account', web_app: { url: url.toString() } }],
        ],
      });
    }
    return { ok: true };
  }

  async link(actor: Actor, initData: string, action?: Action) {
    const id = verifyTelegramUser(initData, config().token);
    try {
      await this.db.client.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM moe_auth_user WHERE id=${actor.id} FOR UPDATE`;
        const user = await tx.authUser.findUnique({ where: { id: actor.id } });
        const session = await tx.authSession.findUnique({
          where: { id: actor.sessionId },
        });
        if (
          !session ||
          !user ||
          session.userId !== user.id ||
          session.expiresAt <= new Date() ||
          session.authVersion !== user.authVersion ||
          user.authVersion !== actor.authVersion
        )
          throw new UnauthorizedException();
        if (!user.enabled || user.role !== 'member' || user.mustChangePassword)
          throw new ForbiddenException();
        const existing = await tx.telegramMemberLink.findUnique({
          where: { telegramId: id },
        });
        if (existing && existing.userId !== user.id)
          throw new ConflictException('Telegram is already linked.');
        if (existing) {
          await tx.telegramMemberLink.update({
            where: { telegramId: id },
            data: { authVersion: user.authVersion },
          });
        } else {
          await tx.telegramMemberLink.create({
            data: {
              telegramId: id,
              userId: user.id,
              authVersion: user.authVersion,
            },
          });
        }
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      )
        throw new ConflictException(
          'An account is already linked. Disconnect it before linking again.',
        );
      throw error;
    }
    if (!action) return { delivered: false };
    try {
      return { delivered: await this.deliver(id, action) };
    } catch {
      return { delivered: false };
    }
  }

  private async deliver(id: string, action: Action) {
    const link = await this.db.client.telegramMemberLink.findUnique({
      where: { telegramId: id },
      include: {
        user: {
          select: {
            id: true,
            enabled: true,
            role: true,
            mustChangePassword: true,
            authVersion: true,
          },
        },
      },
    });
    if (
      !link ||
      !link.user.enabled ||
      link.user.role !== 'member' ||
      link.user.mustChangePassword ||
      link.user.authVersion !== link.authVersion
    )
      return false;
    const user = link.user;
    if (action === 'qr') {
      const qr = await this.qr.own(user.id);
      const png = await QRCode.toBuffer(qr.payload, { width: 400 });
      const form = new FormData();
      form.set('chat_id', id);
      form.set('protect_content', 'true');
      form.set(
        'photo',
        new Blob([Uint8Array.from(png)], { type: 'image/png' }),
        'moe-qr.png',
      );
      await this.callTelegram('sendPhoto', form);
    } else if (action === 'plan') {
      const { items, nextCursor } = await this.memberships.list(
        { limit: 5, status: 'Active' },
        user.id,
      );
      const lines = items.map(
        (item) =>
          item.plan.name.slice(0, 120) +
          ' · ' +
          item.remainingVisits +
          ' visits left · through ' +
          item.endDate,
      );
      if (nextCursor) lines.push('Open MOE to see all plans.');
      await this.send(id, lines.join('\n') || 'You have no active plans.');
    } else {
      const { items } = await this.history.list(
        { id: user.id, role: user.role },
        { limit: 5, status: 'effective' },
        'own',
      );
      await this.send(
        id,
        items
          .map(
            (item) =>
              item.session.meetupDate + ' · ' + item.session.name.slice(0, 120),
          )
          .join('\n') || 'No attendance recorded yet.',
      );
    }
    return true;
  }

  private send(id: string, message: string, keyboard?: object) {
    return this.callTelegram(
      'sendMessage',
      JSON.stringify({
        chat_id: id,
        text: message,
        protect_content: true,
        reply_markup: keyboard,
      }),
    );
  }

  private async callTelegram(
    method: 'sendMessage' | 'sendPhoto',
    body: string | FormData,
  ) {
    const { token } = config();
    try {
      const response = await fetch(
        'https://api.telegram.org/bot' + token + '/' + method,
        {
          method: 'POST',
          body,
          headers:
            typeof body === 'string'
              ? { 'Content-Type': 'application/json' }
              : undefined,
          signal: AbortSignal.timeout(5000),
        },
      );
      if (response.ok && (await response.json()).ok === true) return;
    } catch {
      // Avoid including the request URL, which contains the bot token.
    }
    throw new ServiceUnavailableException(
      'Telegram reply temporarily unavailable.',
    );
  }
}
