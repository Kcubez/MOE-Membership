import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';
import request from 'supertest';
import { createApp } from '../src/create-app.js';
import { yangonToday } from '../src/common/domain/rules.js';
test(
  'PostgreSQL live check-in: permissions, idempotency, duplicate/last-visit races, rollback, date and QR eligibility, quota accounting',
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
        "SELECT 1 FROM pg_database WHERE datname='moe_attendance_test'",
      );
      if (!found.rowCount)
        await maintenance.query('CREATE DATABASE moe_attendance_test');
    } finally {
      await maintenance.end();
    }
    url.pathname = '/moe_attendance_test';
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
      const admin = await sign('Scan Test Admin', '09791234572'),
        a = await sign('Scan Test Staff A', '09791234573'),
        b = await sign('Scan Test Staff B', '09791234574'),
        m = await sign('Scan Test Member', '09791234575'),
        outsider = await sign('Scan Unassigned Staff', '09791234576');
      await pool.query("UPDATE moe_auth_user SET role='admin' WHERE id=$1", [
        admin.body.user.id,
      ]);
      await pool.query(
        "UPDATE moe_auth_user SET role='staff' WHERE id=ANY($1::text[])",
        [[a.body.user.id, b.body.user.id, outsider.body.user.id]],
      );
      const send = (
        method: 'post' | 'patch' | 'put',
        path: string,
        data: object,
        token = admin.body.token,
      ) =>
        api[method]('/api/v1' + path)
          .set('X-MOE-Client', 'mobile')
          .set('Authorization', 'Bearer ' + token)
          .send(data);
      const get = (path: string, token = admin.body.token) =>
        api.get('/api/v1' + path).set('Authorization', 'Bearer ' + token);
      const today = yangonToday(),
        shift = (n: number) =>
          new Date(Date.parse(today + 'T12:00Z') + n * 86400000)
            .toISOString()
            .slice(0, 10);
      const makePlan = async (visits: number) =>
        (
          await send('post', '/admin/plans', {
            name: 'Scanner plan ' + randomUUID(),
            description: '',
            benefits: '',
            totalVisits: visits,
            reason: 'Scanner test setup',
          }).expect(200)
        ).body;
      const assign = async (
        plan: { id: string; version: number },
        start = today,
        end = today,
      ) =>
        (
          await send('post', '/admin/memberships', {
            userId: m.body.user.id,
            planId: plan.id,
            planVersion: plan.version,
            startDate: start,
            endDate: end,
            reason: 'Scanner test assignment',
          }).expect(200)
        ).body;
      const meetup = async (plan: { id: string }, day = today) =>
        (
          await send('post', '/admin/sessions', {
            name: 'Scanner meetup ' + randomUUID(),
            planId: plan.id,
            meetupDate: day,
            open: true,
            staffIds: [a.body.user.id, b.body.user.id],
            reason: 'Scanner test setup',
          }).expect(200)
        ).body;
      const qr = async () =>
        (await get('/members/me/qr', m.body.token).expect(200)).body
          .payload as string;
      let payload = await qr();
      const plan = await makePlan(10),
        term = await assign(plan),
        s1 = await meetup(plan),
        s2 = await meetup(plan);
      const scan = (
        session: { id: string },
        token = a.body.token,
        key = randomUUID(),
        value = payload,
      ) =>
        send(
          'post',
          '/sessions/' + session.id + '/check-ins',
          { requestId: key, qrPayload: value },
          token,
        );
      const balance = async (id = term.id) =>
        (
          await pool.query(
            'SELECT "usedVisits",version FROM memberships WHERE id=$1',
            [id],
          )
        ).rows[0];
      await api
        .post('/api/v1/sessions/' + s1.id + '/check-ins')
        .set('X-MOE-Client', 'mobile')
        .send({ requestId: randomUUID(), qrPayload: payload })
        .expect(401);
      await scan(s1, m.body.token).expect(403);
      await scan(s1, outsider.body.token).expect(404);
      await send(
        'post',
        '/sessions/' + s1.id + '/check-ins',
        { requestId: randomUUID(), qrPayload: payload, userId: m.body.user.id },
        a.body.token,
      ).expect(400);
      await scan(s1, a.body.token, randomUUID(), 'invalid-qr').expect(409);
      assert.equal((await balance()).usedVisits, 0);
      const key = randomUUID();
      const first = (await scan(s1, a.body.token, key).expect(200)).body;
      assert.equal(first.outcome, 'CHECKED_IN');
      assert.equal(first.membership.remainingVisits, 9);
      assert.ok(!('phone' in first.member));
      const replay = (await scan(s1, a.body.token, key).expect(200)).body;
      assert.equal(replay.replayed, true);
      assert.equal(replay.attendanceId, first.attendanceId);
      assert.equal(replay.checkedInAt, first.checkedInAt);
      const repeat = (await scan(s1, b.body.token).expect(200)).body;
      assert.equal(repeat.outcome, 'ALREADY_CHECKED_IN');
      assert.equal(repeat.checkedInAt, first.checkedInAt);
      assert.equal((await balance()).usedVisits, 1);
      await scan(s2, a.body.token, key).expect(409);
      await pool.query('UPDATE moe_auth_user SET enabled=false WHERE id=$1', [
        m.body.user.id,
      ]);
      const denied = await scan(s2);
      assert.equal(denied.status, 409);
      assert.equal(denied.body.code, 'ACCOUNT_DISABLED');
      assert.ok(!('member' in denied.body));
      await pool.query('UPDATE moe_auth_user SET enabled=true WHERE id=$1', [
        m.body.user.id,
      ]);
      await pool.query('UPDATE moe_auth_user SET enabled=false WHERE id=$1', [
        b.body.user.id,
      ]);
      await scan(s2, b.body.token).expect(403);
      await pool.query('UPDATE moe_auth_user SET enabled=true WHERE id=$1', [
        b.body.user.id,
      ]);
      await send('post', '/admin/users/' + m.body.user.id + '/qr/regenerate', {
        version: 1,
        reason: 'Test QR invalidation',
      }).expect(200);
      await scan(s2).expect(409);
      payload = await qr();
      const secondKey = randomUUID();
      await scan(s2, a.body.token, secondKey).expect(200);
      assert.equal((await balance()).usedVisits, 2);
      await send('patch', '/admin/sessions/' + s2.id + '/state', {
        version: 1,
        open: false,
        reason: 'Close for test',
      }).expect(200);
      await scan(s2).expect(409);
      assert.equal(
        (await scan(s2, a.body.token, secondKey).expect(200)).body.replayed,
        true,
      );
      const past = await meetup(plan, shift(-1)),
        future = await meetup(plan, shift(1));
      assert.equal(
        (await scan(past).expect(409)).body.code,
        'SESSION_DATE_MISMATCH',
      );
      await scan(future).expect(409);
      const upcoming = await makePlan(3);
      await assign(upcoming, shift(1), shift(2));
      assert.equal(
        (await scan(await meetup(upcoming)).expect(409)).body.code,
        'NO_ELIGIBLE_MEMBERSHIP',
      );
      const expired = await makePlan(3);
      await assign(expired, shift(-2), shift(-1));
      await scan(await meetup(expired)).expect(409);
      const cancelled = await makePlan(3),
        cancelTerm = await assign(cancelled);
      await send('post', '/admin/memberships/' + cancelTerm.id + '/cancel', {
        version: cancelTerm.version,
        reason: 'Cancel test term',
      }).expect(200);
      await scan(await meetup(cancelled)).expect(409);
      const otherPlan = await makePlan(5),
        otherTerm = await assign(otherPlan),
        otherSession = await meetup(otherPlan);
      await scan(otherSession).expect(200);
      assert.equal((await balance()).usedVisits, 2);
      assert.equal((await balance(otherTerm.id)).usedVisits, 1);
      const lastPlan = await makePlan(1),
        lastTerm = await assign(lastPlan),
        lastA = await meetup(lastPlan),
        lastB = await meetup(lastPlan),
        lastKeyA = randomUUID(),
        lastKeyB = randomUUID();
      const last = await Promise.all([
        scan(lastA, a.body.token, lastKeyA),
        scan(lastB, b.body.token, lastKeyB),
      ]);
      assert.deepEqual(last.map((r) => r.status).sort(), [200, 409]);
      const loser = last.find((r) => r.status === 409)!;
      assert.equal(loser.body.code, 'VISITS_EXHAUSTED');
      assert.equal((await balance(lastTerm.id)).usedVisits, 1);
      const winner = last[0].status === 200 ? lastA : lastB;
      const winnerKey = last[0].status === 200 ? lastKeyA : lastKeyB;
      const winnerActor = last[0].status === 200 ? a.body.token : b.body.token;
      assert.equal(
        (await scan(winner).expect(200)).body.outcome,
        'ALREADY_CHECKED_IN',
      );
      const samePlan = await makePlan(2),
        sameTerm = await assign(samePlan),
        same = await meetup(samePlan);
      const duplicate = await Promise.all([
        scan(same, a.body.token),
        scan(same, b.body.token),
      ]);
      assert.ok(duplicate.every((r) => r.status === 200));
      assert.deepEqual(duplicate.map((r) => r.body.outcome).sort(), [
        'ALREADY_CHECKED_IN',
        'CHECKED_IN',
      ]);
      assert.equal((await balance(sameTerm.id)).usedVisits, 1);
      // Force a late audit failure: attendance, visit counter and operation row must all roll back.
      const rollbackSession = await meetup(otherPlan),
        rollbackKey = randomUUID();
      await pool.query(
        "ALTER TABLE domain_audit ADD CONSTRAINT scan_test_failure CHECK (action <> 'attendance.checked_in') NOT VALID",
      );
      try {
        await scan(rollbackSession, a.body.token, rollbackKey).expect(503);
        assert.equal((await balance(otherTerm.id)).usedVisits, 1);
        assert.equal(
          (
            await pool.query(
              'SELECT count(*)::int n FROM attendance WHERE "sessionId"=$1',
              [rollbackSession.id],
            )
          ).rows[0].n,
          0,
        );
        assert.equal(
          (
            await pool.query(
              'SELECT count(*)::int n FROM check_in_operations WHERE "requestId"=$1',
              [rollbackKey],
            )
          ).rows[0].n,
          0,
        );
      } finally {
        await pool.query(
          'ALTER TABLE domain_audit DROP CONSTRAINT scan_test_failure',
        );
      }
      await scan(rollbackSession, a.body.token, rollbackKey).expect(200);
      const fresh = (
        await get('/admin/memberships/' + otherTerm.id).expect(200)
      ).body;
      assert.equal(
        (
          await send('patch', '/admin/memberships/' + otherTerm.id, {
            version: fresh.version,
            startDate: shift(1),
            endDate: shift(2),
            totalVisits: 5,
            reason: 'Cannot hide attendance',
          }).expect(409)
        ).body.code,
        'ATTENDANCE_OUTSIDE_PERIOD',
      );
      // A real PostgreSQL serialization failure is retried with its whole transaction rolled back.
      const retrySession = await meetup(otherPlan),
        retryKey = randomUUID();
      const beforeRetry = (await balance(otherTerm.id)).usedVisits;
      await pool.query('CREATE SEQUENCE scan_test_retry_seq');
      await pool.query(
        "CREATE FUNCTION scan_test_retry() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF nextval('scan_test_retry_seq')=1 THEN RAISE EXCEPTION 'Synthetic serialization conflict' USING ERRCODE='40001'; END IF; RETURN NEW; END; $$",
      );
      await pool.query(
        'CREATE TRIGGER zz_scan_test_retry BEFORE INSERT ON attendance FOR EACH ROW EXECUTE FUNCTION scan_test_retry()',
      );
      try {
        await scan(retrySession, a.body.token, retryKey).expect(200);
        assert.equal((await balance(otherTerm.id)).usedVisits, beforeRetry + 1);
        assert.equal(
          (await pool.query('SELECT last_value FROM scan_test_retry_seq'))
            .rows[0].last_value,
          '2',
        );
      } finally {
        await pool.query('DROP TRIGGER zz_scan_test_retry ON attendance');
        await pool.query('DROP FUNCTION scan_test_retry()');
        await pool.query('DROP SEQUENCE scan_test_retry_seq');
      }
      // Database cancellation foundation refunds once and keeps old request identities safe.
      const won = last.find((r) => r.status === 200)!.body;
      await pool.query(
        'UPDATE attendance SET "cancelledAt"=clock_timestamp(),"cancelledById"=$2,"cancellationReason"=$3 WHERE id=$1',
        [won.attendanceId, admin.body.user.id, 'Test refund'],
      );
      assert.equal((await balance(lastTerm.id)).usedVisits, 0);
      assert.equal(
        (await scan(winner, winnerActor, winnerKey).expect(200)).body.outcome,
        'CANCELLED',
      );
      assert.equal((await balance(lastTerm.id)).usedVisits, 0);
      await scan(winner).expect(200);
      await pool.query(
        'UPDATE attendance SET "cancellationReason"="cancellationReason" WHERE id=$1',
        [won.attendanceId],
      );
      assert.equal((await balance(lastTerm.id)).usedVisits, 1);
      await assert.rejects(
        pool.query('DELETE FROM attendance WHERE id=$1', [won.attendanceId]),
        (error: unknown) => (error as { code: string }).code === '23514',
      );
      for (let i = 0; i < 8; i++) await scan(await meetup(plan)).expect(200);
      assert.equal((await balance()).usedVisits, 10);
      await scan(await meetup(plan)).expect(409);
      // Removal committed while a scan is waiting must be rechecked after acquiring locks.
      const revokedSession = await meetup(otherPlan);
      const held = await pool.connect();
      await held.query('BEGIN');
      await held.query('SELECT id FROM moe_auth_user WHERE id=$1 FOR UPDATE', [
        m.body.user.id,
      ]);
      const waitingKey = randomUUID();
      const waiting = scan(revokedSession, a.body.token, waitingKey).then(
        (response) => response,
      );
      try {
        let blocked = false;
        for (let i = 0; i < 100; i++) {
          const observed = await pool.query(
            "SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE '%moe_auth_user%' LIMIT 1",
          );
          if (observed.rowCount) {
            blocked = true;
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
        assert.ok(blocked, 'Scanner reached the authorization lock barrier');
        await send('put', '/admin/sessions/' + revokedSession.id + '/staff', {
          version: 1,
          staffIds: [],
          reason: 'Revoke in-flight scanner assignment',
        }).expect(200);
      } finally {
        await held.query('ROLLBACK');
        held.release();
      }
      assert.equal((await waiting).status, 404);
      assert.equal(
        (
          await pool.query(
            'SELECT count(*)::int n FROM check_in_operations WHERE "requestId"=$1',
            [waitingKey],
          )
        ).rows[0].n,
        0,
      );
      {
        // API cancellation preserves the original record and refunds once, including concurrent retries.
        const cancelPlan = await makePlan(1),
          cancelTerm = await assign(cancelPlan),
          cancelSession = await meetup(cancelPlan),
          originalKey = randomUUID();
        const original = (
          await scan(cancelSession, a.body.token, originalKey).expect(200)
        ).body;
        const cancel = (
          id: string,
          reason = 'Wrong person recorded',
          token = admin.body.token,
        ) =>
          send(
            'post',
            '/admin/attendance/' + id + '/cancel',
            { reason },
            token,
          );
        await api
          .post('/api/v1/admin/attendance/' + original.attendanceId + '/cancel')
          .set('X-MOE-Client', 'mobile')
          .send({ reason: 'Test' })
          .expect(401);
        await cancel(original.attendanceId, 'Test', a.body.token).expect(403);
        await cancel(original.attendanceId, 'Test', m.body.token).expect(403);
        await cancel('missing-attendance').expect(404);
        await cancel(original.attendanceId, ' ').expect(400);
        await cancel(original.attendanceId, 'x'.repeat(501)).expect(400);
        await send(
          'post',
          '/admin/attendance/' + original.attendanceId + '/cancel',
          { reason: 'Test', usedVisits: 0 },
        ).expect(400);
        const before = await balance(cancelTerm.id);
        await pool.query(
          "ALTER TABLE domain_audit ADD CONSTRAINT cancel_test_failure CHECK (action <> 'attendance.cancelled') NOT VALID",
        );
        try {
          await cancel(original.attendanceId).expect(503);
          assert.deepEqual(await balance(cancelTerm.id), before);
          assert.equal(
            (
              await pool.query(
                'SELECT "cancelledAt" FROM attendance WHERE id=$1',
                [original.attendanceId],
              )
            ).rows[0].cancelledAt,
            null,
          );
        } finally {
          await pool.query(
            'ALTER TABLE domain_audit DROP CONSTRAINT cancel_test_failure',
          );
        }
        const outcomes = await Promise.all([
          cancel(original.attendanceId, 'Correction A').then((r) => r),
          cancel(original.attendanceId, 'Correction B').then((r) => r),
        ]);
        assert.ok(outcomes.every((r) => r.status === 200));
        assert.deepEqual(outcomes.map((r) => r.body.outcome).sort(), [
          'ALREADY_CANCELLED',
          'CANCELLED',
        ]);
        assert.equal(outcomes.filter((r) => r.body.refundApplied).length, 1);
        assert.deepEqual(
          outcomes[0].body.cancellation,
          outcomes[1].body.cancellation,
        );
        assert.equal((await balance(cancelTerm.id)).usedVisits, 0);
        assert.equal(
          (await balance(cancelTerm.id)).version,
          before.version + 1,
        );
        const repeated = (
          await cancel(original.attendanceId, 'Do not overwrite').expect(200)
        ).body;
        assert.equal(repeated.refundApplied, false);
        assert.deepEqual(repeated.cancellation, outcomes[0].body.cancellation);
        assert.equal(
          (
            await pool.query(
              'SELECT count(*)::int n FROM domain_audit WHERE "entityId"=$1 AND action=$2',
              [original.attendanceId, 'attendance.cancelled'],
            )
          ).rows[0].n,
          1,
        );
        assert.equal(
          (await scan(cancelSession, a.body.token, originalKey).expect(200))
            .body.outcome,
          'CANCELLED',
        );
        const replacement = (await scan(cancelSession).expect(200)).body;
        assert.notEqual(replacement.attendanceId, original.attendanceId);
        assert.equal((await balance(cancelTerm.id)).usedVisits, 1);
        await cancel(original.attendanceId).expect(200);
        assert.equal((await balance(cancelTerm.id)).usedVisits, 1);
        // Corrections still apply to disabled users and cancelled terms, without crediting a replacement term.
        const current = (
          await get('/admin/memberships/' + cancelTerm.id).expect(200)
        ).body;
        await send('post', '/admin/memberships/' + cancelTerm.id + '/cancel', {
          version: current.version,
          reason: 'Cancelled term',
        }).expect(200);
        const newTerm = await assign(cancelPlan);
        await send('patch', '/admin/sessions/' + cancelSession.id + '/state', {
          open: false,
          version: cancelSession.version,
          reason: 'Closed meetup',
        }).expect(200);
        await pool.query('UPDATE moe_auth_user SET enabled=false WHERE id=$1', [
          m.body.user.id,
        ]);
        try {
          const corrected = (await cancel(replacement.attendanceId).expect(200))
            .body;
          assert.equal(corrected.membership.id, cancelTerm.id);
          assert.equal(corrected.membership.remainingVisits, 1);
        } finally {
          await pool.query(
            'UPDATE moe_auth_user SET enabled=true WHERE id=$1',
            [m.body.user.id],
          );
        }
        assert.equal((await balance(cancelTerm.id)).usedVisits, 0);
        assert.equal((await balance(newTerm.id)).usedVisits, 0);
        const retained = (
          await get(
            '/members/me/attendance?membershipId=' + cancelTerm.id,
            m.body.token,
          ).expect(200)
        ).body;
        assert.equal(retained.items.length, 2);
        assert.ok(
          retained.items.every(
            (r: { status: string; cancellation: unknown }) =>
              r.status === 'cancelled' && r.cancellation,
          ),
        );
        // A cancel/scan race is serialized: scan either sees the old effective row or creates a fresh one after cancellation.
        const racingPlan = await makePlan(1),
          racingTerm = await assign(racingPlan),
          racingSession = await meetup(racingPlan);
        const firstRace = (await scan(racingSession).expect(200)).body;
        const racing = await Promise.all([
          cancel(firstRace.attendanceId).then((r) => r),
          scan(racingSession).then((r) => r),
        ]);
        assert.ok(racing.every((r) => r.status === 200));
        const effective = (
          await pool.query(
            'SELECT count(*)::int n FROM attendance WHERE "membershipId"=$1 AND "cancelledAt" IS NULL',
            [racingTerm.id],
          )
        ).rows[0].n;
        assert.equal((await balance(racingTerm.id)).usedVisits, effective);
        assert.equal(
          effective,
          racing[1].body.outcome === 'CHECKED_IN' ? 1 : 0,
        );
        // Real serialization failure retries the complete refund transaction without losing or doubling the credit.
        const retryPlan = await makePlan(1),
          retryTerm = await assign(retryPlan),
          retrySession = await meetup(retryPlan);
        const retryAttendance = (await scan(retrySession).expect(200)).body;
        await pool.query('CREATE SEQUENCE cancel_test_retry_seq');
        await pool.query(
          "CREATE FUNCTION cancel_test_retry() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF OLD.\"cancelledAt\" IS NULL AND NEW.\"cancelledAt\" IS NOT NULL AND nextval('cancel_test_retry_seq')=1 THEN RAISE EXCEPTION 'Synthetic cancellation conflict' USING ERRCODE='40001'; END IF; RETURN NEW; END; $$",
        );
        await pool.query(
          'CREATE TRIGGER zz_cancel_test_retry BEFORE UPDATE ON attendance FOR EACH ROW EXECUTE FUNCTION cancel_test_retry()',
        );
        try {
          await cancel(retryAttendance.attendanceId).expect(200);
          assert.equal((await balance(retryTerm.id)).usedVisits, 0);
          assert.equal(
            (await pool.query('SELECT last_value FROM cancel_test_retry_seq'))
              .rows[0].last_value,
            '2',
          );
        } finally {
          await pool.query('DROP TRIGGER zz_cancel_test_retry ON attendance');
          await pool.query('DROP FUNCTION cancel_test_retry()');
          await pool.query('DROP SEQUENCE cancel_test_retry_seq');
        }
      }
      {
        // Historical attendance uses the event date, not today's membership status.
        const historyPlan = await makePlan(3),
          historyTerm = await assign(historyPlan, shift(-2), shift(-1)),
          historySession = await meetup(historyPlan, shift(-1));
        await send('patch', '/admin/sessions/' + historySession.id + '/state', {
          open: false,
          version: historySession.version,
          reason: 'Historical session closed',
        }).expect(200);
        const key = randomUUID(),
          occurredAt = shift(-1) + 'T23:59:00+06:30';
        const backfill = (
          session: { id: string },
          requestId = randomUUID(),
          overrides: Record<string, unknown> = {},
          token = admin.body.token,
        ) =>
          send(
            'post',
            '/admin/sessions/' + session.id + '/attendance/backfill',
            {
              requestId,
              userId: m.body.user.id,
              occurredAt,
              reason: 'Missed scanner during network outage',
              ...overrides,
            },
            token,
          );
        await api
          .post(
            '/api/v1/admin/sessions/' +
              historySession.id +
              '/attendance/backfill',
          )
          .set('X-MOE-Client', 'mobile')
          .send({})
          .expect(401);
        await backfill(historySession, randomUUID(), {}, a.body.token).expect(
          403,
        );
        await backfill(historySession, randomUUID(), {}, m.body.token).expect(
          403,
        );
        await backfill(historySession, randomUUID(), { reason: '  ' }).expect(
          400,
        );
        await backfill(historySession, randomUUID(), { usedVisits: 0 }).expect(
          400,
        );
        await backfill(historySession, randomUUID(), {
          occurredAt: 'invalid',
        }).expect(400);
        await backfill(historySession, randomUUID(), {
          occurredAt: today + 'T00:00:00+06:30',
        }).expect(409);
        await backfill(s1).expect(409);
        await backfill(await meetup(historyPlan, shift(1)), randomUUID(), {
          occurredAt: shift(1) + 'T12:00:00+06:30',
        }).expect(409);
        const saved = (await backfill(historySession, key).expect(200)).body;
        assert.equal(saved.outcome, 'CHECKED_IN');
        assert.equal(saved.checkedInAt, new Date(occurredAt).toISOString());
        assert.equal(saved.membership.usedVisits, 1);
        const stored = (
          await pool.query(
            'SELECT method,"occurredAt","recordedAt","recordedById" FROM attendance WHERE id=$1',
            [saved.attendanceId],
          )
        ).rows[0];
        assert.equal(
          stored.occurredAt.toISOString(),
          new Date(occurredAt).toISOString(),
        );
        assert.equal(stored.method, 'backfill');
        assert.equal(stored.recordedById, admin.body.user.id);
        assert.ok(stored.recordedAt > stored.occurredAt);
        const replay = (
          await backfill(historySession, key, {
            occurredAt: new Date(occurredAt).toISOString(),
          }).expect(200)
        ).body;
        assert.equal(replay.replayed, true);
        assert.equal(replay.attendanceId, saved.attendanceId);
        await scan(s1, admin.body.token, key).expect(409);
        assert.equal(
          (await backfill(historySession).expect(200)).body.outcome,
          'ALREADY_CHECKED_IN',
        );
        assert.equal(
          (
            await backfill(historySession, key, {
              reason: 'Changed input',
            }).expect(409)
          ).body.code,
          'IDEMPOTENCY_CONFLICT',
        );
        assert.equal((await balance(historyTerm.id)).usedVisits, 1);
        const auditRow = (
          await pool.query(
            'SELECT reason,action FROM domain_audit WHERE "entityId"=$1',
            [saved.attendanceId],
          )
        ).rows[0];
        assert.equal(auditRow.action, 'attendance.backfilled');
        assert.equal(auditRow.reason, 'Missed scanner during network outage');
        await pool.query('UPDATE moe_auth_user SET enabled=false WHERE id=$1', [
          m.body.user.id,
        ]);
        await backfill(historySession).expect(409);
        await pool.query('UPDATE moe_auth_user SET enabled=true WHERE id=$1', [
          m.body.user.id,
        ]);
        const outside = await meetup(historyPlan, shift(-3));
        await backfill(outside, randomUUID(), {
          occurredAt: shift(-3) + 'T12:00:00+06:30',
        }).expect(409);
        // Cancellation never lets an old operation recreate attendance.
        await pool.query(
          'UPDATE attendance SET "cancelledAt"=clock_timestamp(),"cancelledById"=$2,"cancellationReason"=$3 WHERE id=$1',
          [
            saved.attendanceId,
            admin.body.user.id,
            'Test historical correction',
          ],
        );
        assert.equal(
          (await backfill(historySession, key).expect(200)).body.outcome,
          'CANCELLED',
        );
        assert.equal((await balance(historyTerm.id)).usedVisits, 0);
        await backfill(historySession).expect(200);
        // Failed audit rolls back historical attendance, usage and idempotency row together.
        const failedSession = await meetup(historyPlan, shift(-2)),
          failedKey = randomUUID();
        await pool.query(
          "ALTER TABLE domain_audit ADD CONSTRAINT backfill_test_failure CHECK (action <> 'attendance.backfilled') NOT VALID",
        );
        try {
          await backfill(failedSession, failedKey, {
            occurredAt: shift(-2) + 'T00:00:00+06:30',
          }).expect(503);
          assert.equal((await balance(historyTerm.id)).usedVisits, 1);
          assert.equal(
            (
              await pool.query(
                'SELECT count(*)::int n FROM check_in_operations WHERE "requestId"=$1',
                [failedKey],
              )
            ).rows[0].n,
            0,
          );
        } finally {
          await pool.query(
            'ALTER TABLE domain_audit DROP CONSTRAINT backfill_test_failure',
          );
        }
        await backfill(failedSession, failedKey, {
          occurredAt: shift(-2) + 'T00:00:00+06:30',
        }).expect(200);
        const currentHistorical = (
          await get('/admin/memberships/' + historyTerm.id).expect(200)
        ).body;
        await send('patch', '/admin/memberships/' + historyTerm.id, {
          version: currentHistorical.version,
          startDate: shift(-1),
          endDate: shift(-1),
          totalVisits: 3,
          reason: 'Cannot exclude historical attendance',
        }).expect(409);
        // Live and backfill compete for the same final available visit.
        const racePlan = await makePlan(1),
          raceTerm = await assign(racePlan, shift(-1), today),
          oldSession = await meetup(racePlan, shift(-1)),
          liveSession = await meetup(racePlan);
        const race = await Promise.all([
          backfill(oldSession).then((r) => r),
          scan(liveSession).then((r) => r),
        ]);
        assert.deepEqual(race.map((r) => r.status).sort(), [200, 409]);
        assert.equal((await balance(raceTerm.id)).usedVisits, 1);
        const duplicatePlan = await makePlan(1),
          duplicateTerm = await assign(duplicatePlan, shift(-1), shift(-1)),
          duplicateSession = await meetup(duplicatePlan, shift(-1));
        const duplicated = await Promise.all([
          backfill(duplicateSession).then((r) => r),
          backfill(duplicateSession).then((r) => r),
        ]);
        assert.ok(duplicated.every((r) => r.status === 200));
        assert.deepEqual(duplicated.map((r) => r.body.outcome).sort(), [
          'ALREADY_CHECKED_IN',
          'CHECKED_IN',
        ]);
        assert.equal((await balance(duplicateTerm.id)).usedVisits, 1);
        await backfill(await meetup(duplicatePlan, shift(-1))).expect(409);
        const cancelledPlan = await makePlan(1),
          cancelledTerm = await assign(cancelledPlan, shift(-1), shift(-1));
        await send(
          'post',
          '/admin/memberships/' + cancelledTerm.id + '/cancel',
          { version: cancelledTerm.version, reason: 'Cancelled term' },
        ).expect(200);
        await backfill(await meetup(cancelledPlan, shift(-1))).expect(409);
        const historical = (
          await get(
            '/members/me/attendance?method=backfill&from=' +
              shift(-2) +
              '&to=' +
              shift(-1),
            m.body.token,
          ).expect(200)
        ).body;
        assert.ok(historical.items.length >= 3);
        assert.ok(
          historical.items.every(
            (r: { method: string }) => r.method === 'backfill',
          ),
        );
      }
      {
        // History is read-only, paginated and scoped by authenticated identity.
        await api.get('/api/v1/admin/attendance').expect(401);
        await get('/admin/attendance', m.body.token).expect(403);
        await get('/admin/attendance', a.body.token).expect(403);
        await get(
          '/members/me/attendance?userId=' + m.body.user.id,
          m.body.token,
        ).expect(400);
        for (const query of [
          'limit=0',
          'limit=101',
          'from=2026-02-30',
          'from=2026-12-02&to=2026-12-01',
          'cursor=bad',
          'status=unknown',
          'include=credentials',
        ]) {
          await get('/admin/attendance?' + query).expect(400);
        }
        const beforeHistory = await pool.query(
          'SELECT sum("usedVisits")::int total FROM memberships',
        );
        const full = (await get('/admin/attendance?limit=100').expect(200))
          .body;
        assert.ok(full.items.length > 10);
        await get('/staff/attendance', m.body.token).expect(403);
        const staffId = outsider.body.user.id;
        const sessionId = full.items[0].session.id;
        await pool.query(
          'INSERT INTO meetup_staff ("sessionId", "userId") VALUES ($1, $2)',
          [sessionId, staffId],
        );
        const assigned = new Set([sessionId]);
        const expected = full.items.filter((row: { session: { id: string } }) =>
          assigned.has(row.session.id),
        );
        assert.ok(expected.length > 0 && expected.length < full.items.length);
        const staffHistory = (
          await get('/staff/attendance?limit=100', outsider.body.token).expect(
            200,
          )
        ).body;
        assert.deepEqual(staffHistory.items, expected);
        const outside = full.items.find(
          (row: { session: { id: string } }) => !assigned.has(row.session.id),
        );
        const staffFiltered = (
          await get(
            '/staff/attendance?sessionId=' + outside.session.id,
            outsider.body.token,
          ).expect(200)
        ).body;
        assert.deepEqual(staffFiltered.items, []);

        assert.ok(
          full.items.some(
            (r: { status: string; cancellation: unknown }) =>
              r.status === 'cancelled' && r.cancellation,
          ),
        );
        const ids: string[] = [];
        let cursor: string | null = null;
        do {
          const result: {
            body: { items: { id: string }[]; nextCursor: string | null };
          } = await get(
            '/admin/attendance?limit=3' +
              (cursor ? '&cursor=' + encodeURIComponent(cursor) : ''),
          ).expect(200);
          ids.push(...result.body.items.map((r: { id: string }) => r.id));
          cursor = result.body.nextCursor;
        } while (cursor);
        assert.deepEqual(
          ids,
          full.items.map((r: { id: string }) => r.id),
        );
        assert.equal(new Set(ids).size, ids.length);
        const owner = (
          await get('/members/me/attendance?limit=100', m.body.token).expect(
            200,
          )
        ).body;
        assert.equal(owner.items.length, full.items.length);
        assert.ok(
          owner.items.every(
            (r: { member: { id: string } }) => r.member.id === m.body.user.id,
          ),
        );
        assert.equal(
          (await get('/members/me/attendance', outsider.body.token).expect(200))
            .body.items.length,
          0,
        );
        const first = full.items[0];
        const filtered = (
          await get(
            '/admin/attendance?sessionId=' +
              first.session.id +
              '&from=' +
              today +
              '&to=' +
              today,
          ).expect(200)
        ).body;
        assert.ok(filtered.items.length > 0);
        assert.ok(
          filtered.items.every(
            (r: { session: { id: string; meetupDate: string } }) =>
              r.session.id === first.session.id &&
              r.session.meetupDate === today,
          ),
        );
        const cancelled = (
          await get('/admin/attendance?status=cancelled').expect(200)
        ).body;
        assert.ok(cancelled.items.length > 0);
        assert.ok(
          cancelled.items.every(
            (r: { status: string }) => r.status === 'cancelled',
          ),
        );
        assert.ok(
          (await get('/admin/attendance?method=backfill').expect(200)).body
            .items.length > 0,
        );
        assert.equal(
          (
            await get(
              '/admin/attendance?search=no-match-' + randomUUID(),
            ).expect(200)
          ).body.items.length,
          0,
        );
        const numbered = (
          await get(
            '/admin/attendance?search=' + first.member.memberNumber,
          ).expect(200)
        ).body;
        assert.ok(numbered.items.length > 0);
        assert.ok(
          numbered.items.every(
            (r: { member: { memberNumber: string } }) =>
              r.member.memberNumber === first.member.memberNumber,
          ),
        );
        const body = JSON.stringify(full);
        for (const forbidden of [
          'qrPayload',
          'password',
          'phone',
          'fingerprint',
          'authVersion',
        ])
          assert.equal(body.includes('"' + forbidden + '"'), false);
        assert.equal(
          (
            await pool.query(
              'SELECT sum("usedVisits")::int total FROM memberships',
            )
          ).rows[0].total,
          beforeHistory.rows[0].total,
        );
      }
      const counts = await pool.query(
        'SELECT m.id FROM memberships m LEFT JOIN attendance a ON a."membershipId"=m.id AND a."cancelledAt" IS NULL GROUP BY m.id HAVING m."usedVisits"<>count(a.id)',
      );
      assert.equal(counts.rowCount, 0);
      const leak = await pool.query(
        'SELECT count(*)::int n FROM domain_audit WHERE "entityType"=\'Attendance\' AND ("after"::text LIKE \'%qrPayload%\' OR "after"::text LIKE \'%moe:member:v1:%\')',
      );
      assert.equal(leak.rows[0].n, 0);
    } finally {
      await app.close();
      await pool.end();
    }
  },
);
