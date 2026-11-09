import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AdminGuard } from '../auth/roles.guard.js';
import {
  MembershipsController,
  MyMembershipsController,
} from './memberships.controller.js';
import { MembershipsService } from './memberships.service.js';
@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [MembershipsController, MyMembershipsController],
  exports: [MembershipsService],
  providers: [MembershipsService, AdminGuard],
})
export class MembershipsModule {}
