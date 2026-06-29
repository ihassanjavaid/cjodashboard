// JLV Social Media Footprint — portfolio table from Google Sheet.

import { useDashboardDataWithFallback } from '../../hooks/useDashboardDataWithFallback.js';
import { StaleBanner } from '../components/primitives.jsx';
import { ChartFrame } from '../components/ChartFrame.jsx';
import { normalizeQuery, rowMatchesSearch } from '../lib/utils.js';

const FALLBACK = [];

const COLUMNS = [
  { key: 'application',   label: 'Application' },
  { key: 'category',      label: 'Category' },
  { key: 'facebook',      label: 'Facebook Followers', align: 'right' },
  { key: 'instagram',     label: 'Instagram Followers', align: 'right' },
  { key: 'tiktok',        label: 'TikTok Followers', align: 'right' },
  { key: 'linkedin',      label: 'LinkedIn Followers', align: 'right' },
  { key: 'playReviews',   label: 'Google Play Store Reviews', align: 'right' },
  { key: 'playDownloads', label: 'Google Play Store Downloads', align: 'right' },
];

function cellValue(value) {
  const s = String(value ?? '').trim();
  return s || '—';
}

export function SocialView({ syncTick, search }) {
  const { rows: liveRows, sheetStatus } = useDashboardDataWithFallback('social', FALLBACK, syncTick);
  const rows = liveRows ?? FALLBACK;
  const query = normalizeQuery(search);
  const shown = rows.filter((r) => rowMatchesSearch(r, COLUMNS.map((c) => c.key), query));

  return (
    <section className="nu-page">
      <header className="nu-page__head">
        <div className="nu-page__heading">
          <h1>JLV Social Media Footprint</h1>
          <p>Portfolio social reach across Facebook, Instagram, TikTok, LinkedIn, and Google Play.</p>
        </div>
      </header>

      <StaleBanner status={sheetStatus} />

      <div className="nu-grid nu-grid--full">
        <ChartFrame
          title="JLV Portfolio Social Media Footprint"
          caption={`${shown.length} of ${rows.length} applications`}
          empty={shown.length === 0}
        >
          <div className="nu-table-wrap">
            <table className="nu-table" style={{ minWidth: 1080 }}>
              <thead>
                <tr>
                  {COLUMNS.map((col) => (
                    <th
                      key={col.key}
                      style={col.align === 'right' ? { textAlign: 'right' } : undefined}
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {shown.map((row, i) => (
                  <tr key={`${row.application}-${i}`}>
                    {COLUMNS.map((col) => (
                      <td
                        key={col.key}
                        className={col.key === 'application' ? 'nu-strong' : col.align === 'right' ? 'nu-num' : 'nu-mute'}
                        style={col.align === 'right' ? { textAlign: 'right' } : undefined}
                      >
                        {cellValue(row[col.key])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ChartFrame>
      </div>
    </section>
  );
}
