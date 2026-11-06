import 'dotenv/config';
import { createApp } from './create-app.js';
async function bootstrap() {
  const { app, config } = await createApp();
  await app.listen(config.port, '0.0.0.0');
}
void bootstrap().catch(() => {
  console.error('API startup failed. Check configuration.');
  process.exitCode = 1;
});
