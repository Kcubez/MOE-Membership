import { AttendanceModule } from './attendance/attendance.module.js';
import { QrModule } from './qr/qr.module.js';
import { MeetupSessionsModule } from './meetup-sessions/meetup-sessions.module.js';
import { PlansModule } from './plans/plans.module.js';
import { MembershipsModule } from './memberships/memberships.module.js';
import { AccountsModule } from './accounts/accounts.module.js';
import { Module } from '@nestjs/common';
import { HealthController } from './health/health.controller.js';
import { AuthModule } from './auth/auth.module.js';
import { MembersModule } from './members/members.module.js';
@Module({
  imports: [
    AuthModule,
    AttendanceModule,
    QrModule,
    MembersModule,
    AccountsModule,
    PlansModule,
    MeetupSessionsModule,
    MembershipsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
