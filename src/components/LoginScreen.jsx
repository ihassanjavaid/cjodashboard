import { useState } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { JW_LOGO } from '../shared/dashboardKit.jsx';
import { auth } from '../lib/firebase.js';

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

function friendlyError(code) {
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Incorrect email or password.';
    case 'auth/invalid-email':
      return 'That email address looks invalid.';
    case 'auth/email-already-in-use':
      return 'An account already exists for that email — try logging in instead.';
    case 'auth/weak-password':
      return 'Password should be at least 6 characters.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a moment and try again.';
    case 'auth/network-request-failed':
      return 'Network error. Check your connection and try again.';
    default:
      return 'Something went wrong. Please try again.';
  }
}

// Note: there is no onSuccess callback — App.jsx listens to Firebase's
// onAuthStateChanged and reacts to sign-in/sign-up automatically. A newly
// registered account has no Firestore role doc yet, so it lands on
// NoRoleScreen until an admin assigns one.
export function LoginScreen() {
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const isRegister = mode === 'register';
  const canSubmit = email && password && (!isRegister || confirmPassword) && !loading;

  const switchMode = (next) => {
    setMode(next);
    setError('');
    setPassword('');
    setConfirmPassword('');
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    if (isRegister && password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }
    setLoading(true);
    setError('');
    const cleanEmail = email.trim().toLowerCase();
    try {
      if (isRegister) {
        await createUserWithEmailAndPassword(auth, cleanEmail, password);
      } else {
        await signInWithEmailAndPassword(auth, cleanEmail, password);
      }
      // On success, stay in the loading state on purpose. App.jsx's
      // onAuthStateChanged listener will swap this screen out a moment
      // later — resetting `loading` here would briefly re-enable the
      // button in between, causing a visible flash.
    } catch (e) {
      setError(friendlyError(e.code));
      setPassword('');
      setConfirmPassword('');
      setLoading(false);
    }
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
            {isRegister ? 'Create an account' : 'Customer Journey Optimization'}
          </div>
        </div>

        {/* Email field */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.textSub, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={e => { setEmail(e.target.value); setError(''); }}
            onKeyDown={handleKeyDown}
            placeholder="Enter your email"
            autoFocus
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            style={{
              width: '100%',
              padding: '11px 14px',
              borderRadius: 10,
              border: `1.5px solid ${C.cardBorder}`,
              background: '#F8F6F5',
              color: C.text,
              fontSize: 14,
              fontFamily: 'Poppins, sans-serif',
              outline: 'none',
              boxSizing: 'border-box',
              transition: 'border-color 0.15s',
            }}
            onFocus={e => { e.target.style.borderColor = C.accent; e.target.style.background = '#fff'; }}
            onBlur={e => { e.target.style.borderColor = C.cardBorder; e.target.style.background = '#F8F6F5'; }}
          />
        </div>

        {/* Password field */}
        <div style={{ marginBottom: isRegister ? 14 : 8 }}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.textSub, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={e => { setPassword(e.target.value); setError(''); }}
            onKeyDown={handleKeyDown}
            placeholder={isRegister ? 'Choose a password' : 'Enter your password'}
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
        </div>

        {/* Confirm password field — register mode only */}
        {isRegister && (
          <div style={{ marginBottom: 8 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.textSub, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>
              Confirm Password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={e => { setConfirmPassword(e.target.value); setError(''); }}
              onKeyDown={handleKeyDown}
              placeholder="Re-enter your password"
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
          </div>
        )}

        {/* Error message */}
        <div style={{
          fontSize: 12,
          color: '#B22222',
          marginBottom: 6,
          minHeight: 18,
          opacity: error ? 1 : 0,
          transition: 'opacity 0.2s',
        }}>
          {error}
        </div>

        {/* Submit button */}
        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          style={{
            width: '100%',
            padding: '12px',
            borderRadius: 10,
            border: 'none',
            background: !canSubmit
              ? C.muted
              : `linear-gradient(135deg, ${C.accent}, ${C.accent2})`,
            color: '#fff',
            fontSize: 14,
            fontWeight: 600,
            fontFamily: 'Poppins, sans-serif',
            cursor: !canSubmit ? 'not-allowed' : 'pointer',
            transition: 'all 0.15s',
            letterSpacing: '0.01em',
            marginTop: 4,
          }}
          onMouseEnter={e => { if (canSubmit) e.target.style.opacity = '0.88'; }}
          onMouseLeave={e => { e.target.style.opacity = '1'; }}
        >
          {loading
            ? (isRegister ? 'Creating account…' : 'Signing in…')
            : (isRegister ? 'Create Account' : 'Access Dashboard')}
        </button>

        {/* Mode toggle */}
        <div style={{ textAlign: 'center', marginTop: 18, fontSize: 12.5, color: C.textSub }}>
          {isRegister ? (
            <>
              Already Registered?{' '}
              <span
                onClick={() => switchMode('login')}
                style={{ color: C.accent, fontWeight: 600, cursor: 'pointer' }}
              >
                Log In!
              </span>
            </>
          ) : (
            <>
              Don't have an account?{' '}
              <span
                onClick={() => switchMode('register')}
                style={{ color: C.accent, fontWeight: 600, cursor: 'pointer' }}
              >
                Sign Up!
              </span>
            </>
          )}
        </div>
      </div>

      {/* Footer */}
      <div style={{ marginTop: 20, fontSize: 11, color: C.muted }}>
        Jazz World · 2026
      </div>
    </div>
  );
}
