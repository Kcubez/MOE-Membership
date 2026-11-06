import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { createDb } from './db.js';

@Injectable()
export class PrismaService implements OnModuleDestroy {
  private instance?: ReturnType<typeof createDb>;
  get client() {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('Database is not configured');
    return (this.instance ??= createDb(url));
  }
  async onModuleDestroy() {
    await this.instance?.$disconnect();
  }
}
