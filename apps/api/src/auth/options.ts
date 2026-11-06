import { betterAuth } from 'better-auth';
import { bearer } from 'better-auth/plugins';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import type { PrismaClient } from '../generated/prisma/client.js';
export function buildAuth(
  prisma: PrismaClient,
  secret: string,
  baseURL: string,
  origins: string[],
) {
  return betterAuth({
    database: prismaAdapter(prisma, {
      provider: 'postgresql',
      transaction: true,
    }),
    secret,
    baseURL,
    basePath: '/internal-auth',
    trustedOrigins: origins,
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
      autoSignIn: true,
      minPasswordLength: 8,
      maxPasswordLength: 128,
    },
    user: {
      modelName: 'AuthUser',
      additionalFields: {
        phone: { type: 'string', required: true, unique: true, input: true },
        role: { type: 'string', defaultValue: 'member', input: false },
        enabled: { type: 'boolean', defaultValue: true, input: false },
        mustChangePassword: {
          type: 'boolean',
          defaultValue: false,
          input: false,
        },
        authVersion: { type: 'number', defaultValue: 0, input: false },
      },
    },
    session: {
      modelName: 'AuthSession',
      additionalFields: {
        authVersion: { type: 'number', defaultValue: 0, input: false },
      },
      expiresIn: 60 * 60 * 24 * 7,
      cookieCache: { enabled: false },
    },
    account: { modelName: 'AuthAccount' },
    verification: { modelName: 'AuthVerification' },
    rateLimit: {
      enabled: true,
      storage: 'database',
      window: 60,
      max: 20,
      modelName: 'AuthRateLimit',
    },
    plugins: [bearer()],
    databaseHooks: {
      session: {
        create: {
          before: async (session, context) => {
            const user = await context?.context.internalAdapter.findUserById(
              session.userId,
            );
            const expected = Number(
              context?.headers?.get('x-moe-auth-version') || '0',
            );
            const state = user as unknown as {
              enabled: boolean;
              authVersion: number;
            } | null;
            return state?.enabled === true && state.authVersion === expected
              ? { data: { ...session, authVersion: expected } }
              : false;
          },
        },
      },
    },
  });
}
