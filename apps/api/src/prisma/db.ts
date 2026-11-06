import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';

export function createDb(url: string) {
  return new PrismaClient({
    adapter: new PrismaPg({
      connectionString: url,
      // Keep Prisma timestamp serialization independent of the database server's default timezone.
      options: '-c timezone=UTC',
      max: 5,
      connectionTimeoutMillis: 10000,
    }),
  });
}
