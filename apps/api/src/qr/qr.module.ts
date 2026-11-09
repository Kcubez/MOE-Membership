import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { AdminGuard } from '../auth/roles.guard.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { QrService } from './qr.service.js';
import { PersonalQrController, AdminQrController } from './qr.controller.js';
@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [PersonalQrController, AdminQrController],
  exports: [QrService],
  providers: [QrService, AdminGuard],
})
export class QrModule {}
