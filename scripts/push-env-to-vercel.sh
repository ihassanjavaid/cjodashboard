#!/usr/bin/env bash
# Pushes manual env vars from .env.local to Vercel project (production + preview + development).
# Skips KV_*, REDIS_URL, VERCEL_OIDC_TOKEN — those are auto-injected by Vercel.
#
# Usage: bash scripts/push-env-to-vercel.sh

VARS=(
  SYNC_SECRET
  SHEET_ID_DESIGN
  SHEET_GID_DESIGN
  DIAGNOSTICS_PASSWORD
  SHEET_ID_PROCESS
  SHEET_GID_PROCESS
  VITE_SHEET_ID_PROCESS
  VITE_SHEET_GID_PROCESS
  GOOGLE_CLIENT_ID
  GOOGLE_CLIENT_SECRET
  SHEET_ID_STD
  SHEET_GID_STD_BAU
  SHEET_GID_STD_JLV
  GOOGLE_REFRESH_TOKEN
)

ENVS=(production preview development)

if [ ! -f .env.local ]; then
  echo "ERROR: .env.local not found. Run from project root." >&2
  exit 1
fi

for VAR in "${VARS[@]}"; do
  RAW=$(grep -E "^${VAR}=" .env.local | head -1)
  if [ -z "$RAW" ]; then
    echo "  skip $VAR (not in .env.local)"
    continue
  fi
  VALUE=${RAW#${VAR}=}
  # Strip surrounding double quotes
  if [[ $VALUE == \"*\" ]]; then
    VALUE=${VALUE:1:-1}
  fi

  for ENV in "${ENVS[@]}"; do
    # Preview env requires a git branch positional arg. Empty string = "all preview branches".
    # --force needs a specific branch to know what to overwrite, so for preview we
    # remove-then-add instead.
    if [ "$ENV" = "preview" ]; then
      vercel env rm "$VAR" "$ENV" "" --yes >/dev/null 2>&1 || true
      vercel env add "$VAR" "$ENV" "" --value "$VALUE" --yes >/dev/null 2>&1 \
        && echo "  set $VAR -> $ENV" \
        || echo "  FAILED $VAR -> $ENV"
    else
      vercel env add "$VAR" "$ENV" --value "$VALUE" --force --yes >/dev/null 2>&1 \
        && echo "  set $VAR -> $ENV" \
        || echo "  FAILED $VAR -> $ENV"
    fi
  done
done

echo
echo "Done."
