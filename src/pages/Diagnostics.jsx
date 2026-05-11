import { useState } from 'react';
import { C } from '../shared/dashboardKit.jsx';

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
