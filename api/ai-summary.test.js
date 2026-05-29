// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('./_lib/aiClient.js', () => ({
  chatCompletion: vi.fn(async () => 'Good morning.\n\n**Design** is on track.'),
}));

import { kv as memoryKv } from '../tests/mocks/kv.js';
import { setData, setMeta } from './_lib/kv.js';
const { default: handler } = await import('./ai-summary.js');

function mockReqRes({ query = {} } = {}) {
  const req = { method: 'GET', query, headers: {} };
  const res = {
    statusCode: 200,
    body: undefined,
    headers: {},
    status(code) { this.statusCode = code; return this; },
    setHeader() { return this; },
    json(data) { this.body = data; return this; },
  };
  return { req, res };
}

describe('/api/ai-summary', () => {
  beforeEach(() => {
    memoryKv.__reset();
    delete process.env.KV_REST_API_URL;
    delete process.env.KV_REST_API_TOKEN;
  });

  it('returns empty state when no data', async () => {
    const { req, res } = mockReqRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.source).toBe('empty');
  });

  it('returns payload with AI narrative when data exists', async () => {
    await setData('design', [{ period: 'Jan 26', type: 'Usability', status: 'Completed' }]);
    await setData('std', { bau: [], jlv: [] });
    await setData('process', { unique: 1, counts: [], bvs: { bvs: 0, nonBvs: 0 }, tat: [], teamProductivity: [] });
    await setMeta('lastSyncedAt', '2026-01-15T00:00:00.000Z');

    const { req, res } = mockReqRes({ query: { period: 'Jan 26' } });
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.period).toBe('Jan 26');
    expect(res.body.narrative).toContain('Good morning');
    expect(res.body.source).toBe('ai');
    expect(res.body.charts.teamComparison).toBeDefined();
  });
});
