// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@vercel/kv', () => import('../tests/mocks/kv.js'));
vi.mock('./_lib/fetchSheet.js', () => ({
  fetchSheet: vi.fn(),
}));

const { kv } = await import('@vercel/kv');
const { fetchSheet } = await import('./_lib/fetchSheet.js');
const { default: handler } = await import('./sync.js');

function mockReqRes({ method = 'POST', headers = {} } = {}) {
  const req = { method, headers };
  const res = {
    statusCode: 200,
    body: undefined,
    headers: {},
    status(code) { this.statusCode = code; return this; },
    setHeader(name, value) { this.headers[name] = value; return this; },
    json(data) { this.body = data; return this; },
    end() { return this; },
  };
  return { req, res };
}

describe('/api/sync auth', () => {
  beforeEach(() => {
    kv.__reset();
    fetchSheet.mockReset();
    process.env.SYNC_SECRET = 'shhh';
    process.env.CRON_SECRET = 'croncron';
    delete process.env.SHEET_ID_DESIGN;
  });

  it('rejects non-POST methods with 405', async () => {
    const { req, res } = mockReqRes({ method: 'GET' });
    await handler(req, res);
    expect(res.statusCode).toBe(405);
  });

  it('rejects missing/invalid auth with 401', async () => {
    const { req, res } = mockReqRes();
    await handler(req, res);
    expect(res.statusCode).toBe(401);
  });

  it('accepts the manual sync header (x-sync-secret)', async () => {
    process.env.SHEET_ID_DESIGN = 'd1';
    fetchSheet.mockResolvedValue([{ a: 1 }]);
    const { req, res } = mockReqRes({ headers: { 'x-sync-secret': 'shhh' } });
    await handler(req, res);
    expect(res.statusCode).toBe(200);
  });

  it('accepts the Vercel cron Authorization Bearer token', async () => {
    process.env.SHEET_ID_DESIGN = 'd1';
    fetchSheet.mockResolvedValue([{ a: 1 }]);
    const { req, res } = mockReqRes({ headers: { authorization: 'Bearer croncron' } });
    await handler(req, res);
    expect(res.statusCode).toBe(200);
  });

  it('rejects bogus "Bearer undefined" when CRON_SECRET is unset', async () => {
    delete process.env.CRON_SECRET;
    const { req, res } = mockReqRes({ headers: { authorization: 'Bearer undefined' } });
    await handler(req, res);
    expect(res.statusCode).toBe(401);
  });

  it('rejects empty x-sync-secret when SYNC_SECRET is empty string', async () => {
    process.env.SYNC_SECRET = '';
    const { req, res } = mockReqRes({ headers: { 'x-sync-secret': '' } });
    await handler(req, res);
    expect(res.statusCode).toBe(401);
  });
});

describe('/api/sync per-sheet loop', () => {
  beforeEach(() => {
    kv.__reset();
    fetchSheet.mockReset();
    process.env.SYNC_SECRET = 'shhh';
    process.env.SHEET_ID_DESIGN = 'd1';
    delete process.env.SHEET_ID_STD;
    delete process.env.SHEET_ID_STRATEGY;
    delete process.env.SHEET_ID_PROCESS;
  });

  it('skips unconfigured tabs and only syncs configured ones', async () => {
    fetchSheet.mockResolvedValue([{ a: 1 }]);
    const { req, res } = mockReqRes({ headers: { 'x-sync-secret': 'shhh' } });
    await handler(req, res);
    expect(fetchSheet).toHaveBeenCalledTimes(1);
    expect(res.body.perSheet).toEqual({ design: 'ok' });
  });

  it('continues syncing other sheets when one fails', async () => {
    process.env.SHEET_ID_PROCESS = 'p1';
    fetchSheet.mockImplementation(async (cfg) => {
      if (cfg.id === 'process') throw new Error('parser missing');
      return [{ a: 1 }];
    });
    const { req, res } = mockReqRes({ headers: { 'x-sync-secret': 'shhh' } });
    await handler(req, res);
    expect(res.body.perSheet).toEqual({ design: 'ok', process: 'failed' });
    expect(res.body.errors).toContainEqual(
      expect.objectContaining({ sheet: 'process', message: expect.stringMatching(/parser missing/) })
    );
  });
});

describe('/api/sync KV writes and guards', () => {
  beforeEach(() => {
    kv.__reset();
    fetchSheet.mockReset();
    process.env.SYNC_SECRET = 'shhh';
    process.env.SHEET_ID_DESIGN = 'd1';
  });

  it('writes rows to KV under data:<tab>', async () => {
    fetchSheet.mockResolvedValue([{ a: 1 }, { a: 2 }]);
    const { req, res } = mockReqRes({ headers: { 'x-sync-secret': 'shhh' } });
    await handler(req, res);
    expect(await kv.get('data:design')).toEqual([{ a: 1 }, { a: 2 }]);
  });

  it('writes meta:lastSyncedAt and meta:lastSyncStatus', async () => {
    fetchSheet.mockResolvedValue([{ a: 1 }]);
    const { req, res } = mockReqRes({ headers: { 'x-sync-secret': 'shhh' } });
    await handler(req, res);
    expect(await kv.get('meta:lastSyncedAt')).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    const status = await kv.get('meta:lastSyncStatus');
    expect(status.status).toBe('ok');
    expect(status.perSheet.design).toBe('ok');
  });

  it('preserves previous KV data when all sheets return empty (all-empty guard)', async () => {
    await kv.set('data:design', [{ legacy: true }]);
    await kv.set('meta:lastSyncedAt', '2026-04-01T00:00:00Z');  // pre-existing timestamp
    fetchSheet.mockResolvedValue([]);   // empty
    const { req, res } = mockReqRes({ headers: { 'x-sync-secret': 'shhh' } });
    await handler(req, res);
    expect(await kv.get('data:design')).toEqual([{ legacy: true }]); // preserved
    // NEW: lastSyncedAt is preserved, not bumped
    expect(await kv.get('meta:lastSyncedAt')).toBe('2026-04-01T00:00:00Z');
    expect(res.body.errors).toContainEqual(
      expect.objectContaining({ sheet: '*', message: expect.stringMatching(/All-empty guard/) })
    );
  });

  it('appends to syncHistory ring buffer on every run', async () => {
    fetchSheet.mockResolvedValue([{ a: 1 }]);
    const { req: r1, res: s1 } = mockReqRes({ headers: { 'x-sync-secret': 'shhh' } });
    await handler(r1, s1);
    const { req: r2, res: s2 } = mockReqRes({ headers: { 'x-sync-secret': 'shhh' } });
    await handler(r2, s2);
    const history = await kv.lrange('meta:syncHistory', 0, -1);
    expect(history).toHaveLength(2);
    expect(history[0].status).toBe('ok');
  });
});
