import { getMeta, readSyncHistory } from './_lib/kv.js';

export default async function handler(req, res) {
  if (req.query?.password !== process.env.DIAGNOSTICS_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const lastSyncedAt   = await getMeta('lastSyncedAt');
  const lastSyncStatus = await getMeta('lastSyncStatus');
  const history        = await readSyncHistory();

  return res.status(200).json({ lastSyncedAt, lastSyncStatus, history });
}
