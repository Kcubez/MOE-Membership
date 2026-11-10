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
} from '../common/domain/rules.js';
import { PlansService } from './plans.service.js';
const input = z
  .object({
    name: z.string().trim().min(1).max(120),
    description: z.string().trim().max(2000),
    benefits: z.string().trim().max(4000),
    totalVisits: visits,
    reason,
  })
  .strict();
@Controller('admin/plans')
@UseGuards(SessionGuard, AdminGuard)
@UseFilters(DomainExceptionFilter)
export class PlansController {
  constructor(@Inject(PlansService) private readonly service: PlansService) {}
  @Get() @Header('Cache-Control', 'no-store') list(@Query() query: unknown) {
    const data = parse(
      pageQuery
        .extend({
          trash: z.literal('true').optional(),
          archived: z
            .enum(['true', 'false'])
            .optional()
            .transform((value) =>
              value === undefined ? undefined : value === 'true',
            ),
        })
        .strict(),
      query,
    );
    return this.service.list(data);
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
  @Post() @HttpCode(200) create(
    @Req() req: AuthenticatedRequest,
    @Body() body: unknown,
  ) {
    return this.service.create(req.actor, parse(input, body));
  }
  @Patch(':id') update(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.service.update(
      req.actor,
      id,
      parse(input.extend({ version }).strict(), body),
    );
  }
  @Patch(':id/trash') trash(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.service.trash(
      req.actor,
      id,
      parse(
        z
          .object({
            action: z.enum(['move', 'restore', 'delete']),
            version,
            reason,
          })
          .strict(),
        body,
      ),
    );
  }
  @Patch(':id/availability') availability(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.service.availability(
      req.actor,
      id,
      parse(
        z.object({ archived: z.boolean(), version, reason }).strict(),
        body,
      ),
    );
  }
}
