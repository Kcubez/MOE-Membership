import {
  Injectable,
  Inject,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { buildAuth } from './options.js';
import { readConfig } from '../config.js';
@Injectable()
export class AuthService {
  constructor(
    @Inject(PrismaService) private readonly database: PrismaService,
  ) {}
  private runtime?: {
    auth: ReturnType<typeof buildAuth>;
    prisma: PrismaService['client'];
    baseURL: string;
  };
  getRuntime() {
    if (this.runtime) return this.runtime;
    const { DATABASE_URL, BETTER_AUTH_SECRET, AUTH_BASE_URL } = process.env;
    if (
      !DATABASE_URL ||
      !BETTER_AUTH_SECRET ||
      BETTER_AUTH_SECRET.length < 32 ||
      !AUTH_BASE_URL
    )
      throw new ServiceUnavailableException('Authentication is not configured');
    const url = new URL(AUTH_BASE_URL);
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.origin !== AUTH_BASE_URL ||
      (process.env.NODE_ENV === 'production' && url.protocol !== 'https:')
    )
      throw new ServiceUnavailableException(
        'Invalid authentication configuration',
      );
    const prisma = this.database.client;
    this.runtime = {
      prisma,
      baseURL: AUTH_BASE_URL,
      auth: buildAuth(
        prisma,
        BETTER_AUTH_SECRET,
        AUTH_BASE_URL,
        readConfig().origins,
      ),
    };
    return this.runtime;
  }
}
