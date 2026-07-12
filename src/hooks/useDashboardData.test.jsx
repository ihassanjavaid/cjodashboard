import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useDashboardData } from './useDashboardData.js';

describe('useDashboardData', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    // Force the API path (not the direct-fetch path) for these tests
    vi.stubEnv('VITE_SHEET_ID_DESIGN', '');
    vi.stubEnv('VITE_SHEET_ID_PROCESS', '');
    vi.stubEnv('VITE_SHEET_ID_SOCIAL', '');
    vi.stubEnv('VITE_SHEET_GID_SOCIAL', '');
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

  it('direct-fetches the public social sheet in the browser', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      text: async () => [
        'Application,Category,Facebook Followers,Instagram Followers,TikTok Followers,LinkedIn Followers,Google Play Store Reviews,Google Play Store Downloads',
        'ROX,Digital Lifestyle / Telco,24k,17.8k,82.2k,4k,76.1k,10M+',
      ].join('\n'),
    });
    const { result } = renderHook(() => useDashboardData('social'));
    await waitFor(() => expect(result.current.sheetStatus).toBe('ok'));
    expect(result.current.rows).toEqual([{
      application: 'ROX',
      category: 'Digital Lifestyle / Telco',
      facebook: '24k',
      instagram: '17.8k',
      tiktok: '82.2k',
      linkedin: '4k',
      playReviews: '76.1k',
      playDownloads: '10M+',
    }]);
    expect(fetch.mock.calls[0][0]).toContain('1E9_LrPiQRa3FvKzOHDwmNpd8mbYiXLURJlkvbHzyY8Q');
    expect(fetch.mock.calls[0][0]).toContain('range=A2%3AH');
  });
});
