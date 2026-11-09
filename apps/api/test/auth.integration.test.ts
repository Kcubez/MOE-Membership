import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createHmac, randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';
import { createApp } from '../src/create-app.js';
import { normalizePhone } from '../src/auth/phone.js';

test('Myanmar phone normalization and foreign-number rejection', () => {
  assert.equal(normalizePhone('09791234567'), '+959791234567');
  assert.equal(normalizePhone('+959791234567'), '+959791234567');
  assert.throws(() => normalizePhone('+14155552671'));
});

test('unconfigured auth fails closed without breaking public health', async () => {
  const previous = process.env.BETTER_AUTH_SECRET;
  delete process.env.BETTER_AUTH_SECRET;
  const { app } = await createApp();
  await app.init();
  try {
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('X-MOE-Client', 'mobile')
      .send({ phone: '09791234567', password: 'testing-password-123' })
      .expect(503);
  } finally {
    await app.close();
    if (previous) process.env.BETTER_AUTH_SECRET = previous;
  }
});

test(
  'Better Auth real PostgreSQL: no-OTP signup, cookie/mobile sessions, logout, disabled accounts and revocation',
  { skip: !process.env.AUTH_TEST_DATABASE_URL },
  async () => {
    const url = new URL(process.env.AUTH_TEST_DATABASE_URL!);
    if (
      !['127.0.0.1', 'localhost'].includes(url.hostname) ||
      url.pathname !== '/moe_auth_test'
    )
      throw new Error('Only isolated local moe_auth_test database is allowed');
    process.env.DATABASE_URL = url.toString();
    process.env.BETTER_AUTH_SECRET = randomBytes(40).toString('hex');
    process.env.AUTH_BASE_URL = 'http://localhost:3000';
    process.env.WEB_ORIGINS = 'http://localhost:5173';
    execFileSync(
      process.execPath,
      ['../../node_modules/prisma/build/index.js', 'migrate', 'deploy'],
      {
        cwd: fileURLToPath(new URL('..', import.meta.url)),
        env: {
          ...process.env,
          DIRECT_URL: url.toString(),
          DATABASE_URL: url.toString(),
        },
        stdio: 'pipe',
      },
    );
    const pool = new Pool({ connectionString: url.toString() });
    const missing = await pool.query(
      'SELECT count(*) FROM moe_auth_user u LEFT JOIN member_profiles p ON p."userId"=u.id WHERE p."userId" IS NULL',
    );
    assert.equal(
      missing.rows[0].count,
      '0',
      'Migration backfills all pre-existing users',
    );
    const tx = await pool.connect();
    try {
      await tx.query('BEGIN');
      await tx.query(
        `INSERT INTO moe_auth_user (id,name,email,"emailVerified",phone,role,enabled) VALUES ('rollback-profile-test','Rollback','rollback@phone.moe.invalid',false,'+959790000000','member',true)`,
      );
      const created = await tx.query(
        `SELECT count(*) FROM member_profiles WHERE "userId"='rollback-profile-test'`,
      );
      assert.equal(created.rows[0].count, '1');
      await tx.query('ROLLBACK');
      const removed = await tx.query(
        `SELECT count(*) FROM member_profiles WHERE "userId"='rollback-profile-test'`,
      );
      assert.equal(
        removed.rows[0].count,
        '0',
        'Profile rolls back with its auth user',
      );
    } finally {
      await tx.query('ROLLBACK');
      tx.release();
    }
    await pool.query(
      'TRUNCATE moe_auth_session, moe_auth_account, moe_auth_verification, moe_auth_rate_limit, moe_auth_user CASCADE',
    );
    const { app } = await createApp();
    await app.init();
    const api = request(app.getHttpServer());
    const password = 'testing-password-123';
    try {
      const signed = await api
        .post('/api/v1/auth/signup')
        .set('X-MOE-Client', 'mobile')
        .send({ name: 'Test Member', phone: '09791234567', password })
        .expect(200);
      assert.equal(signed.body.user.phone, '+959791234567');
      assert.equal(signed.body.user.role, 'member');
      assert.ok(signed.body.token);
      assert.equal(signed.body.user.email, undefined);
      assert.equal(
        signed.headers['set-cookie'],
        undefined,
        'Mobile bearer clients must not receive browser cookies',
      );
      const token = signed.body.token;
      await api.get('/api/v1/members/me').expect(401);
      const me = await api
        .get('/api/v1/members/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      assert.equal(me.body.userId, signed.body.user.id);
      assert.match(me.body.memberNumber, /^MOE-\d{6,}$/);
      assert.equal(me.body.language, 'en');
      assert.deepEqual(Object.keys(me.body).sort(), [
        'language',
        'memberNumber',
        'name',
        'phone',
        'userId',
      ]);
      assert.equal(me.headers['cache-control'], 'no-store');
      const repeated = await api
        .get('/api/v1/members/me?userId=someone-else')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      assert.deepEqual(repeated.body, me.body);
      const count = await pool.query(
        'SELECT count(*) FROM member_profiles WHERE "userId"=$1',
        [signed.body.user.id],
      );
      assert.equal(count.rows[0].count, '1');
      await api
        .get('/api/v1/auth/session')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      const duplicate = await api
        .post('/api/v1/auth/signup')
        .set('X-MOE-Client', 'mobile')
        .send({ name: 'Duplicate', phone: '+959791234567', password });
      assert.ok(duplicate.status >= 400);
      const invalidCredentials = await api
        .post('/api/v1/auth/login')
        .set('X-MOE-Client', 'mobile')
        .send({ phone: '09791234567', password: 'wrong-password' })
        .expect(401);
      await api
        .post('/api/v1/auth/signup')
        .set('X-MOE-Client', 'mobile')
        .send({ name: 'Bad', phone: '09791234567', password, role: 'admin' })
        .expect(400);
      await api
        .post('/api/v1/auth/login')
        .set('Origin', 'https://untrusted.example')
        .send({ phone: '09791234567', password })
        .expect(403);
      const sessionCount = () =>
        pool.query('SELECT count(*) FROM moe_auth_session');
      const beforeMismatch = await sessionCount();
      const mismatch = await api
        .post('/api/v1/auth/login')
        .set('Origin', 'http://localhost:5173')
        .send({ phone: '09791234567', password, portal: 'console' })
        .expect(401);
      assert.deepEqual(mismatch.body, invalidCredentials.body);
      assert.equal(mismatch.headers['set-cookie'], undefined);
      assert.deepEqual((await sessionCount()).rows, beforeMismatch.rows);
      const browser = await api
        .post('/api/v1/auth/login')
        .set('Origin', 'http://localhost:5173')
        .send({ phone: '09791234567', password, portal: 'member' })
        .expect(200);
      assert.equal(browser.body.token, undefined);
      const cookies = browser.headers['set-cookie'];
      assert.ok(cookies);
      const cookie = (Array.isArray(cookies) ? cookies : [cookies])
        .map((item: string) => item.split(';')[0])
        .join('; ');
      await api.get('/api/v1/auth/session').set('Cookie', cookie).expect(200);
      await api.get('/api/v1/members/me').set('Cookie', cookie).expect(200);
      const botToken = 'test-token';
      const webhookSecret = 'test-secret';
      const originalFetch = globalThis.fetch;
      const env = {
        TELEGRAM_BOT_TOKEN: botToken,
        TELEGRAM_WEBHOOK_SECRET: webhookSecret,
        TELEGRAM_LINK_URL: 'https://example.test/telegram/link',
      };
      const previousEnv = Object.fromEntries(
        Object.keys(env).map((name) => [name, process.env[name]]),
      );
      Object.assign(process.env, env);
      const replies: (string | FormData)[] = [];
      globalThis.fetch = async (url, options) => {
        if (String(url).startsWith('https://api.telegram.org/bottest-token/')) {
          replies.push(options?.body as string | FormData);
          return Response.json({ ok: true });
        }
        return originalFetch(url, options);
      };
      try {
        const webhook = (
          text: string,
          type = 'private',
          secret = webhookSecret,
        ) =>
          api
            .post('/api/v1/telegram/webhook')
            .set('X-Telegram-Bot-Api-Secret-Token', secret)
            .send({
              update_id: 1,
              message: {
                text,
                chat: { id: 123, type },
                from: { id: 123, is_bot: false },
              },
            });
        await webhook('/start', 'private', 'wrong').expect(403);
        await webhook('Show my QR code', 'group').expect(200);
        assert.equal(replies.length, 0);
        await webhook('Hi').expect(200);
        assert.deepEqual(
          JSON.parse(replies[0] as string).reply_markup.keyboard,
          [
            ['📱 Show my QR code', '📋 My plan'],
            ['📅 Attendance history', '🚪 Logout'],
          ],
        );
        await webhook('Show my QR code').expect(200);
        assert.match(replies.at(-1) as string, /Link MOE account/);
        const params = new URLSearchParams({
          auth_date: String(Math.floor(Date.now() / 1000)),
          user: JSON.stringify({ id: 123 }),
        });
        const key = createHmac('sha256', 'WebAppData')
          .update(botToken)
          .digest();
        const hash = createHmac('sha256', key)
          .update(
            'auth_date=' +
              params.get('auth_date') +
              '\nuser=' +
              params.get('user'),
          )
          .digest('hex');
        const link = (initData: string) =>
          api
            .post('/api/v1/telegram/link')
            .set('Origin', 'http://localhost:5173')
            .set('Cookie', cookie)
            .send({ initData, action: 'qr' });
        await link(params + '&hash=invalid').expect(401);
        const linked = await link(params + '&hash=' + hash).expect(200);
        assert.equal(linked.body.delivered, true);
        const qrReply = replies.at(-1) as FormData;
        assert.equal(qrReply.get('chat_id'), '123');
        assert.equal(qrReply.get('protect_content'), 'true');
        assert.equal((qrReply.get('photo') as File).type, 'image/png');
        await webhook('📋 My plan').expect(200);
        assert.match(replies.at(-1) as string, /no active plans/);
        await webhook('Attendance history').expect(200);
        assert.match(replies.at(-1) as string, /No attendance/);
        await webhook('🚪 Logout').expect(200);
        await webhook('Show my QR code').expect(200);
        assert.match(replies.at(-1) as string, /Link MOE account/);
      } finally {
        globalThis.fetch = originalFetch;
        for (const [name, value] of Object.entries(previousEnv)) {
          if (value === undefined) delete process.env[name];
          else process.env[name] = value;
        }
      }
      await api.post('/api/v1/auth/logout').set('Cookie', cookie).expect(403);
      await api
        .post('/api/v1/auth/logout')
        .set('X-MOE-Client', 'mobile')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      await api
        .get('/api/v1/auth/session')
        .set('Authorization', `Bearer ${token}`)
        .expect(401);
      await pool.query('UPDATE moe_auth_user SET enabled=false WHERE id=$1', [
        signed.body.user.id,
      ]);
      await api.get('/api/v1/auth/session').set('Cookie', cookie).expect(403);
      await api.get('/api/v1/members/me').set('Cookie', cookie).expect(403);
      const disabled = await api
        .post('/api/v1/auth/login')
        .set('X-MOE-Client', 'mobile')
        .send({ phone: '09791234567', password });
      assert.ok(disabled.status >= 400);
      await pool.query('DELETE FROM moe_auth_session WHERE "userId"=$1', [
        signed.body.user.id,
      ]);
      await api.get('/api/v1/auth/session').set('Cookie', cookie).expect(401);
      await api.get('/api/v1/members/me').set('Cookie', cookie).expect(401);
      await api
        .post('/api/v1/auth/sign-up/email')
        .set('X-MOE-Client', 'mobile')
        .send({})
        .expect(404);
      let throttled = false;
      for (let i = 0; i < 25; i++) {
        const response = await api
          .post('/api/v1/auth/login')
          .set('X-MOE-Client', 'mobile')
          .send({ phone: '09791234567', password: 'wrong-password' });
        if (response.status === 429) {
          throttled = true;
          break;
        }
      }
      assert.equal(
        throttled,
        true,
        'Repeated login attempts must be rate-limited',
      );
    } finally {
      await app.close();
      await pool.end();
    }
  },
);

test(
  'Account management: controlled bootstrap, role guards, forced password changes, reset/disable, audit and session epochs',
  { skip: !process.env.AUTH_TEST_DATABASE_URL },
  async () => {
    const url = new URL(process.env.AUTH_TEST_DATABASE_URL!);
    if (
      !['127.0.0.1', 'localhost'].includes(url.hostname) ||
      url.pathname !== '/moe_auth_test'
    )
      throw new Error('Isolated local database required');
    const pool = new Pool({ connectionString: url.toString() });
    process.env.DATABASE_URL = url.toString();
    process.env.BETTER_AUTH_SECRET = randomBytes(40).toString('hex');
    process.env.AUTH_BASE_URL = 'http://localhost:3000';
    process.env.WEB_ORIGINS = 'http://localhost:5173';
    await pool.query(
      'TRUNCATE account_audit,moe_auth_rate_limit,moe_auth_session,moe_auth_account,moe_auth_user CASCADE',
    );
    const cliEnv = {
      ...process.env,
      DIRECT_URL: url.toString(),
      BOOTSTRAP_ADMIN_PHONE: '09791234560',
      BOOTSTRAP_ADMIN_NAME: 'Test Admin',
      BOOTSTRAP_ADMIN_PASSWORD: 'temporary-admin-123',
    };
    const cli = () =>
      execFileSync(
        process.execPath,
        ['../../node_modules/tsx/dist/cli.mjs', 'scripts/bootstrap-admin.ts'],
        {
          cwd: fileURLToPath(new URL('..', import.meta.url)),
          env: cliEnv,
          stdio: 'pipe',
        },
      );
    const { app } = await createApp();
    await app.init();
    const api = request(app.getHttpServer());
    // This workflow exercises many logins; limiter rejection is covered in the prior test.
    const login = async (phone: string, password: string) => {
      await pool.query(
        "DELETE FROM moe_auth_rate_limit WHERE key NOT LIKE 'account-write:%'",
      );
      return api
        .post('/api/v1/auth/login')
        .set('X-MOE-Client', 'mobile')
        .send({ phone, password });
    };
    const write = (
      method: 'post' | 'patch',
      path: string,
      token: string,
      body: object,
    ) =>
      api[method](path)
        .set('X-MOE-Client', 'mobile')
        .set('Authorization', `Bearer ${token}`)
        .send(body);
    try {
      cli();
      assert.throws(cli, 'Bootstrap refuses a second Admin');
      const temp = await login('09791234560', 'temporary-admin-123');
      assert.equal(temp.status, 200);
      assert.equal(temp.body.user.mustChangePassword, true);
      await api
        .get('/api/v1/members/me')
        .set('Authorization', `Bearer ${temp.body.token}`)
        .expect(403);
      await write('post', '/api/v1/account/password', temp.body.token, {
        currentPassword: 'wrong-password',
        newPassword: 'permanent-admin-456',
      }).expect(401);
      await write('post', '/api/v1/account/password', temp.body.token, {
        currentPassword: 'temporary-admin-123',
        newPassword: 'permanent-admin-456',
      }).expect(200);
      await api
        .get('/api/v1/auth/session')
        .set('Authorization', `Bearer ${temp.body.token}`)
        .expect(401);
      const admin = await login('09791234560', 'permanent-admin-456');
      assert.equal(admin.status, 200);
      assert.equal(admin.body.user.mustChangePassword, false);
      const account = {
        name: 'Managed Member',
        phone: '09791234561',
        temporaryPassword: 'temporary-member-123',
        role: 'member',
      };
      const created = await write(
        'post',
        '/api/v1/admin/users',
        admin.body.token,
        account,
      ).expect(200);
      const id = created.body.user.id;
      assert.equal(created.body.created, true);
      const reused = await write(
        'post',
        '/api/v1/admin/users',
        admin.body.token,
        { ...account, role: 'staff' },
      ).expect(200);
      assert.equal(reused.body.created, false);
      assert.equal(reused.body.user.role, 'member');
      await write('post', '/api/v1/admin/users', admin.body.token, {
        ...account,
        phone: '+14155552671',
      }).expect(400);
      await write('post', '/api/v1/admin/users', admin.body.token, {
        ...account,
        role: 'admin',
      }).expect(400);
      const member = await login(account.phone, account.temporaryPassword);
      assert.equal(member.status, 200);
      await api
        .get('/api/v1/members/me')
        .set('Authorization', `Bearer ${member.body.token}`)
        .expect(403);
      await write('post', '/api/v1/account/password', member.body.token, {
        currentPassword: account.temporaryPassword,
        newPassword: 'permanent-member-456',
      }).expect(200);
      const normal = await login(account.phone, 'permanent-member-456');
      assert.equal(normal.status, 200);
      await write(
        'post',
        '/api/v1/admin/users',
        normal.body.token,
        account,
      ).expect(403);
      await api
        .post('/api/v1/account/password')
        .set('Authorization', `Bearer ${normal.body.token}`)
        .send({
          currentPassword: 'permanent-member-456',
          newPassword: 'new-password-789',
        })
        .expect(403);
      await write(
        'post',
        `/api/v1/admin/users/${id}/reset-password`,
        admin.body.token,
        {
          temporaryPassword: 'reset-password-789',
          reason: 'Page identity verified',
          identityVerified: false,
        },
      ).expect(400);
      const oldEpoch = (
        await pool.query(
          'SELECT "authVersion" FROM moe_auth_user WHERE id=$1',
          [id],
        )
      ).rows[0].authVersion;
      await write(
        'post',
        `/api/v1/admin/users/${id}/reset-password`,
        admin.body.token,
        {
          temporaryPassword: 'reset-password-789',
          reason: 'Page identity verified',
          identityVerified: true,
        },
      ).expect(200);
      await api
        .get('/api/v1/auth/session')
        .set('Authorization', `Bearer ${normal.body.token}`)
        .expect(401);
      assert.ok(
        (await login(account.phone, 'permanent-member-456')).status >= 400,
      );
      const reset = await login(account.phone, 'reset-password-789');
      assert.equal(reset.status, 200);
      assert.equal(reset.body.user.mustChangePassword, true);
      await assert.rejects(
        pool.query(
          `INSERT INTO moe_auth_session (id,"userId",token,"expiresAt","updatedAt","authVersion") VALUES ('stale-session',$1,'stale-token',now()+interval '1 day',now(),$2)`,
          [id, oldEpoch],
        ),
        (e: { code?: string }) => e.code === '23514',
      );
      await write('post', '/api/v1/account/password', reset.body.token, {
        currentPassword: 'reset-password-789',
        newPassword: 'final-member-password-999',
      }).expect(200);
      const current = await login(account.phone, 'final-member-password-999');
      assert.equal(current.status, 200);
      await write(
        'patch',
        `/api/v1/admin/users/${id}/access`,
        admin.body.token,
        { enabled: true, role: 'staff', reason: 'Assign staff role' },
      ).expect(200);
      await api
        .get('/api/v1/members/me')
        .set('Authorization', `Bearer ${current.body.token}`)
        .expect(401);
      const staff = await login(account.phone, 'final-member-password-999');
      assert.equal(staff.body.user.role, 'staff');
      await write(
        'post',
        '/api/v1/admin/users',
        staff.body.token,
        account,
      ).expect(403);
      await write(
        'patch',
        `/api/v1/admin/users/${id}/access`,
        admin.body.token,
        { enabled: false, role: 'staff', reason: 'Deactivate test staff' },
      ).expect(200);
      await api
        .get('/api/v1/members/me')
        .set('Authorization', `Bearer ${staff.body.token}`)
        .expect(401);
      assert.ok(
        (await login(account.phone, 'final-member-password-999')).status >= 400,
      );
      await write(
        'patch',
        `/api/v1/admin/users/${admin.body.user.id}/access`,
        admin.body.token,
        { enabled: false, role: 'member', reason: 'Must be denied' },
      ).expect(403);
      const directory = await api
        .get('/api/v1/admin/users?limit=1')
        .set('Authorization', `Bearer ${admin.body.token}`)
        .expect(200);
      assert.equal(directory.body.items.length, 1);
      const summary = await api
        .get('/api/v1/admin/users/summary')
        .set('Authorization', `Bearer ${admin.body.token}`)
        .expect(200);
      assert.equal(summary.body.total, 2);
      assert.equal(summary.body.staff, 1);
      await api
        .get('/api/v1/admin/users/summary')
        .set('Authorization', `Bearer ${staff.body.token}`)
        .expect(401);
      assert.ok(directory.body.nextCursor);
      assert.equal('email' in directory.body.items[0], false);
      await api
        .get('/api/v1/admin/users')
        .set('Authorization', `Bearer ${staff.body.token}`)
        .expect(401);
      // Both requests started with the same session/current password. Only one may commit.
      const changes = await Promise.all([
        write('post', '/api/v1/account/password', admin.body.token, {
          currentPassword: 'permanent-admin-456',
          newPassword: 'concurrent-admin-password-A',
        }),
        write('post', '/api/v1/account/password', admin.body.token, {
          currentPassword: 'permanent-admin-456',
          newPassword: 'concurrent-admin-password-B',
        }),
      ]);
      assert.deepEqual(changes.map((item) => item.status).sort(), [200, 401]);
      const audits = await pool.query(
        'SELECT action,reason,"before","after" FROM account_audit',
      );
      const text = JSON.stringify(audits.rows);
      assert.ok(text.includes('password.reset'));
      assert.ok(text.includes('account.access_changed'));
      for (const secret of [
        'temporary-admin-123',
        'temporary-member-123',
        'reset-password-789',
        'final-member-password-999',
      ])
        assert.equal(text.includes(secret), false);
    } finally {
      await app.close();
      await pool.end();
    }
  },
);
