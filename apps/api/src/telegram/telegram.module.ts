import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { QrModule } from '../qr/qr.module.js';
import { AttendanceModule } from '../attendance/attendance.module.js';
import { MembershipsModule } from '../memberships/memberships.module.js';
import { TelegramController } from './telegram.controller.js';
import { TelegramService } from './telegram.service.js';

@Module({
  imports: [
    AuthModule,
    PrismaModule,
    QrModule,
    AttendanceModule,
    MembershipsModule,
  ],
  controllers: [TelegramController],
  providers: [TelegramService],
})
export class TelegramModule {}
