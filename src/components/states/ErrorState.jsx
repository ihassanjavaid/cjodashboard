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
