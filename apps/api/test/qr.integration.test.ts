import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';
import request from 'supertest';
import { createApp } from '../src/create-app.js';
import { qrPayload, qrLookupId, qrMatches } from '../src/qr/qr-codec.js';
test('QR codec binds current random ID, account, version and signing key without personal data', () => {
  const row = {
      credentialId: randomUUID(),
      userId: 'codec-test-user',
      version: 1,
    },
    secret = randomBytes(40).toString('hex');
  const payload = qrPayload(row, secret);
  assert.ok(qrMatches(payload, row, secret));
  assert.ok(qrLookupId(payload) === row.credentialId);
  assert.ok(!payload.includes(row.userId));
  assert.ok(
    !qrMatches(payload, { ...row, credentialId: randomUUID() }, secret),
  );
  assert.ok(!qrMatches(payload, { ...row, userId: 'another-user' }, secret));
  assert.ok(!qrMatches(payload, { ...row, version: 2 }, secret));
  assert.ok(!qrMatches(payload, row, randomBytes(40).toString('hex')));
  assert.ok(!qrMatches(payload + '=', row, secret));
  assert.ok(!qrMatches('not-a-QR', row, secret));
  assert.ok(qrLookupId('not-a-QR') === null);
});
test(
  'PostgreSQL QR provisioning, own-only disclosure, atomic rotation, stale/concurrent updates and secret-free audit',
  { skip: !process.env.AUTH_TEST_DATABASE_URL },
  async () => {
    const url = new URL(process.env.AUTH_TEST_DATABASE_URL!);
    if (
      !['127.0.0.1', 'localhost'].includes(url.hostname) ||
      url.pathname !== '/moe_auth_test'
    )
      throw new Error('Isolated local test database required');
    const maintenance = new Pool({ connectionString: url.toString() });
    try {
      const found = await maintenance.query(
        "SELECT 1 FROM pg_database WHERE datname='moe_qr_test'",
      );
      if (!found.rowCount)
        await maintenance.query('CREATE DATABASE moe_qr_test');
    } finally {
      await maintenance.end();
    }
    url.pathname = '/moe_qr_test';
    process.env.DATABASE_URL = url.toString();
    process.env.DIRECT_URL = url.toString();
    process.env.BETTER_AUTH_SECRET = randomBytes(40).toString('hex');
    process.env.QR_SIGNING_SECRET = randomBytes(40).toString('hex');
    process.env.AUTH_BASE_URL = 'http://localhost:3000';
    process.env.WEB_ORIGINS = 'http://localhost:5173';
    execFileSync(
      process.execPath,
      ['../../node_modules/prisma/build/index.js', 'migrate', 'deploy'],
      {
        cwd: fileURLToPath(new URL('..', import.meta.url)),
        env: process.env,
        stdio: 'pipe',
      },
    );
    const pool = new Pool({ connectionString: url.toString() });
    await pool.query(
      'TRUNCATE domain_audit,memberships,plans,account_audit,moe_auth_rate_limit,moe_auth_user CASCADE',
    );
    const { app } = await createApp();
    await app.init();
    const api = request(app.getHttpServer());
    const password = 'testing-password-123';
    const sign = async (name: string, phone: string) => {
      // Isolated fixture setup; authentication throttling has its own regression tests.
      await pool.query('DELETE FROM moe_auth_rate_limit');
      return api
        .post('/api/v1/auth/signup')
        .set('X-MOE-Client', 'mobile')
        .send({ name, phone, password })
        .expect(200);
    };

    try {
      const admin = await sign('QR Test Admin', '09791234569');
      await pool.query("UPDATE moe_auth_user SET role='admin' WHERE id=$1", [
        admin.body.user.id,
      ]);
      const member = await sign('QR Test Member', '09791234570');
      const staff = await sign('QR Test Staff', '09791234571');
      await pool.query("UPDATE moe_auth_user SET role='staff' WHERE id=$1", [
        staff.body.user.id,
      ]);
      const token = admin.body.token,
        memberToken = member.body.token,
        memberId = member.body.user.id;
      const get = (path: string, who = token) =>
        api.get('/api/v1' + path).set('Authorization', 'Bearer ' + who);
      const post = (path: string, body: object, who = token) =>
        api
          .post('/api/v1' + path)
          .set('X-MOE-Client', 'mobile')
          .set('Authorization', 'Bearer ' + who)
          .send(body);
      const base = '/admin/users/' + memberId + '/qr';
      await api.get('/api/v1/members/me/qr').expect(401);
      const own = await get('/members/me/qr', memberToken).expect(200);
      assert.ok(own.headers['cache-control'].includes('no-store'));
      assert.equal(own.body.format, 'moe-member-v1');
      assert.equal(own.body.version, 1);
      assert.ok(typeof own.body.memberNumber === 'string');
      assert.ok(!('phone' in own.body));
      assert.ok(!('userId' in own.body));
      assert.ok(
        (await get('/members/me/qr', memberToken).expect(200)).body.payload ===
          own.body.payload,
      );
      assert.equal(
        (await pool.query('SELECT count(*)::int n FROM member_qr')).rows[0].n,
        3,
      );
      assert.equal(
        (await pool.query('SELECT count(*)::int n FROM memberships')).rows[0].n,
        0,
      );
      const original = (
        await pool.query('SELECT * FROM member_qr WHERE "userId"=$1', [
          memberId,
        ])
      ).rows[0];
      assert.ok(
        qrMatches(own.body.payload, original, process.env.QR_SIGNING_SECRET!),
      );
      await get('/members/me/qr', staff.body.token).expect(200);
      await get(base, memberToken).expect(403);
      await get(base, staff.body.token).expect(403);
      await post(
        base + '/regenerate',
        { version: 1, reason: 'Unauthorized' },
        memberToken,
      ).expect(403);
      await post(
        base + '/regenerate',
        { version: 1, reason: 'Unauthorized' },
        staff.body.token,
      ).expect(403);
      await get(base + '/audit', staff.body.token).expect(403);
      await get('/admin/users/missing/qr').expect(404);
      const meta = (await get(base).expect(200)).body;
      assert.ok(!('payload' in meta));
      assert.ok(!('credentialId' in meta));
      await post(base + '/regenerate', { version: 1, reason: '' }).expect(400);
      await post(base + '/regenerate', {
        version: 1,
        reason: 'Attempt override',
        userId: admin.body.user.id,
      }).expect(400);
      const rotate = (
        await post(base + '/regenerate', {
          version: 1,
          reason: 'Replace lost member card',
        }).expect(200)
      ).body;
      assert.equal(rotate.version, 2);
      assert.ok(!('payload' in rotate));
      const changed = (await get('/members/me/qr', memberToken).expect(200))
        .body;
      assert.ok(changed.payload !== own.body.payload);
      const current = (
        await pool.query('SELECT * FROM member_qr WHERE "userId"=$1', [
          memberId,
        ])
      ).rows[0];
      assert.ok(
        qrMatches(changed.payload, current, process.env.QR_SIGNING_SECRET!),
      );
      assert.ok(
        !qrMatches(own.body.payload, current, process.env.QR_SIGNING_SECRET!),
      );
      assert.equal(
        (
          await pool.query(
            'SELECT count(*)::int n FROM member_qr WHERE "credentialId"=$1',
            [qrLookupId(own.body.payload)],
          )
        ).rows[0].n,
        0,
      );
      await post(base + '/regenerate', {
        version: 1,
        reason: 'Stale retry',
      }).expect(409);
      const racing = await Promise.all([
        post(base + '/regenerate', {
          version: 2,
          reason: 'Concurrent replacement A',
        }),
        post(base + '/regenerate', {
          version: 2,
          reason: 'Concurrent replacement B',
        }),
      ]);
      assert.deepEqual(
        racing.map((result) => result.status).sort(),
        [200, 409],
      );
      assert.equal((await get(base).expect(200)).body.version, 3);
      const history = (await get(base + '/audit').expect(200)).body.items;
      assert.equal(history.length, 2);
      assert.ok(
        history.some(
          (row: { reason: string }) =>
            row.reason === 'Replace lost member card',
        ),
      );
      const auditText = JSON.stringify(history);
      assert.ok(!auditText.includes('credentialId'));
      assert.ok(!auditText.includes(own.body.payload));
      assert.ok(!auditText.includes(changed.payload));
      assert.ok(!auditText.includes(process.env.QR_SIGNING_SECRET!));
      assert.ok(!auditText.includes(original.credentialId));
      assert.equal(
        (await get('/auth/session', memberToken).expect(200)).body.user.id,
        memberId,
      );
      // QR content is never accepted as an authentication bearer token.
      await get('/members/me', changed.payload).expect(401);
      await pool.query('UPDATE moe_auth_user SET enabled=false WHERE id=$1', [
        memberId,
      ]);
      await get('/members/me/qr', memberToken).expect(403);
      await pool.query(
        'UPDATE moe_auth_user SET enabled=true, "mustChangePassword"=true WHERE id=$1',
        [memberId],
      );
      await get('/members/me/qr', memberToken).expect(403);
      await pool.query(
        'UPDATE moe_auth_user SET "mustChangePassword"=false WHERE id=$1',
        [memberId],
      );
      const newRow = (
        await pool.query('SELECT * FROM member_qr WHERE "userId"=$1', [
          memberId,
        ])
      ).rows[0];
      const key = process.env.QR_SIGNING_SECRET;
      delete process.env.QR_SIGNING_SECRET;
      const fallback = (await get('/members/me/qr', memberToken).expect(200))
        .body;
      assert.ok(
        qrMatches(fallback.payload, newRow, process.env.BETTER_AUTH_SECRET!),
      );
      process.env.QR_SIGNING_SECRET = '';
      await get('/members/me/qr', memberToken).expect(503);
      process.env.QR_SIGNING_SECRET = key;
      await pool.query('DELETE FROM moe_auth_session WHERE "userId"=$1', [
        memberId,
      ]);
      await get('/members/me/qr', memberToken).expect(401);
    } finally {
      await app.close();
      await pool.end();
    }
  },
);
