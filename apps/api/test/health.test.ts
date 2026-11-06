import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../src/create-app.js';
import { readConfig } from '../src/config.js';
test('public liveness response and explicit CORS policy', async () => {
  const { app } = await createApp();
  await app.init();
  try {
    const response = await request(app.getHttpServer())
      .get('/api/v1/health')
      .set('Origin', 'http://localhost:5173')
      .expect(200);
    assert.deepEqual(response.body, { status: 'ok', service: 'moe-api' });
    assert.equal(response.headers['cache-control'], 'no-store');
    assert.equal(
      response.headers['access-control-allow-origin'],
      'http://localhost:5173',
    );
    const rejected = await request(app.getHttpServer())
      .get('/api/v1/health')
      .set('Origin', 'https://untrusted.example');
    assert.equal(rejected.headers['access-control-allow-origin'], undefined);
  } finally {
    await app.close();
  }
});
test('rejects wildcard origins and invalid ports', () => {
  assert.throws(() => readConfig({ WEB_ORIGINS: '*' }));
  assert.throws(() => readConfig({ PORT: '0' }));
});

test('production requires explicit HTTPS browser origins', () => {
  assert.throws(() => readConfig({ NODE_ENV: 'production' }));
  assert.throws(() =>
    readConfig({
      NODE_ENV: 'production',
      WEB_ORIGINS: 'http://localhost:5173',
    }),
  );
  assert.deepEqual(
    readConfig({
      NODE_ENV: 'production',
      WEB_ORIGINS: 'https://app.example.com',
    }).origins,
    ['https://app.example.com'],
  );
});
