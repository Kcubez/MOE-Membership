import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AdminGuard } from '../auth/roles.guard.js';
import {
  MeetupSessionsController,
  AdminMeetupSessionsController,
} from './meetup-sessions.controller.js';
import { MeetupSessionsService } from './meetup-sessions.service.js';
@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [MeetupSessionsController, AdminMeetupSessionsController],
  providers: [MeetupSessionsService, AdminGuard],
})
export class MeetupSessionsModule {}
