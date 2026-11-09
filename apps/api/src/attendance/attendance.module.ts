import { CancellationService } from './cancellation.service.js';
import { HistoryController } from './history.controller.js';
import { HistoryService } from './history.service.js';
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AttendanceController } from './attendance.controller.js';
import { AttendanceService } from './attendance.service.js';
@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [AttendanceController, HistoryController],
  exports: [HistoryService],
  providers: [AttendanceService, HistoryService, CancellationService],
})
export class AttendanceModule {}
