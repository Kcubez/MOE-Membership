import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AccountsService } from './accounts.service.js';
import {
  AccountPasswordController,
  AdminUsersController,
} from './accounts.controller.js';
import { AdminGuard } from '../auth/roles.guard.js';
@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [AccountPasswordController, AdminUsersController],
  providers: [AccountsService, AdminGuard],
})
export class AccountsModule {}
