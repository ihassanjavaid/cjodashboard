import { getData, getMeta } from './_lib/kv.js';
import { ALL_TABS, isTabConfigured } from './_config/sheets.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const tab = req.query?.tab;
  if (!ALL_TABS.includes(tab)) {
    return res.status(400).json({ error: 'Unknown tab' });
  }

  res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=600');

  if (!isTabConfigured(tab)) {
    return res.status(200).json({ rows: null, lastSyncedAt: null, sheetStatus: 'unconfigured' });
  }

  const rows = await getData(tab);
  const lastSyncedAt = await getMeta('lastSyncedAt');
  const meta = await getMeta('lastSyncStatus');

  if (rows === null && lastSyncedAt === null) {
    return res.status(200).json({ rows: null, lastSyncedAt: null, sheetStatus: 'never-synced' });
  }

  const sheetStatus = meta?.perSheet?.[tab] === 'failed' ? 'failed' : 'ok';
  return res.status(200).json({ rows, lastSyncedAt, sheetStatus });
}
