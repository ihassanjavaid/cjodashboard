import { kv } from '@vercel/kv';

const HISTORY_KEY = 'meta:syncHistory';
const HISTORY_LIMIT = 10;
const LOCK_KEY = 'lock:sync';

export async function setData(tab, rows) {
  await kv.set(`data:${tab}`, rows);
}

export async function getData(tab) {
  return await kv.get(`data:${tab}`);
}

export async function setMeta(key, value) {
  await kv.set(`meta:${key}`, value);
}

export async function getMeta(key) {
  return await kv.get(`meta:${key}`);
}

export async function pushSyncHistory(entry) {
  await kv.lpush(HISTORY_KEY, entry);
  await kv.ltrim(HISTORY_KEY, 0, HISTORY_LIMIT - 1);
}

export async function readSyncHistory() {
  return (await kv.lrange(HISTORY_KEY, 0, HISTORY_LIMIT - 1)) ?? [];
}

export async function acquireSyncLock(ttlSeconds) {
  const result = await kv.set(LOCK_KEY, '1', { ex: ttlSeconds, nx: true });
  return result === 'OK';
}
