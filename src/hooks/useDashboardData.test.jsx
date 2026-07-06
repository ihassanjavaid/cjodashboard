import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useDashboardData } from './useDashboardData.js';

describe('useDashboardData', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    // Force the API path (not the direct-fetch path) for these tests
    vi.stubEnv('VITE_SHEET_ID_DESIGN', '');
    vi.stubEnv('VITE_SHEET_ID_PROCESS', '');
  });

  it('returns loading state initially', () => {
    fetch.mockImplementation(() => new Promise(() => {}));
    const { result } = renderHook(() => useDashboardData('design'));
    expect(result.current.sheetStatus).toBe('loading');
    expect(result.current.rows).toBeNull();
  });

  it('returns rows and status when fetch succeeds', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        rows: [{ project: 'X' }],
        lastSyncedAt: '2026-05-09T06:00:00Z',
        sheetStatus: 'ok',
      }),
    });
    const { result } = renderHook(() => useDashboardData('design'));
    await waitFor(() => expect(result.current.sheetStatus).toBe('ok'));
    expect(result.current.rows).toEqual([{ project: 'X' }]);
    expect(result.current.lastSyncedAt).toBe('2026-05-09T06:00:00Z');
  });

  it('returns error status on network failure', async () => {
    fetch.mockRejectedValueOnce(new Error('network'));
    const { result } = renderHook(() => useDashboardData('design'));
    await waitFor(() => expect(result.current.sheetStatus).toBe('error'));
    expect(result.current.error).toMatch(/network/);
  });

  it('calls /api/data with the tab id', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ rows: [], lastSyncedAt: null, sheetStatus: 'never-synced' }),
    });
    renderHook(() => useDashboardData('process'));
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(fetch.mock.calls[0][0]).toBe('/api/data?tab=process');
  });

  it('exposes a refresh function that re-fetches', async () => {
    fetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ rows: [{ a: 1 }], lastSyncedAt: 'T1', sheetStatus: 'ok' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ rows: [{ a: 2 }], lastSyncedAt: 'T2', sheetStatus: 'ok' }) });
    const { result } = renderHook(() => useDashboardData('design'));
    await waitFor(() => expect(result.current.rows).toEqual([{ a: 1 }]));
    await result.current.refresh();
    await waitFor(() => expect(result.current.rows).toEqual([{ a: 2 }]));
  });

  it('re-fetches when refreshTrigger changes', async () => {
    fetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ rows: [{ a: 1 }], lastSyncedAt: 'T1', sheetStatus: 'ok' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ rows: [{ a: 2 }], lastSyncedAt: 'T2', sheetStatus: 'ok' }) });
    const { result, rerender } = renderHook(({ trigger }) => useDashboardData('design', trigger), {
      initialProps: { trigger: 0 },
    });
    await waitFor(() => expect(result.current.rows).toEqual([{ a: 1 }]));
    rerender({ trigger: 1 });
    await waitFor(() => expect(result.current.rows).toEqual([{ a: 2 }]));
  });
});
