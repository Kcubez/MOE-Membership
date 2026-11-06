import {
  Controller,
  Get,
  Header,
  Inject,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  SessionGuard,
  type AuthenticatedRequest,
} from '../auth/session.guard.js';
import { MembersService } from './members.service.js';
@Controller('members')
@UseGuards(SessionGuard)
export class MembersController {
  constructor(
    @Inject(MembersService) private readonly members: MembersService,
  ) {}
  @Get('me')
  @Header('Cache-Control', 'no-store')
  getMe(@Req() req: AuthenticatedRequest) {
    return this.members.getOwnProfile(req.actor.id);
  }
}
