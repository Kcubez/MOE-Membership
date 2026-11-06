import {
  Controller,
  Get,
  Query,
  Req,
  UseGuards,
  UseFilters,
  Inject,
  Header,
} from '@nestjs/common';
import {
  SessionGuard,
  type AuthenticatedRequest,
} from '../auth/session.guard.js';
import { DomainExceptionFilter } from '../common/domain/errors.js';
import { parse } from '../common/domain/rules.js';
import { HistoryService, historyQuery } from './history.service.js';
@Controller()
@UseGuards(SessionGuard)
@UseFilters(DomainExceptionFilter)
export class HistoryController {
  constructor(
    @Inject(HistoryService) private readonly service: HistoryService,
  ) {}
  @Get('admin/attendance')
  @Header('Cache-Control', 'private, no-store')
  admin(@Req() req: AuthenticatedRequest, @Query() query: unknown) {
    return this.service.list(req.actor, parse(historyQuery, query), false);
  }
  @Get('members/me/attendance')
  @Header('Cache-Control', 'private, no-store')
  own(@Req() req: AuthenticatedRequest, @Query() query: unknown) {
    return this.service.list(req.actor, parse(historyQuery, query), true);
  }
}
