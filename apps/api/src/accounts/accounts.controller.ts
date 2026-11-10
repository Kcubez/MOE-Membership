import { consoleEmail } from '../auth/email.js';
import {
  Controller,
  Post,
  Patch,
  Body,
  Param,
  Req,
  UseGuards,
  Inject,
  BadRequestException,
  Header,
  HttpCode,
  Get,
  Query,
  UseFilters,
} from '@nestjs/common';
import { z } from 'zod';
import { AccountsExceptionFilter } from './accounts.filter.js';
import {
  SessionGuard,
  type AuthenticatedRequest,
} from '../auth/session.guard.js';
import { AdminGuard } from '../auth/roles.guard.js';
import { AccountsService } from './accounts.service.js';
const password = z.string().min(8).max(128);
const reason = z.string().trim().min(1).max(500);
function parse<T>(schema: z.ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) throw new BadRequestException('Invalid input');
  return result.data;
}
@UseFilters(AccountsExceptionFilter)
@Controller('account')
@UseGuards(SessionGuard)
export class AccountPasswordController {
  constructor(
    @Inject(AccountsService) private readonly service: AccountsService,
  ) {}
  @Post('password')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  change(@Req() req: AuthenticatedRequest, @Body() body: unknown) {
    const data = parse(
      z.object({ currentPassword: password, newPassword: password }).strict(),
      body,
    );
    return this.service.changePassword(
      req.actor,
      data.currentPassword,
      data.newPassword,
    );
  }
}
@UseFilters(AccountsExceptionFilter)
@Controller('admin/users')
@UseGuards(SessionGuard, AdminGuard)
export class AdminUsersController {
  @Get('summary')
  @Header('Cache-Control', 'no-store')
  summary() {
    return this.service.summary();
  }

  @Get()
  @Header('Cache-Control', 'no-store')
  list(@Query() query: unknown) {
    const data = parse(
      z
        .object({
          limit: z.coerce.number().int().min(1).max(100).default(20),
          cursor: z.string().max(128).optional(),
          search: z.string().trim().max(120).optional(),
          role: z.enum(['admin', 'staff', 'member']).optional(),
          enabled: z
            .enum(['true', 'false'])
            .optional()
            .transform((value) =>
              value === undefined ? undefined : value === 'true',
            ),
        })
        .strict(),
      query,
    );
    return this.service.list(
      data.limit,
      data.cursor,
      data.search,
      data.role,
      data.enabled,
    );
  }

  constructor(
    @Inject(AccountsService) private readonly service: AccountsService,
  ) {}
  @Post()
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  create(@Req() req: AuthenticatedRequest, @Body() body: unknown) {
    const data = parse(
      z
        .object({
          name: z.string().trim().min(1).max(120),
          phone: z.string().max(40).optional(),
          email: consoleEmail.optional(),
          temporaryPassword: password,
          role: z.enum(['member', 'staff']),
        })
        .strict()
        .refine((data) =>
          data.role === 'member'
            ? !!data.phone && !data.email
            : !!data.email && !data.phone,
        ),
      body,
    );
    return this.service.create(req.actor, data);
  }
  @Post(':id/reset-password')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  reset(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const data = parse(
      z
        .object({
          temporaryPassword: password,
          reason,
          identityVerified: z.literal(true),
        })
        .strict(),
      body,
    );
    return this.service.reset(
      req.actor,
      id,
      data.temporaryPassword,
      data.reason,
    );
  }
  @Patch(':id/access')
  @Header('Cache-Control', 'no-store')
  access(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const data = parse(
      z
        .object({
          enabled: z.boolean(),
          role: z.enum(['member', 'staff']),
          reason,
        })
        .strict(),
      body,
    );
    return this.service.access(
      req.actor,
      id,
      data.enabled,
      data.role,
      data.reason,
    );
  }
}
