import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { createApp } from './create-app.js';
async function bootstrap() {
  const { app, config } = await createApp(NestFactory);
  await app.listen(config.port, '0.0.0.0');
}
void bootstrap().catch(() => {
  console.error('API startup failed. Check configuration.');
  process.exitCode = 1;
});
