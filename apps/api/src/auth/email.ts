import { z } from 'zod';

export const consoleEmail = z
  .string()
  .trim()
  .max(254)
  .toLowerCase()
  .pipe(z.email())
  .refine((email) => !email.endsWith('@phone.moe.invalid'));
