import { fetchSheet } from './_lib/fetchSheet.js';
import { setData, setMeta, getMeta, pushSyncHistory } from './_lib/kv.js';
import { ALL_TABS, getSheetConfig } from './_config/sheets.js';

function isAuthorized(req) {
  const cronAuth = req.headers['authorization'];
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && cronAuth === `Bearer ${cronSecret}`) return true;

  const manual = req.headers['x-sync-secret'];
  const syncSecret = process.env.SYNC_SECRET;
  if (manual && syncSecret && manual === syncSecret) return true;

  return false;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!isAuthorized(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const perSheet = {};
  const errors = [];
  const successfulRows = {};   // tab -> rows; written to KV after the all-empty guard

  for (const tab of ALL_TABS) {
    const config = getSheetConfig(tab);
    if (!config) continue;
    try {
      const rows = await fetchSheet(config);
      successfulRows[tab] = rows;
      perSheet[tab] = 'ok';
    } catch (e) {
      perSheet[tab] = 'failed';
      errors.push({ sheet: tab, message: e.message });
    }
  }

  // All-empty guard: refuse to overwrite KV if every successful sheet returned 0 rows.
  const successCount = Object.keys(successfulRows).length;
  const allEmpty = successCount > 0 && Object.values(successfulRows).every(r => isEmpty(r));
  const status = computeOverallStatus(perSheet);

  if (!allEmpty) {
    for (const [tab, rows] of Object.entries(successfulRows)) {
      await setData(tab, rows);
    }
  } else {
    errors.push({ sheet: '*', message: 'All-empty guard: refused to overwrite KV with zero-row data.' });
  }

  const now = new Date().toISOString();

  // Only advance lastSyncedAt if we actually wrote new data.
  if (!allEmpty) {
    await setMeta('lastSyncedAt', now);
  }
  await setMeta('lastSyncStatus', { status, perSheet, errors });
  await pushSyncHistory({ at: now, status, perSheet, errorCount: errors.length });

  // Response includes the previous lastSyncedAt if we didn't advance it
  const responseLastSyncedAt = allEmpty ? await getMeta('lastSyncedAt') : now;

  return res.status(200).json({ ok: true, status, lastSyncedAt: responseLastSyncedAt, perSheet, errors });
}

function isEmpty(rows) {
  if (Array.isArray(rows)) return rows.length === 0;
  if (rows && typeof rows === 'object') return Object.keys(rows).length === 0;
  return true;
}

function computeOverallStatus(perSheet) {
  const values = Object.values(perSheet);
  if (values.length === 0) return 'ok';
  if (values.every(s => s === 'ok')) return 'ok';
  if (values.every(s => s === 'failed')) return 'failed';
  return 'partial';
}
