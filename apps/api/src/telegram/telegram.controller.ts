import {
  Body,
  Controller,
  Headers,
  Header,
  HttpCode,
  Inject,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';
import {
  SessionGuard,
  type AuthenticatedRequest,
} from '../auth/session.guard.js';
import { parse } from '../common/domain/rules.js';
import { TelegramService, telegramAction } from './telegram.service.js';

@Controller('telegram')
export class TelegramController {
  constructor(
    @Inject(TelegramService) private readonly telegram: TelegramService,
  ) {}

  @Post('webhook')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  webhook(
    @Headers('x-telegram-bot-api-secret-token') secret: string | undefined,
    @Body() body: unknown,
  ) {
    return this.telegram.webhook(secret, body);
  }

  @Post('link')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @UseGuards(SessionGuard)
  link(@Req() req: AuthenticatedRequest, @Body() body: unknown) {
    const input = parse(
      z
        .object({
          initData: z.string().min(1).max(8192),
          action: telegramAction.optional(),
        })
        .strict(),
      body,
    );
    return this.telegram.link(req.actor, input.initData, input.action);
  }
}
