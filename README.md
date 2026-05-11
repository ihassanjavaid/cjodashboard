# CJO Dashboard

A live dashboard for the Customer Journey Operations team, fed by three Google Sheets and deployed on Vercel.

**Live:** [cjodash.vercel.app](https://cjodash.vercel.app)
**New layout:** [/new-ui](https://cjodash.vercel.app/new-ui) · **Legacy:** [/](https://cjodash.vercel.app)

---

## What it shows

| Tab | Source | What's tracked |
| --- | --- | --- |
| **Design & Usability** | Design sheet (one worksheet per month) | Research, usability, survey, sentiment, and pulse tasks per resource and month. |
| **Standardization** | Std sheet (BAU + JLV worksheets) | UAT activity, pass/fail rates, manned-hour load, raised-vs-fixed issues. |
| **Process Team** | Process sheet | Channel distribution, BVS coverage, TAT distribution, productivity (new vs revamp). |
| **Strategic Overview** | Cross-team rollup | Aggregated view across all three streams. |

---

## How data flows

```
Google Sheets ──► /api/sync ──► Vercel KV (Upstash Redis) ──► /api/data ──► browser
```

- **Scheduled refresh** — `/api/sync` runs every Monday at **06:00 UTC** via Vercel cron (`vercel.json`).
- **Manual refresh** — the **Sync now** button in the left sidebar calls `/api/manual-sync` (2-minute cooldown between manual syncs).
- **Cache** — Vercel KV holds the last successful pull so the dashboard renders instantly and survives Sheets outages.
- **Fallback** — if KV has never been populated and the live fetch fails, each tab degrades to a hardcoded sample so the UI doesn't go blank.

> Edits made directly in the linked Google Sheets are picked up by the next sync. To change which sheet feeds a tab, update the matching `SHEET_ID_*` env var on Vercel and redeploy — env-var changes do not take effect until the next deployment.

---

## Running locally

**Prerequisites**

- Node.js 20+
- The Vercel CLI: `npm i -g vercel`
- The provided `.env` file (treat as secret — never commit)

**Steps**

```bash
npm install
cp <provided env file> .env.local
vercel link           # follow prompts to link to your Vercel project
vercel dev            # serves at http://localhost:3000
```

`vercel dev` runs the SPA + the `/api/*` serverless functions together. Plain `npm run dev` only runs Vite, so the API routes won't work — always use `vercel dev` for full-stack local development.

---

## Deploying to your own Vercel account

The free tier is sufficient.

1. **Create a project** — `vercel` in the project folder, follow the prompts (or import via the Vercel dashboard).
2. **Add environment variables** — Settings → Environment Variables → add each variable from the provided `.env` file, scoped to **Production**, **Preview**, and **Development**.
3. **Deploy** — `vercel --prod`.
4. **Populate the cache** — open the deployed app and click **Sync now** in the sidebar. Until the first sync runs, KV is empty and tabs show fallback data.

### Required environment variables

| Variable | Purpose |
| --- | --- |
| `SHEET_ID_DESIGN`, `SHEET_GID_DESIGN` | Design & Usability sheet (auth-mode, multi-worksheet) |
| `SHEET_ID_STD`, `SHEET_GID_STD_BAU`, `SHEET_GID_STD_JLV` | Standardization sheet (BAU + JLV worksheets) |
| `SHEET_ID_PROCESS`, `SHEET_GID_PROCESS` | Process sheet (public, multi-block parser) |
| `VITE_SHEET_ID_PROCESS`, `VITE_SHEET_GID_PROCESS` | Browser-side direct fetch for the Process tab |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN` | OAuth for Sheets API (regenerate with `npm run auth` if revoked) |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN`, `KV_REST_API_READ_ONLY_TOKEN`, `KV_URL`, `REDIS_URL` | Upstash Redis instance (provisioned via Vercel Marketplace) |
| `SYNC_SECRET` | Authorizes external sync triggers (`/api/sync` direct calls) |
| `DIAGNOSTICS_PASSWORD` | Gates the `/diagnostics` page |

---

## Diagnostics

Visit `/diagnostics`, enter the `DIAGNOSTICS_PASSWORD`, and you'll see:

- Per-tab sync status (`ok` / `failed` / `partial`)
- Last successful sync timestamp
- Recent sync history (last 10 runs)
- Configured tabs and their sheet IDs

If a sheet sync starts failing, this is the first place to look.

---

## Project layout

```
api/                    # Vercel serverless functions
  data.js               # GET /api/data?tab=<id>          → reads KV
  sync.js               # POST /api/sync                  → cron + secret-auth
  manual-sync.js        # POST /api/manual-sync           → button click (cooldown-gated)
  diagnostics.js        # GET /api/diagnostics            → password-gated health
  _config/sheets.js     # Sheet IDs, gids, parser config
  _lib/fetchSheet.js    # Public CSV + auth-Sheets fetch logic
  _lib/kv.js            # KV reads, writes, cooldown lock, sync history

src/
  shared/sheetSchemas.js  # Single source of truth for column → field mapping
  shared/schemaMapper.js  # Tolerant header matching + type coercion + transforms
  hooks/useDashboardData.js
                          # Live fetch with backend + direct-CSV fallback
  new-ui/                 # New layout (/new-ui)
    NewUI.jsx, components/, tabs/, lib/, new-ui.css
  tabs/                   # Legacy layout (/)
  shared/dashboardKit.jsx # Shared UI primitives + JW logo

scripts/google-auth.js  # Re-runs the OAuth flow to mint a fresh refresh token
```

---

## Common tasks

| Task | How |
| --- | --- |
| Refresh data right now | Click **Sync now** in the sidebar (or `POST /api/manual-sync`) |
| Inspect last sync result | Open `/diagnostics` |
| Change which sheet feeds a tab | Update `SHEET_ID_*` env on Vercel → `vercel --prod` |
| Regenerate OAuth refresh token | `npm run auth`, paste the result into `GOOGLE_REFRESH_TOKEN` |
| Run unit tests | `npm test` |
| Lint | `npm run lint` |
| Build for production locally | `npm run build` then `npm run preview` |

---

## Tech stack

- **Frontend** — React 19, Vite 8, Recharts 3, plain CSS
- **Backend** — Vercel serverless functions (Node), googleapis, papaparse
- **Cache** — Vercel KV (Upstash Redis)
- **Hosting** — Vercel (free tier compatible)
- **Cron** — Vercel scheduled functions

---

## Support

Source code and configuration are entirely in this repository — there is no external orchestration layer. The Vercel CLI plus the provided `.env` file are enough to redeploy from scratch on any Vercel account.

### Hasan Javaid Malik
