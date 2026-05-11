import { acquireSyncLock } from './_lib/kv.js';
import syncHandler from './sync.js';

const COOLDOWN_SECONDS = 120;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const acquired = await acquireSyncLock(COOLDOWN_SECONDS);
  if (!acquired) {
    return res.status(429).json({
      error: 'Sync cooldown in effect — try again shortly.',
      retryAfterSeconds: COOLDOWN_SECONDS,
    });
  }

  // Delegate to /api/sync handler with internal-trust header.
  // Both endpoints share the same code path; manual-sync only adds the cooldown.
  const internalReq = {
    method: 'POST',
    headers: { 'x-sync-secret': process.env.SYNC_SECRET },
  };
  return syncHandler(internalReq, res);
}
