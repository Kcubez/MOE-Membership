import {
  Controller,
  Get,
  Post,
  Patch,
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
  visits,
  dateOnly,
} from '../common/domain/rules.js';
import { MembershipsService } from './memberships.service.js';
const period = { startDate: dateOnly, endDate: dateOnly, reason };
const id = z.string().min(1).max(128);
@Controller('admin/memberships')
@UseGuards(SessionGuard, AdminGuard)
@UseFilters(DomainExceptionFilter)
export class MembershipsController {
  constructor(
    @Inject(MembershipsService) private readonly service: MembershipsService,
  ) {}
  @Get() @Header('Cache-Control', 'no-store') list(@Query() query: unknown) {
    return this.service.list(
      parse(
        pageQuery
          .extend({
            planId: id.optional(),
            userId: id.optional(),
            status: z
              .enum(['Cancelled', 'Completed', 'Expired', 'Upcoming', 'Active'])
              .optional(),
          })
          .strict(),
        query,
      ),
    );
  }
  @Get(':id') @Header('Cache-Control', 'no-store') get(
    @Param('id') id: string,
  ) {
    return this.service.get(id);
  }
  @Get(':id/audit') @Header('Cache-Control', 'no-store') history(
    @Param('id') id: string,
  ) {
    return this.service.history(id);
  }
  @Post() @HttpCode(200) assign(
    @Req() req: AuthenticatedRequest,
    @Body() body: unknown,
  ) {
    return this.service.assign(
      req.actor,
      parse(
        z
          .object({ ...period, userId: id, planId: id, planVersion: version })
          .strict(),
        body,
      ),
    );
  }
  @Patch(':id') update(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.service.update(
      req.actor,
      id,
      parse(
        z.object({ ...period, totalVisits: visits, version }).strict(),
        body,
      ),
    );
  }
  @Post(':id/renew') @HttpCode(200) renew(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.service.renew(
      req.actor,
      id,
      parse(z.object({ ...period, planVersion: version }).strict(), body),
    );
  }
  @Post(':id/cancel') @HttpCode(200) cancel(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.service.cancel(
      req.actor,
      id,
      parse(z.object({ version, reason }).strict(), body),
    );
  }
}
@Controller('members/me/memberships')
@UseGuards(SessionGuard)
@UseFilters(DomainExceptionFilter)
export class MyMembershipsController {
  constructor(
    @Inject(MembershipsService) private readonly service: MembershipsService,
  ) {}
  @Get() @Header('Cache-Control', 'no-store') list(
    @Req() req: AuthenticatedRequest,
    @Query() query: unknown,
  ) {
    return this.service.list(
      parse(pageQuery.omit({ search: true }).strict(), query),
      req.actor.id,
    );
  }
  @Get(':id') @Header('Cache-Control', 'no-store') get(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.service.get(id, req.actor.id);
  }
}
