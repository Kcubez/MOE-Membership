import {
  Injectable,
  Inject,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
@Injectable()
export class MembersService {
  constructor(
    @Inject(PrismaService) private readonly database: PrismaService,
  ) {}
  async getOwnProfile(userId: string) {
    try {
      const profile = await this.database.client.memberProfile.findUnique({
        where: { userId },
        select: {
          memberNumber: true,
          language: true,
          user: { select: { id: true, name: true, phone: true } },
        },
      });
      if (!profile) throw new Error('Profile missing');
      return {
        userId: profile.user.id,
        memberNumber: `MOE-${String(profile.memberNumber).padStart(6, '0')}`,
        name: profile.user.name,
        phone: profile.user.phone,
        language: profile.language,
      };
    } catch {
      throw new ServiceUnavailableException('Profile temporarily unavailable');
    }
  }
}
