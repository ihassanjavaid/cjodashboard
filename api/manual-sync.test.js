// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@vercel/kv', () => import('../tests/mocks/kv.js'));
vi.mock('./_lib/fetchSheet.js', () => ({
  fetchSheet: vi.fn(),
}));

const { kv } = await import('@vercel/kv');
const { fetchSheet } = await import('./_lib/fetchSheet.js');
const { default: handler } = await import('./manual-sync.js');

function mockReqRes({ method = 'POST' } = {}) {
  const req = { method, headers: {} };
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

describe('/api/manual-sync', () => {
  beforeEach(() => {
    kv.__reset();
    fetchSheet.mockReset();
    process.env.SYNC_SECRET = 'shhh';
    process.env.SHEET_ID_DESIGN = 'd1';
  });

  it('rejects non-POST methods', async () => {
    const { req, res } = mockReqRes({ method: 'GET' });
    await handler(req, res);
    expect(res.statusCode).toBe(405);
  });

  it('runs sync on first call (no auth required)', async () => {
    fetchSheet.mockResolvedValue([{ a: 1 }]);
    const { req, res } = mockReqRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('rejects subsequent calls within the cooldown window', async () => {
    fetchSheet.mockResolvedValue([{ a: 1 }]);
    const { req: r1, res: s1 } = mockReqRes();
    await handler(r1, s1);

    const { req: r2, res: s2 } = mockReqRes();
    await handler(r2, s2);
    expect(s2.statusCode).toBe(429);
    expect(s2.body.error).toMatch(/cooldown|rate/i);
  });

  it('returns the cooldown TTL in the rate-limit response', async () => {
    fetchSheet.mockResolvedValue([{ a: 1 }]);
    const { req: r1, res: s1 } = mockReqRes();
    await handler(r1, s1);
    const { req: r2, res: s2 } = mockReqRes();
    await handler(r2, s2);
    expect(s2.body.retryAfterSeconds).toBeGreaterThan(0);
    expect(s2.body.retryAfterSeconds).toBeLessThanOrEqual(120);
  });
});
