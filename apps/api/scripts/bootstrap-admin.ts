import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { createDb } from '../src/prisma/db.js';
import { buildAuth } from '../src/auth/options.js';
import { normalizePhone, phoneIdentity } from '../src/auth/phone.js';
const {
  BOOTSTRAP_ADMIN_PHONE,
  BOOTSTRAP_ADMIN_PASSWORD,
  BOOTSTRAP_ADMIN_NAME,
  DATABASE_URL,
  BETTER_AUTH_SECRET,
  AUTH_BASE_URL,
} = process.env;
if (
  !BOOTSTRAP_ADMIN_PHONE ||
  !BOOTSTRAP_ADMIN_PASSWORD ||
  !BOOTSTRAP_ADMIN_NAME ||
  !DATABASE_URL ||
  !BETTER_AUTH_SECRET ||
  !AUTH_BASE_URL ||
  BOOTSTRAP_ADMIN_PASSWORD.length < 12 ||
  BOOTSTRAP_ADMIN_PASSWORD.length > 128
)
  throw new Error(
    'Set BOOTSTRAP_ADMIN_PHONE, BOOTSTRAP_ADMIN_NAME and a 12–128 character BOOTSTRAP_ADMIN_PASSWORD locally, plus standard auth configuration',
  );
let phone: string;
try {
  phone = normalizePhone(BOOTSTRAP_ADMIN_PHONE);
} catch {
  console.error(
    '[INVALID_PHONE] BOOTSTRAP_ADMIN_PHONE must be a valid Myanmar mobile number (09... or +959...). Check the value locally in apps/api/.env.',
  );
  process.exit(1);
}
class BootstrapError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}
const db = createDb(DATABASE_URL);
try {
  const context = await buildAuth(db, BETTER_AUTH_SECRET, AUTH_BASE_URL, [])
    .$context;
  const password = await context.password.hash(BOOTSTRAP_ADMIN_PASSWORD);
  await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(631248092)::text`;
    if (await tx.authUser.count({ where: { role: 'admin' } }))
      throw new BootstrapError(
        'ADMIN_EXISTS',
        'Admin already exists; bootstrap is locked. Sign in with the existing Admin account.',
      );
    if (await tx.authUser.findUnique({ where: { phone } }))
      throw new BootstrapError(
        'PHONE_EXISTS',
        'Phone already exists; bootstrap never overwrites existing accounts. Use an unregistered Admin phone number.',
      );
    const id = randomUUID();
    await tx.authUser.create({
      data: {
        id,
        name: BOOTSTRAP_ADMIN_NAME,
        phone,
        email: phoneIdentity(phone),
        emailVerified: false,
        role: 'admin',
        enabled: true,
        mustChangePassword: true,
      },
    });
    await tx.authAccount.create({
      data: {
        id: randomUUID(),
        userId: id,
        accountId: id,
        providerId: 'credential',
        password,
        updatedAt: new Date(),
      },
    });
    await tx.accountAudit.create({
      data: {
        targetId: id,
        action: 'admin.bootstrapped',
        reason: 'Controlled first Admin bootstrap',
      },
    });
  });
  console.log(
    'First Admin created. Sign in and change the temporary password.',
  );
} catch (error) {
  const databaseErrors: Record<string, string> = {
    P1001: 'Database is unreachable. Check connectivity and retry.',
    P1002: 'Database connection timed out. Check connectivity and retry.',
    P2024:
      'Database connection pool timed out. Retry after checking connectivity.',
    P2028:
      'Database transaction timed out or expired. Check connectivity and retry.',
    P2021:
      'Required database table is missing. Run the reviewed database migrations.',
    P2022:
      'Required database column is missing. Run the reviewed database migrations.',
    P2002:
      'An account with the same unique identity already exists. No account was overwritten.',
  };
  if (error instanceof BootstrapError)
    console.error(`[${error.code}] ${error.message}`);
  else {
    const code =
      typeof error === 'object' &&
      error &&
      'code' in error &&
      typeof error.code === 'string'
        ? error.code
        : '';
    console.error(
      `[BOOTSTRAP_FAILED] ${databaseErrors[code] || 'Check local auth configuration and migration status. No credentials are printed.'}`,
    );
  }
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
