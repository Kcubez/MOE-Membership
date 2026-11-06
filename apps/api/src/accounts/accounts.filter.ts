import {
  Catch,
  HttpException,
  type ExceptionFilter,
  type ArgumentsHost,
} from '@nestjs/common';
import type { Response } from 'express';
@Catch()
export class AccountsExceptionFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    const status = error instanceof HttpException ? error.getStatus() : 503;
    const codes: Record<number, string> = {
      400: 'INVALID_INPUT',
      401: 'UNAUTHENTICATED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      409: 'CONFLICT',
      429: 'RATE_LIMITED',
      503: 'UNAVAILABLE',
    };
    const body = error instanceof HttpException ? error.getResponse() : null;
    const forced =
      body &&
      typeof body === 'object' &&
      'code' in body &&
      body.code === 'PASSWORD_CHANGE_REQUIRED';
    res.setHeader('Cache-Control', 'no-store');
    res.status(status).json({
      statusCode: status,
      code: forced
        ? 'PASSWORD_CHANGE_REQUIRED'
        : codes[status] || 'UNAVAILABLE',
      message:
        error instanceof HttpException && status < 500
          ? error.message
          : 'Account operation temporarily unavailable',
    });
  }
}
