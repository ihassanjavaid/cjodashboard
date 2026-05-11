# CJO Dashboard — Google Sheets Sync & Process Tab Rebuild

**Date:** 2026-05-09
**Status:** Design approved, pending spec review
**Author:** Brainstormed with the user

---

## 1. Goals

Replace the dashboard's hardcoded data with live Google Sheets, with weekly auto-sync and a manual sync button. Rebuild the Process Team tab from scratch around a new sheet. Ship in two phases — public sheets first, restricted sheets when credentials arrive.

### In scope

1. Live data for the **Design & Usability** tab (UI unchanged — pure data-source swap).
2. Full rebuild of the **Process Team** tab (fourth tab) using the new public sheet.
3. Vercel-hosted serverless API for fetching, parsing, caching, and serving sheet data.
4. Vercel KV as the single cache layer.
5. Vercel Cron Job for weekly automatic sync (Mondays 06:00 UTC).
6. Manual sync button in the dashboard header with rate limiting.
7. Per-sheet status tracking with stale-data banners.
8. `/diagnostics` page for operational visibility.
9. Two-phase rollout: public sheets now, restricted sheets when the dedicated Google account arrives.

### Out of scope

- Authentication for end users (no sign-in screen — dashboard remains accessible to anyone with the URL).
- Editing data from the dashboard (read-only).
- Historical snapshots of synced data (only latest is kept).
- Slack / email alerting on sync failures (in-app banner + Vercel logs only).
- Modifying the visual design or layout of the Design, Standardization, or Strategy tabs.
- Restructuring the Process sheet itself (parser handles the existing block layout).

---

## 2. Phasing

| Phase | Tabs covered | Trigger |
| --- | --- | --- |
| **Phase 1 — public sheets** | Design ✅, Process ✅ | Now. Standardization + Strategy keep their hardcoded data temporarily. |
| **Phase 2 — restricted sheets** | + Standardization, + Strategy | When the sheet owner provides the dedicated Google account credentials. |

Phase 2 is a config + env var change only, with no code changes. The `mode: 'public' | 'auth'` flag on each sheet config drives which fetch path is used.

---

## 3. Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        Vercel deployment                         │
│                                                                  │
│  ┌────────────────────┐         ┌────────────────────────────┐   │
│  │   React frontend   │ ──GET── │  /api/data?tab=design      │   │
│  │   (Vite SPA)       │         │  → reads from KV, returns  │   │
│  │                    │         └────────────────────────────┘   │
│  │  - Sync button     │                                          │
│  │  - Last synced ts  │ ──POST─►┌────────────────────────────┐   │
│  │  - 4 tabs          │         │  /api/sync                 │   │
│  └────────────────────┘         │  → fetches all sheets,     │   │
│                                 │    writes to KV,           │   │
│  ┌────────────────────┐ ────────►   updates "lastSyncedAt"   │   │
│  │  Vercel Cron Job   │  weekly │  → returns fresh data      │   │
│  │  (Mon 06:00 UTC)   │         └──────────────┬─────────────┘   │
│  └────────────────────┘                        │                 │
│                                                ▼                 │
│                                  ┌────────────────────────────┐  │
│                                  │       Vercel KV            │  │
│                                  │  data:design   → JSON      │  │
│                                  │  data:std      → JSON      │  │
│                                  │  data:process  → JSON      │  │
│                                  │  data:strategy → JSON      │  │
│                                  │  meta:lastSyncedAt → ISO   │  │
│                                  │  meta:lastSyncStatus → ok  │  │
│                                  │  meta:syncHistory → [...]  │  │
│                                  └────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼ (called only by /api/sync)
        ┌─────────────────────────────────────────────────┐
        │            Google Sheets (4 sheets)             │
        │  Design (public)        ← CSV export URL        │
        │  Process (public)       ← CSV export URL        │
        │  Standardization (auth) ← Sheets API + OAuth    │
        │  Strategy (auth)        ← Sheets API + OAuth    │
        └─────────────────────────────────────────────────┘
```

### Key properties

- **The hot path never calls Google.** Visitors hit `/api/data` which only reads KV. Fast, free, no rate-limit risk.
- **Sync is a single code path.** Cron and manual sync both call `/api/sync` (manual goes through a thin rate-limited wrapper). No duplication.
- **`/api/sync` is auth-protected** — Vercel Cron's automatic `Authorization: Bearer ${CRON_SECRET}` header for cron calls; an `x-sync-secret` header for direct manual calls.
- **KV stores the latest snapshot only.** Each sync overwrites. Plus a small ring buffer (`meta:syncHistory`) of the last 10 attempts for diagnostics.

---

## 4. Fetcher layer

A single function `fetchSheet(config)` handles both public and restricted sheets. The frontend and rest of the backend never know which mode is in use.

### Sheet configuration

`api/_config/sheets.js` (server-only):

```js
export const SHEET_CONFIGS = {
  design: {
    sheetId: process.env.SHEET_ID_DESIGN,
    gid: process.env.SHEET_GID_DESIGN ?? '0',
    mode: 'public',
    schema: designSchema,
    parser: 'tabular',           // standard headers + rows
  },
  process: {
    sheetId: process.env.SHEET_ID_PROCESS,
    gid: process.env.SHEET_GID_PROCESS ?? '0',
    mode: 'public',
    schema: null,                // process uses a custom block parser
    parser: 'process-blocks',
  },
  std: {
    sheetId: process.env.SHEET_ID_STD,
    gid: process.env.SHEET_GID_STD ?? '0',
    mode: 'auth',                // ← Phase 2; not active until refresh token is set
    schema: stdSchema,
    parser: 'tabular',
  },
  strategy: {
    sheetId: process.env.SHEET_ID_STRATEGY,
    gid: process.env.SHEET_GID_STRATEGY ?? '0',
    mode: 'auth',
    schema: strategySchema,
    parser: 'tabular',
  },
};
```

### Two code paths under one function

```js
// api/_lib/fetchSheet.js

export async function fetchSheet(config) {
  const rawRows = config.mode === 'public'
    ? await fetchPublicCsv(config)
    : await fetchAuthSheet(config);

  if (config.parser === 'process-blocks') {
    return parseProcessBlocks(rawRows);
  }
  return rawRows.map(row => mapRowToSchema(row, config.schema));
}

// Path A — public sheets: HTTPS GET to the export URL
async function fetchPublicCsv({ sheetId, gid }) {
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`Sheet fetch failed: ${res.status}`);
  return parseCsv(await res.text());   // returns array of {col1: val, ...}
}

// Path B — restricted sheets (Phase 2): googleapis SDK + refresh token
async function fetchAuthSheet({ sheetId, gid }) {
  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
  );
  auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });

  const sheets = google.sheets({ version: 'v4', auth });
  const sheetName = await getSheetNameByGid(sheets, sheetId, gid);
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: sheetName,
  });
  return rowsToObjects(res.data.values);
}
```

### Schema mapping (for tabular sheets)

Each tabular schema declares how a sheet row becomes a JS object the frontend already knows. Example for the Design tab — target shape matches the existing `DESIGN_RAW` constant:

```js
// Existing DESIGN_RAW row shape (preserved, unchanged):
//   { month, project, assigned_to, stakeholder, status, type, count_users }

const designSchema = {
  month:        { column: 'Month',         type: 'string' },
  project:      { column: 'Project',       type: 'string' },
  assigned_to:  { column: 'Assigned To',   type: 'string' },
  stakeholder:  { column: 'Stakeholder',   type: 'string' },
  status:       { column: 'Status',        type: 'string' },
  type:         { column: 'Type',          type: 'string' },
  count_users:  { column: 'Count of Users', type: 'number' },
};
```

The actual sheet column names will be confirmed against the live sheet during implementation. If a column is renamed in the sheet, the schema mapping is the only thing that changes.

### Why this shape

- Switching a sheet from public → restricted is a one-line config change (`mode: 'public'` → `'auth'`).
- Adding a 5th tab is one new entry in `SHEET_CONFIGS` + one schema definition.
- Sheet column renames only require a one-line schema edit.

---

## 5. Sync orchestration & storage

### KV schema

```
data:design     → JSON array of row objects
data:std        → JSON array of row objects (Phase 2)
data:process    → JSON object { counts, tat, bvs, unique, teamProductivity }
data:strategy   → JSON array of row objects (Phase 2)
meta:lastSyncedAt    → ISO 8601 timestamp
meta:lastSyncStatus  → { status, perSheet: { design: 'ok', ... }, errors: [...] }
meta:syncHistory     → ring buffer of last 10 sync attempts
lock:sync            → existence flag with 2-min TTL (manual sync rate limit)
```

### `/api/sync` flow

```
POST /api/sync                            ← cron OR manual button (via wrapper)
  │
  ├─ Auth check
  │   ├─ Vercel Cron header? → allow
  │   └─ Else require x-sync-secret matching SYNC_SECRET → allow
  │
  ├─ For each sheet in SHEET_CONFIGS:
  │     try {
  │       rows = await fetchSheet(config)
  │       await kv.set(`data:${config.id}`, rows)
  │       perSheet[config.id] = 'ok'
  │     } catch (e) {
  │       perSheet[config.id] = 'failed'
  │       errors.push({ sheet: config.id, message: e.message })
  │       // ← does NOT abort; other sheets still sync
  │     }
  │
  ├─ Determine overall status:
  │     all ok      → 'ok'
  │     some failed → 'partial'
  │     all failed  → 'failed'
  │
  ├─ "All-empty" guard: if every sheet returned 0 rows, refuse to overwrite KV
  │     (treats catastrophic empty-sync as suspicious; preserves last good data)
  │
  ├─ await kv.set('meta:lastSyncedAt', new Date().toISOString())
  ├─ await kv.set('meta:lastSyncStatus', { status, perSheet, errors })
  ├─ Append to meta:syncHistory (ring buffer of 10)
  │
  └─ Respond: { ok: true, status, lastSyncedAt, perSheet, errors }
```

Per-sheet failures do not abort the run. Three tabs keep working while you fix the fourth.

### `/api/data?tab=<id>` flow

```
GET /api/data?tab=design
  │
  ├─ Validate `tab` ∈ { design, std, process, strategy }
  ├─ Read `data:${tab}` from KV
  ├─ Read `meta:lastSyncedAt` and per-sheet status
  └─ Respond:
      {
        rows: [...] | null,
        lastSyncedAt: '2026-05-09T06:00:00Z' | null,
        sheetStatus: 'ok' | 'failed' | 'never-synced' | 'unconfigured',
      }

      'unconfigured' = SHEET_ID_<TAB> env var is unset (e.g., Phase 1 Std/Strategy).
                       Frontend falls back to hardcoded constant for that tab.
```

**Edge cache headers:** `Cache-Control: public, max-age=60, stale-while-revalidate=600`. KV is fast, but Vercel's edge is faster for repeat visitors.

### Manual sync

`/api/manual-sync` is a thin wrapper around `/api/sync`:

- Same code path.
- Rate-limited to 1 call per 2 minutes globally via a `lock:sync` KV key with a 2-min TTL.
- No secret required (public endpoint behind a rate limit). The dashboard URL is internal-only and an admin password adds friction without real security benefit at this scale.
- Returns the same metadata payload as `/api/sync` (status, lastSyncedAt, perSheet, errors). Does **not** include row data.

### Frontend behavior after a successful manual sync

When `/api/manual-sync` returns success:

1. Header timestamp updates from the response's `lastSyncedAt`.
2. The `useDashboardData` hook for **every mounted tab** is invalidated and re-fetches `/api/data?tab=<id>` once. (In practice only the active tab is mounted at a time, so this is one extra request.)
3. Charts and KPIs update with the fresh data within a few hundred milliseconds.
4. The amber/red stale banner clears automatically if the previously-failed sheet succeeded this round.

This avoids stuffing row data into the sync response (keeps it small) while ensuring the visible tab visibly refreshes on click.

### Cron config

`vercel.json`:

```json
{
  "crons": [
    { "path": "/api/sync", "schedule": "0 6 * * 1" }
  ]
}
```

Mondays at 06:00 UTC = 11:00 AM Pakistan. Vercel automatically authenticates cron requests with `Authorization: Bearer ${CRON_SECRET}` so the handler trusts them.

---

## 6. Frontend integration

### Data hook

```js
// src/hooks/useDashboardData.js

export function useDashboardData(tab) {
  const [state, setState] = useState({
    rows: null,
    lastSyncedAt: null,
    sheetStatus: 'loading',
    error: null,
  });

  useEffect(() => {
    fetch(`/api/data?tab=${tab}`)
      .then(r => r.json())
      .then(data => setState({ ...data, sheetStatus: data.sheetStatus }))
      .catch(err => setState(s => ({ ...s, sheetStatus: 'error', error: err.message })));
  }, [tab]);

  return state;
}
```

### Tab consumption pattern

```jsx
function DesignTab({ globalMonthRange }) {
  const { rows, sheetStatus } = useDashboardData('design');

  if (sheetStatus === 'loading') return <SkeletonState />;
  if (sheetStatus === 'error')   return <ErrorState onRetry={...} />;
  if (!rows?.length)             return <EmptyState />;

  // Existing render logic, reading from `rows` instead of DESIGN_RAW.
  // No UI changes — same charts, same KPIs, same filters.
}
```

### Migration & fallback to hardcoded data

Two complementary mechanisms ensure the dashboard never goes blank during the cutover:

**1. Server-side `'unconfigured'` status.**
If the `SHEET_ID_<TAB>` env var for a tab is unset, `/api/data?tab=<id>` returns `{ rows: null, sheetStatus: 'unconfigured' }`. The frontend sees this and falls back to the hardcoded constant for that tab. This is the **default Phase 1 behavior** for Standardization and Strategy — no env vars set → tabs render exactly as today.

**2. Optional global override `VITE_USE_HARDCODED=1`.**
A build-time env var that forces every tab to use its hardcoded constant regardless of API state. Used as a safety switch during the Design / Process cutover: if live data looks broken, set `VITE_USE_HARDCODED=1`, redeploy, and the dashboard reverts to known-good state in 30 seconds.

**Tab decision logic:**

```js
function useDashboardDataWithFallback(tab, hardcodedFallback) {
  const live = useDashboardData(tab);

  if (import.meta.env.VITE_USE_HARDCODED === '1') return { rows: hardcodedFallback, source: 'hardcoded' };
  if (live.sheetStatus === 'unconfigured')        return { rows: hardcodedFallback, source: 'hardcoded' };
  if (live.sheetStatus === 'never-synced')        return { rows: hardcodedFallback, source: 'hardcoded' };  // pre-first-sync
  return { ...live, source: 'live' };
}
```

Tabs never blank out; worst case, they show stale data with a banner.

Once each tab's live data has been validated for a week or two, the hardcoded constant for that tab is deleted in a small follow-up commit.

### Sync button & timestamp UX

Replaces the existing hardcoded `"Last updated: March 15, 2026"` line at [App.jsx:1473](../../../src/App.jsx). New header-area component:

```
┌─────────────────────────────────────────────────────────────┐
│  Customer Journey Optimization | Dashboard       [Period]   │
│  Performance Observatory                                    │
│                                                             │
│  Last synced: 2 hours ago        [↻ Sync now]               │
└─────────────────────────────────────────────────────────────┘
```

**Button states:**

- `↻ Sync now` (idle)
- `⟳ Syncing…` (in flight, disabled)
- `✓ Synced` (200ms flash, then idle with new timestamp)
- `! Sync failed — retry` (error tooltip on hover)
- `↻ Sync now (cooldown 1:42)` (rate-limited, countdown)

Visual style matches existing primitives (`Sel`, `ResetBtn`, the tab navigation styling).

### Per-sheet failure UX

If `/api/sync` partially failed:

- Affected tabs show an **amber banner** at the top: `⚠ This data may be stale — last successful sync was 8 days ago`.
- Banner turns red at 14 days.
- Other tabs render normally.
- Sync button shows partial state on hover.

### Loading & empty states

Three reusable components in `src/components/states/`, all reusing the existing `C` color palette:

- `<SkeletonState />` — grey shimmer placeholders matching tab layout
- `<ErrorState onRetry />` — sad-state card with retry
- `<EmptyState />` — for sheets with zero rows

---

## 7. Process Team tab UI design

The Process tab is rebuilt from scratch around the new sheet. Visual style strictly inherits from the existing tabs — same `KpiCard`, `ChartCard`, `Sel`, `C` palette, `PIE_COLORS`, Poppins font, card spacing, and shadows.

### Source data (parsed)

```js
{
  counts: [
    { team: 'Call Center', count: 264 },
    { team: 'Experience Center', count: 204 },
    // ... 9 entries total
  ],
  unique: 498,
  bvs: { bvs: 63, nonBvs: 435 },
  tat: [
    { team: 'Experiance Center', bucket: 'Immediate', month: 'Jan', value: 68 },
    // ... ~220 rows (4 teams × 11 buckets × 5 months)
  ],
  teamProductivity: [
    { teamMember: 'Waqas', month: 'Jan', new: 12, revamp: 12 },
    // ... 25 rows (5 members × 5 months)
  ],
}
```

Note: "Experiance" is a typo in the source sheet. The parser passes through the team name verbatim — fix it in the sheet, it auto-corrects on the next sync.

### Layout

```
ROW 1 — 4 KPI cards (equal width)
  [Unique 498] [Channels 9] [BVS 63] [Non-BVS 435]

ROW 2 — Two cards
  [Process Distribution by Channel — bar chart, 2/3 width]
  [BVS Composition — donut, 1/3 width]

ROW 3 — Full width
  [TAT Distribution           Team: ▾   [Table | Chart]]
  Heatmap-style table OR stacked bars (toggleable, persisted in localStorage)
  Team selector switches between 4 teams: Experiance Center, Franchise, Call Center, Backend

ROW 4 — Full width
  [Team Member Productivity                [Table | Chart]]
  5 team members × 5 months × {New, Revamp}
  Default view: table (preserves source as-is)
  Chart view: stacked bar per team member (New + Revamp YTD totals)
```

### Component breakdown

| Component | Source | Notes |
| --- | --- | --- |
| 4 KPI cards | `unique`, `counts.length`, `bvs.bvs`, `bvs.nonBvs` | Reuses existing `KpiCard`. Icons: 📋 Unique, 🏢 Channels, ✅ BVS, 📋 Non-BVS. |
| Channel distribution | `counts` | Recharts horizontal `BarChart`. Bar fills from `PIE_COLORS`. End-of-bar value labels. |
| BVS donut | `bvs` | Recharts `PieChart` with `innerRadius`. Center label shows `498`. Two slices from `PIE_COLORS`. |
| TAT grid | `tat` filtered by selected team | HTML table with cells tinted by value (heatmap effect using `C.accent` at variable alpha). YTD column bolded. Toggle to stacked-bar chart view. |
| Team productivity grid | `teamProductivity` | Two-row header (Month + New/Revamp). Same heatmap tint. Toggle to stacked-bar chart. |

### Filters

- **Team selector** (Sel component) above TAT grid. Defaults to first team. Options derived dynamically from `tat` data so adding a team later auto-appears.
- **No global month filter** for this tab. The existing logic at [App.jsx:1383](../../../src/App.jsx) already hides the header month filter when `activeTab === 'process'` — preserved.

### View toggles

- Both Row 3 (TAT) and Row 4 (Team Productivity) get a `[Table | Chart]` segmented toggle in the card header.
- Default to Table (preserves source representation).
- Selection persists in localStorage per-toggle.

### Block-detection parser

Logic for splitting the messy single-tab sheet into 4 blocks:

```js
function parseProcessSheet(rows) {
  const blocks = { counts: [], unique: 0, bvs: {}, tat: [], teamProductivity: [] };
  let mode = null;
  let tatTeams = [];           // tracks side-by-side TAT teams in the current row group
  let prodMonths = null;       // tracks the productivity 2-row header (months)

  for (const row of rows) {
    // Header detection
    if (row[0] === 'Processes' && row[1] === 'Count')                 { mode = 'counts'; continue; }
    if (row[0] === 'Month' && /Jan/i.test(row[1] || row[2] || ''))    { mode = 'productivity-h1'; prodMonths = row; continue; }
    if (row[0] === 'Team Member')                                     { mode = 'productivity'; continue; }
    if (containsJanFebMarHeaders(row))                                { mode = 'tat'; tatTeams = extractTeamsFromHeader(row); continue; }
    if (row[0] === 'BVS' || row[0] === 'Non-BVS')                     {
      blocks.bvs[normalizeKey(row[0])] = +row[1];
      continue;
    }

    switch (mode) {
      case 'counts':
        if (row[0] === 'Unique') blocks.unique = +row[1];
        else if (row[0]) blocks.counts.push({ team: row[0], count: +row[1] });
        break;
      case 'tat':
        // Reads side-by-side teams from one row.
        // tatTeams is an array of { teamName, columnOffset } pairs.
        for (const t of tatTeams) {
          blocks.tat.push({
            team: t.teamName,
            bucket: row[t.columnOffset],
            month: 'Jan',  value: +row[t.columnOffset + 1],
          }, /* ...Feb, Mar, Apr, YTD entries */);
        }
        break;
      case 'productivity':
        // Row has 11 cells: [TeamMember, Jan-New, Jan-Revamp, Feb-New, Feb-Revamp, ..., YTD-New, YTD-Revamp]
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'YTD'];
        for (let i = 0; i < months.length; i++) {
          blocks.teamProductivity.push({
            teamMember: row[0],
            month: months[i],
            new: +row[1 + i * 2],
            revamp: +row[2 + i * 2],
          });
        }
        break;
    }
  }
  return blocks;
}
```

**Known fragility:** if the sheet owner reorders blocks, renames headers, or adds a 5th block, the parser will silently drop rows. Mitigations:

- Unrecognized rows are logged in `meta:lastSyncStatus.errors` so they surface in the diagnostics page banner.
- Snapshot test in `tests/fixtures/process-sheet.csv` — asserts `parseProcessSheet(fixture)` produces the expected shape. Fails loudly in CI if the parser regresses.
- Spec documents that adding new blocks requires a parser update.
- If the sheet ever needs to grow, the recommended migration is splitting into separate worksheet tabs (one gid per block) — at that point the parser becomes trivial.

---

## 8. Error handling & failure modes

### Failure matrix

| What breaks | Detected by | User sees | Auto-recovers? |
| --- | --- | --- | --- |
| Public sheet 404 (deleted/unshared) | `/api/sync` | Amber banner: "Data may be stale — last successful sync N days ago." Cached data still renders. | No — sheet must be re-shared. |
| OAuth refresh token expired/revoked (Phase 2) | `/api/sync` | Same as above for restricted tabs. Auth error logged in `meta:lastSyncStatus.errors`. | No — needs re-running local OAuth script + updating `GOOGLE_REFRESH_TOKEN`. |
| Sheet schema changed | parser | Tab still renders, missing/wrong fields. Errors logged. Banner appears. | No — needs sheet fix or schema update. |
| Vercel KV down | `/api/data` | Whole-page error state: "Service temporarily unavailable. Retry." | Yes — KV usually recovers in seconds. |
| Cron didn't fire | nobody initially | Banner: "Last synced 8 days ago" → amber at 8 days, red at 14 days. | Yes — next manual sync or successful cron clears it. |
| Network timeout to Google | `/api/sync` | Sheet treated as failed. Other sheets sync normally. Cached data persists. | Yes — next sync retries. |
| Empty sheet | parser | Tab shows `<EmptyState />` with last-synced timestamp. | Yes — refilling sheet + sync brings it back. |
| Malformed CSV | CSV parser | Sheet treated as failed. Cached data persists. Logged. | Sometimes. |
| Manual sync rate limit hit | `/api/manual-sync` | Button shows `↻ Sync now (cooldown 1:42)`. | Yes — automatically. |
| Cron exceeds 300s timeout | `/api/sync` | Partial sync. Whatever finished is in KV. | Yes — next run retries. (Unlikely with 4 small sheets.) |

### Visibility

1. **In-app banners** — covered above.
2. **`/diagnostics` page** (gated by `DIAGNOSTICS_PASSWORD` env var) shows:
   - Last sync timestamp
   - Per-sheet status with last-success time and last error message
   - Last 10 sync attempts (from `meta:syncHistory`)
   - Per-sheet "Force resync" button
3. **Vercel function logs** — all `/api/sync` errors logged via `console.error`.

### Defense in depth

- **Stale-data thresholds:** neutral → amber at 8 days, amber → red at 14 days. Surfaces silent cron failures.
- **Parser snapshot tests:** saved CSV fixture in `tests/fixtures/process-sheet.csv`. Test asserts parser output shape. Fails loudly in CI if parser regresses.
- **Schema validation:** type coercion with `null` fallback (e.g., "N/A" in a number column → `null`, logged, doesn't crash).
- **All-empty guard:** if every sheet returns 0 rows, refuse to overwrite KV. Old data stays; failure is logged.
- **No frontend auto-retry:** `/api/data` reads only; never triggers a Google fetch.
- **First-run handling:** if KV is empty (very first deploy), `/api/data` returns `{ rows: null, sheetStatus: 'never-synced' }` and tabs prompt user to click Sync now.

---

## 9. Repository structure

```
cjodashboard/
├── api/
│   ├── _config/
│   │   └── sheets.js              # SHEET_CONFIGS + schemas
│   ├── _lib/
│   │   ├── fetchSheet.js          # public + auth fetcher
│   │   ├── parseProcessSheet.js   # block-detection parser
│   │   ├── csv.js                 # CSV → row objects
│   │   └── kv.js                  # KV client wrapper
│   ├── data.js                    # GET /api/data
│   ├── sync.js                    # POST /api/sync (cron + direct)
│   ├── manual-sync.js             # POST /api/manual-sync (rate-limited proxy)
│   └── diagnostics.js             # GET /diagnostics
├── scripts/
│   └── google-auth.js             # Phase 2 — one-time refresh token CLI
├── src/
│   ├── App.jsx                    # refactored to consume hooks
│   ├── hooks/
│   │   └── useDashboardData.js
│   ├── components/
│   │   ├── states/                # SkeletonState, ErrorState, EmptyState
│   │   └── SyncButton.jsx
│   └── tabs/                      # NEW — App.jsx split per tab
│       ├── DesignTab.jsx
│       ├── StandardizationTab.jsx
│       ├── ProcessTab.jsx         # rebuilt from scratch
│       └── StrategyTab.jsx
├── tests/
│   └── fixtures/
│       └── process-sheet.csv      # snapshot for parser tests
├── docs/superpowers/specs/
│   └── 2026-05-09-google-sheets-sync-design.md  ← this document
├── vercel.json
└── package.json                   # adds: googleapis, @vercel/kv, papaparse
```

**Bonus refactor:** `App.jsx` (1,478 lines) splits into per-tab files. Each tab becomes self-contained around its `useDashboardData(...)` call. Done because we're touching every tab anyway.

---

## 10. Deployment & operational steps

### Phase 1 — public sheets only

1. **Vercel KV setup** (~3 minutes)
   - Storage tab → Create Database → KV
   - Create two instances: `kv-prod` (Production) and `kv-preview` (Preview + Development)
   - Vercel auto-injects `KV_REST_API_URL` and `KV_REST_API_TOKEN` env vars

2. **Environment variables** (Settings → Environment Variables)

   ```bash
   # Sheet IDs
   SHEET_ID_DESIGN=10jYPcINf2UvN4-Quc8SG5Tl0tyw7Qmdv
   SHEET_GID_DESIGN=1246818985
   SHEET_ID_PROCESS=1VFxuBDrAWE93PTxdQKqRhh3SfXB_cXN16KY2guMwRxo
   SHEET_GID_PROCESS=0

   # Auth secrets
   SYNC_SECRET=<generate: openssl rand -hex 32>
   DIAGNOSTICS_PASSWORD=<simple password>

   # CRON_SECRET is auto-set by Vercel Cron — do not set manually
   # KV_* vars are auto-injected by Vercel KV — do not set manually
   ```

3. **`vercel.json`** (committed to repo)

   ```json
   {
     "crons": [
       { "path": "/api/sync", "schedule": "0 6 * * 1" }
     ]
   }
   ```

4. **Deploy**

   ```bash
   git push      # if Vercel Git integration is set up
   # or
   vercel --prod
   ```

5. **First sync** (manual, since KV starts empty)

   ```bash
   curl -X POST https://your-app.vercel.app/api/sync \
     -H "x-sync-secret: $SYNC_SECRET"
   # OR visit the dashboard and click "Sync now"
   ```

6. **Verify**
   - Visit each tab → data renders (Design + Process from sheets, Std + Strategy still hardcoded)
   - Visit `/diagnostics?password=...` → Design and Process show ✓
   - Wait until Monday 06:00 UTC → confirm `lastSyncedAt` updates automatically

### Phase 2 — restricted sheets

When the dedicated Google account credentials arrive:

1. **Google Cloud setup** (~10 minutes, signed in as the dedicated account)
   - console.cloud.google.com → new project "CJO Dashboard"
   - Enable Google Sheets API
   - OAuth consent screen → External → add dedicated account email as Test user
   - Credentials → Create OAuth Client ID → Desktop application
   - Save Client ID + Client Secret

2. **Generate refresh token** (~2 minutes)

   ```bash
   node scripts/google-auth.js
   ```

   - Browser opens → sign in with dedicated account → Allow
   - Script prints refresh token

3. **Add Phase 2 env vars in Vercel:**

   ```bash
   GOOGLE_CLIENT_ID=...apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=...
   GOOGLE_REFRESH_TOKEN=...
   SHEET_ID_STD=...
   SHEET_GID_STD=...
   SHEET_ID_STRATEGY=...
   SHEET_GID_STRATEGY=...
   ```

4. **No code changes.** The `mode: 'auth'` flag on the std and strategy configs already routes them through the OAuth path. Trigger a manual sync — they appear.

### Local testing

```bash
npm i -g vercel
vercel link
vercel env pull .env.local
vercel dev      # localhost:3000 with full /api/* support
```

What works locally:

| Feature | Local? | How |
| --- | --- | --- |
| `/api/data` endpoints | ✅ | `vercel dev` |
| `/api/sync` endpoint | ✅ | Hit it via curl or button |
| Manual sync button | ✅ | Same code path |
| Public sheet fetching | ✅ | HTTPS call |
| Restricted sheet fetching (Phase 2) | ✅ | Refresh token works locally too |
| Vercel KV reads/writes | ✅ | Connects to `kv-preview` instance |
| Weekly cron | ❌ | Cron only fires in prod. Simulate by triggering `/api/sync` manually. |

---

## 11. Open questions

These do not block the design but need answers during implementation:

1. **Confirmed Design sheet column names** — the schema mapping in §4 uses placeholder names (`Month`, `Project`, `Assigned To`, `Stakeholder`, `Status`, `Type`, `Count of Users`). Actual names confirmed against the live sheet during implementation.
2. **Process sheet completeness** — current understanding: 4 blocks (counts, TAT, BVS, team productivity). If a 5th block exists, parser needs a one-time update.
3. **Cron schedule confirmation** — currently set to Monday 06:00 UTC. Owner may prefer a different time.
4. **Standardization & Strategy sheet IDs** — supplied by sheet owner during Phase 2 transition.
5. **`assigned_to` value normalization** — the existing `DESIGN_RAW` has values like `"Haris"`, `"Safa"`, `"Maha"`, `"Hasan"`. If the live sheet uses full names (e.g., `"Safa Ahmed"`), the existing filter UI may need a normalization step. Verified during data swap.

---

## 12. Non-goals (explicit)

- No write-back from dashboard to sheets.
- No diff/history tracking — only the latest snapshot is kept.
- No Slack / email / SMS alerting.
- No public sign-in; the dashboard URL itself is the access boundary.
- No restructuring of the Process source sheet's block layout.
- No visual or UX changes to the Design, Standardization, or Strategy tabs.
- No analytics on dashboard usage (page views, button clicks, etc.).
