import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { createRequire } from 'node:module';
import type { RequestHandler } from 'express';
import { AppModule } from './app.module.js';
import { readConfig } from './config.js';
// Helmet's CommonJS entry exports the middleware factory directly.
// Load it explicitly so host compilers cannot reinterpret its ESM default type.
const helmet = createRequire(import.meta.url)('helmet') as () => RequestHandler;
export async function createApp(factory: typeof NestFactory = NestFactory) {
  const config = readConfig();
  const app = await factory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  app.setGlobalPrefix('api/v1');
  app.use(helmet());
  app.enableCors({ origin: config.origins, credentials: true });
  app.enableShutdownHooks();
  return { app, config };
}
