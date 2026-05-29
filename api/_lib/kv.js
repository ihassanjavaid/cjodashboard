import { kv as vercelKv } from '@vercel/kv';
import { kv as memoryKv } from '../../tests/mocks/kv.js';

const HISTORY_KEY = 'meta:syncHistory';
const HISTORY_LIMIT = 10;
const LOCK_KEY = 'lock:sync';

let warnedMemory = false;

export function isKvConfigured() {
  return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

function store() {
  if (isKvConfigured()) return vercelKv;
  if (!warnedMemory) {
    warnedMemory = true;
    console.warn(
      '[kv] KV_REST_API_URL / KV_REST_API_TOKEN not set — using in-memory store for this process. '
      + 'Data is not persisted across restarts. Add Upstash KV vars from Vercel for production-like caching.',
    );
  }
  return memoryKv;
}

export async function setData(tab, rows) {
  await store().set(`data:${tab}`, rows);
}

export async function getData(tab) {
  return store().get(`data:${tab}`);
}

export async function setMeta(key, value) {
  await store().set(`meta:${key}`, value);
}

export async function getMeta(key) {
  return store().get(`meta:${key}`);
}

export async function pushSyncHistory(entry) {
  await store().lpush(HISTORY_KEY, entry);
  await store().ltrim(HISTORY_KEY, 0, HISTORY_LIMIT - 1);
}

export async function readSyncHistory() {
  return (await store().lrange(HISTORY_KEY, 0, HISTORY_LIMIT - 1)) ?? [];
}

export async function acquireSyncLock(ttlSeconds) {
  const result = await store().set(LOCK_KEY, '1', { ex: ttlSeconds, nx: true });
  return result === 'OK';
}
