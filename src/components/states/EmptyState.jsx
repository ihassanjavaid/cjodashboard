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
