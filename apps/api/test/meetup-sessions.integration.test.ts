import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';
import request from 'supertest';
import { createApp } from '../src/create-app.js';
test(
  'PostgreSQL meetup sessions: role scope, staff removal/disable, version races, validation and audit',
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
        "SELECT 1 FROM pg_database WHERE datname='moe_session_test'",
      );
      if (!found.rowCount)
        await maintenance.query('CREATE DATABASE moe_session_test');
    } finally {
      await maintenance.end();
    }
    url.pathname = '/moe_session_test';
    process.env.DATABASE_URL = url.toString();
    process.env.DIRECT_URL = url.toString();
    process.env.BETTER_AUTH_SECRET = randomBytes(40).toString('hex');
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
      const admin = await sign('Session Test Admin', '09791234565');
      await pool.query("UPDATE moe_auth_user SET role='admin' WHERE id=$1", [
        admin.body.user.id,
      ]);
      const staff = await sign('Session Test Staff', '09791234566');
      const other = await sign('Other Test Staff', '09791234567');
      const member = await sign('Session Test Member', '09791234568');
      await pool.query(
        "UPDATE moe_auth_user SET role='staff' WHERE id=ANY($1::text[])",
        [[staff.body.user.id, other.body.user.id]],
      );
      const token = admin.body.token,
        staffToken = staff.body.token,
        otherToken = other.body.token;
      const get = (path: string, who = token) =>
        api.get('/api/v1' + path).set('Authorization', 'Bearer ' + who);
      const send = (
        method: 'post' | 'patch' | 'put',
        path: string,
        body: object,
        who = token,
      ) =>
        api[method]('/api/v1' + path)
          .set('Authorization', 'Bearer ' + who)
          .set('X-MOE-Client', 'mobile')
          .send(body);
      await api.get('/api/v1/sessions').expect(401);
      await get('/sessions', member.body.token).expect(403);
      const plan = (
        await send('post', '/admin/plans', {
          name: 'Session Test Plan',
          description: 'Test',
          benefits: 'Meetups',
          totalVisits: 10,
          reason: 'Test setup',
        }).expect(200)
      ).body;
      const input = {
        name: 'November Meetup',
        planId: plan.id,
        meetupDate: '2026-11-05',
        open: false,
        staffIds: [staff.body.user.id],
        reason: 'Create test meetup',
      };
      await send('post', '/admin/sessions', input, staffToken).expect(403);
      await send('post', '/admin/sessions', {
        ...input,
        meetupDate: '2026-02-30',
      }).expect(400);
      await send('post', '/admin/sessions', {
        ...input,
        meetupDate: undefined,
      }).expect(400);
      await send('post', '/admin/sessions', {
        ...input,
        actorId: admin.body.user.id,
      }).expect(400);
      await send('post', '/admin/sessions', {
        ...input,
        staffIds: [staff.body.user.id, staff.body.user.id],
      }).expect(400);
      await send('post', '/admin/sessions', {
        ...input,
        staffIds: [member.body.user.id],
      }).expect(409);
      await send('post', '/admin/sessions', {
        ...input,
        staffIds: ['missing-staff'],
      }).expect(409);
      const session = (await send('post', '/admin/sessions', input).expect(200))
        .body;
      assert.equal(session.meetupDate, '2026-11-05');
      assert.equal(session.version, 1);
      assert.equal(session.staff[0].id, staff.body.user.id);
      assert.ok(!JSON.stringify(session).includes('email'));
      assert.ok(!JSON.stringify(session).includes('password'));
      await send('post', '/admin/sessions', {
        ...input,
        name: 'Unassigned Meetup',
        staffIds: [],
      }).expect(200);
      assert.equal((await get('/sessions').expect(200)).body.items.length, 2);
      const assigned = (await get('/sessions', staffToken).expect(200)).body;
      assert.equal(assigned.items.length, 1);
      assert.equal(assigned.items[0].staff, undefined);
      assert.equal(
        (await get('/sessions', otherToken).expect(200)).body.items.length,
        0,
      );
      await get('/sessions/' + session.id, otherToken).expect(404);
      const staffDetail = (
        await get('/sessions/' + session.id, staffToken).expect(200)
      ).body;
      assert.equal(staffDetail.staff, undefined);
      await get('/admin/sessions/' + session.id + '/audit', staffToken).expect(
        403,
      );
      await send(
        'put',
        '/admin/sessions/' + session.id + '/staff',
        { staffIds: [], version: 1, reason: 'Unauthorized' },
        staffToken,
      ).expect(403);
      await send(
        'patch',
        '/admin/sessions/' + session.id + '/state',
        { open: true, version: 1, reason: 'Unauthorized' },
        staffToken,
      ).expect(403);
      assert.equal(
        (await get('/sessions?open=true').expect(200)).body.items.length,
        0,
      );
      assert.equal(
        (await get('/sessions?from=2026-11-05&to=2026-11-05').expect(200)).body
          .items.length,
        2,
      );
      await get('/sessions?from=2026-11-06&to=2026-11-05').expect(400);
      await get('/sessions?userId=' + other.body.user.id, staffToken).expect(
        400,
      );
      const opened = (
        await send('patch', '/admin/sessions/' + session.id + '/state', {
          open: true,
          version: 1,
          reason: 'Start meetup',
        }).expect(200)
      ).body;
      assert.equal(opened.version, 2);
      assert.equal(opened.open, true);
      assert.equal(
        (await get('/sessions?open=true&search=November').expect(200)).body
          .items.length,
        1,
      );
      await send('patch', '/admin/sessions/' + session.id + '/state', {
        open: false,
        version: 1,
        reason: 'Stale change',
      }).expect(409);
      await send('put', '/admin/sessions/' + session.id + '/staff', {
        staffIds: [other.body.user.id],
        version: 2,
        reason: 'Hand over meetup',
      }).expect(200);
      await get('/sessions/' + session.id, staffToken).expect(404);
      assert.equal(
        (await get('/sessions', staffToken).expect(200)).body.items.length,
        0,
      );
      await get('/sessions/' + session.id, otherToken).expect(200);
      const race = await Promise.all([
        send('patch', '/admin/sessions/' + session.id + '/state', {
          open: false,
          version: 3,
          reason: 'Close simultaneously A',
        }),
        send('put', '/admin/sessions/' + session.id + '/staff', {
          staffIds: [],
          version: 3,
          reason: 'Remove simultaneously B',
        }),
      ]);
      assert.deepEqual(race.map((result) => result.status).sort(), [200, 409]);
      const current = (await get('/sessions/' + session.id).expect(200)).body;
      await send('put', '/admin/sessions/' + session.id + '/staff', {
        staffIds: [other.body.user.id],
        version: current.version,
        reason: 'Restore scanner assignment',
      }).expect(200);
      await pool.query('UPDATE moe_auth_user SET enabled=false WHERE id=$1', [
        other.body.user.id,
      ]);
      await get('/sessions', otherToken).expect(403);
      const beforeInvalid = (await get('/sessions/' + session.id).expect(200))
        .body;
      await send('put', '/admin/sessions/' + session.id + '/staff', {
        staffIds: [other.body.user.id],
        version: beforeInvalid.version,
        reason: 'Disabled staff must fail',
      }).expect(409);
      assert.equal(
        (await get('/sessions/' + session.id).expect(200)).body.version,
        beforeInvalid.version,
      );
      await send('put', '/admin/sessions/' + session.id + '/staff', {
        staffIds: [],
        version: beforeInvalid.version,
        reason: 'Remove disabled staff',
      }).expect(200);
      const history = (
        await get('/admin/sessions/' + session.id + '/audit').expect(200)
      ).body.items;
      assert.ok(
        history.find(
          (row: { reason: string }) => row.reason === 'Hand over meetup',
        ),
      );
      const handover = history.find(
        (row: { reason: string }) => row.reason === 'Hand over meetup',
      );
      assert.deepEqual(handover.before.staffIds, [staff.body.user.id]);
      assert.deepEqual(handover.after.staffIds, [other.body.user.id]);
      assert.equal(handover.actorId, admin.body.user.id);
      await send('patch', '/admin/plans/' + plan.id + '/availability', {
        archived: true,
        version: plan.version,
        reason: 'Archive for test',
      }).expect(200);
      await send('post', '/admin/sessions', input).expect(409);
      await get('/sessions/' + session.id).expect(200);
      const trashPlan = (id: string, action: string, version: number) =>
        send('patch', '/admin/plans/' + id + '/trash', {
          action,
          version,
          reason: 'Trash regression',
        });
      await trashPlan(plan.id, 'move', plan.version + 1).expect(200);
      assert.ok(
        (await get('/admin/plans?trash=true').expect(200)).body.items.some(
          (item: { id: string }) => item.id === plan.id,
        ),
      );
      const blocked = await trashPlan(
        plan.id,
        'delete',
        plan.version + 2,
      ).expect(409);
      assert.equal(blocked.body.code, 'PLAN_IN_USE');
      await trashPlan(plan.id, 'restore', plan.version + 2).expect(200);
      assert.equal(
        (await get('/admin/plans/' + plan.id).expect(200)).body.archived,
        true,
      );
      const unused = (
        await send('post', '/admin/plans', {
          name: 'Unused test plan',
          description: '',
          benefits: '',
          totalVisits: 1,
          reason: 'Setup',
        }).expect(200)
      ).body;
      await trashPlan(unused.id, 'delete', unused.version).expect(409);
      await trashPlan(unused.id, 'move', unused.version).expect(200);
      await send('post', '/admin/sessions', {
        ...input,
        planId: unused.id,
      }).expect(409);
      await trashPlan(unused.id, 'delete', unused.version + 1).expect(200);
      await get('/admin/plans/' + unused.id).expect(404);
      // Role demotion also removes access even when assignment rows are retained.
      const another = (
        await send('post', '/admin/plans', {
          name: 'Another plan',
          description: '',
          benefits: '',
          totalVisits: 1,
          reason: 'Setup',
        }).expect(200)
      ).body;
      const roleSession = (
        await send('post', '/admin/sessions', {
          ...input,
          planId: another.id,
        }).expect(200)
      ).body;
      await pool.query("UPDATE moe_auth_user SET role='member' WHERE id=$1", [
        staff.body.user.id,
      ]);
      await get('/sessions/' + roleSession.id, staffToken).expect(403);
      const noOp = (await get('/sessions/' + session.id).expect(200)).body;
      const count = await pool.query(
        'SELECT count(*)::int n FROM domain_audit WHERE "entityId"=$1',
        [session.id],
      );
      await send('patch', '/admin/sessions/' + session.id + '/state', {
        open: noOp.open,
        version: noOp.version,
        reason: 'Same state retry',
      }).expect(200);
      assert.equal(
        (
          await pool.query(
            'SELECT count(*)::int n FROM domain_audit WHERE "entityId"=$1',
            [session.id],
          )
        ).rows[0].n,
        count.rows[0].n,
      );
    } finally {
      await app.close();
      await pool.end();
    }
  },
);
