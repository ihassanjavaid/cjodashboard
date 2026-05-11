// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@vercel/kv', () => import('../tests/mocks/kv.js'));
const { kv } = await import('@vercel/kv');
const { default: handler } = await import('./diagnostics.js');

function mockReqRes({ method = 'GET', query = {} } = {}) {
  const req = { method, query, headers: {} };
  const res = {
    statusCode: 200,
    body: undefined,
    headers: {},
    status(code) { this.statusCode = code; return this; },
    setHeader(name, value) { this.headers[name] = value; return this; },
    json(data) { this.body = data; return this; },
  };
  return { req, res };
}

describe('/api/diagnostics', () => {
  beforeEach(() => {
    kv.__reset();
    process.env.DIAGNOSTICS_PASSWORD = 'opensesame';
  });

  it('rejects access without password', async () => {
    const { req, res } = mockReqRes();
    await handler(req, res);
    expect(res.statusCode).toBe(401);
  });

  it('rejects access with wrong password', async () => {
    const { req, res } = mockReqRes({ query: { password: 'wrong' } });
    await handler(req, res);
    expect(res.statusCode).toBe(401);
  });

  it('returns diagnostics summary with correct password', async () => {
    await kv.set('meta:lastSyncedAt', '2026-05-09T06:00:00Z');
    await kv.set('meta:lastSyncStatus', { status: 'ok', perSheet: { design: 'ok' }, errors: [] });
    await kv.lpush('meta:syncHistory', { at: '2026-05-09T06:00:00Z', status: 'ok' });

    const { req, res } = mockReqRes({ query: { password: 'opensesame' } });
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.lastSyncedAt).toBe('2026-05-09T06:00:00Z');
    expect(res.body.lastSyncStatus.status).toBe('ok');
    expect(res.body.history).toHaveLength(1);
  });
});
