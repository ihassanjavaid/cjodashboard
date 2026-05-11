const store = new Map();
const expirations = new Map();

function isExpired(key) {
  const exp = expirations.get(key);
  if (exp && Date.now() > exp) {
    store.delete(key);
    expirations.delete(key);
    return true;
  }
  return false;
}

export const kv = {
  async get(key) {
    if (isExpired(key)) return null;
    return store.has(key) ? store.get(key) : null;
  },
  async set(key, value, opts = {}) {
    if (opts.nx && store.has(key) && !isExpired(key)) return null;
    store.set(key, value);
    if (opts.ex) expirations.set(key, Date.now() + opts.ex * 1000);
    return 'OK';
  },
  async exists(key) {
    if (isExpired(key)) return 0;
    return store.has(key) ? 1 : 0;
  },
  async del(key) {
    store.delete(key);
    expirations.delete(key);
  },
  async lpush(key, ...values) {
    const list = store.get(key) ?? [];
    list.unshift(...values);
    store.set(key, list);
    return list.length;
  },
  async ltrim(key, start, stop) {
    const list = store.get(key) ?? [];
    store.set(key, list.slice(start, stop + 1));
  },
  async lrange(key, start, stop) {
    const list = store.get(key) ?? [];
    const end = stop === -1 ? list.length : stop + 1;
    return list.slice(start, end);
  },
  __reset() {
    store.clear();
    expirations.clear();
  },
};
