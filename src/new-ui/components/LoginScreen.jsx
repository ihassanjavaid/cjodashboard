import { useState } from 'react';
import { JW_LOGO } from '../shared/dashboardKit.jsx';

const C = {
  bg: '#F5F2F0',
  card: '#FFFFFF',
  cardBorder: '#DDD5D0',
  accent: '#8B1A1A',
  accent2: '#B22222',
  text: '#1C1410',
  textSub: '#6B5E58',
  muted: '#B0A8A4',
  shadow: '0 4px 12px rgba(139,26,26,0.08)',
  shadowHover: '0 8px 24px rgba(139,26,26,0.16)',
};

export function LoginScreen({ onSuccess }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = () => {
    const expected = import.meta.env.VITE_APP_PASSWORD;

    // If no password is configured, skip the gate
    if (!expected) {
      onSuccess();
      return;
    }

    setLoading(true);
    setTimeout(() => {
      if (password === expected) {
        const token = 'v1_' + btoa(expected).slice(0, 14);
        sessionStorage.setItem('cjo_auth', token);
        onSuccess();
      } else {
        setError('Incorrect password. Please try again.');
        setPassword('');
      }
      setLoading(false);
    }, 400); // small delay so it feels deliberate
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSubmit();
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: C.bg,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'Poppins, sans-serif',
      padding: '24px',
    }}>
      <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet" />

      {/* Card */}
      <div style={{
        background: C.card,
        border: `1px solid ${C.cardBorder}`,
        borderRadius: 18,
        padding: '40px 40px 36px',
        width: '100%',
        maxWidth: 400,
        boxShadow: C.shadowHover,
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Top accent bar */}
        <div style={{
          position: 'absolute',
          top: 0, left: 0, right: 0,
          height: 4,
          background: `linear-gradient(90deg, ${C.accent}, ${C.accent2})`,
          borderRadius: '18px 18px 0 0',
        }} />

        {/* Logo + title */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 32 }}>
          <img
            src={JW_LOGO}
            alt="Jazz World"
            style={{ width: 52, height: 52, borderRadius: '50%', objectFit: 'cover', marginBottom: 16, boxShadow: C.shadow }}
          />
          <div style={{ fontSize: 18, fontWeight: 700, color: C.text, letterSpacing: '-0.02em', textAlign: 'center' }}>
            CJO Dashboard
          </div>
          <div style={{ fontSize: 12, color: C.textSub, marginTop: 4, textAlign: 'center' }}>
            Customer Journey Optimization
          </div>
        </div>

        {/* Password field */}
        <div style={{ marginBottom: 8 }}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.textSub, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={e => { setPassword(e.target.value); setError(''); }}
            onKeyDown={handleKeyDown}
            placeholder="Enter access password"
            autoFocus
            style={{
              width: '100%',
              padding: '11px 14px',
              borderRadius: 10,
              border: `1.5px solid ${error ? '#B22222' : C.cardBorder}`,
              background: error ? '#FFF5F5' : '#F8F6F5',
              color: C.text,
              fontSize: 14,
              fontFamily: 'Poppins, sans-serif',
              outline: 'none',
              boxSizing: 'border-box',
              transition: 'border-color 0.15s',
            }}
            onFocus={e => { e.target.style.borderColor = C.accent; e.target.style.background = '#fff'; }}
            onBlur={e => { e.target.style.borderColor = error ? '#B22222' : C.cardBorder; e.target.style.background = error ? '#FFF5F5' : '#F8F6F5'; }}
          />
          {/* Error message */}
          <div style={{
            fontSize: 12,
            color: '#B22222',
            marginTop: 6,
            minHeight: 18,
            opacity: error ? 1 : 0,
            transition: 'opacity 0.2s',
          }}>
            {error}
          </div>
        </div>

        {/* Submit button */}
        <button
          onClick={handleSubmit}
          disabled={loading || !password}
          style={{
            width: '100%',
            padding: '12px',
            borderRadius: 10,
            border: 'none',
            background: loading || !password
              ? C.muted
              : `linear-gradient(135deg, ${C.accent}, ${C.accent2})`,
            color: '#fff',
            fontSize: 14,
            fontWeight: 600,
            fontFamily: 'Poppins, sans-serif',
            cursor: loading || !password ? 'not-allowed' : 'pointer',
            transition: 'all 0.15s',
            letterSpacing: '0.01em',
            marginTop: 4,
          }}
          onMouseEnter={e => { if (!loading && password) e.target.style.opacity = '0.88'; }}
          onMouseLeave={e => { e.target.style.opacity = '1'; }}
        >
          {loading ? 'Verifying…' : 'Access Dashboard'}
        </button>
      </div>

      {/* Footer */}
      <div style={{ marginTop: 20, fontSize: 11, color: C.muted }}>
        Jazz World · 2026
      </div>
    </div>
  );
}
