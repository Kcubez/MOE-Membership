import {
  All,
  Controller,
  HttpException,
  Inject,
  Req,
  Res,
  ServiceUnavailableException,
} from '@nestjs/common';
import type {
  Request as ExpressRequest,
  Response as ExpressResponse,
} from 'express';
import { z } from 'zod';
import { AuthService } from './auth.service.js';
import { normalizePhone, phoneIdentity } from './phone.js';
import { readConfig } from '../config.js';
const credentials = z
  .object({ phone: z.string().max(40), password: z.string().min(8).max(128) })
  .strict();
const signup = credentials.extend({ name: z.string().trim().min(1).max(120) });
@Controller('auth')
export class AuthController {
  constructor(@Inject(AuthService) private readonly service: AuthService) {}
  @All(':action')
  async handle(@Req() req: ExpressRequest, @Res() res: ExpressResponse) {
    res.setHeader('Cache-Control', 'no-store');
    const action = req.params.action as string;
    const routes: Record<string, { method: string; path: string }> = {
      signup: { method: 'POST', path: 'sign-up/email' },
      login: { method: 'POST', path: 'sign-in/email' },
      session: { method: 'GET', path: 'get-session' },
      logout: { method: 'POST', path: 'sign-out' },
    };
    const route = routes[action];
    if (!route || req.method !== route.method)
      throw new HttpException('Not found', 404);
    const mobile = req.get('X-MOE-Client') === 'mobile';
    const origin = req.get('Origin');
    if (origin && !readConfig().origins.includes(origin))
      throw new HttpException('Untrusted origin', 403);
    if (req.method !== 'GET' && !origin && (!mobile || req.get('Cookie')))
      throw new HttpException(
        'Trusted Origin or mobile client header required',
        403,
      );
    let payload: Record<string, unknown> | undefined;
    if (action === 'signup' || action === 'login') {
      const parsed = (action === 'signup' ? signup : credentials).safeParse(
        req.body,
      );
      if (!parsed.success) throw new HttpException('Invalid input', 400);
      let phone: string;
      try {
        phone = normalizePhone(parsed.data.phone);
      } catch {
        throw new HttpException('Use a valid Myanmar phone number', 400);
      }
      payload = { email: phoneIdentity(phone), password: parsed.data.password };
      if ('name' in parsed.data) {
        payload.name = parsed.data.name;
        payload.phone = phone;
      }
    }
    const runtime = this.service.getRuntime();
    const headers = new Headers({ 'content-type': 'application/json' });
    for (const name of ['cookie', 'authorization', 'origin', 'user-agent']) {
      const value = req.get(name);
      if (value) headers.set(name, value);
    }
    // Do not trust client-provided forwarded IP headers for rate limiting.
    headers.set(
      'x-forwarded-for',
      req.ip || req.socket.remoteAddress || 'unknown',
    );
    try {
      if (action === 'login') {
        const account = await runtime.prisma.authUser.findUnique({
          where: { phone: normalizePhone(req.body.phone) },
          select: { authVersion: true },
        });
        headers.set('x-moe-auth-version', String(account?.authVersion ?? 0));
      }
      const response = await runtime.auth.handler(
        new Request(`${runtime.baseURL}/internal-auth/${route.path}`, {
          method: route.method,
          headers,
          ...(payload ? { body: JSON.stringify(payload) } : {}),
        }),
      );
      const data = await response.json();
      if (!mobile) {
        for (const cookie of response.headers.getSetCookie())
          res.appendHeader('Set-Cookie', cookie);
      }
      if (!response.ok)
        return res
          .status(
            data?.code === 'FAILED_TO_CREATE_SESSION' ? 401 : response.status,
          )
          .json({
            code: action === 'signup' ? 'SIGNUP_FAILED' : 'AUTH_FAILED',
            message:
              action === 'signup'
                ? 'Unable to create account. Check your details or contact MOE.'
                : 'Authentication failed',
          });
      if (action === 'logout') return res.json({ success: true });
      const user = data?.user;
      if (!user) return res.status(401).json({ code: 'UNAUTHENTICATED' });
      // No cookie cache: check live account state on each session read.
      if (user.enabled !== true)
        return res.status(403).json({ code: 'ACCOUNT_DISABLED' });
      const result: Record<string, unknown> = {
        user: {
          id: user.id,
          name: user.name,
          phone: user.phone,
          role: user.role,
          mustChangePassword: user.mustChangePassword === true,
        },
      };
      if (mobile && action !== 'session')
        result.token = response.headers.get('set-auth-token') || data.token;
      return res.status(200).json(result);
    } catch {
      throw new ServiceUnavailableException(
        'Authentication temporarily unavailable',
      );
    }
  }
}
