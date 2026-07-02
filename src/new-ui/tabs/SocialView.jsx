// JLV Social Media Footprint — portfolio table from Google Sheet.

import { useMemo, useState } from 'react';
import { useDashboardDataWithFallback } from '../../hooks/useDashboardDataWithFallback.js';
import { KpiCard } from '../components/KpiCard.jsx';
import { Pill, StaleBanner } from '../components/primitives.jsx';
import { ChartFrame } from '../components/ChartFrame.jsx';
import { Search } from '../components/Search.jsx';
import {
  formatCompactMetric,
  heatTint,
  normalizeQuery,
  parseCompactMetric,
  rowMatchesSearch,
} from '../lib/utils.js';

const FALLBACK = [];

const METRIC_KEYS = ['facebook', 'instagram', 'tiktok', 'linkedin', 'playReviews', 'playDownloads'];

const COLUMNS = [
  { key: 'application',   label: 'Application', heat: false },
  { key: 'category',      label: 'Category', heat: false, pill: true },
  { key: 'facebook',      label: 'Facebook Followers', heat: true },
  { key: 'instagram',     label: 'Instagram Followers', heat: true },
  { key: 'tiktok',        label: 'TikTok Followers', heat: true },
  { key: 'linkedin',      label: 'LinkedIn Followers', heat: true },
  { key: 'playReviews',   label: 'Google Play Store Reviews', heat: true },
  { key: 'playDownloads', label: 'Google Play Store Downloads', heat: true, emphasize: true },
];

const SEARCH_FIELDS = COLUMNS.map((c) => c.key);

function cellValue(value) {
  const s = String(value ?? '').trim();
  return s || '—';
}

function matchesCombinedSearch(row, globalSearch, tableSearch) {
  const global = normalizeQuery(globalSearch);
  const local = normalizeQuery(tableSearch);
  if (global && !rowMatchesSearch(row, SEARCH_FIELDS, global)) return false;
  if (local && !rowMatchesSearch(row, SEARCH_FIELDS, local)) return false;
  return true;
}

export function SocialView({ syncTick, search }) {
  const { rows: liveRows, sheetStatus } = useDashboardDataWithFallback('social', FALLBACK, syncTick);
  const rows = liveRows ?? FALLBACK;
  const [tableSearch, setTableSearch] = useState('');

  const shown = useMemo(
    () => rows.filter((r) => matchesCombinedSearch(r, search, tableSearch)),
    [rows, search, tableSearch],
  );

  const columnMax = useMemo(() => {
    const max = Object.fromEntries(METRIC_KEYS.map((k) => [k, 0]));
    for (const row of shown) {
      for (const key of METRIC_KEYS) {
        const n = parseCompactMetric(row[key]);
        if (n > max[key]) max[key] = n;
      }
    }
    return max;
  }, [shown]);

  const totals = useMemo(() => {
    const out = Object.fromEntries(METRIC_KEYS.map((k) => [k, 0]));
    for (const row of shown) {
      for (const key of METRIC_KEYS) out[key] += parseCompactMetric(row[key]);
    }
    return out;
  }, [shown]);

  const categories = useMemo(
    () => new Set(shown.map((r) => r.category).filter(Boolean)).size,
    [shown],
  );

  const topTikTok = useMemo(() => {
    let best = { application: '—', value: 0 };
    for (const row of shown) {
      const n = parseCompactMetric(row.tiktok);
      if (n > best.value) best = { application: row.application || '—', value: n };
    }
    return best;
  }, [shown]);

  const topPlay = useMemo(() => {
    let best = { application: '—', value: 0 };
    for (const row of shown) {
      const n = parseCompactMetric(row.playDownloads);
      if (n > best.value) best = { application: row.application || '—', value: n };
    }
    return best;
  }, [shown]);

  return (
    <section className="nu-page">
      <header className="nu-page__head">
        <div className="nu-page__heading">
          <h1>Jazz Lifestyle Ventures | Social Media Footprint</h1>
          <p>Portfolio social reach across Facebook, Instagram, TikTok, LinkedIn, and Google Play Store.</p>
        </div>
      </header>

      <StaleBanner status={sheetStatus} />

      <div className="nu-kpi-row">
        <div className="nu-rise" data-i="0">
          <KpiCard
            label="Applications"
            value={shown.length}
            sub={`${rows.length} in portfolio`}
            filled
          />
        </div>
        <div className="nu-rise" data-i="1">
          <KpiCard label="Categories" value={categories} sub="Distinct verticals" />
        </div>
        <div className="nu-rise" data-i="2">
          <KpiCard
            label="Top TikTok reach"
            value={topTikTok.value ? formatCompactMetric(topTikTok.value) : '—'}
            sub={topTikTok.application}
          />
        </div>
        <div className="nu-rise" data-i="3">
          <KpiCard
            label="Top Play downloads"
            value={topPlay.value ? formatCompactMetric(topPlay.value) : '—'}
            sub={topPlay.application}
          />
        </div>
      </div>

      <div className="nu-grid nu-grid--full">
        <ChartFrame
          title="JLV Portfolio Social Media Footprint"
          caption={`${shown.length} of ${rows.length} applications`}
          action={(
            <Search
              id="nu-social-table-search"
              className="nu-search--compact"
              value={tableSearch}
              onChange={setTableSearch}
              placeholder="Filter table..."
              hint=""
            />
          )}
          empty={shown.length === 0}
        >
          <div className="nu-table-wrap">
            <table className="nu-table" style={{ minWidth: 1080 }}>
              <thead>
                <tr>
                  {COLUMNS.map((col) => (
                    <th
                      key={col.key}
                      style={{
                        textAlign: col.heat ? 'right' : 'left',
                        color: col.emphasize ? 'var(--nu-ink)' : undefined,
                      }}
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {shown.map((row, i) => (
                  <tr key={`${row.application}-${i}`}>
                    {COLUMNS.map((col) => {
                      const raw = cellValue(row[col.key]);
                      const numeric = col.heat ? parseCompactMetric(row[col.key]) : 0;
                      if (col.pill) {
                        return (
                          <td key={col.key} className="nu-mute">
                            <Pill tone="accent">{raw}</Pill>
                          </td>
                        );
                      }
                      if (col.heat) {
                        return (
                          <td
                            key={col.key}
                            className="nu-num nu-heat-cell"
                            style={{
                              background: heatTint(numeric, columnMax[col.key]),
                              fontWeight: col.emphasize ? 600 : 400,
                            }}
                          >
                            {raw === '—' ? <span className="nu-mute">—</span> : raw}
                          </td>
                        );
                      }
                      return (
                        <td key={col.key} className="nu-strong">{raw}</td>
                      );
                    })}
                  </tr>
                ))}
                {shown.length > 0 && (
                  <tr className="nu-table__total">
                    <td className="nu-strong">Total</td>
                    <td className="nu-mute">—</td>
                    {METRIC_KEYS.map((key) => (
                      <td key={key} className="nu-num nu-strong">
                        {formatCompactMetric(totals[key])}
                      </td>
                    ))}
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </ChartFrame>
      </div>
    </section>
  );
}
