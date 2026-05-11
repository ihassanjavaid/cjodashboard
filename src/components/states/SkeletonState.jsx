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
