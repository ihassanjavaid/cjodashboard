# Plan A — Production Deploy Checklist

After Plan A is implemented, follow this checklist to ship to Vercel.

---

## Prerequisites

- A Vercel account
- Vercel CLI installed: `npm i -g vercel`
- The Google Sheet for Design & Usability is publicly accessible (already confirmed)

---

## Step 1 — Vercel KV setup (one-time, ~3 min)

> **Note:** `@vercel/kv` (v3) was deprecated in 2025. Vercel migrated KV functionality to Marketplace partners (Upstash Redis is the default). The code is compatible with both — Upstash Redis exposes the same Redis API our `kv.js` wrapper uses. If creating new KV instances on Vercel, follow the Marketplace flow (it provisions an Upstash Redis instance and auto-injects the same env var names). Existing `@vercel/kv` projects continue to work.

1. Open the Vercel dashboard for this project → **Storage** tab → Create Database → KV (or Upstash Redis via Marketplace)
2. Create **two** instances:
   - `kv-prod` — link to the **Production** environment
   - `kv-preview` — link to **Preview + Development** environments
3. Vercel auto-injects these env vars into deploys:
   - `KV_REST_API_URL`
   - `KV_REST_API_TOKEN`
   - `KV_REST_API_READ_ONLY_TOKEN`

Do NOT set these manually.

---

## Step 2 — Environment variables (Settings → Environment Variables)

Set these for **Production** (and copy to Preview if you want preview deploys to also sync):

```bash
# Sheet IDs — Phase 1 only configures Design (others are deferred)
SHEET_ID_DESIGN=10jYPcINf2UvN4-Quc8SG5Tl0tyw7Qmdv
SHEET_GID_DESIGN=1246818985

# Auth secrets
SYNC_SECRET=<generate: openssl rand -hex 32>
DIAGNOSTICS_PASSWORD=<choose a strong password>

# CRON_SECRET is auto-set by Vercel Cron — do not set manually
# KV_* vars are auto-injected by Vercel KV — do not set manually
```

**Intentionally NOT set in Phase 1:**
- `SHEET_ID_STD`, `SHEET_ID_STRATEGY` — these tabs use hardcoded fallback until you have the sheet IDs and Google account credentials
- `SHEET_ID_PROCESS` — Process tab UI is rebuilt in Plan B; don't connect the live data until Plan B lands
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN` — Phase 2 (restricted sheets) only

---

## Step 3 — Confirm `vercel.json` is committed

Already in the repo:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "crons": [
    { "path": "/api/sync", "schedule": "0 6 * * 1" }
  ]
}
```

Cron fires every Monday at 06:00 UTC = 11:00 AM Pakistan.

---

## Step 4 — Deploy

```bash
git push      # if Vercel Git integration is configured (recommended)
# OR
vercel --prod # CLI deploy
```

Wait for the deploy to complete (typically <60 seconds). Vercel will show the production URL.

---

## Step 5 — First sync (manual, since KV starts empty)

KV is empty on first deploy, so the dashboard will show "Never synced". Trigger the first sync manually:

```bash
# Option A — via curl (bypasses cooldown)
curl -X POST https://your-app.vercel.app/api/sync \
  -H "x-sync-secret: $SYNC_SECRET"

# Option B — via the dashboard
# 1. Visit https://your-app.vercel.app
# 2. Click the "Sync now" button in the header
# Expected response: {"ok":true,"status":"ok","lastSyncedAt":"...","perSheet":{"design":"ok"}}
```

---

## Step 6 — Browser smoke test

Visit the production URL and verify each item:

- [ ] **Header** shows `Last synced: just now` (or `X minutes ago`) instead of the old hardcoded `Last updated: March 15, 2026`
- [ ] **Sync button** is visible in the header, clickable, shows visual feedback
- [ ] **Click Sync now** — button cycles through `Sync now → Syncing… → Synced ✓ → Sync now`
- [ ] **Click Sync now again immediately** — button shows cooldown countdown (e.g., `Sync now (cooldown 1:58)`)
- [ ] **Design & Usability tab** shows live data from the Google Sheet (project names should match what's actually in the sheet, not the hardcoded names from `DESIGN_RAW`)
- [ ] **Standardization, Process, Strategy tabs** render unchanged (still using hardcoded data — `SHEET_ID_*` env vars not set)
- [ ] **No JavaScript errors** in the browser console
- [ ] **Period filter** still works on Design + Standardization tabs

---

## Step 7 — Diagnostics check

Visit `https://your-app.vercel.app/diagnostics` — should show a password prompt.

Enter the `DIAGNOSTICS_PASSWORD` you set in env vars. You should see:

- Last synced timestamp
- Per-sheet status (only `design: ok` for Phase 1)
- Sync history (one entry from your manual first sync)
- Any errors (should be empty)

If password fails: check `DIAGNOSTICS_PASSWORD` env var matches.

---

## Step 8 — API endpoint sanity checks

```bash
# Configured tab → returns rows + lastSyncedAt
curl 'https://your-app.vercel.app/api/data?tab=design'
# Expected: {"rows":[...],"lastSyncedAt":"...","sheetStatus":"ok"}

# Unconfigured tab → returns "unconfigured"
curl 'https://your-app.vercel.app/api/data?tab=std'
# Expected: {"rows":null,"lastSyncedAt":null,"sheetStatus":"unconfigured"}

# Manual sync wrapper
curl -X POST https://your-app.vercel.app/api/manual-sync
# Expected (first call): {"ok":true,...}
# Expected (within 2 min of last call): {"error":"...cooldown...","retryAfterSeconds":120}
```

---

## Step 9 — Cron verification

Wait until next Monday at 06:00 UTC. The cron job will fire automatically.

After the cron run, check:

```bash
curl 'https://your-app.vercel.app/api/data?tab=design'
# Look at lastSyncedAt — should be the recent Monday timestamp
```

If `lastSyncedAt` did NOT advance after the expected cron time:
1. Open Vercel dashboard → Functions → Cron Jobs → check the last run status
2. Open Vercel logs for `/api/sync` — look for errors
3. Check that `SHEET_ID_DESIGN` env var is set in Production
4. Manually trigger a sync via curl to test the endpoint independently

---

## Rollback procedure

If live data looks broken after deploy:

### Quick rollback (no redeploy needed)

Set `VITE_USE_HARDCODED=1` in Vercel env vars → redeploy. All tabs revert to hardcoded data within 30 seconds. The dashboard returns to its pre-Plan A state visually.

### Full rollback

```bash
git revert <commit-range>  # revert Plan A commits
git push
```

---

## Common issues & fixes

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| Design tab shows "Never synced" forever | First sync wasn't triggered | Run Step 5 manually |
| Design tab still shows old hardcoded data | Browser cache OR `VITE_USE_HARDCODED=1` set | Hard refresh, check env vars |
| `/api/sync` returns 401 | `SYNC_SECRET` mismatch | Re-check env var; regenerate if lost |
| `/api/manual-sync` returns 500 | KV not provisioned or wrong env vars | Step 1 — confirm `kv-prod` exists and is linked to Production |
| Sync succeeds but data is wrong | Sheet column names don't match `designSchema` in `api/_config/schemas.js` | Update column names in `schemas.js`, redeploy |
| Cron didn't fire on Monday | Vercel project paused or cron disabled | Vercel dashboard → Settings → confirm Cron Jobs enabled |

---

## Plan B prerequisites

When you're ready to start Plan B:

- [ ] Plan A has been deployed and validated for at least a week
- [ ] Design tab live data is reliable (cron has fired at least once successfully)
- [ ] You're ready to set `SHEET_ID_PROCESS` and rebuild the Process tab UI

Plan B will:
- Add the block-detection parser for the Process sheet
- Rebuild the Process tab UI from scratch (KPIs, charts, TAT grid, team productivity)
- Set `SHEET_ID_PROCESS=1VFxuBDrAWE93PTxdQKqRhh3SfXB_cXN16KY2guMwRxo` in env vars

When the dedicated Google account credentials arrive (Phase 2):
- Add `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN` env vars
- Add `SHEET_ID_STD` and `SHEET_ID_STRATEGY` env vars
- No code changes needed — the per-sheet `mode: 'auth'` flag in `sheets.js` will route those tabs through the OAuth path automatically (after Phase 2 implements `fetchAuthSheet`)
