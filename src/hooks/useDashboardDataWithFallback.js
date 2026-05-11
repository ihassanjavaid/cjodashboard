import { useDashboardData } from './useDashboardData.js';

export function useDashboardDataWithFallback(tab, hardcodedRows, refreshTrigger = 0) {
  const live = useDashboardData(tab, refreshTrigger);

  if (import.meta.env.VITE_USE_HARDCODED === '1') {
    return { rows: hardcodedRows, lastSyncedAt: null, sheetStatus: 'hardcoded', source: 'hardcoded', refresh: live.refresh };
  }

  if (
    live.sheetStatus === 'unconfigured' ||
    live.sheetStatus === 'never-synced' ||
    live.sheetStatus === 'error'
  ) {
    return { rows: hardcodedRows, lastSyncedAt: null, sheetStatus: live.sheetStatus, source: 'hardcoded', refresh: live.refresh };
  }

  if (live.sheetStatus === 'loading') {
    return { ...live, source: null };
  }

  return { ...live, source: 'live' };
}
