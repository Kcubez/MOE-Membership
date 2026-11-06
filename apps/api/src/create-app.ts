import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import helmetMiddleware from 'helmet';
import type { RequestHandler } from 'express';
import { readFileSync } from 'node:fs';
import { SwaggerModule, type OpenAPIObject } from '@nestjs/swagger';
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
  const document = JSON.parse(
    readFileSync(
      new URL('../../../postman/specs/openapi.json', import.meta.url),
      'utf8',
    ),
  ) as OpenAPIObject;
  document.servers = [{ url: '/' }];
  SwaggerModule.setup('docs', app, document, {
    jsonDocumentUrl: 'docs/openapi.json',
    swaggerOptions: {
      supportedSubmitMethods: [],
      persistAuthorization: false,
      displayRequestDuration: true,
      docExpansion: 'list',
    },
    customSiteTitle: 'MOE API Documentation',
  });
  app.enableCors({ origin: config.origins, credentials: true });
  app.enableShutdownHooks();
  return { app, config };
}
