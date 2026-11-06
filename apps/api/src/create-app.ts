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
  // Explicit file references let serverless tracing retain Swagger's assets.
  const swaggerAssets = {
    '/docs/swagger-ui-bundle.js': {
      type: 'application/javascript',
      body: readFileSync(
        new URL(
          '../../../node_modules/swagger-ui-dist/swagger-ui-bundle.js',
          import.meta.url,
        ),
      ),
    },
    '/docs/swagger-ui-standalone-preset.js': {
      type: 'application/javascript',
      body: readFileSync(
        new URL(
          '../../../node_modules/swagger-ui-dist/swagger-ui-standalone-preset.js',
          import.meta.url,
        ),
      ),
    },
    '/docs/swagger-ui.css': {
      type: 'text/css',
      body: readFileSync(
        new URL(
          '../../../node_modules/swagger-ui-dist/swagger-ui.css',
          import.meta.url,
        ),
      ),
    },
  };
  for (const [path, asset] of Object.entries(swaggerAssets)) {
    app
      .getHttpAdapter()
      .get(path, (_req: unknown, res: import('express').Response) => {
        res.type(asset.type).send(asset.body);
      });
  }
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
