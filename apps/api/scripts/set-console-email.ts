import 'dotenv/config';
import { createDb } from '../src/prisma/db.js';
import { consoleEmail } from '../src/auth/email.js';
import { normalizePhone, phoneIdentity } from '../src/auth/phone.js';

const { CONSOLE_ACCOUNT_PHONE, CONSOLE_ACCOUNT_EMAIL, DATABASE_URL } =
  process.env;
const email = consoleEmail.safeParse(CONSOLE_ACCOUNT_EMAIL);
if (!DATABASE_URL || !CONSOLE_ACCOUNT_PHONE || !email.success)
  throw new Error(
    'Set DATABASE_URL, CONSOLE_ACCOUNT_PHONE and a valid CONSOLE_ACCOUNT_EMAIL.',
  );

const phone = normalizePhone(CONSOLE_ACCOUNT_PHONE);
const db = createDb(DATABASE_URL);
try {
  const updated = await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM moe_auth_user WHERE phone=${phone} FOR UPDATE`;
    const user = await tx.authUser.findUnique({ where: { phone } });
    if (!user || !['admin', 'staff'].includes(user.role)) return false;
    if (user.email === email.data) return true;
    if (user.email !== phoneIdentity(phone)) return false;
    await tx.authUser.update({
      where: { id: user.id },
      data: {
        email: email.data,
        emailVerified: false,
        authVersion: { increment: 1 },
        updatedAt: new Date(),
      },
    });
    await tx.authSession.deleteMany({ where: { userId: user.id } });
    return true;
  });
  if (!updated)
    throw new Error(
      'Account is missing, is a member, or already uses a different email.',
    );
  console.log(
    'Console email saved. Sign in with the new email and existing password.',
  );
} catch {
  console.error(
    'Email update failed. Check the selected database, account role and email uniqueness.',
  );
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
