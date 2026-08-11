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
  shadowHover: '0 8px 24px rgba(139,26,26,0.16)',
};

export function NoRoleScreen({ email, onLogout }) {
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

      <div style={{
        background: C.card,
        border: `1px solid ${C.cardBorder}`,
        borderRadius: 18,
        padding: '40px',
        width: '100%',
        maxWidth: 420,
        boxShadow: C.shadowHover,
        textAlign: 'center',
      }}>
        <img
          src={JW_LOGO}
          alt="Jazz World"
          style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover', marginBottom: 20 }}
        />
        <div style={{ fontSize: 17, fontWeight: 700, color: C.text, marginBottom: 8 }}>
          No Role Assigned!
        </div>
        <div style={{ fontSize: 13, color: C.textSub, lineHeight: 1.6, marginBottom: 4 }}>
          Your account ({email}) is signed in, but doesn't have a role yet.
        </div>
        <div style={{ fontSize: 13, color: C.textSub, lineHeight: 1.6, marginBottom: 24 }}>
          Ask an administrator to assign you a role in order to access the dashboard.
        </div>
        <button
          onClick={onLogout}
          style={{
            padding: '10px 20px',
            borderRadius: 10,
            border: `1.5px solid ${C.cardBorder}`,
            background: '#fff',
            color: C.accent,
            fontSize: 13,
            fontWeight: 600,
            fontFamily: 'Poppins, sans-serif',
            cursor: 'pointer',
          }}
        >
          Log out
        </button>
      </div>
    </div>
  );
}
