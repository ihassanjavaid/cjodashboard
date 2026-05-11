import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useDashboardDataWithFallback } from './useDashboardDataWithFallback.js';

const HARDCODED = [{ source: 'hardcoded' }];

describe('useDashboardDataWithFallback', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    vi.unstubAllEnvs();
    // Force API path (not direct-fetch) for these tests
    vi.stubEnv('VITE_SHEET_ID_DESIGN', '');
    vi.stubEnv('VITE_SHEET_ID_STD', '');
  });

  it('uses hardcoded fallback when sheetStatus is unconfigured', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ rows: null, lastSyncedAt: null, sheetStatus: 'unconfigured' }),
    });
    const { result } = renderHook(() => useDashboardDataWithFallback('std', HARDCODED));
    await waitFor(() => expect(result.current.source).toBe('hardcoded'));
    expect(result.current.rows).toBe(HARDCODED);
  });

  it('uses hardcoded fallback when sheetStatus is never-synced', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ rows: null, lastSyncedAt: null, sheetStatus: 'never-synced' }),
    });
    const { result } = renderHook(() => useDashboardDataWithFallback('design', HARDCODED));
    await waitFor(() => expect(result.current.source).toBe('hardcoded'));
  });

  it('uses live data when sheetStatus is ok', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ rows: [{ live: true }], lastSyncedAt: 'T', sheetStatus: 'ok' }),
    });
    const { result } = renderHook(() => useDashboardDataWithFallback('design', HARDCODED));
    await waitFor(() => expect(result.current.source).toBe('live'));
    expect(result.current.rows).toEqual([{ live: true }]);
  });

  it('uses live (stale) data when sheetStatus is failed', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ rows: [{ stale: true }], lastSyncedAt: 'T', sheetStatus: 'failed' }),
    });
    const { result } = renderHook(() => useDashboardDataWithFallback('design', HARDCODED));
    await waitFor(() => expect(result.current.source).toBe('live'));
    expect(result.current.rows).toEqual([{ stale: true }]);
    expect(result.current.sheetStatus).toBe('failed');
  });

  it('forces hardcoded data when VITE_USE_HARDCODED=1', async () => {
    vi.stubEnv('VITE_USE_HARDCODED', '1');
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ rows: [{ live: true }], lastSyncedAt: 'T', sheetStatus: 'ok' }),
    });
    const { result } = renderHook(() => useDashboardDataWithFallback('design', HARDCODED));
    await waitFor(() => expect(result.current.source).toBe('hardcoded'));
  });

  it('falls back to hardcoded data when API request errors (404, network)', async () => {
    fetch.mockRejectedValueOnce(new Error('Network/404'));
    const { result } = renderHook(() => useDashboardDataWithFallback('design', HARDCODED));
    await waitFor(() => expect(result.current.source).toBe('hardcoded'));
    expect(result.current.rows).toBe(HARDCODED);
    expect(result.current.sheetStatus).toBe('error');
  });
});
