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
