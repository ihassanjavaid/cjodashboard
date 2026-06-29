import { C, SectionTitle } from '../shared/dashboardKit.jsx';
import { useDashboardDataWithFallback } from '../hooks/useDashboardDataWithFallback.js';
import { SkeletonState } from '../components/states/SkeletonState.jsx';
import { StaleBanner } from '../components/StaleBanner.jsx';

const FALLBACK = [];

const COLUMNS = [
  { key: 'application',   label: 'Application' },
  { key: 'category',      label: 'Category' },
  { key: 'facebook',      label: 'Facebook Followers' },
  { key: 'instagram',     label: 'Instagram Followers' },
  { key: 'tiktok',        label: 'TikTok Followers' },
  { key: 'linkedin',      label: 'LinkedIn Followers' },
  { key: 'playReviews',   label: 'Google Play Store Reviews' },
  { key: 'playDownloads', label: 'Google Play Store Downloads' },
];

function cellValue(value) {
  const s = String(value ?? '').trim();
  return s || '—';
}

export function SocialTab({ syncTick }) {
  const live = useDashboardDataWithFallback('social', FALLBACK, syncTick);
  const rows = live.rows ?? FALLBACK;
  const { sheetStatus } = live;

  if (live.sheetStatus === 'loading' && !live.rows) {
    return <SkeletonState />;
  }

  return (
    <div style={{ paddingBottom: 40 }}>
      <StaleBanner status={sheetStatus} lastSyncedAt={live.lastSyncedAt} />
      <SectionTitle>JLV Portfolio Social Media Footprint</SectionTitle>
      <div className="cjo-scroll-x" style={{ background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 14, boxShadow: C.shadow }}>
        <table style={{ width: '100%', minWidth: 1080, borderCollapse: 'collapse', fontFamily: 'Poppins,sans-serif', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#F5F2F0' }}>
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  style={{
                    padding: '12px 14px',
                    textAlign: col.key === 'application' || col.key === 'category' ? 'left' : 'right',
                    color: C.textSub,
                    fontWeight: 600,
                    fontSize: 11,
                    borderBottom: `2px solid ${C.cardBorder}`,
                    whiteSpace: 'nowrap',
                    letterSpacing: '0.02em',
                  }}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={`${row.application}-${i}`}
                style={{ borderBottom: `1px solid ${C.cardBorder}`, background: i % 2 === 0 ? '#fff' : '#FAF7F5', transition: 'background 0.12s' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#F5EDE8'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = i % 2 === 0 ? '#fff' : '#FAF7F5'; }}
              >
                {COLUMNS.map((col) => (
                  <td
                    key={col.key}
                    style={{
                      padding: '13px 14px',
                      textAlign: col.key === 'application' || col.key === 'category' ? 'left' : 'right',
                      color: col.key === 'application' ? C.text : C.textSub,
                      fontWeight: col.key === 'application' ? 600 : 400,
                      fontSize: col.key === 'application' ? 13 : 12,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {cellValue(row[col.key])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
