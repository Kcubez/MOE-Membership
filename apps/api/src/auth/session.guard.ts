import {
  Injectable,
  Inject,
  UnauthorizedException,
  ForbiddenException,
  ServiceUnavailableException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service.js';
import { readConfig } from '../config.js';
export type AuthenticatedRequest = Request & {
  actor: {
    id: string;
    sessionId: string;
    authVersion: number;
    role: string;
    mustChangePassword: boolean;
  };
};
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}
  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (req.get('Origin') && !readConfig().origins.includes(req.get('Origin')!))
      throw new ForbiddenException('Untrusted origin');
    const headers = new Headers();
    for (const key of ['cookie', 'authorization']) {
      const value = req.get(key);
      if (value) headers.set(key, value);
    }
    if (
      !['GET', 'HEAD', 'OPTIONS'].includes(req.method) &&
      !req.get('Origin') &&
      (req.get('X-MOE-Client') !== 'mobile' || req.get('Cookie'))
    )
      throw new ForbiddenException(
        'Trusted Origin or mobile client header required',
      );
    const { auth } = this.auth.getRuntime();
    let session;
    try {
      session = await auth.api.getSession({ headers });
    } catch {
      throw new ServiceUnavailableException(
        'Authentication temporarily unavailable',
      );
    }
    if (!session) throw new UnauthorizedException();
    if (session.user.enabled !== true)
      throw new ForbiddenException('Account disabled');
    if (session.session.authVersion !== session.user.authVersion)
      throw new UnauthorizedException();
    if (
      session.user.mustChangePassword &&
      req.path !== '/api/v1/account/password'
    )
      throw new ForbiddenException({
        code: 'PASSWORD_CHANGE_REQUIRED',
        message: 'Change your temporary password first',
      });
    req.actor = {
      id: session.user.id,
      sessionId: session.session.id,
      authVersion: session.user.authVersion,
      role: session.user.role,
      mustChangePassword: session.user.mustChangePassword,
    };
    return true;
  }
}
