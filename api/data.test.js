// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@vercel/kv', () => import('../tests/mocks/kv.js'));
const { kv } = await import('@vercel/kv');
const { default: handler } = await import('./data.js');

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

describe('/api/data', () => {
  beforeEach(() => {
    kv.__reset();
    delete process.env.SHEET_ID_DESIGN;
    delete process.env.SHEET_ID_STD;
    delete process.env.SHEET_ID_STRATEGY;
    delete process.env.SHEET_ID_PROCESS;
  });

  it('rejects non-GET methods', async () => {
    const { req, res } = mockReqRes({ method: 'POST', query: { tab: 'design' } });
    await handler(req, res);
    expect(res.statusCode).toBe(405);
  });

  it('rejects unknown tab id with 400', async () => {
    const { req, res } = mockReqRes({ query: { tab: 'nonsense' } });
    await handler(req, res);
    expect(res.statusCode).toBe(400);
  });

  it('returns "unconfigured" for tabs without SHEET_ID env var', async () => {
    const { req, res } = mockReqRes({ query: { tab: 'std' } });
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ rows: null, lastSyncedAt: null, sheetStatus: 'unconfigured' });
  });

  it('returns "never-synced" when configured but KV has no data yet', async () => {
    process.env.SHEET_ID_DESIGN = 'd1';
    const { req, res } = mockReqRes({ query: { tab: 'design' } });
    await handler(req, res);
    expect(res.body.sheetStatus).toBe('never-synced');
    expect(res.body.rows).toBeNull();
  });

  it('returns "ok" with rows when KV has data', async () => {
    process.env.SHEET_ID_DESIGN = 'd1';
    await kv.set('data:design', [{ project: 'X' }]);
    await kv.set('meta:lastSyncedAt', '2026-05-09T06:00:00Z');
    await kv.set('meta:lastSyncStatus', { status: 'ok', perSheet: { design: 'ok' }, errors: [] });
    const { req, res } = mockReqRes({ query: { tab: 'design' } });
    await handler(req, res);
    expect(res.body).toEqual({
      rows: [{ project: 'X' }],
      lastSyncedAt: '2026-05-09T06:00:00Z',
      sheetStatus: 'ok',
    });
  });

  it('returns "failed" when last sync marked this tab as failed', async () => {
    process.env.SHEET_ID_DESIGN = 'd1';
    await kv.set('data:design', [{ project: 'X' }]);
    await kv.set('meta:lastSyncedAt', '2026-05-09T06:00:00Z');
    await kv.set('meta:lastSyncStatus', { status: 'partial', perSheet: { design: 'failed' }, errors: [] });
    const { req, res } = mockReqRes({ query: { tab: 'design' } });
    await handler(req, res);
    expect(res.body.sheetStatus).toBe('failed');
    expect(res.body.rows).toEqual([{ project: 'X' }]);
  });

  it('sets cache headers', async () => {
    process.env.SHEET_ID_DESIGN = 'd1';
    const { req, res } = mockReqRes({ query: { tab: 'design' } });
    await handler(req, res);
    expect(res.headers['Cache-Control']).toMatch(/max-age=60/);
    expect(res.headers['Cache-Control']).toMatch(/stale-while-revalidate=600/);
  });
});
