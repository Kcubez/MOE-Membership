import { CancellationService } from './cancellation.service.js';
import { AdminGuard } from '../auth/roles.guard.js';
import {
  Controller,
  Post,
  Param,
  Body,
  Req,
  UseGuards,
  UseFilters,
  Inject,
  HttpCode,
  Header,
} from '@nestjs/common';
import { z } from 'zod';
import {
  SessionGuard,
  type AuthenticatedRequest,
} from '../auth/session.guard.js';
import { DomainExceptionFilter } from '../common/domain/errors.js';
import { parse, reason } from '../common/domain/rules.js';
import { AttendanceService } from './attendance.service.js';
@Controller()
@UseGuards(SessionGuard)
@UseFilters(DomainExceptionFilter)
export class AttendanceController {
  constructor(
    @Inject(AttendanceService) private readonly service: AttendanceService,
    @Inject(CancellationService)
    private readonly cancellations: CancellationService,
  ) {}
  @Post('sessions/:id/check-ins')
  @HttpCode(200)
  @Header('Cache-Control', 'private, no-store')
  checkIn(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.service.checkIn(
      req.actor,
      parse(z.string().min(1).max(128), id),
      parse(
        z
          .object({
            requestId: z.uuid(),
            qrPayload: z.string().min(1).max(256),
          })
          .strict(),
        body,
      ),
    );
  }
  @Post('admin/sessions/:id/attendance/backfill')
  @UseGuards(AdminGuard)
  @HttpCode(200)
  @Header('Cache-Control', 'private, no-store')
  backfill(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.service.backfill(
      req.actor,
      parse(z.string().min(1).max(128), id),
      parse(
        z
          .object({
            requestId: z.uuid(),
            userId: z.string().min(1).max(128),
            occurredAt: z.iso.datetime({ offset: true }),
            reason,
          })
          .strict(),
        body,
      ),
    );
  }
  @Post('admin/attendance/:id/cancel')
  @UseGuards(AdminGuard)
  @HttpCode(200)
  @Header('Cache-Control', 'private, no-store')
  cancel(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.cancellations.cancel(
      req.actor,
      parse(z.string().min(1).max(128), id),
      parse(z.object({ reason }).strict(), body).reason,
    );
  }
}
