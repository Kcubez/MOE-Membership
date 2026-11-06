import {
  Controller,
  Get,
  Post,
  Patch,
  Put,
  Param,
  Body,
  Query,
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
import { AdminGuard } from '../auth/roles.guard.js';
import { DomainExceptionFilter } from '../common/domain/errors.js';
import {
  parse,
  pageQuery,
  reason,
  version,
  dateOnly,
} from '../common/domain/rules.js';
import { MeetupSessionsService } from './meetup-sessions.service.js';
const id = z.string().min(1).max(128);
const staffIds = z
  .array(id)
  .max(100)
  .refine(
    (values) => new Set(values).size === values.length,
    'Duplicate staff IDs',
  );
@Controller('sessions')
@UseGuards(SessionGuard)
@UseFilters(DomainExceptionFilter)
export class MeetupSessionsController {
  constructor(
    @Inject(MeetupSessionsService)
    private readonly service: MeetupSessionsService,
  ) {}
  @Get() @Header('Cache-Control', 'no-store') list(
    @Req() req: AuthenticatedRequest,
    @Query() query: unknown,
  ) {
    const input = parse(
      pageQuery
        .extend({
          planId: id.optional(),
          open: z
            .enum(['true', 'false'])
            .optional()
            .transform((value) =>
              value === undefined ? undefined : value === 'true',
            ),
          from: dateOnly.optional(),
          to: dateOnly.optional(),
        })
        .strict()
        .refine((value) => !value.from || !value.to || value.to >= value.from),
      query,
    );
    return this.service.list(req.actor, input);
  }
  @Get(':id') @Header('Cache-Control', 'no-store') get(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.service.get(req.actor, id);
  }
}
@Controller('admin/sessions')
@UseGuards(SessionGuard, AdminGuard)
@UseFilters(DomainExceptionFilter)
export class AdminMeetupSessionsController {
  constructor(
    @Inject(MeetupSessionsService)
    private readonly service: MeetupSessionsService,
  ) {}
  @Post() @HttpCode(200) create(
    @Req() req: AuthenticatedRequest,
    @Body() body: unknown,
  ) {
    return this.service.create(
      req.actor,
      parse(
        z
          .object({
            name: z.string().trim().min(1).max(120),
            planId: id,
            meetupDate: dateOnly,
            open: z.boolean(),
            staffIds,
            reason,
          })
          .strict(),
        body,
      ),
    );
  }
  @Patch(':id/state') state(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.service.changeState(
      req.actor,
      id,
      parse(z.object({ open: z.boolean(), version, reason }).strict(), body),
    );
  }
  @Put(':id/staff') staff(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.service.replaceStaff(
      req.actor,
      id,
      parse(z.object({ staffIds, version, reason }).strict(), body),
    );
  }
  @Get(':id/audit') @Header('Cache-Control', 'no-store') history(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.service.history(req.actor, id);
  }
}
