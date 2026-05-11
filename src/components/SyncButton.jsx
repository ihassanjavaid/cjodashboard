import { useState, useEffect } from 'react';

const palette = { accent: '#8B1A1A', cardBorder: '#E7E1DC', muted: '#9E9089', success: '#2F7D32' };

export function SyncButton({ onSyncComplete }) {
  const [state, setState] = useState('idle');
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
