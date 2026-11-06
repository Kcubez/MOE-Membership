import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AdminGuard } from '../auth/roles.guard.js';
import { PlansController } from './plans.controller.js';
import { PlansService } from './plans.service.js';
@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [PlansController],
  providers: [PlansService, AdminGuard],
})
export class PlansModule {}
