// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@vercel/kv', () => import('../../tests/mocks/kv.js'));

const { kv } = await import('@vercel/kv');
const { setData, getData, setMeta, getMeta, pushSyncHistory, readSyncHistory, acquireSyncLock } = await import('./kv.js');

describe('kv wrapper', () => {
  beforeEach(() => kv.__reset());

  it('round-trips data:<tab>', async () => {
    await setData('design', [{ a: 1 }, { a: 2 }]);
    expect(await getData('design')).toEqual([{ a: 1 }, { a: 2 }]);
  });

  it('returns null for unknown tab', async () => {
    expect(await getData('design')).toBeNull();
  });

  it('round-trips meta keys', async () => {
    await setMeta('lastSyncedAt', '2026-05-09T06:00:00Z');
    expect(await getMeta('lastSyncedAt')).toBe('2026-05-09T06:00:00Z');
  });

  it('keeps sync history as a ring buffer of 10', async () => {
    for (let i = 1; i <= 12; i++) {
      await pushSyncHistory({ at: `2026-05-${String(i).padStart(2, '0')}`, status: 'ok' });
    }
    const history = await readSyncHistory();
    expect(history).toHaveLength(10);
    expect(history[0].at).toBe('2026-05-12');
    expect(history[9].at).toBe('2026-05-03');
  });

  it('acquireSyncLock returns true the first time and false within TTL', async () => {
    expect(await acquireSyncLock(120)).toBe(true);
    expect(await acquireSyncLock(120)).toBe(false);
  });
});
