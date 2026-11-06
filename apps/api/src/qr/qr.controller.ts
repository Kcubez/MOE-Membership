import {
  Controller,
  Get,
  Post,
  Req,
  Param,
  Body,
  UseGuards,
  UseFilters,
  Inject,
  Header,
  HttpCode,
} from '@nestjs/common';
import { z } from 'zod';
import {
  SessionGuard,
  type AuthenticatedRequest,
} from '../auth/session.guard.js';
import { AdminGuard } from '../auth/roles.guard.js';
import { DomainExceptionFilter } from '../common/domain/errors.js';
import { parse, version, reason } from '../common/domain/rules.js';
import { QrService } from './qr.service.js';
@Controller('members/me/qr')
@UseGuards(SessionGuard)
@UseFilters(DomainExceptionFilter)
export class PersonalQrController {
  constructor(@Inject(QrService) private readonly service: QrService) {}
  @Get() @Header('Cache-Control', 'private, no-store') own(
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.own(req.actor.id);
  }
}
@Controller('admin/users/:id/qr')
@UseGuards(SessionGuard, AdminGuard)
@UseFilters(DomainExceptionFilter)
export class AdminQrController {
  constructor(@Inject(QrService) private readonly service: QrService) {}
  @Get() @Header('Cache-Control', 'private, no-store') metadata(
    @Param('id') id: string,
  ) {
    return this.service.metadata(id);
  }
  @Post('regenerate')
  @HttpCode(200)
  @Header('Cache-Control', 'private, no-store')
  regenerate(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.service.regenerate(
      req.actor,
      id,
      parse(z.object({ version, reason }).strict(), body),
    );
  }
  @Get('audit') @Header('Cache-Control', 'private, no-store') history(
    @Param('id') id: string,
  ) {
    return this.service.history(id);
  }
}
