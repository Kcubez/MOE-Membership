import {
  Catch,
  HttpException,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import type { Response } from 'express';
@Catch()
export class DomainExceptionFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    let status = 503;
    let code = 'UNAVAILABLE';
    let message =
      'The operation is temporarily unavailable. Refresh before retrying.';
    if (error instanceof HttpException) {
      status = error.getStatus();
      const body = error.getResponse();
      const defaults: Record<number, string> = {
        400: 'INVALID_INPUT',
        401: 'UNAUTHENTICATED',
        403: 'FORBIDDEN',
        404: 'NOT_FOUND',
        409: 'CONFLICT',
      };
      code = defaults[status] || 'UNAVAILABLE';
      message = error.message;
      if (
        body &&
        typeof body === 'object' &&
        'code' in body &&
        typeof body.code === 'string'
      )
        code = body.code;
    } else {
      const text =
        String(error instanceof Error ? error.message : '') +
        JSON.stringify(error);
      if (text.includes('23P01') || text.includes('memberships_no_overlap')) {
        status = 409;
        code = 'MEMBERSHIP_OVERLAP';
        message =
          'This member already has an overlapping period for this plan.';
      } else if (text.includes('P2002')) {
        status = 409;
        code = 'CONFLICT';
        message = 'A conflicting record already exists.';
      }
    }
    const res = host.switchToHttp().getResponse<Response>();
    res.setHeader('Cache-Control', 'no-store');
    res.status(status).json({ statusCode: status, code, message });
  }
}
