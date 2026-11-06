import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';
import request from 'supertest';
import { createApp } from '../src/create-app.js';
import { membershipStatus } from '../src/common/domain/rules.js';
test('Membership status: inclusive Yangon dates and Completed-before-Expired precedence', () => {
  const base = {
    startDate: new Date('2026-11-01T00:00Z'),
    endDate: new Date('2026-11-05T00:00Z'),
    totalVisits: 10,
    usedVisits: 0,
    cancelledAt: null,
  };
  assert.equal(
    membershipStatus(base, new Date('2026-11-05T17:29:59Z')),
    'Active',
  );
  assert.equal(
    membershipStatus(base, new Date('2026-11-05T17:30:00Z')),
    'Expired',
  );
  assert.equal(
    membershipStatus(
      { ...base, usedVisits: 10 },
      new Date('2026-11-06T00:00Z'),
    ),
    'Completed',
  );
  assert.equal(
    membershipStatus(
      { ...base, usedVisits: 10, cancelledAt: new Date() },
      new Date('2026-11-06T00:00Z'),
    ),
    'Cancelled',
  );
  assert.equal(
    membershipStatus(base, new Date('2026-10-31T00:00Z')),
    'Upcoming',
  );
});
test(
  'Real PostgreSQL plans/memberships: snapshots, dates, overlap races, renewal, audit, cancellation and ownership',
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
        "SELECT 1 FROM pg_database WHERE datname='moe_membership_test'",
      );
      if (!found.rowCount)
        await maintenance.query('CREATE DATABASE moe_membership_test');
    } finally {
      await maintenance.end();
    }
    url.pathname = '/moe_membership_test';
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
    const sign = async (name: string, phone: string) =>
      api
        .post('/api/v1/auth/signup')
        .set('X-MOE-Client', 'mobile')
        .send({ name, phone, password })
        .expect(200);
    const write = (
      method: 'post' | 'patch',
      path: string,
      body: object,
      token: string,
    ) =>
      api[method](path)
        .set('X-MOE-Client', 'mobile')
        .set('Authorization', `Bearer ${token}`)
        .send(body);
    try {
      const admin = await sign('Plan Test Admin', '09791234562');
      await pool.query("UPDATE moe_auth_user SET role='admin' WHERE id=$1", [
        admin.body.user.id,
      ]);
      const token = admin.body.token;
      const member = await sign('Plan Test Member', '09791234563');
      const staff = await sign('Plan Test Staff', '09791234564');
      await pool.query("UPDATE moe_auth_user SET role='staff' WHERE id=$1", [
        staff.body.user.id,
      ]);
      const input = {
        name: 'Weekly Meetup',
        description: 'Community meetup',
        benefits: 'Networking\nShared learning',
        totalVisits: 10,
        reason: 'Initial plan',
      };
      await write(
        'post',
        '/api/v1/admin/plans',
        input,
        member.body.token,
      ).expect(403);
      await write(
        'post',
        '/api/v1/admin/plans',
        input,
        staff.body.token,
      ).expect(403);
      await write(
        'post',
        '/api/v1/admin/plans',
        { ...input, totalVisits: 0 },
        token,
      ).expect(400);
      await write(
        'post',
        '/api/v1/admin/plans',
        { ...input, startDate: '2026-11-01' },
        token,
      ).expect(400);
      const plan = (
        await write('post', '/api/v1/admin/plans', input, token).expect(200)
      ).body;
      const assign = {
        userId: member.body.user.id,
        planId: plan.id,
        planVersion: plan.version,
        startDate: '2026-11-01',
        endDate: '2026-11-30',
        reason: 'Assign first term',
      };
      await write(
        'post',
        '/api/v1/admin/memberships',
        { ...assign, endDate: '2026-10-31' },
        token,
      ).expect(400);
      await write(
        'post',
        '/api/v1/admin/memberships',
        { ...assign, startDate: '2026-02-30' },
        token,
      ).expect(400);
      await write(
        'post',
        '/api/v1/admin/memberships',
        {
          userId: assign.userId,
          planId: assign.planId,
          reason: assign.reason,
          planVersion: 1,
        },
        token,
      ).expect(400);
      for (const target of [admin.body.user.id, staff.body.user.id]) {
        const rejected = await write(
          'post',
          '/api/v1/admin/memberships',
          { ...assign, userId: target },
          token,
        ).expect(409);
        assert.equal(rejected.body.code, 'INVALID_MEMBER_ROLE');
        assert.equal(
          (
            await pool.query(
              'SELECT count(*)::int n FROM memberships WHERE "userId"=$1',
              [target],
            )
          ).rows[0].n,
          0,
        );
      }
      const first = (
        await write('post', '/api/v1/admin/memberships', assign, token).expect(
          200,
        )
      ).body;
      assert.equal(first.totalVisits, 10);
      assert.equal(first.usedVisits, 0);
      assert.equal(first.remainingVisits, 10);
      // A picker selection can become stale: renewal must re-check the target role under lock.
      await pool.query("UPDATE moe_auth_user SET role='staff' WHERE id=$1", [
        member.body.user.id,
      ]);
      try {
        const rejected = await write(
          'post',
          `/api/v1/admin/memberships/${first.id}/renew`,
          {
            planVersion: plan.version,
            startDate: '2026-12-01',
            endDate: '2026-12-31',
            reason: 'Role changed after selection',
          },
          token,
        ).expect(409);
        assert.equal(rejected.body.code, 'INVALID_MEMBER_ROLE');
      } finally {
        await pool.query("UPDATE moe_auth_user SET role='member' WHERE id=$1", [
          member.body.user.id,
        ]);
      }

      const overlap = await write(
        'post',
        '/api/v1/admin/memberships',
        { ...assign, startDate: '2026-11-30', endDate: '2026-12-05' },
        token,
      ).expect(409);
      assert.equal(overlap.body.code, 'MEMBERSHIP_OVERLAP');
      const editedPlan = (
        await write(
          'patch',
          `/api/v1/admin/plans/${plan.id}`,
          {
            ...input,
            totalVisits: 13,
            version: 1,
            reason: 'New quota for future assignments',
          },
          token,
        ).expect(200)
      ).body;
      assert.equal(
        (
          await api
            .get(`/api/v1/admin/memberships/${first.id}`)
            .set('Authorization', `Bearer ${token}`)
            .expect(200)
        ).body.totalVisits,
        10,
      );
      await write(
        'post',
        '/api/v1/admin/memberships',
        { ...assign, startDate: '2027-01-01', endDate: '2027-01-31' },
        token,
      ).expect(409);
      const renew = (
        await write(
          'post',
          `/api/v1/admin/memberships/${first.id}/renew`,
          {
            startDate: '2026-12-01',
            endDate: '2026-12-31',
            planVersion: editedPlan.version,
            reason: 'Renew term',
          },
          token,
        ).expect(200)
      ).body;
      assert.equal(renew.totalVisits, 13);
      assert.equal(renew.usedVisits, 0);
      assert.equal(renew.renewedFromId, first.id);
      const edits = {
        startDate: '2026-11-02',
        endDate: '2026-11-29',
        totalVisits: 10,
        version: 1,
        reason: 'Correct dates',
      };
      const updated = (
        await write(
          'patch',
          `/api/v1/admin/memberships/${first.id}`,
          edits,
          token,
        ).expect(200)
      ).body;
      await write(
        'patch',
        `/api/v1/admin/memberships/${first.id}`,
        edits,
        token,
      ).expect(409);
      await pool.query('UPDATE memberships SET "usedVisits"=5 WHERE id=$1', [
        first.id,
      ]);
      await write(
        'patch',
        `/api/v1/admin/memberships/${first.id}`,
        { ...edits, totalVisits: 4, version: updated.version },
        token,
      ).expect(409);
      await assert.rejects(
        pool.query('UPDATE memberships SET "usedVisits"=11 WHERE id=$1', [
          first.id,
        ]),
        (e: { code?: string }) => e.code === '23514',
      );
      const cancelled = (
        await write(
          'post',
          `/api/v1/admin/memberships/${first.id}/cancel`,
          { version: updated.version, reason: 'Replacement requested' },
          token,
        ).expect(200)
      ).body;
      assert.equal(cancelled.status, 'Cancelled');
      assert.equal(cancelled.usedVisits, 5);
      await write(
        'post',
        `/api/v1/admin/memberships/${first.id}/cancel`,
        { version: updated.version, reason: 'Retry' },
        token,
      ).expect(200);
      assert.equal(
        (
          await pool.query(
            'SELECT count(*) FROM domain_audit WHERE "entityId"=$1 AND action=\'membership.cancelled\'',
            [first.id],
          )
        ).rows[0].count,
        '1',
      );
      const replacement = (
        await write(
          'post',
          '/api/v1/admin/memberships',
          { ...assign, planVersion: editedPlan.version },
          token,
        ).expect(200)
      ).body;
      const races = await Promise.all([
        write(
          'post',
          '/api/v1/admin/memberships',
          {
            ...assign,
            startDate: '2027-01-01',
            endDate: '2027-01-31',
            planVersion: editedPlan.version,
          },
          token,
        ),
        write(
          'post',
          '/api/v1/admin/memberships',
          {
            ...assign,
            startDate: '2027-01-01',
            endDate: '2027-01-31',
            planVersion: editedPlan.version,
          },
          token,
        ),
      ]);
      assert.deepEqual(races.map((item) => item.status).sort(), [200, 409]);
      await assert.rejects(
        pool.query(
          'INSERT INTO memberships(id,"userId","planId","startDate","endDate","totalVisits") VALUES ($1,$2,$3,$4,$5,1)',
          [
            'direct-overlap',
            assign.userId,
            plan.id,
            '2027-01-01',
            '2027-01-02',
          ],
        ),
        (e: { code?: string }) => e.code === '23P01',
      );
      await write(
        'patch',
        `/api/v1/admin/plans/${plan.id}/availability`,
        {
          archived: true,
          version: editedPlan.version,
          reason: 'Archive template',
        },
        token,
      ).expect(200);
      const archived = await write(
        'post',
        '/api/v1/admin/memberships',
        {
          ...assign,
          startDate: '2027-02-01',
          endDate: '2027-02-28',
          planVersion: editedPlan.version + 1,
        },
        token,
      ).expect(409);
      assert.equal(archived.body.code, 'PLAN_ARCHIVED');
      await api
        .get(`/api/v1/admin/memberships/${replacement.id}/audit`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      const mine = await api
        .get('/api/v1/members/me/memberships')
        .set('Authorization', `Bearer ${member.body.token}`)
        .expect(200);
      assert.ok(mine.body.items.length >= 3);
      assert.ok(
        mine.body.items.every(
          (item: { userId: string }) => item.userId === member.body.user.id,
        ),
      );
      await api
        .get(`/api/v1/members/me/memberships/${first.id}`)
        .set('Authorization', `Bearer ${staff.body.token}`)
        .expect(404);
      await api
        .get('/api/v1/members/me/memberships?userId=someone')
        .set('Authorization', `Bearer ${member.body.token}`)
        .expect(400);
      await pool.query(
        'UPDATE memberships SET "usedVisits"="totalVisits" WHERE id=$1',
        [renew.id],
      );
      const completed = await api
        .get('/api/v1/admin/memberships?status=Completed')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      assert.ok(
        completed.body.items.some(
          (item: { id: string }) => item.id === renew.id,
        ),
      );
      const history = await api
        .get(`/api/v1/admin/memberships/${first.id}/audit`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      assert.ok(
        history.body.items.some(
          (item: {
            before?: { startDate?: string };
            after?: { startDate?: string };
          }) =>
            item.before?.startDate === '2026-11-01' &&
            item.after?.startDate === '2026-11-02',
        ),
      );
    } finally {
      await app.close();
      await pool.end();
    }
  },
);
