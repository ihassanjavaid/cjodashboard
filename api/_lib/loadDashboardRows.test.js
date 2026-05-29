// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('./fetchSheet.js', () => ({
  fetchSheet: vi.fn(async () => [{ period: 'Jan 26', type: 'Usability', status: 'Completed' }]),
}));

import { kv as memoryKv } from '../../tests/mocks/kv.js';
import { setData } from './kv.js';
import { loadDashboardRows } from './loadDashboardRows.js';
import { fetchSheet } from './fetchSheet.js';

describe('loadDashboardRows', () => {
  beforeEach(() => {
    memoryKv.__reset();
    delete process.env.KV_REST_API_URL;
    delete process.env.KV_REST_API_TOKEN;
    delete process.env.SHEET_ID_DESIGN;
    vi.mocked(fetchSheet).mockClear();
  });

  it('returns KV data when present', async () => {
    await setData('design', [{ period: 'Jan 26' }]);
    const rows = await loadDashboardRows('design');
    expect(rows).toEqual([{ period: 'Jan 26' }]);
    expect(fetchSheet).not.toHaveBeenCalled();
  });

  it('fetches sheets when KV is empty and tab is configured', async () => {
    process.env.SHEET_ID_DESIGN = 'sheet123';
    const rows = await loadDashboardRows('design');
    expect(fetchSheet).toHaveBeenCalled();
    expect(rows).toHaveLength(1);
  });
});
