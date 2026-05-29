import { getData } from './kv.js';
import { fetchSheet } from './fetchSheet.js';
import { getSheetConfig, isTabConfigured } from '../_config/sheets.js';

/**
 * Read tab rows from KV when available; otherwise fetch live from Google Sheets
 * (for local dev without Upstash, or before the first sync).
 */
export async function loadDashboardRows(tab) {
  const cached = await getData(tab);
  if (cached != null) return cached;

  if (!isTabConfigured(tab)) return null;

  try {
    return await fetchSheet(getSheetConfig(tab));
  } catch (e) {
    console.warn(`[loadDashboardRows] ${tab}:`, e.message);
    return null;
  }
}
