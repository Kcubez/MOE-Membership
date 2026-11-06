import { z } from 'zod';
const schema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  WEB_ORIGINS: z
    .string()
    .default('http://localhost:5173,http://127.0.0.1:5173'),
});
export function readConfig(env: NodeJS.ProcessEnv = process.env) {
  if (env.NODE_ENV === 'production' && !env.WEB_ORIGINS?.trim())
    throw new Error('WEB_ORIGINS is required in production');
  const config = schema.parse(env);
  const origins = config.WEB_ORIGINS.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  if (
    !origins.length ||
    origins.some((origin) => {
      try {
        const url = new URL(origin);
        return (
          !['https:', 'http:'].includes(url.protocol) ||
          url.origin !== origin ||
          (env.NODE_ENV === 'production' && url.protocol !== 'https:')
        );
      } catch {
        return true;
      }
    })
  )
    throw new Error('WEB_ORIGINS must contain explicit HTTP(S) origins');
  return { port: config.PORT, origins };
}
