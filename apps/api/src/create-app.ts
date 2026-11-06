import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import helmetMiddleware from 'helmet';
import type { RequestHandler } from 'express';
import { AppModule } from './app.module.js';
import { readConfig } from './config.js';
// Keep a static import so serverless bundlers include Helmet. Its default
// factory has inconsistent inferred types across host TypeScript compilers.
const helmet = helmetMiddleware as unknown as () => RequestHandler;
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
