# Plan A — Google Sheets Sync Infrastructure + Design Tab Live Data

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the entire Google-Sheets-to-Vercel-KV pipeline with weekly cron + manual sync, and switch the Design & Usability tab to live data. Standardization, Strategy, and Process tabs keep their existing hardcoded data via per-tab fallback.

**Architecture:** Vercel serverless functions fetch public Google Sheets via CSV export URL, parse with papaparse, write to Vercel KV. A weekly cron + a public rate-limited manual sync endpoint trigger refreshes. Frontend reads from `/api/data?tab=<id>`, falls back to hardcoded constants when sheets are unconfigured.

**Tech Stack:** React 19, Vite 8, Vercel serverless functions (Node runtime), @vercel/kv, papaparse, vitest, @testing-library/react.

**Plan B (separate document) will:** Add the Process sheet parser and rebuild the Process tab UI. Plan A leaves Process tab unchanged, using hardcoded fallback.

**Reference spec:** [docs/superpowers/specs/2026-05-09-google-sheets-sync-design.md](../specs/2026-05-09-google-sheets-sync-design.md)

---

## Phase 1 — Foundation

### Task 1: Initialize git repository

**Files:**
- Create: `.gitignore` (extend existing)

- [ ] **Step 1: Check if git is already initialized**

Run: `git status 2>&1 | head -1`
Expected: `fatal: not a git repository` (project is not yet a git repo per env info)

- [ ] **Step 2: Initialize git and configure ignores**

Run: `git init`
Expected: `Initialized empty Git repository in ...`

- [ ] **Step 3: Verify the existing `.gitignore` and add new entries**

Read `.gitignore`. Append these entries to the END of the file (do not duplicate existing ones):

```gitignore
# Vercel
.vercel
.env.local
.env*.local

# Test coverage
coverage/

# Editor
.vscode/
.idea/
*.swp
.DS_Store
```

- [ ] **Step 4: Make initial commit of existing codebase**

```bash
git add -A
git commit -m "chore: initial commit of existing codebase"
```

Expected: commit succeeds with all existing files staged.

- [ ] **Step 5: Commit the spec and plan docs**

```bash
git add docs/
git commit -m "docs: add design spec and plan A for sheets sync"
```

---

### Task 2: Install dependencies and add scripts

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install runtime dependencies**

```bash
npm install @vercel/kv papaparse
```

Expected: packages added to `dependencies` in `package.json`. The `googleapis` package is intentionally deferred — it is not needed for Plan A (Phase 2 only).

- [ ] **Step 2: Install dev dependencies**

```bash
npm install -D vitest @vitest/ui jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

Expected: packages added to `devDependencies`.

- [ ] **Step 3: Add scripts to `package.json`**

Read `package.json`. Replace the `"scripts"` block with:

```json
"scripts": {
  "dev": "vite",
  "build": "vite build",
  "lint": "eslint .",
  "preview": "vite preview",
  "test": "vitest run",
  "test:watch": "vitest",
  "test:ui": "vitest --ui"
}
```

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add testing and sync deps (vitest, @vercel/kv, papaparse)"
```

---

### Task 3: Configure vitest

**Files:**
- Create: `vitest.config.js`
- Create: `tests/setup.js`
- Create: `tests/smoke.test.js`

- [ ] **Step 1: Create `vitest.config.js`**

```js
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.js'],
    include: ['**/*.test.{js,jsx}'],
    coverage: {
      reporter: ['text', 'html'],
      include: ['src/**', 'api/**'],
    },
  },
});
```

- [ ] **Step 2: Create `tests/setup.js`**

```js
import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
});
```

- [ ] **Step 3: Create the smoke test `tests/smoke.test.js`**

```js
import { describe, it, expect } from 'vitest';

describe('test environment', () => {
  it('runs vitest with expect available', () => {
    expect(1 + 1).toBe(2);
  });

  it('has DOM globals from jsdom', () => {
    expect(typeof document).toBe('object');
    expect(typeof window).toBe('object');
  });
});
```

- [ ] **Step 4: Run tests to verify setup**

Run: `npm test`
Expected: `2 passed` in the `tests/smoke.test.js` file.

- [ ] **Step 5: Commit**

```bash
git add vitest.config.js tests/
git commit -m "test: add vitest config and smoke test"
```

---

### Task 4: Scaffold project directories

**Files:**
- Create: `api/_config/.gitkeep`
- Create: `api/_lib/.gitkeep`
- Create: `src/hooks/.gitkeep`
- Create: `src/components/states/.gitkeep`
- Create: `src/tabs/.gitkeep`
- Create: `tests/fixtures/.gitkeep`
- Create: `tests/mocks/.gitkeep`
- Create: `scripts/.gitkeep`

- [ ] **Step 1: Create empty placeholder files to establish directory structure**

```bash
mkdir -p api/_config api/_lib src/hooks src/components/states src/tabs tests/fixtures tests/mocks scripts
touch api/_config/.gitkeep api/_lib/.gitkeep src/hooks/.gitkeep src/components/states/.gitkeep src/tabs/.gitkeep tests/fixtures/.gitkeep tests/mocks/.gitkeep scripts/.gitkeep
```

- [ ] **Step 2: Commit the scaffolding**

```bash
git add api/ src/hooks/ src/components/ src/tabs/ tests/fixtures/ tests/mocks/ scripts/
git commit -m "chore: scaffold api, hooks, tabs, and tests directories"
```

---

### Task 5: Add `vercel.json` and `.env.example`

**Files:**
- Create: `vercel.json`
- Create: `.env.example`

- [ ] **Step 1: Create `vercel.json`**

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "crons": [
    { "path": "/api/sync", "schedule": "0 6 * * 1" }
  ]
}
```

- [ ] **Step 2: Create `.env.example` documenting all env vars**

```bash
# Sheet IDs (Phase 1 — public sheets only)
SHEET_ID_DESIGN=10jYPcINf2UvN4-Quc8SG5Tl0tyw7Qmdv
SHEET_GID_DESIGN=1246818985

# Standardization, Strategy, and Process are deferred.
# When you have sheet IDs, set these. Until then, those tabs use hardcoded fallback.
# SHEET_ID_STD=
# SHEET_GID_STD=0
# SHEET_ID_STRATEGY=
# SHEET_GID_STRATEGY=0
# SHEET_ID_PROCESS=1VFxuBDrAWE93PTxdQKqRhh3SfXB_cXN16KY2guMwRxo
# SHEET_GID_PROCESS=0

# Auth secrets
# Generate SYNC_SECRET with: openssl rand -hex 32
SYNC_SECRET=
DIAGNOSTICS_PASSWORD=

# Phase 2 only — Google OAuth for restricted sheets
# GOOGLE_CLIENT_ID=
# GOOGLE_CLIENT_SECRET=
# GOOGLE_REFRESH_TOKEN=

# Auto-injected by Vercel — DO NOT set manually
# CRON_SECRET (Vercel Cron)
# KV_REST_API_URL, KV_REST_API_TOKEN, KV_REST_API_READ_ONLY_TOKEN (Vercel KV)

# Optional cutover safety override — forces all tabs to use hardcoded data
# VITE_USE_HARDCODED=1
```

- [ ] **Step 3: Commit**

```bash
git add vercel.json .env.example
git commit -m "feat: add vercel.json with weekly cron and .env.example"
```

---

## Phase 2 — Server libraries

### Task 6: CSV parser wrapper

**Files:**
- Create: `api/_lib/csv.js`
- Create: `api/_lib/csv.test.js`

- [ ] **Step 1: Write the failing test**

Create `api/_lib/csv.test.js`:

```js
// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { parseCsv, parseCsvRaw } from './csv.js';

describe('parseCsv (with headers)', () => {
  it('parses a simple CSV with headers into row objects', () => {
    const csv = 'name,age\nAlice,30\nBob,25';
    expect(parseCsv(csv)).toEqual([
      { name: 'Alice', age: '30' },
      { name: 'Bob', age: '25' },
    ]);
  });

  it('skips empty lines', () => {
    const csv = 'name,age\nAlice,30\n\n\nBob,25\n';
    expect(parseCsv(csv)).toEqual([
      { name: 'Alice', age: '30' },
      { name: 'Bob', age: '25' },
    ]);
  });

  it('handles quoted fields containing commas', () => {
    const csv = 'name,note\n"Smith, John","hello, world"';
    expect(parseCsv(csv)).toEqual([
      { name: 'Smith, John', note: 'hello, world' },
    ]);
  });

  it('returns empty array for empty input', () => {
    expect(parseCsv('')).toEqual([]);
  });
});

describe('parseCsvRaw (no headers, returns 2D array)', () => {
  it('returns rows as arrays without header processing', () => {
    const csv = 'a,b,c\n1,2,3\n4,5,6';
    expect(parseCsvRaw(csv)).toEqual([
      ['a', 'b', 'c'],
      ['1', '2', '3'],
      ['4', '5', '6'],
    ]);
  });

  it('preserves blank cells as empty strings', () => {
    const csv = 'a,,c\n,2,';
    expect(parseCsvRaw(csv)).toEqual([
      ['a', '', 'c'],
      ['', '2', ''],
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- csv`
Expected: FAIL — `Cannot find module './csv.js'`

- [ ] **Step 3: Implement `csv.js`**

Create `api/_lib/csv.js`:

```js
import Papa from 'papaparse';

export function parseCsv(csvText) {
  if (!csvText) return [];
  const result = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: true,
  });
  return result.data;
}

export function parseCsvRaw(csvText) {
  if (!csvText) return [];
  const result = Papa.parse(csvText, {
    header: false,
    skipEmptyLines: false,
  });
  return result.data;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- csv`
Expected: PASS — all 6 tests green.

- [ ] **Step 5: Commit**

```bash
git add api/_lib/csv.js api/_lib/csv.test.js
git commit -m "feat: add csv parser wrapper around papaparse"
```

---

### Task 7: Schema mapping helper

**Files:**
- Create: `api/_lib/schema.js`
- Create: `api/_lib/schema.test.js`

- [ ] **Step 1: Write the failing test**

Create `api/_lib/schema.test.js`:

```js
// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { mapRowToSchema } from './schema.js';

describe('mapRowToSchema', () => {
  const schema = {
    month:        { column: 'Month',          type: 'string' },
    project:      { column: 'Project',        type: 'string' },
    count_users:  { column: 'Count of Users', type: 'number' },
  };

  it('maps sheet column names to JS field names', () => {
    const row = { Month: 'January', Project: 'Tamasha', 'Count of Users': '16' };
    expect(mapRowToSchema(row, schema)).toEqual({
      month: 'January',
      project: 'Tamasha',
      count_users: 16,
    });
  });

  it('coerces numeric strings to numbers', () => {
    const row = { Month: 'Feb', Project: 'X', 'Count of Users': '0' };
    expect(mapRowToSchema(row, schema).count_users).toBe(0);
  });

  it('returns null for invalid numbers and logs a warning', () => {
    const row = { Month: 'Feb', Project: 'X', 'Count of Users': 'N/A' };
    expect(mapRowToSchema(row, schema).count_users).toBeNull();
  });

  it('uses empty string when source column is missing', () => {
    const row = { Month: 'March' };
    const result = mapRowToSchema(row, schema);
    expect(result.month).toBe('March');
    expect(result.project).toBe('');
    expect(result.count_users).toBeNull();
  });

  it('trims whitespace from string fields', () => {
    const row = { Month: '  January  ', Project: 'X', 'Count of Users': '5' };
    expect(mapRowToSchema(row, schema).month).toBe('January');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- schema`
Expected: FAIL — `Cannot find module './schema.js'`

- [ ] **Step 3: Implement `schema.js`**

Create `api/_lib/schema.js`:

```js
export function mapRowToSchema(row, schema) {
  const result = {};
  for (const [field, def] of Object.entries(schema)) {
    const raw = row[def.column];
    if (raw === undefined || raw === null || raw === '') {
      result[field] = def.type === 'number' ? null : '';
      continue;
    }
    if (def.type === 'number') {
      const n = Number(raw);
      result[field] = Number.isFinite(n) ? n : null;
    } else {
      result[field] = String(raw).trim();
    }
  }
  return result;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- schema`
Expected: PASS — all 5 tests green.

- [ ] **Step 5: Commit**

```bash
git add api/_lib/schema.js api/_lib/schema.test.js
git commit -m "feat: add row-to-schema mapper with type coercion"
```

---

### Task 8: KV client wrapper + in-memory test mock

**Files:**
- Create: `api/_lib/kv.js`
- Create: `tests/mocks/kv.js`
- Create: `api/_lib/kv.test.js`

- [ ] **Step 1: Create the in-memory mock at `tests/mocks/kv.js`**

```js
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
    store.set(key, value);
    if (opts.ex) expirations.set(key, Date.now() + opts.ex * 1000);
    if (opts.nx && store.has(key) && !isExpired(key)) return null;
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
```

- [ ] **Step 2: Write the failing test**

Create `api/_lib/kv.test.js`:

```js
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
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- kv`
Expected: FAIL — `Cannot find module './kv.js'`

- [ ] **Step 4: Implement `api/_lib/kv.js`**

```js
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
  const existing = await kv.exists(LOCK_KEY);
  if (existing) return false;
  await kv.set(LOCK_KEY, '1', { ex: ttlSeconds });
  return true;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- kv`
Expected: PASS — all 5 tests green.

- [ ] **Step 6: Commit**

```bash
git add api/_lib/kv.js api/_lib/kv.test.js tests/mocks/kv.js
git commit -m "feat: add kv wrapper with data, meta, history, and lock helpers"
```

---

### Task 9: Public CSV sheet fetcher

**Files:**
- Create: `api/_lib/fetchSheet.js`
- Create: `api/_lib/fetchSheet.test.js`

- [ ] **Step 1: Write the failing test**

Create `api/_lib/fetchSheet.test.js`:

```js
// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fetchPublicCsv, fetchSheet } from './fetchSheet.js';

describe('fetchPublicCsv', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('builds the export URL and parses CSV into row objects', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => 'name,age\nAlice,30\nBob,25',
    });

    const rows = await fetchPublicCsv({ sheetId: 'SHEET123', gid: '0' });

    expect(fetch).toHaveBeenCalledWith(
      'https://docs.google.com/spreadsheets/d/SHEET123/export?format=csv&gid=0',
      expect.objectContaining({ redirect: 'follow' }),
    );
    expect(rows).toEqual([
      { name: 'Alice', age: '30' },
      { name: 'Bob', age: '25' },
    ]);
  });

  it('throws on non-2xx response', async () => {
    fetch.mockResolvedValueOnce({ ok: false, status: 404, text: async () => '' });
    await expect(fetchPublicCsv({ sheetId: 'X', gid: '0' }))
      .rejects.toThrow(/404/);
  });

  it('uses default gid 0 when not provided', async () => {
    fetch.mockResolvedValueOnce({ ok: true, text: async () => 'a\n1' });
    await fetchPublicCsv({ sheetId: 'X' });
    expect(fetch.mock.calls[0][0]).toContain('gid=0');
  });
});

describe('fetchSheet dispatch', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('routes mode:public through fetchPublicCsv and applies schema mapping', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      text: async () => 'Project,Count of Users\nTamasha,16',
    });

    const config = {
      sheetId: 'X',
      gid: '0',
      mode: 'public',
      parser: 'tabular',
      schema: {
        project:     { column: 'Project',        type: 'string' },
        count_users: { column: 'Count of Users', type: 'number' },
      },
    };

    const rows = await fetchSheet(config);
    expect(rows).toEqual([{ project: 'Tamasha', count_users: 16 }]);
  });

  it('throws "not implemented" for mode:auth (Plan A — Phase 2 deferred)', async () => {
    const config = { sheetId: 'X', gid: '0', mode: 'auth', parser: 'tabular', schema: {} };
    await expect(fetchSheet(config)).rejects.toThrow(/not implemented/i);
  });

  it('throws for unknown parser strategy', async () => {
    fetch.mockResolvedValueOnce({ ok: true, text: async () => 'a\n1' });
    const config = { sheetId: 'X', gid: '0', mode: 'public', parser: 'unknown', schema: {} };
    await expect(fetchSheet(config)).rejects.toThrow(/parser/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- fetchSheet`
Expected: FAIL — `Cannot find module './fetchSheet.js'`

- [ ] **Step 3: Implement `fetchSheet.js`**

```js
import { parseCsv } from './csv.js';
import { mapRowToSchema } from './schema.js';

export async function fetchPublicCsv({ sheetId, gid = '0' }) {
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`Sheet fetch failed: ${res.status}`);
  return parseCsv(await res.text());
}

export async function fetchAuthSheet() {
  // Plan A intentionally defers OAuth/restricted-sheet support.
  // Plan B (or a follow-up) wires up googleapis + refresh token.
  throw new Error('Auth-mode fetch not implemented in Plan A (deferred to Phase 2)');
}

export async function fetchSheet(config) {
  const rawRows = config.mode === 'public'
    ? await fetchPublicCsv(config)
    : await fetchAuthSheet(config);

  if (config.parser === 'tabular') {
    return rawRows.map(row => mapRowToSchema(row, config.schema));
  }
  if (config.parser === 'process-blocks') {
    // Plan B implements this. Plan A throws so /api/sync surfaces it as a per-sheet failure.
    throw new Error('Process-blocks parser not implemented in Plan A (Plan B rebuilds Process tab)');
  }
  throw new Error(`Unknown parser strategy: ${config.parser}`);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- fetchSheet`
Expected: PASS — all 6 tests green.

- [ ] **Step 5: Commit**

```bash
git add api/_lib/fetchSheet.js api/_lib/fetchSheet.test.js
git commit -m "feat: add public sheet fetcher and dispatch with auth-mode stub"
```

---

### Task 10: Sheet configs module + Design schema

**Files:**
- Create: `api/_config/schemas.js`
- Create: `api/_config/sheets.js`
- Create: `api/_config/sheets.test.js`

- [ ] **Step 1: Write the failing test**

Create `api/_config/sheets.test.js`:

```js
// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest';
import { getSheetConfig, getConfiguredTabs, isTabConfigured, ALL_TABS } from './sheets.js';

describe('sheet config registry', () => {
  beforeEach(() => {
    delete process.env.SHEET_ID_DESIGN;
    delete process.env.SHEET_ID_STD;
    delete process.env.SHEET_ID_STRATEGY;
    delete process.env.SHEET_ID_PROCESS;
  });

  it('lists all four canonical tab ids', () => {
    expect(ALL_TABS).toEqual(['design', 'std', 'process', 'strategy']);
  });

  it('returns null for an unknown tab id', () => {
    expect(getSheetConfig('nonsense')).toBeNull();
  });

  it('marks a tab as unconfigured when SHEET_ID_<TAB> env var is missing', () => {
    expect(isTabConfigured('design')).toBe(false);
  });

  it('marks a tab as configured when SHEET_ID_<TAB> is set', () => {
    process.env.SHEET_ID_DESIGN = 'abc123';
    expect(isTabConfigured('design')).toBe(true);
  });

  it('builds a full config object from env vars', () => {
    process.env.SHEET_ID_DESIGN = 'abc123';
    process.env.SHEET_GID_DESIGN = '99';
    const config = getSheetConfig('design');
    expect(config).toMatchObject({
      id: 'design',
      sheetId: 'abc123',
      gid: '99',
      mode: 'public',
      parser: 'tabular',
    });
    expect(config.schema).toBeDefined();
    expect(config.schema.month.column).toBeDefined();
  });

  it('defaults gid to "0" when SHEET_GID_<TAB> is unset', () => {
    process.env.SHEET_ID_DESIGN = 'abc123';
    expect(getSheetConfig('design').gid).toBe('0');
  });

  it('getConfiguredTabs returns only tabs with sheet IDs set', () => {
    process.env.SHEET_ID_DESIGN = 'a';
    process.env.SHEET_ID_PROCESS = 'b';
    expect(getConfiguredTabs().sort()).toEqual(['design', 'process']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- sheets`
Expected: FAIL — `Cannot find module './sheets.js'`

- [ ] **Step 3: Implement `api/_config/schemas.js`**

The `count_users` schema field name matches the existing `DESIGN_RAW` shape at [src/App.jsx:11](../../../src/App.jsx). Column name `'Count of Users'` is a placeholder — confirm against the live sheet during Task 26 (deploy verification). If different, this is the only line to change.

```js
export const designSchema = {
  month:        { column: 'Month',          type: 'string' },
  project:      { column: 'Project',        type: 'string' },
  assigned_to:  { column: 'Assigned To',    type: 'string' },
  stakeholder:  { column: 'Stakeholder',    type: 'string' },
  status:       { column: 'Status',         type: 'string' },
  type:         { column: 'Type',           type: 'string' },
  count_users:  { column: 'Count of Users', type: 'number' },
};

// std and strategy schemas are stubbed for Phase 2.
export const stdSchema = {};
export const strategySchema = {};
```

- [ ] **Step 4: Implement `api/_config/sheets.js`**

```js
import { designSchema, stdSchema, strategySchema } from './schemas.js';

export const ALL_TABS = ['design', 'std', 'process', 'strategy'];

const STATIC_PER_TAB = {
  design:   { mode: 'public', parser: 'tabular',        schema: designSchema },
  process:  { mode: 'public', parser: 'process-blocks', schema: null },
  std:      { mode: 'auth',   parser: 'tabular',        schema: stdSchema },
  strategy: { mode: 'auth',   parser: 'tabular',        schema: strategySchema },
};

export function getSheetConfig(tab) {
  if (!ALL_TABS.includes(tab)) return null;
  const sheetId = process.env[`SHEET_ID_${tab.toUpperCase()}`];
  if (!sheetId) return null;
  const gid = process.env[`SHEET_GID_${tab.toUpperCase()}`] ?? '0';
  return { id: tab, sheetId, gid, ...STATIC_PER_TAB[tab] };
}

export function isTabConfigured(tab) {
  return getSheetConfig(tab) !== null;
}

export function getConfiguredTabs() {
  return ALL_TABS.filter(isTabConfigured);
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- sheets`
Expected: PASS — all 7 tests green.

- [ ] **Step 6: Commit**

```bash
git add api/_config/
git commit -m "feat: add sheet config registry and design schema"
```

---

## Phase 3 — API endpoints

### Task 11: `/api/sync` — auth + per-sheet loop

**Files:**
- Create: `api/sync.js`
- Create: `api/sync.test.js`

- [ ] **Step 1: Write the failing test**

Create `api/sync.test.js`:

```js
// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@vercel/kv', () => import('../tests/mocks/kv.js'));
vi.mock('./_lib/fetchSheet.js', () => ({
  fetchSheet: vi.fn(),
}));

const { kv } = await import('@vercel/kv');
const { fetchSheet } = await import('./_lib/fetchSheet.js');
const { default: handler } = await import('./sync.js');

function mockReqRes({ method = 'POST', headers = {} } = {}) {
  const req = { method, headers };
  const res = {
    statusCode: 200,
    body: undefined,
    headers: {},
    status(code) { this.statusCode = code; return this; },
    setHeader(name, value) { this.headers[name] = value; return this; },
    json(data) { this.body = data; return this; },
    end() { return this; },
  };
  return { req, res };
}

describe('/api/sync auth', () => {
  beforeEach(() => {
    kv.__reset();
    fetchSheet.mockReset();
    process.env.SYNC_SECRET = 'shhh';
    process.env.CRON_SECRET = 'croncron';
    delete process.env.SHEET_ID_DESIGN;
  });

  it('rejects non-POST methods with 405', async () => {
    const { req, res } = mockReqRes({ method: 'GET' });
    await handler(req, res);
    expect(res.statusCode).toBe(405);
  });

  it('rejects missing/invalid auth with 401', async () => {
    const { req, res } = mockReqRes();
    await handler(req, res);
    expect(res.statusCode).toBe(401);
  });

  it('accepts the manual sync header (x-sync-secret)', async () => {
    process.env.SHEET_ID_DESIGN = 'd1';
    fetchSheet.mockResolvedValue([{ a: 1 }]);
    const { req, res } = mockReqRes({ headers: { 'x-sync-secret': 'shhh' } });
    await handler(req, res);
    expect(res.statusCode).toBe(200);
  });

  it('accepts the Vercel cron Authorization Bearer token', async () => {
    process.env.SHEET_ID_DESIGN = 'd1';
    fetchSheet.mockResolvedValue([{ a: 1 }]);
    const { req, res } = mockReqRes({ headers: { authorization: 'Bearer croncron' } });
    await handler(req, res);
    expect(res.statusCode).toBe(200);
  });
});

describe('/api/sync per-sheet loop', () => {
  beforeEach(() => {
    kv.__reset();
    fetchSheet.mockReset();
    process.env.SYNC_SECRET = 'shhh';
    process.env.SHEET_ID_DESIGN = 'd1';
    delete process.env.SHEET_ID_STD;
    delete process.env.SHEET_ID_STRATEGY;
    delete process.env.SHEET_ID_PROCESS;
  });

  it('skips unconfigured tabs and only syncs configured ones', async () => {
    fetchSheet.mockResolvedValue([{ a: 1 }]);
    const { req, res } = mockReqRes({ headers: { 'x-sync-secret': 'shhh' } });
    await handler(req, res);
    expect(fetchSheet).toHaveBeenCalledTimes(1);
    expect(res.body.perSheet).toEqual({ design: 'ok' });
  });

  it('continues syncing other sheets when one fails', async () => {
    process.env.SHEET_ID_PROCESS = 'p1';
    fetchSheet.mockImplementation(async (cfg) => {
      if (cfg.id === 'process') throw new Error('parser missing');
      return [{ a: 1 }];
    });
    const { req, res } = mockReqRes({ headers: { 'x-sync-secret': 'shhh' } });
    await handler(req, res);
    expect(res.body.perSheet).toEqual({ design: 'ok', process: 'failed' });
    expect(res.body.errors).toContainEqual(
      expect.objectContaining({ sheet: 'process', message: expect.stringMatching(/parser missing/) })
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- sync`
Expected: FAIL — `Cannot find module './sync.js'`

- [ ] **Step 3: Implement `api/sync.js`**

```js
import { fetchSheet } from './_lib/fetchSheet.js';
import { setData, setMeta, pushSyncHistory } from './_lib/kv.js';
import { ALL_TABS, getSheetConfig } from './_config/sheets.js';

function isAuthorized(req) {
  const cronAuth = req.headers['authorization'];
  if (cronAuth === `Bearer ${process.env.CRON_SECRET}`) return true;
  const manual = req.headers['x-sync-secret'];
  if (manual && manual === process.env.SYNC_SECRET) return true;
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

  const lastSyncedAt = new Date().toISOString();
  await setMeta('lastSyncedAt', lastSyncedAt);
  await setMeta('lastSyncStatus', { status, perSheet, errors });
  await pushSyncHistory({ at: lastSyncedAt, status, perSheet, errorCount: errors.length });

  return res.status(200).json({ ok: true, status, lastSyncedAt, perSheet, errors });
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- sync`
Expected: PASS — all 6 tests green.

- [ ] **Step 5: Commit**

```bash
git add api/sync.js api/sync.test.js
git commit -m "feat: add /api/sync with auth, per-sheet loop, and all-empty guard"
```

---

### Task 12: `/api/sync` — all-empty guard test + KV write verification

**Files:**
- Modify: `api/sync.test.js`

- [ ] **Step 1: Add tests for the all-empty guard and KV write behavior**

Append the following block to `api/sync.test.js` (inside the bottom of the file, after existing describes):

```js
describe('/api/sync KV writes and guards', () => {
  beforeEach(() => {
    kv.__reset();
    fetchSheet.mockReset();
    process.env.SYNC_SECRET = 'shhh';
    process.env.SHEET_ID_DESIGN = 'd1';
  });

  it('writes rows to KV under data:<tab>', async () => {
    fetchSheet.mockResolvedValue([{ a: 1 }, { a: 2 }]);
    const { req, res } = mockReqRes({ headers: { 'x-sync-secret': 'shhh' } });
    await handler(req, res);
    expect(await kv.get('data:design')).toEqual([{ a: 1 }, { a: 2 }]);
  });

  it('writes meta:lastSyncedAt and meta:lastSyncStatus', async () => {
    fetchSheet.mockResolvedValue([{ a: 1 }]);
    const { req, res } = mockReqRes({ headers: { 'x-sync-secret': 'shhh' } });
    await handler(req, res);
    expect(await kv.get('meta:lastSyncedAt')).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    const status = await kv.get('meta:lastSyncStatus');
    expect(status.status).toBe('ok');
    expect(status.perSheet.design).toBe('ok');
  });

  it('preserves previous KV data when all sheets return empty (all-empty guard)', async () => {
    await kv.set('data:design', [{ legacy: true }]);
    fetchSheet.mockResolvedValue([]);   // empty
    const { req, res } = mockReqRes({ headers: { 'x-sync-secret': 'shhh' } });
    await handler(req, res);
    expect(await kv.get('data:design')).toEqual([{ legacy: true }]); // preserved
    expect(res.body.errors).toContainEqual(
      expect.objectContaining({ sheet: '*', message: expect.stringMatching(/All-empty guard/) })
    );
  });

  it('appends to syncHistory ring buffer on every run', async () => {
    fetchSheet.mockResolvedValue([{ a: 1 }]);
    const { req: r1, res: s1 } = mockReqRes({ headers: { 'x-sync-secret': 'shhh' } });
    await handler(r1, s1);
    const { req: r2, res: s2 } = mockReqRes({ headers: { 'x-sync-secret': 'shhh' } });
    await handler(r2, s2);
    const history = await kv.lrange('meta:syncHistory', 0, -1);
    expect(history).toHaveLength(2);
    expect(history[0].status).toBe('ok');
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `npm test -- sync`
Expected: PASS — all 10 tests green (4 new + 6 from Task 11).

- [ ] **Step 3: Commit**

```bash
git add api/sync.test.js
git commit -m "test: cover sync KV writes, all-empty guard, and history ring buffer"
```

---

### Task 13: `/api/data` endpoint

**Files:**
- Create: `api/data.js`
- Create: `api/data.test.js`

- [ ] **Step 1: Write the failing test**

Create `api/data.test.js`:

```js
// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@vercel/kv', () => import('../tests/mocks/kv.js'));
const { kv } = await import('@vercel/kv');
const { default: handler } = await import('./data.js');

function mockReqRes({ method = 'GET', query = {} } = {}) {
  const req = { method, query, headers: {} };
  const res = {
    statusCode: 200,
    body: undefined,
    headers: {},
    status(code) { this.statusCode = code; return this; },
    setHeader(name, value) { this.headers[name] = value; return this; },
    json(data) { this.body = data; return this; },
  };
  return { req, res };
}

describe('/api/data', () => {
  beforeEach(() => {
    kv.__reset();
    delete process.env.SHEET_ID_DESIGN;
    delete process.env.SHEET_ID_STD;
    delete process.env.SHEET_ID_STRATEGY;
    delete process.env.SHEET_ID_PROCESS;
  });

  it('rejects non-GET methods', async () => {
    const { req, res } = mockReqRes({ method: 'POST', query: { tab: 'design' } });
    await handler(req, res);
    expect(res.statusCode).toBe(405);
  });

  it('rejects unknown tab id with 400', async () => {
    const { req, res } = mockReqRes({ query: { tab: 'nonsense' } });
    await handler(req, res);
    expect(res.statusCode).toBe(400);
  });

  it('returns "unconfigured" for tabs without SHEET_ID env var', async () => {
    const { req, res } = mockReqRes({ query: { tab: 'std' } });
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ rows: null, lastSyncedAt: null, sheetStatus: 'unconfigured' });
  });

  it('returns "never-synced" when configured but KV has no data yet', async () => {
    process.env.SHEET_ID_DESIGN = 'd1';
    const { req, res } = mockReqRes({ query: { tab: 'design' } });
    await handler(req, res);
    expect(res.body.sheetStatus).toBe('never-synced');
    expect(res.body.rows).toBeNull();
  });

  it('returns "ok" with rows when KV has data', async () => {
    process.env.SHEET_ID_DESIGN = 'd1';
    await kv.set('data:design', [{ project: 'X' }]);
    await kv.set('meta:lastSyncedAt', '2026-05-09T06:00:00Z');
    await kv.set('meta:lastSyncStatus', { status: 'ok', perSheet: { design: 'ok' }, errors: [] });
    const { req, res } = mockReqRes({ query: { tab: 'design' } });
    await handler(req, res);
    expect(res.body).toEqual({
      rows: [{ project: 'X' }],
      lastSyncedAt: '2026-05-09T06:00:00Z',
      sheetStatus: 'ok',
    });
  });

  it('returns "failed" when last sync marked this tab as failed', async () => {
    process.env.SHEET_ID_DESIGN = 'd1';
    await kv.set('data:design', [{ project: 'X' }]);
    await kv.set('meta:lastSyncedAt', '2026-05-09T06:00:00Z');
    await kv.set('meta:lastSyncStatus', { status: 'partial', perSheet: { design: 'failed' }, errors: [] });
    const { req, res } = mockReqRes({ query: { tab: 'design' } });
    await handler(req, res);
    expect(res.body.sheetStatus).toBe('failed');
    expect(res.body.rows).toEqual([{ project: 'X' }]);     // stale data still served
  });

  it('sets cache headers', async () => {
    process.env.SHEET_ID_DESIGN = 'd1';
    const { req, res } = mockReqRes({ query: { tab: 'design' } });
    await handler(req, res);
    expect(res.headers['Cache-Control']).toMatch(/max-age=60/);
    expect(res.headers['Cache-Control']).toMatch(/stale-while-revalidate=600/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- data`
Expected: FAIL — `Cannot find module './data.js'`

- [ ] **Step 3: Implement `api/data.js`**

```js
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- data`
Expected: PASS — all 7 tests green.

- [ ] **Step 5: Commit**

```bash
git add api/data.js api/data.test.js
git commit -m "feat: add /api/data with status states and cache headers"
```

---

### Task 14: `/api/manual-sync` rate-limited wrapper

**Files:**
- Create: `api/manual-sync.js`
- Create: `api/manual-sync.test.js`

- [ ] **Step 1: Write the failing test**

Create `api/manual-sync.test.js`:

```js
// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@vercel/kv', () => import('../tests/mocks/kv.js'));
vi.mock('./_lib/fetchSheet.js', () => ({
  fetchSheet: vi.fn(),
}));

const { kv } = await import('@vercel/kv');
const { fetchSheet } = await import('./_lib/fetchSheet.js');
const { default: handler } = await import('./manual-sync.js');

function mockReqRes({ method = 'POST' } = {}) {
  const req = { method, headers: {} };
  const res = {
    statusCode: 200,
    body: undefined,
    headers: {},
    status(code) { this.statusCode = code; return this; },
    setHeader(name, value) { this.headers[name] = value; return this; },
    json(data) { this.body = data; return this; },
  };
  return { req, res };
}

describe('/api/manual-sync', () => {
  beforeEach(() => {
    kv.__reset();
    fetchSheet.mockReset();
    process.env.SYNC_SECRET = 'shhh';
    process.env.SHEET_ID_DESIGN = 'd1';
  });

  it('rejects non-POST methods', async () => {
    const { req, res } = mockReqRes({ method: 'GET' });
    await handler(req, res);
    expect(res.statusCode).toBe(405);
  });

  it('runs sync on first call (no auth required)', async () => {
    fetchSheet.mockResolvedValue([{ a: 1 }]);
    const { req, res } = mockReqRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('rejects subsequent calls within the cooldown window', async () => {
    fetchSheet.mockResolvedValue([{ a: 1 }]);
    const { req: r1, res: s1 } = mockReqRes();
    await handler(r1, s1);

    const { req: r2, res: s2 } = mockReqRes();
    await handler(r2, s2);
    expect(s2.statusCode).toBe(429);
    expect(s2.body.error).toMatch(/cooldown|rate/i);
  });

  it('returns the cooldown TTL in the rate-limit response', async () => {
    fetchSheet.mockResolvedValue([{ a: 1 }]);
    const { req: r1, res: s1 } = mockReqRes();
    await handler(r1, s1);
    const { req: r2, res: s2 } = mockReqRes();
    await handler(r2, s2);
    expect(s2.body.retryAfterSeconds).toBeGreaterThan(0);
    expect(s2.body.retryAfterSeconds).toBeLessThanOrEqual(120);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- manual-sync`
Expected: FAIL — `Cannot find module './manual-sync.js'`

- [ ] **Step 3: Implement `api/manual-sync.js`**

```js
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- manual-sync`
Expected: PASS — all 4 tests green.

- [ ] **Step 5: Commit**

```bash
git add api/manual-sync.js api/manual-sync.test.js
git commit -m "feat: add /api/manual-sync with 2-minute cooldown"
```

---

### Task 15: `/api/diagnostics` endpoint

**Files:**
- Create: `api/diagnostics.js`
- Create: `api/diagnostics.test.js`

- [ ] **Step 1: Write the failing test**

Create `api/diagnostics.test.js`:

```js
// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@vercel/kv', () => import('../tests/mocks/kv.js'));
const { kv } = await import('@vercel/kv');
const { default: handler } = await import('./diagnostics.js');

function mockReqRes({ method = 'GET', query = {} } = {}) {
  const req = { method, query, headers: {} };
  const res = {
    statusCode: 200,
    body: undefined,
    headers: {},
    status(code) { this.statusCode = code; return this; },
    setHeader(name, value) { this.headers[name] = value; return this; },
    json(data) { this.body = data; return this; },
  };
  return { req, res };
}

describe('/api/diagnostics', () => {
  beforeEach(() => {
    kv.__reset();
    process.env.DIAGNOSTICS_PASSWORD = 'opensesame';
  });

  it('rejects access without password', async () => {
    const { req, res } = mockReqRes();
    await handler(req, res);
    expect(res.statusCode).toBe(401);
  });

  it('rejects access with wrong password', async () => {
    const { req, res } = mockReqRes({ query: { password: 'wrong' } });
    await handler(req, res);
    expect(res.statusCode).toBe(401);
  });

  it('returns diagnostics summary with correct password', async () => {
    await kv.set('meta:lastSyncedAt', '2026-05-09T06:00:00Z');
    await kv.set('meta:lastSyncStatus', { status: 'ok', perSheet: { design: 'ok' }, errors: [] });
    await kv.lpush('meta:syncHistory', { at: '2026-05-09T06:00:00Z', status: 'ok' });

    const { req, res } = mockReqRes({ query: { password: 'opensesame' } });
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.lastSyncedAt).toBe('2026-05-09T06:00:00Z');
    expect(res.body.lastSyncStatus.status).toBe('ok');
    expect(res.body.history).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- diagnostics`
Expected: FAIL — `Cannot find module './diagnostics.js'`

- [ ] **Step 3: Implement `api/diagnostics.js`**

```js
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- diagnostics`
Expected: PASS — all 3 tests green.

- [ ] **Step 5: Commit**

```bash
git add api/diagnostics.js api/diagnostics.test.js
git commit -m "feat: add /api/diagnostics with password gate"
```

---

## Phase 4 — Frontend hook + state components

### Task 16: `useDashboardData` hook

**Files:**
- Create: `src/hooks/useDashboardData.js`
- Create: `src/hooks/useDashboardData.test.jsx`

- [ ] **Step 1: Write the failing test**

Create `src/hooks/useDashboardData.test.jsx`:

```jsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useDashboardData } from './useDashboardData.js';

describe('useDashboardData', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('returns loading state initially', () => {
    fetch.mockImplementation(() => new Promise(() => {}));
    const { result } = renderHook(() => useDashboardData('design'));
    expect(result.current.sheetStatus).toBe('loading');
    expect(result.current.rows).toBeNull();
  });

  it('returns rows and status when fetch succeeds', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        rows: [{ project: 'X' }],
        lastSyncedAt: '2026-05-09T06:00:00Z',
        sheetStatus: 'ok',
      }),
    });
    const { result } = renderHook(() => useDashboardData('design'));
    await waitFor(() => expect(result.current.sheetStatus).toBe('ok'));
    expect(result.current.rows).toEqual([{ project: 'X' }]);
    expect(result.current.lastSyncedAt).toBe('2026-05-09T06:00:00Z');
  });

  it('returns error status on network failure', async () => {
    fetch.mockRejectedValueOnce(new Error('network'));
    const { result } = renderHook(() => useDashboardData('design'));
    await waitFor(() => expect(result.current.sheetStatus).toBe('error'));
    expect(result.current.error).toMatch(/network/);
  });

  it('calls /api/data with the tab id', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ rows: [], lastSyncedAt: null, sheetStatus: 'never-synced' }),
    });
    renderHook(() => useDashboardData('process'));
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(fetch.mock.calls[0][0]).toBe('/api/data?tab=process');
  });

  it('exposes a refresh function that re-fetches', async () => {
    fetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ rows: [{ a: 1 }], lastSyncedAt: 'T1', sheetStatus: 'ok' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ rows: [{ a: 2 }], lastSyncedAt: 'T2', sheetStatus: 'ok' }) });
    const { result } = renderHook(() => useDashboardData('design'));
    await waitFor(() => expect(result.current.rows).toEqual([{ a: 1 }]));
    await result.current.refresh();
    await waitFor(() => expect(result.current.rows).toEqual([{ a: 2 }]));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- useDashboardData`
Expected: FAIL — `Cannot find module './useDashboardData.js'`

- [ ] **Step 3: Implement `useDashboardData.js`**

```js
import { useState, useEffect, useCallback } from 'react';

export function useDashboardData(tab) {
  const [state, setState] = useState({
    rows: null,
    lastSyncedAt: null,
    sheetStatus: 'loading',
    error: null,
  });

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/data?tab=${tab}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setState({
        rows: data.rows,
        lastSyncedAt: data.lastSyncedAt,
        sheetStatus: data.sheetStatus,
        error: null,
      });
    } catch (e) {
      setState(prev => ({ ...prev, sheetStatus: 'error', error: e.message }));
    }
  }, [tab]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { ...state, refresh: fetchData };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- useDashboardData`
Expected: PASS — all 5 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useDashboardData.js src/hooks/useDashboardData.test.jsx
git commit -m "feat: add useDashboardData hook with refresh"
```

---

### Task 17: `useDashboardDataWithFallback` wrapper

**Files:**
- Create: `src/hooks/useDashboardDataWithFallback.js`
- Create: `src/hooks/useDashboardDataWithFallback.test.jsx`

- [ ] **Step 1: Write the failing test**

Create `src/hooks/useDashboardDataWithFallback.test.jsx`:

```jsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useDashboardDataWithFallback } from './useDashboardDataWithFallback.js';

const HARDCODED = [{ source: 'hardcoded' }];

describe('useDashboardDataWithFallback', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    vi.unstubAllEnvs();
  });

  it('uses hardcoded fallback when sheetStatus is unconfigured', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ rows: null, lastSyncedAt: null, sheetStatus: 'unconfigured' }),
    });
    const { result } = renderHook(() => useDashboardDataWithFallback('std', HARDCODED));
    await waitFor(() => expect(result.current.source).toBe('hardcoded'));
    expect(result.current.rows).toBe(HARDCODED);
  });

  it('uses hardcoded fallback when sheetStatus is never-synced', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ rows: null, lastSyncedAt: null, sheetStatus: 'never-synced' }),
    });
    const { result } = renderHook(() => useDashboardDataWithFallback('design', HARDCODED));
    await waitFor(() => expect(result.current.source).toBe('hardcoded'));
  });

  it('uses live data when sheetStatus is ok', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ rows: [{ live: true }], lastSyncedAt: 'T', sheetStatus: 'ok' }),
    });
    const { result } = renderHook(() => useDashboardDataWithFallback('design', HARDCODED));
    await waitFor(() => expect(result.current.source).toBe('live'));
    expect(result.current.rows).toEqual([{ live: true }]);
  });

  it('uses live (stale) data when sheetStatus is failed', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ rows: [{ stale: true }], lastSyncedAt: 'T', sheetStatus: 'failed' }),
    });
    const { result } = renderHook(() => useDashboardDataWithFallback('design', HARDCODED));
    await waitFor(() => expect(result.current.source).toBe('live'));
    expect(result.current.rows).toEqual([{ stale: true }]);
    expect(result.current.sheetStatus).toBe('failed');
  });

  it('forces hardcoded data when VITE_USE_HARDCODED=1', async () => {
    vi.stubEnv('VITE_USE_HARDCODED', '1');
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ rows: [{ live: true }], lastSyncedAt: 'T', sheetStatus: 'ok' }),
    });
    const { result } = renderHook(() => useDashboardDataWithFallback('design', HARDCODED));
    await waitFor(() => expect(result.current.source).toBe('hardcoded'));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- useDashboardDataWithFallback`
Expected: FAIL — `Cannot find module './useDashboardDataWithFallback.js'`

- [ ] **Step 3: Implement `useDashboardDataWithFallback.js`**

```js
import { useDashboardData } from './useDashboardData.js';

export function useDashboardDataWithFallback(tab, hardcodedRows) {
  const live = useDashboardData(tab);

  if (import.meta.env.VITE_USE_HARDCODED === '1') {
    return { rows: hardcodedRows, lastSyncedAt: null, sheetStatus: 'hardcoded', source: 'hardcoded', refresh: live.refresh };
  }

  if (live.sheetStatus === 'unconfigured' || live.sheetStatus === 'never-synced') {
    return { rows: hardcodedRows, lastSyncedAt: null, sheetStatus: live.sheetStatus, source: 'hardcoded', refresh: live.refresh };
  }

  return { ...live, source: 'live' };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- useDashboardDataWithFallback`
Expected: PASS — all 5 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useDashboardDataWithFallback.js src/hooks/useDashboardDataWithFallback.test.jsx
git commit -m "feat: add fallback wrapper for hardcoded-vs-live data"
```

---

### Task 18: State components — Skeleton, Error, Empty

**Files:**
- Create: `src/components/states/SkeletonState.jsx`
- Create: `src/components/states/ErrorState.jsx`
- Create: `src/components/states/EmptyState.jsx`
- Create: `src/components/states/states.test.jsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/states/states.test.jsx`:

```jsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SkeletonState } from './SkeletonState.jsx';
import { ErrorState } from './ErrorState.jsx';
import { EmptyState } from './EmptyState.jsx';

describe('SkeletonState', () => {
  it('renders without crashing and has skeleton role', () => {
    render(<SkeletonState />);
    expect(screen.getByRole('status', { name: /loading/i })).toBeInTheDocument();
  });
});

describe('ErrorState', () => {
  it('renders the error message and retry button', () => {
    render(<ErrorState message="Boom" onRetry={() => {}} />);
    expect(screen.getByText(/boom/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('calls onRetry when the button is clicked', async () => {
    const onRetry = vi.fn();
    render(<ErrorState message="Boom" onRetry={onRetry} />);
    await userEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

describe('EmptyState', () => {
  it('renders with default message', () => {
    render(<EmptyState />);
    expect(screen.getByText(/no data/i)).toBeInTheDocument();
  });

  it('renders the lastSyncedAt timestamp when provided', () => {
    render(<EmptyState lastSyncedAt="2026-05-09T06:00:00Z" />);
    expect(screen.getByText(/last synced/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- states`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement `SkeletonState.jsx`**

```jsx
const palette = { card: '#ffffff', cardBorder: '#E7E1DC', muted: '#9E9089' };

export function SkeletonState() {
  return (
    <div role="status" aria-label="Loading data" style={{ padding: 32 }}>
      <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
        {[0, 1, 2, 3].map(i => (
          <div key={i} style={{
            flex: 1, height: 92, borderRadius: 14,
            background: '#F5F2F0', border: `1px solid ${palette.cardBorder}`,
            animation: 'pulse 1.6s ease-in-out infinite',
          }} />
        ))}
      </div>
      <div style={{
        height: 280, borderRadius: 14,
        background: '#F5F2F0', border: `1px solid ${palette.cardBorder}`,
        animation: 'pulse 1.6s ease-in-out infinite',
      }} />
      <style>{`@keyframes pulse { 0%,100% { opacity: 1 } 50% { opacity: 0.6 } }`}</style>
    </div>
  );
}
```

- [ ] **Step 4: Implement `ErrorState.jsx`**

```jsx
const palette = { card: '#ffffff', cardBorder: '#E7E1DC', muted: '#9E9089', accent: '#8B1A1A' };

export function ErrorState({ message, onRetry }) {
  return (
    <div style={{
      padding: 32, textAlign: 'center', borderRadius: 14,
      background: palette.card, border: `1px solid ${palette.cardBorder}`,
    }}>
      <div style={{ fontSize: 36, marginBottom: 12 }}>⚠</div>
      <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Couldn't load this tab</div>
      <div style={{ fontSize: 13, color: palette.muted, marginBottom: 20 }}>{message}</div>
      <button onClick={onRetry} style={{
        padding: '8px 18px', borderRadius: 8, border: 'none',
        background: palette.accent, color: '#fff', cursor: 'pointer',
        fontFamily: 'inherit', fontSize: 13, fontWeight: 500,
      }}>Retry</button>
    </div>
  );
}
```

- [ ] **Step 5: Implement `EmptyState.jsx`**

```jsx
const palette = { card: '#ffffff', cardBorder: '#E7E1DC', muted: '#9E9089' };

export function EmptyState({ lastSyncedAt }) {
  return (
    <div style={{
      padding: 48, textAlign: 'center', borderRadius: 14,
      background: palette.card, border: `1px solid ${palette.cardBorder}`,
    }}>
      <div style={{ fontSize: 36, marginBottom: 12 }}>📭</div>
      <div style={{ fontSize: 15, fontWeight: 500, color: palette.muted }}>No data available yet</div>
      {lastSyncedAt && (
        <div style={{ fontSize: 12, color: palette.muted, marginTop: 8 }}>
          Last synced: {new Date(lastSyncedAt).toLocaleString()}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npm test -- states`
Expected: PASS — all 5 tests green.

- [ ] **Step 7: Commit**

```bash
git add src/components/states/
git commit -m "feat: add Skeleton, Error, and Empty state components"
```

---

### Task 19: SyncButton component

**Files:**
- Create: `src/components/SyncButton.jsx`
- Create: `src/components/SyncButton.test.jsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/SyncButton.test.jsx`:

```jsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SyncButton } from './SyncButton.jsx';

describe('SyncButton', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('renders idle state by default', () => {
    render(<SyncButton onSyncComplete={() => {}} />);
    expect(screen.getByRole('button', { name: /sync now/i })).toBeInTheDocument();
  });

  it('shows syncing state during request', async () => {
    let resolveFetch;
    fetch.mockImplementation(() => new Promise(r => { resolveFetch = r; }));

    render(<SyncButton onSyncComplete={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: /sync now/i }));
    expect(screen.getByRole('button', { name: /syncing/i })).toBeInTheDocument();
    resolveFetch({ ok: true, json: async () => ({ ok: true, lastSyncedAt: 'T' }) });
  });

  it('calls onSyncComplete with the response data after success', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true, lastSyncedAt: '2026-05-09T06:00:00Z', perSheet: { design: 'ok' } }),
    });
    const onSyncComplete = vi.fn();
    render(<SyncButton onSyncComplete={onSyncComplete} />);
    await userEvent.click(screen.getByRole('button', { name: /sync now/i }));
    await waitFor(() => expect(onSyncComplete).toHaveBeenCalledWith(
      expect.objectContaining({ lastSyncedAt: '2026-05-09T06:00:00Z' })
    ));
  });

  it('shows cooldown state when 429 returned', async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      json: async () => ({ error: 'cooldown', retryAfterSeconds: 90 }),
    });
    render(<SyncButton onSyncComplete={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: /sync now/i }));
    await waitFor(() => expect(screen.getByRole('button')).toBeDisabled());
    expect(screen.getByRole('button').textContent).toMatch(/cooldown/i);
  });

  it('shows failed state on network error', async () => {
    fetch.mockRejectedValueOnce(new Error('network'));
    render(<SyncButton onSyncComplete={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: /sync now/i }));
    await waitFor(() => expect(screen.getByRole('button').textContent).toMatch(/failed/i));
  });

  it('calls /api/manual-sync (not /api/sync)', async () => {
    fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) });
    render(<SyncButton onSyncComplete={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: /sync now/i }));
    expect(fetch).toHaveBeenCalledWith('/api/manual-sync', expect.objectContaining({ method: 'POST' }));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- SyncButton`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `SyncButton.jsx`**

```jsx
import { useState, useEffect } from 'react';

const palette = { accent: '#8B1A1A', cardBorder: '#E7E1DC', muted: '#9E9089', success: '#2F7D32' };

export function SyncButton({ onSyncComplete }) {
  const [state, setState] = useState('idle');             // idle | syncing | success | cooldown | failed
  const [cooldownLeft, setCooldownLeft] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (cooldownLeft <= 0) return;
    const id = setInterval(() => {
      setCooldownLeft(s => {
        const next = s - 1;
        if (next <= 0) { setState('idle'); return 0; }
        return next;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [cooldownLeft]);

  const onClick = async () => {
    setState('syncing');
    try {
      const res = await fetch('/api/manual-sync', { method: 'POST' });
      const data = await res.json();
      if (res.status === 429) {
        setCooldownLeft(data.retryAfterSeconds || 120);
        setState('cooldown');
        return;
      }
      if (!res.ok) {
        setErrorMsg(data.error || `HTTP ${res.status}`);
        setState('failed');
        return;
      }
      setState('success');
      onSyncComplete(data);
      setTimeout(() => setState('idle'), 1500);
    } catch (e) {
      setErrorMsg(e.message);
      setState('failed');
    }
  };

  const labels = {
    idle:     'Sync now',
    syncing:  'Syncing…',
    success:  'Synced',
    failed:   `Sync failed — retry`,
    cooldown: `Sync now (cooldown ${Math.floor(cooldownLeft / 60)}:${String(cooldownLeft % 60).padStart(2, '0')})`,
  };

  const colors = {
    idle:     { bg: '#fff',           color: palette.accent, border: palette.accent },
    syncing:  { bg: '#fff',           color: palette.muted,  border: palette.cardBorder },
    success:  { bg: palette.success,  color: '#fff',         border: palette.success },
    failed:   { bg: '#fff',           color: '#B22222',      border: '#B22222' },
    cooldown: { bg: '#F5F2F0',        color: palette.muted,  border: palette.cardBorder },
  };

  const c = colors[state];
  const disabled = state === 'syncing' || state === 'cooldown';

  return (
    <button onClick={onClick} disabled={disabled} title={state === 'failed' ? errorMsg : undefined}
      style={{
        padding: '7px 14px', borderRadius: 8,
        border: `1px solid ${c.border}`, background: c.bg, color: c.color,
        fontFamily: 'Poppins,sans-serif', fontSize: 12, fontWeight: 500,
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'all 0.15s', display: 'inline-flex', alignItems: 'center', gap: 6,
      }}>
      <span>{state === 'syncing' ? '⟳' : state === 'success' ? '✓' : state === 'failed' ? '!' : '↻'}</span>
      {labels[state]}
    </button>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- SyncButton`
Expected: PASS — all 6 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/components/SyncButton.jsx src/components/SyncButton.test.jsx
git commit -m "feat: add SyncButton with idle/syncing/success/failed/cooldown states"
```

---

### Task 20: Stale-data banner component

**Files:**
- Create: `src/components/StaleBanner.jsx`
- Create: `src/components/StaleBanner.test.jsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/StaleBanner.test.jsx`:

```jsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StaleBanner, daysSince } from './StaleBanner.jsx';

describe('daysSince', () => {
  it('returns days between an ISO timestamp and a reference date', () => {
    const ref = new Date('2026-05-20T00:00:00Z');
    expect(daysSince('2026-05-09T00:00:00Z', ref)).toBe(11);
  });

  it('returns 0 for a future date', () => {
    const ref = new Date('2026-05-09T00:00:00Z');
    expect(daysSince('2026-05-20T00:00:00Z', ref)).toBe(0);
  });
});

describe('StaleBanner', () => {
  it('renders nothing when sheetStatus is ok and data is fresh', () => {
    const { container } = render(
      <StaleBanner sheetStatus="ok" lastSyncedAt={new Date().toISOString()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders amber banner when data is between 8 and 14 days old', () => {
    const ten = new Date();
    ten.setDate(ten.getDate() - 10);
    render(<StaleBanner sheetStatus="ok" lastSyncedAt={ten.toISOString()} />);
    const banner = screen.getByRole('alert');
    expect(banner).toHaveTextContent(/stale/i);
    expect(banner).toHaveTextContent(/10 days/i);
  });

  it('renders red banner when data is more than 14 days old', () => {
    const twenty = new Date();
    twenty.setDate(twenty.getDate() - 20);
    render(<StaleBanner sheetStatus="ok" lastSyncedAt={twenty.toISOString()} />);
    const banner = screen.getByRole('alert');
    expect(banner).toHaveTextContent(/20 days/i);
  });

  it('renders banner when sheetStatus is failed regardless of age', () => {
    render(<StaleBanner sheetStatus="failed" lastSyncedAt={new Date().toISOString()} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- StaleBanner`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `StaleBanner.jsx`**

```jsx
const AMBER_THRESHOLD_DAYS = 8;
const RED_THRESHOLD_DAYS = 14;

export function daysSince(iso, ref = new Date()) {
  const then = new Date(iso).getTime();
  const now = ref.getTime();
  if (then >= now) return 0;
  return Math.floor((now - then) / (1000 * 60 * 60 * 24));
}

export function StaleBanner({ sheetStatus, lastSyncedAt }) {
  if (!lastSyncedAt && sheetStatus !== 'failed') return null;
  const age = lastSyncedAt ? daysSince(lastSyncedAt) : Infinity;

  let level = null;
  if (sheetStatus === 'failed')           level = 'red';
  else if (age >= RED_THRESHOLD_DAYS)     level = 'red';
  else if (age >= AMBER_THRESHOLD_DAYS)   level = 'amber';

  if (!level) return null;

  const colors = {
    amber: { bg: '#FEF6E7', border: '#E5A100', text: '#7A4F00' },
    red:   { bg: '#FDECEC', border: '#B22222', text: '#7A1717' },
  }[level];

  const reason = sheetStatus === 'failed'
    ? 'last sync failed for this tab'
    : `last successful sync was ${age} days ago`;

  return (
    <div role="alert" style={{
      padding: '10px 16px', borderRadius: 8, marginBottom: 16,
      background: colors.bg, border: `1px solid ${colors.border}`, color: colors.text,
      fontFamily: 'Poppins,sans-serif', fontSize: 13, fontWeight: 500,
    }}>
      ⚠ This data may be stale — {reason}.
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- StaleBanner`
Expected: PASS — all 6 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/components/StaleBanner.jsx src/components/StaleBanner.test.jsx
git commit -m "feat: add StaleBanner with amber/red thresholds"
```

---

## Phase 5 — Tab refactor

**Heads up:** [src/App.jsx](../../../src/App.jsx) is 1,478 lines. Tasks 21–24 split it into per-tab files, then Task 25 consumes the new hooks. The order matters — extract first, wire second.

### Task 21: Move `DESIGN_RAW` and `DesignTab` to `src/tabs/DesignTab.jsx`

**Files:**
- Create: `src/tabs/DesignTab.jsx`
- Modify: `src/App.jsx`

- [ ] **Step 1: Identify the source range**

Run: `grep -n "^function DesignTab\|^const DESIGN_RAW" "src/App.jsx"`
Expected output: `10:const DESIGN_RAW = [` and `407:function DesignTab({ globalMonthRange }) {`. Note `STD_BAU` at line 103 marks the END of `DESIGN_RAW`.

- [ ] **Step 2: Create `src/tabs/DesignTab.jsx`**

Read `src/App.jsx` lines 10–102 to extract `DESIGN_RAW`, and lines 407–790 to extract `DesignTab`. Copy them verbatim into a new file, prepending the imports.

The file structure should look like:

```jsx
import { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, ComposedChart, Area, LabelList,
} from 'recharts';
import { C, PIE_COLORS, ICON, KpiCard, ChartCard, SectionTitle, SectionLabel, FilterRow, Sel, ResetBtn, CT, cnt, toBarData } from '../shared/dashboardKit.js';

export const DESIGN_RAW = [
  // ... copy lines 11-102 verbatim from App.jsx
];

export function DesignTab({ globalMonthRange, designRows = DESIGN_RAW }) {
  // ... copy the body of DesignTab from lines 408-790, with one critical change:
  //     wherever the original code references DESIGN_RAW directly, replace it with `designRows`.
  //     Look for patterns like `DESIGN_RAW.filter(...)`, `DESIGN_RAW.map(...)`, etc.
}
```

**Important:** any reference inside `DesignTab` that previously read `DESIGN_RAW` must now read the `designRows` prop. This is what enables the live-data swap in Task 25. If the original code reads `DESIGN_RAW` only inside `useMemo`, it's a small set of changes — search the function body for `DESIGN_RAW` and replace.

- [ ] **Step 3: Extract shared dashboard kit**

The `DesignTab` function depends on shared primitives (`C`, `PIE_COLORS`, `KpiCard`, etc.) that live in `App.jsx`. Create `src/shared/dashboardKit.js`:

Read `src/App.jsx` lines 271–406. This range contains: `C` (line 271), `PIE_COLORS` (line 292), `cnt` (line 294), `toBarData` (line 297), `ICON` (line 302), `KpiCard` (line 317), `ChartCard` (line 342), `SectionTitle` (line 354), `SectionLabel` (line 358), `FilterRow` (line 362), `Sel` (line 368), `ResetBtn` (line 380), `CT` (line 389).

Copy lines 271–406 verbatim into a new file `src/shared/dashboardKit.js`, then prepend:

```js
import { Tooltip } from 'recharts';   // CT uses Tooltip's CustomComponent signature
```

Add `export` keyword to each top-level `const`/`function` so they can be imported:

```js
export const C = { ... };
export const PIE_COLORS = [ ... ];
export function cnt(arr, key) { ... }
export function toBarData(obj) { ... }
export const ICON = { ... };
export const KpiCard = ({ label, ... }) => { ... };
export const ChartCard = ({ title, ... }) => ( ... );
// etc.
```

- [ ] **Step 4: Modify `src/App.jsx` to import from the new files**

Read `src/App.jsx` and:
1. Delete lines 10–102 (`DESIGN_RAW`).
2. Delete lines 271–406 (the shared kit).
3. Delete lines 407–790 (the `DesignTab` function body).
4. Add at the top:

```js
import { DesignTab } from './tabs/DesignTab.jsx';
import { C } from './shared/dashboardKit.js';
```

The other tabs (`StandardizationTab`, `ProcessTab`, `StrategyTab`) still live in `App.jsx` for now and reference the same `C` constant — adjust them to import `C` from `dashboardKit.js`. Run a search-and-replace in `App.jsx` to remove any remaining direct references to the deleted constants and route them through the import.

- [ ] **Step 5: Verify the app still runs**

Run: `npm run dev`
Expected: dev server starts. Open `http://localhost:5173`. The Design & Usability tab still renders identically using `DESIGN_RAW` (default prop).

- [ ] **Step 6: Run full test suite**

Run: `npm test`
Expected: PASS — all existing tests still green.

- [ ] **Step 7: Commit**

```bash
git add src/tabs/DesignTab.jsx src/shared/dashboardKit.js src/App.jsx
git commit -m "refactor: extract DesignTab and dashboard kit into separate modules"
```

---

### Task 22: Extract `StandardizationTab` and `StrategyTab` to their own files

**Files:**
- Create: `src/tabs/StandardizationTab.jsx`
- Create: `src/tabs/StrategyTab.jsx`
- Modify: `src/App.jsx`

- [ ] **Step 1: Locate the source ranges**

Run: `grep -n "^function StandardizationTab\|^function StrategyTab\|^const STD_BAU\|^const STD_JLV\|^const STRATEGY_DATA" "src/App.jsx"`

Note the line numbers. Each function's hardcoded data lives just before it.

- [ ] **Step 2: Create `src/tabs/StandardizationTab.jsx`**

Copy `STD_BAU`, `STD_JLV`, and `StandardizationTab` verbatim from `App.jsx`. Wrap with:

```jsx
import { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';
import { C, PIE_COLORS, KpiCard, ChartCard, SectionTitle, SectionLabel, FilterRow, Sel, ResetBtn, CT, cnt, toBarData } from '../shared/dashboardKit.js';

export const STD_BAU = [ /* copy verbatim */ ];
export const STD_JLV = [ /* copy verbatim */ ];

export function StandardizationTab({ globalMonthRange, bauRows = STD_BAU, jlvRows = STD_JLV }) {
  // copy verbatim, replacing references to STD_BAU/STD_JLV with bauRows/jlvRows
}
```

- [ ] **Step 3: Create `src/tabs/StrategyTab.jsx`**

```jsx
import { C, PIE_COLORS } from '../shared/dashboardKit.js';

export const STRATEGY_DATA = [ /* copy verbatim */ ];

export function StrategyTab({ rows = STRATEGY_DATA }) {
  // copy verbatim, replacing references to STRATEGY_DATA with rows
}
```

- [ ] **Step 4: Modify `App.jsx`**

Delete the moved code from `App.jsx`. Add imports:

```js
import { StandardizationTab } from './tabs/StandardizationTab.jsx';
import { StrategyTab } from './tabs/StrategyTab.jsx';
```

- [ ] **Step 5: Verify the app still runs**

Run: `npm run dev`
Expected: dev server starts. All four tabs still render identically.

- [ ] **Step 6: Run full test suite**

Run: `npm test`
Expected: PASS — no regressions.

- [ ] **Step 7: Commit**

```bash
git add src/tabs/StandardizationTab.jsx src/tabs/StrategyTab.jsx src/App.jsx
git commit -m "refactor: extract StandardizationTab and StrategyTab to separate files"
```

---

### Task 23: Extract `ProcessTab` to its own file (UI unchanged)

**Files:**
- Create: `src/tabs/ProcessTab.jsx`
- Modify: `src/App.jsx`

- [ ] **Step 1: Locate the source range**

Run: `grep -n "^function ProcessTab\|^const PROC_\|^function decodeProcRows" "src/App.jsx"`

Note line numbers for: `PROC_MH`, `PROC_NET`, `PROC_CT`, `PROC_VT`, `PROC_CB`, `PROC_ST`, `decodeProcRows`, `ProcessTab`.

- [ ] **Step 2: Create `src/tabs/ProcessTab.jsx`**

Copy all `PROC_*` constants, `decodeProcRows`, and `ProcessTab` verbatim. Wrap:

```jsx
import { useMemo } from 'react';
// recharts imports as needed
import { C, PIE_COLORS, KpiCard, ChartCard, SectionTitle, FilterRow, Sel, ResetBtn, CT } from '../shared/dashboardKit.js';

export const PROC_MH = [ /* ... */ ];
export const PROC_NET = [ /* ... */ ];
// ... other PROC_ constants ...

export function decodeProcRows(mhF, netF, ctF, vtF, cbF, stF) {
  // copy verbatim
}

export function ProcessTab() {
  // copy verbatim — no prop refactor for this tab in Plan A.
  // Plan B will rebuild this function entirely against live data.
}
```

- [ ] **Step 3: Modify `App.jsx`**

Delete the moved code. Add:

```js
import { ProcessTab } from './tabs/ProcessTab.jsx';
```

- [ ] **Step 4: Verify the app still runs**

Run: `npm run dev`
Expected: All four tabs render correctly.

- [ ] **Step 5: Run full test suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/tabs/ProcessTab.jsx src/App.jsx
git commit -m "refactor: extract ProcessTab to separate file"
```

---

### Task 24: Verify `App.jsx` is now lean (sanity check, no code changes)

- [ ] **Step 1: Check the line count**

Run: `wc -l src/App.jsx`
Expected: under 300 lines (was 1,478). It now contains only the root `CJODashboard` component, header/tabs JSX, and footer.

- [ ] **Step 2: Visually confirm the structure**

Read `src/App.jsx`. The file should:
- Import `DesignTab`, `StandardizationTab`, `ProcessTab`, `StrategyTab` from `./tabs/`
- Import `C`, `JW_LOGO` (or move JW_LOGO to dashboardKit.js if not done) from `./shared/`
- Define only `TABS`, `MONTH_OPTIONS`, `DROPDOWN_ARROW`, and the root `CJODashboard` function

If `JW_LOGO` (the long base64 string) is still in `App.jsx`, move it to `src/shared/dashboardKit.js` and import it. The base64 string is at line 7 in the original file.

- [ ] **Step 3: No commit needed if everything is already clean**

If you needed to move `JW_LOGO`:

```bash
git add src/App.jsx src/shared/dashboardKit.js
git commit -m "refactor: relocate JW_LOGO constant to dashboardKit"
```

---

### Task 25: Wire `DesignTab` to live data with hardcoded fallback

**Files:**
- Modify: `src/tabs/DesignTab.jsx`

- [ ] **Step 1: Update imports**

Read `src/tabs/DesignTab.jsx`. Add to the imports at the top:

```js
import { useDashboardDataWithFallback } from '../hooks/useDashboardDataWithFallback.js';
import { SkeletonState } from '../components/states/SkeletonState.jsx';
import { ErrorState } from '../components/states/ErrorState.jsx';
import { StaleBanner } from '../components/StaleBanner.jsx';
```

- [ ] **Step 2: Replace the function signature and add live-data preamble**

Find the `export function DesignTab(...)` line and the opening `{` of its body. Replace the signature line with the new one, then **insert** the four new lines (hook call, two early returns, designRows derivation) at the top of the function body. **Do not delete or reorder anything else** — all existing `useState`, `useMemo`, JSX stays in place inside this same function.

Before:

```jsx
export function DesignTab({ globalMonthRange, designRows = DESIGN_RAW }) {
  // ... existing useState/useMemo/JSX ...
  return (
    /* existing root JSX */
  );
}
```

After:

```jsx
export function DesignTab({ globalMonthRange }) {
  const { rows, sheetStatus, lastSyncedAt, refresh } =
    useDashboardDataWithFallback('design', DESIGN_RAW);

  if (sheetStatus === 'loading') return <SkeletonState />;
  if (sheetStatus === 'error')
    return <ErrorState message="Could not load Design data." onRetry={refresh} />;

  const designRows = rows ?? DESIGN_RAW;

  // ... ALL existing useState/useMemo/JSX is preserved below this line, unchanged.
  // The variable `designRows` is now in scope and is what the existing code reads.

  return (
    <>
      <StaleBanner sheetStatus={sheetStatus} lastSyncedAt={lastSyncedAt} />
      {/* existing root JSX wrapped here */}
    </>
  );
}
```

Two important sub-steps:

1. **Wrap the existing root JSX** that the function previously returned in a fragment that also includes `<StaleBanner ... />`. The existing JSX content stays identical inside the fragment.
2. **Verify references**: in Task 21 you already changed `DESIGN_RAW` → `designRows` everywhere inside the function. The new local `const designRows = rows ?? DESIGN_RAW;` provides that variable. No further changes to `useState`/`useMemo`/JSX are needed.

The early returns appear **before** any hook calls inside the body? No — the early returns appear **after** the hook call (`useDashboardDataWithFallback` is itself a hook) but **before** any conditionally-called hooks would run. React's rules-of-hooks are satisfied because `useDashboardDataWithFallback` is the first call and runs unconditionally; the `useState`/`useMemo` further down are unreachable when we early-return, which is fine because the function exits and won't be rendered for those branches.

Wait — that's not how hooks work. **Hooks must be called in the same order on every render.** If `sheetStatus` is sometimes `loading` and sometimes `ok`, the function returns early in some renders and reaches the `useState`/`useMemo` calls in others. That violates rules-of-hooks.

Fix: do **not** early-return before the existing hooks. Instead, render the loading/error UI inside the existing JSX tree, conditionally:

```jsx
export function DesignTab({ globalMonthRange }) {
  const { rows, sheetStatus, lastSyncedAt, refresh } =
    useDashboardDataWithFallback('design', DESIGN_RAW);

  const designRows = rows ?? DESIGN_RAW;

  // ... ALL existing useState / useMemo calls run unconditionally here ...

  if (sheetStatus === 'loading') return <SkeletonState />;
  if (sheetStatus === 'error')
    return <ErrorState message="Could not load Design data." onRetry={refresh} />;

  return (
    <>
      <StaleBanner sheetStatus={sheetStatus} lastSyncedAt={lastSyncedAt} />
      {/* existing root JSX wrapped here */}
    </>
  );
}
```

This places the early returns **after** all hook calls (existing `useState`/`useMemo` plus the new `useDashboardDataWithFallback`), so hook order is stable across renders. The loading state renders briefly on mount before the first fetch resolves; then the real JSX takes over.

- [ ] **Step 3: Verify the dev server still works**

Run: `npm run dev` and visit the Design tab.
Expected: The Design tab renders the same as before (because no `SHEET_ID_DESIGN` env var is set yet → status `unconfigured` → falls back to `DESIGN_RAW`).

- [ ] **Step 4: Manually test with mock fetch**

In the browser console, run:

```js
const orig = window.fetch;
window.fetch = (url) => {
  if (url.startsWith('/api/data?tab=design')) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({
        rows: [{ month: 'Test', project: 'Live!', assigned_to: 'Test', stakeholder: 'Test', status: 'Completed', type: 'Misc.', count_users: 99 }],
        lastSyncedAt: new Date().toISOString(),
        sheetStatus: 'ok',
      }),
    });
  }
  return orig(url);
};
location.reload();
```

Expected: After reload, the Design tab shows just one row with project "Live!" — confirming the live-data path works.

- [ ] **Step 5: Run full test suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/tabs/DesignTab.jsx
git commit -m "feat: wire DesignTab to live data with hardcoded fallback"
```

---

### Task 26: Wire `StandardizationTab`, `StrategyTab`, `ProcessTab` to fallback wrapper

**Files:**
- Modify: `src/tabs/StandardizationTab.jsx`
- Modify: `src/tabs/StrategyTab.jsx`
- Modify: `src/tabs/ProcessTab.jsx`

These tabs use the wrapper too — but since their `SHEET_ID_<TAB>` env vars are unset in Plan A, the wrapper will always return `source: 'hardcoded'`. This is intentional: it means the moment a sheet ID env var is added, the tab automatically switches to live data without code changes.

- [ ] **Step 1: Update `StandardizationTab.jsx`**

```jsx
import { useDashboardDataWithFallback } from '../hooks/useDashboardDataWithFallback.js';

export function StandardizationTab({ globalMonthRange }) {
  const bau = useDashboardDataWithFallback('std', STD_BAU);
  const jlv = useDashboardDataWithFallback('std', STD_JLV);   // same tab, but two fallback shapes — see note below
  // ... existing rendering, but read from bau.rows and jlv.rows
}
```

**Note:** Standardization currently uses two hardcoded constants (`STD_BAU` and `STD_JLV`). Phase 2 will need a sheet design that supports both, possibly via two sheet tabs or one combined sheet. For Plan A, just keep both fallbacks live — the wrapper returns `STD_BAU` for both calls because std is unconfigured. We document this as an open question to revisit when std actually wires up.

Add a comment at the top of `StandardizationTab.jsx`:

```jsx
// Plan A: Standardization is unconfigured (no SHEET_ID_STD), so this tab uses STD_BAU and STD_JLV
// hardcoded constants via the fallback wrapper.
// Phase 2 / Plan B+: revisit how the sheet schema represents both BAU and JLV streams
// (likely one sheet with a "stream" column, or two sheet tabs).
```

- [ ] **Step 2: Update `StrategyTab.jsx`**

```jsx
import { useDashboardDataWithFallback } from '../hooks/useDashboardDataWithFallback.js';

export function StrategyTab() {
  const { rows } = useDashboardDataWithFallback('strategy', STRATEGY_DATA);
  // ... existing rendering, but read from rows (defaults to STRATEGY_DATA when unconfigured)
}
```

- [ ] **Step 3: Update `ProcessTab.jsx`**

```jsx
import { useDashboardDataWithFallback } from '../hooks/useDashboardDataWithFallback.js';

export function ProcessTab() {
  // Plan A: Process tab UI is unchanged. Plan B rebuilds it.
  // We still wire the fallback wrapper so adding SHEET_ID_PROCESS automatically picks up live data
  // — but Plan A's current ProcessTab doesn't read these rows; it uses the existing hardcoded PROC_* arrays.
  useDashboardDataWithFallback('process', null);   // dispatched but unused
  // ... existing implementation unchanged
}
```

- [ ] **Step 4: Verify the dev server still works**

Run: `npm run dev`
Expected: All four tabs render identically to before. Standardization and Strategy show their hardcoded data.

- [ ] **Step 5: Run full test suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/tabs/
git commit -m "feat: route Std, Strategy, and Process tabs through fallback wrapper"
```

---

## Phase 6 — Header integration

### Task 27: Replace hardcoded "Last updated" with `SyncButton` and live timestamp

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: Locate the existing footer line**

Run: `grep -n "Last updated" "src/App.jsx"`
Expected: a line near the bottom of the JSX with `Last updated: March 15, 2026 · 11:30 AM`.

- [ ] **Step 2: Add imports to `App.jsx`**

```js
import { useState, useEffect, useCallback } from 'react';
import { SyncButton } from './components/SyncButton.jsx';
```

- [ ] **Step 3: Add a `lastSyncedAt` state lifted to the root**

Inside the `CJODashboard` function body, near the top:

```jsx
const [lastSyncedAt, setLastSyncedAt] = useState(null);
const [syncTick, setSyncTick] = useState(0);   // increment to trigger refresh in tabs

// On initial mount, fetch the current lastSyncedAt from any tab's data response (use design as a probe).
useEffect(() => {
  fetch('/api/data?tab=design')
    .then(r => r.json())
    .then(d => setLastSyncedAt(d.lastSyncedAt))
    .catch(() => {});
}, []);

const onSyncComplete = useCallback((data) => {
  setLastSyncedAt(data.lastSyncedAt);
  setSyncTick(t => t + 1);   // tabs that watch this re-fetch
}, []);
```

- [ ] **Step 4: Render the sync button + timestamp in the header area**

Find the header `<div>` block (the sticky one with the logo and Period filter). Add a row above the tab navigation that shows the timestamp + sync button:

```jsx
{/* Sync row — placed under the title row, above the tabs */}
<div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12, padding: '6px 0' }}>
  <span style={{ fontSize: 12, color: '#9E9089', fontFamily: 'Poppins,sans-serif' }}>
    {lastSyncedAt
      ? `Last synced: ${formatRelative(lastSyncedAt)}`
      : 'Never synced'}
  </span>
  <SyncButton onSyncComplete={onSyncComplete} />
</div>
```

Add a helper near the top of the file:

```js
function formatRelative(iso) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}
```

- [ ] **Step 5: Remove the hardcoded "Last updated: March 15…" footer line**

Find the block at the bottom of the JSX:

```jsx
<div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 6, marginTop: 32, paddingTop: 16, borderTop: `1px solid ${C.cardBorder}` }}>
  <svg width="12" height="12" .../>
  <span ...>Last updated: March 15, 2026 · 11:30 AM</span>
</div>
```

Delete this block. The timestamp now lives in the header.

- [ ] **Step 6: Verify the dev server**

Run: `npm run dev` and click "Sync now".
Expected: Button transitions through `Sync now → Syncing… → Synced ✓ → Sync now`. With no real KV / API yet, the call will likely fail with a network error and show the "failed" state — that's expected. We'll verify the full round-trip in Task 28.

- [ ] **Step 7: Run full test suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/App.jsx
git commit -m "feat: replace hardcoded footer with live sync button and timestamp"
```

---

### Task 28: Wire `syncTick` so tabs refetch after a manual sync

**Files:**
- Modify: `src/hooks/useDashboardData.js`
- Modify: `src/hooks/useDashboardDataWithFallback.js`
- Modify: `src/tabs/DesignTab.jsx` (and add prop wiring in `App.jsx`)

The hook already has a `refresh()` function. The simpler approach: pass `syncTick` as a dep that triggers re-fetch.

- [ ] **Step 1: Update the hook to accept a refresh trigger**

Read `src/hooks/useDashboardData.js`. Update:

```js
import { useState, useEffect, useCallback } from 'react';

export function useDashboardData(tab, refreshTrigger = 0) {
  const [state, setState] = useState({
    rows: null,
    lastSyncedAt: null,
    sheetStatus: 'loading',
    error: null,
  });

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/data?tab=${tab}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setState({
        rows: data.rows,
        lastSyncedAt: data.lastSyncedAt,
        sheetStatus: data.sheetStatus,
        error: null,
      });
    } catch (e) {
      setState(prev => ({ ...prev, sheetStatus: 'error', error: e.message }));
    }
  }, [tab]);

  useEffect(() => {
    fetchData();
  }, [fetchData, refreshTrigger]);

  return { ...state, refresh: fetchData };
}
```

- [ ] **Step 2: Update the wrapper to pass through `refreshTrigger`**

```js
import { useDashboardData } from './useDashboardData.js';

export function useDashboardDataWithFallback(tab, hardcodedRows, refreshTrigger = 0) {
  const live = useDashboardData(tab, refreshTrigger);
  // ... existing logic ...
}
```

- [ ] **Step 3: Pass `syncTick` from `App.jsx` to each tab**

In `App.jsx`'s render, where each tab is mounted, pass `syncTick` as a prop:

```jsx
{activeTab === 'design'   && <DesignTab globalMonthRange={globalMonthRange} syncTick={syncTick} />}
{activeTab === 'std'      && <StandardizationTab globalMonthRange={globalMonthRange} syncTick={syncTick} />}
{activeTab === 'process'  && <ProcessTab syncTick={syncTick} />}
{activeTab === 'strategy' && <StrategyTab syncTick={syncTick} />}
```

- [ ] **Step 4: Update each tab's signature to accept `syncTick` and pass it to the hook**

In `src/tabs/DesignTab.jsx`:

```jsx
export function DesignTab({ globalMonthRange, syncTick }) {
  const { rows, sheetStatus, lastSyncedAt, refresh } =
    useDashboardDataWithFallback('design', DESIGN_RAW, syncTick);
  // ... rest unchanged
}
```

Apply the same change in `StandardizationTab.jsx`, `StrategyTab.jsx`, and `ProcessTab.jsx`.

- [ ] **Step 5: Update existing hook tests to cover the new param**

Read `src/hooks/useDashboardData.test.jsx` and append:

```jsx
it('re-fetches when refreshTrigger changes', async () => {
  fetch
    .mockResolvedValueOnce({ ok: true, json: async () => ({ rows: [{ a: 1 }], lastSyncedAt: 'T1', sheetStatus: 'ok' }) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ rows: [{ a: 2 }], lastSyncedAt: 'T2', sheetStatus: 'ok' }) });
  const { result, rerender } = renderHook(({ trigger }) => useDashboardData('design', trigger), {
    initialProps: { trigger: 0 },
  });
  await waitFor(() => expect(result.current.rows).toEqual([{ a: 1 }]));
  rerender({ trigger: 1 });
  await waitFor(() => expect(result.current.rows).toEqual([{ a: 2 }]));
});
```

- [ ] **Step 6: Run tests**

Run: `npm test`
Expected: PASS — all tests green.

- [ ] **Step 7: Commit**

```bash
git add src/hooks/ src/App.jsx src/tabs/
git commit -m "feat: refresh tab data when syncTick advances after manual sync"
```

---

## Phase 7 — Diagnostics page + verification

### Task 29: `/diagnostics` page (frontend)

**Files:**
- Create: `src/pages/Diagnostics.jsx`
- Create: `src/pages/Diagnostics.test.jsx`
- Modify: `src/App.jsx`

- [ ] **Step 1: Write the failing test**

Create `src/pages/Diagnostics.test.jsx`:

```jsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Diagnostics } from './Diagnostics.jsx';

describe('Diagnostics page', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('shows password prompt initially', () => {
    render(<Diagnostics />);
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  });

  it('fetches diagnostics with the entered password', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        lastSyncedAt: '2026-05-09T06:00:00Z',
        lastSyncStatus: { status: 'ok', perSheet: { design: 'ok' }, errors: [] },
        history: [],
      }),
    });
    render(<Diagnostics />);
    await userEvent.type(screen.getByLabelText(/password/i), 'opensesame');
    await userEvent.click(screen.getByRole('button', { name: /unlock/i }));
    await waitFor(() => expect(screen.getByText(/last synced/i)).toBeInTheDocument());
    expect(fetch.mock.calls[0][0]).toContain('password=opensesame');
  });

  it('shows error on wrong password', async () => {
    fetch.mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({ error: 'Unauthorized' }) });
    render(<Diagnostics />);
    await userEvent.type(screen.getByLabelText(/password/i), 'wrong');
    await userEvent.click(screen.getByRole('button', { name: /unlock/i }));
    await waitFor(() => expect(screen.getByText(/unauthorized/i)).toBeInTheDocument());
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- Diagnostics`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `Diagnostics.jsx`**

```jsx
import { useState } from 'react';
import { C } from '../shared/dashboardKit.js';

export function Diagnostics() {
  const [password, setPassword] = useState('');
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const onUnlock = async () => {
    setError(null);
    try {
      const res = await fetch(`/api/diagnostics?password=${encodeURIComponent(password)}`);
      const body = await res.json();
      if (!res.ok) {
        setError(body.error || 'Failed');
        return;
      }
      setData(body);
    } catch (e) {
      setError(e.message);
    }
  };

  if (!data) {
    return (
      <div style={{ maxWidth: 480, margin: '80px auto', padding: 32, fontFamily: 'Poppins,sans-serif' }}>
        <h2 style={{ marginTop: 0 }}>Diagnostics</h2>
        <label style={{ display: 'block', marginBottom: 12 }}>
          <div style={{ marginBottom: 6, fontSize: 13, color: C.textSub }}>Password</div>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)}
            style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: `1px solid ${C.cardBorder}` }} />
        </label>
        <button onClick={onUnlock} style={{
          padding: '8px 18px', borderRadius: 8, border: 'none',
          background: C.accent, color: '#fff', cursor: 'pointer',
        }}>Unlock</button>
        {error && <div role="alert" style={{ marginTop: 12, color: '#B22222' }}>{error}</div>}
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 800, margin: '40px auto', padding: 32, fontFamily: 'Poppins,sans-serif' }}>
      <h2>Diagnostics</h2>
      <p>Last synced: {data.lastSyncedAt || 'never'}</p>
      <h3>Per-sheet status</h3>
      <ul>
        {Object.entries(data.lastSyncStatus?.perSheet ?? {}).map(([tab, status]) => (
          <li key={tab}>{tab}: {status}</li>
        ))}
      </ul>
      {data.lastSyncStatus?.errors?.length > 0 && (
        <>
          <h3>Errors</h3>
          <pre style={{ background: '#FDECEC', padding: 12, borderRadius: 8 }}>
            {JSON.stringify(data.lastSyncStatus.errors, null, 2)}
          </pre>
        </>
      )}
      <h3>Last 10 sync attempts</h3>
      <pre style={{ background: '#F5F2F0', padding: 12, borderRadius: 8, fontSize: 12 }}>
        {JSON.stringify(data.history, null, 2)}
      </pre>
    </div>
  );
}
```

- [ ] **Step 4: Mount the page in `App.jsx`**

Add a simple route. The project has no router, so use a URL-based switch:

```jsx
import { Diagnostics } from './pages/Diagnostics.jsx';

export default function CJODashboard() {
  if (window.location.pathname === '/diagnostics') {
    return <Diagnostics />;
  }
  // ... existing dashboard render
}
```

- [ ] **Step 5: Run tests**

Run: `npm test -- Diagnostics`
Expected: PASS — all 3 tests green.

- [ ] **Step 6: Commit**

```bash
git add src/pages/ src/App.jsx
git commit -m "feat: add /diagnostics page with password gate"
```

---

### Task 30: End-to-end smoke verification + deploy checklist

This is a manual verification task. No new code; you exercise the full pipeline locally and document what to do at deploy time.

- [ ] **Step 1: Confirm full test suite passes**

Run: `npm test`
Expected: ALL tests pass — no skipped, no failed.

- [ ] **Step 2: Confirm the build succeeds**

Run: `npm run build`
Expected: build completes without errors. Output goes to `dist/`.

- [ ] **Step 3: Run lint to confirm no regressions**

Run: `npm run lint`
Expected: no errors. Warnings are acceptable for now.

- [ ] **Step 4: Local Vercel dev verification**

Run: `vercel dev` (after `vercel link` and `vercel env pull .env.local` if not done previously).

In a separate terminal:

```bash
# Sanity: data endpoint with no env vars set returns "unconfigured"
curl 'http://localhost:3000/api/data?tab=std'
# Expected: {"rows":null,"lastSyncedAt":null,"sheetStatus":"unconfigured"}

# Trigger a manual sync (no auth needed, hits /api/manual-sync)
curl -X POST http://localhost:3000/api/manual-sync
# Expected: {"ok":true,"status":"ok","lastSyncedAt":"...","perSheet":{"design":"ok"},"errors":[]}

# Re-read design data — should now have rows
curl 'http://localhost:3000/api/data?tab=design'
# Expected: {"rows":[{"month":"...","project":"...",...}],"lastSyncedAt":"...","sheetStatus":"ok"}

# Diagnostics page (set DIAGNOSTICS_PASSWORD=test in .env.local first)
curl 'http://localhost:3000/api/diagnostics?password=test'
# Expected: full diagnostics JSON
```

- [ ] **Step 5: Browser smoke test**

Open `http://localhost:3000` and verify:
- Design tab shows live data (project names should match the actual sheet, not the original hardcoded ones)
- Standardization, Process, and Strategy tabs render their hardcoded data unchanged
- Header shows "Last synced: just now"
- Click "Sync now" → button cycles through Syncing → Synced → Sync now
- Click again immediately → button shows cooldown countdown
- Visit `/diagnostics` → password prompt appears → enter password → see status JSON

- [ ] **Step 6: Document the production deploy steps**

Create `docs/superpowers/plans/PLAN-A-DEPLOY-CHECKLIST.md`:

```markdown
# Plan A — Production Deploy Checklist

## Vercel project setup (one-time)

1. Vercel dashboard → Storage → Create Database → KV
   - Create `kv-prod` (link to Production env)
   - Create `kv-preview` (link to Preview + Development envs)

2. Vercel dashboard → Settings → Environment Variables → add (Production):
   - `SHEET_ID_DESIGN` = `10jYPcINf2UvN4-Quc8SG5Tl0tyw7Qmdv`
   - `SHEET_GID_DESIGN` = `1246818985`
   - `SYNC_SECRET` = output of `openssl rand -hex 32`
   - `DIAGNOSTICS_PASSWORD` = a strong password
   - (Std/Strategy/Process sheet IDs intentionally omitted — they fall back to hardcoded.)

## Deploy

```bash
git push                       # if Vercel Git integration is configured
# OR
vercel --prod
```

## Post-deploy verification

1. Visit `https://<your-app>.vercel.app/api/data?tab=std`
   - Expected: `{"rows":null,"lastSyncedAt":null,"sheetStatus":"unconfigured"}`
2. Trigger first sync: `curl -X POST https://<your-app>.vercel.app/api/manual-sync`
   - Expected: `{"ok":true,...,"perSheet":{"design":"ok"}}`
3. Visit dashboard → click "Sync now" → see Synced ✓ + fresh timestamp
4. Visit `/diagnostics?password=...` → see status

## Cron verification

Wait until next Monday 06:00 UTC. After that, verify `lastSyncedAt` updated. If not, check Vercel function logs for cron failure.

## Rollback

If live data looks broken: set `VITE_USE_HARDCODED=1` in Vercel env vars and redeploy. All tabs revert to hardcoded data within 30 seconds.
```

- [ ] **Step 7: Commit**

```bash
git add docs/superpowers/plans/PLAN-A-DEPLOY-CHECKLIST.md
git commit -m "docs: add Plan A production deploy checklist"
```

- [ ] **Step 8: Final report**

State to user: "Plan A complete. All tests green. The dashboard is ready to deploy. After deploy and verification, Plan B will rebuild the Process tab around the new sheet."

---

## Self-review notes

The following spec requirements are intentionally deferred to Plan B:

- **Process sheet block-detection parser** (spec §7) — `fetchSheet.js` throws "not implemented" for `parser: 'process-blocks'`. /api/sync surfaces this as a per-sheet failure for `process` only IF `SHEET_ID_PROCESS` is set in env. Plan A's deploy checklist intentionally omits that env var, so Process never tries to sync.
- **Process tab UI rebuild** (spec §7) — Plan A leaves `ProcessTab` in its current state, wired through the fallback wrapper but using the existing hardcoded `PROC_*` arrays.
- **OAuth refresh-token path** (spec §4 path B) — `fetchAuthSheet` throws "not implemented". std and strategy never reach this code because `SHEET_ID_STD`/`SHEET_ID_STRATEGY` env vars stay unset in Phase 1; the wrapper returns `unconfigured` before any fetch is attempted.
- **`scripts/google-auth.js`** — deferred; not required until Phase 2 credentials arrive.

Other spec requirements that ARE implemented in Plan A:
- ✅ Sync orchestration (cron + manual)
- ✅ KV schema (data, meta, syncHistory, lock)
- ✅ /api/data with all status states (ok, failed, never-synced, unconfigured)
- ✅ /api/manual-sync rate limit
- ✅ /api/diagnostics
- ✅ useDashboardData + fallback wrapper
- ✅ SyncButton with all states
- ✅ StaleBanner with 8-day amber / 14-day red thresholds
- ✅ Design tab live-data swap with hardcoded fallback
- ✅ Tab refactor (App.jsx split)
- ✅ All-empty guard in /api/sync
- ✅ Sync history ring buffer
