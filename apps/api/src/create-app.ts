import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { AppModule } from './app.module.js';
import { readConfig } from './config.js';
export async function createApp() {
  const config = readConfig();
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  app.setGlobalPrefix('api/v1');
  app.use(helmet());
  app.enableCors({ origin: config.origins, credentials: true });
  app.enableShutdownHooks();
  return { app, config };
}
