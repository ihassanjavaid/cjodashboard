// JLV Social Media Footprint — portfolio table from Google Sheet.

import { useMemo, useState } from 'react';
import { useDashboardDataWithFallback } from '../../hooks/useDashboardDataWithFallback.js';
import { KpiCard } from '../components/KpiCard.jsx';
import { StaleBanner } from '../components/primitives.jsx';
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

const SOCIAL_FOLLOW_KEYS = ['facebook', 'instagram', 'tiktok', 'linkedin'];
const METRIC_KEYS = [...SOCIAL_FOLLOW_KEYS, 'playReviews', 'playDownloads'];

const COLUMNS = [
  { key: 'application',   label: 'Application', sortable: true },
  { key: 'category',      label: 'Category', sortable: true },
  { key: 'facebook',      label: 'Facebook Followers', sortable: true, heat: true },
  { key: 'instagram',     label: 'Instagram Followers', sortable: true, heat: true },
  { key: 'tiktok',        label: 'TikTok Followers', sortable: true, heat: true },
  { key: 'linkedin',      label: 'LinkedIn Followers', sortable: true, heat: true },
  { key: 'playReviews',   label: 'Google Play Store Reviews', sortable: true, heat: true },
  { key: 'playDownloads', label: 'Google Play Store Downloads', sortable: true, heat: true, emphasize: true },
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

function sortValue(row, key) {
  if (METRIC_KEYS.includes(key)) return parseCompactMetric(row[key]);
  return String(row[key] ?? '').toLowerCase();
}

function SortIcon({ active, dir }) {
  return (
    <svg
      className="nu-table__sort-icon"
      data-active={active}
      data-dir={dir}
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M8 9l4-4 4 4" />
      <path d="M8 15l4 4 4-4" />
    </svg>
  );
}

function SortableTh({ col, sortKey, sortDir, onSort }) {
  const active = sortKey === col.key;
  const align = col.heat ? 'right' : 'left';
  return (
    <th style={{ textAlign: align, color: col.emphasize ? 'var(--nu-ink)' : undefined }}>
      <button
        type="button"
        className="nu-table__sort"
        data-align={align}
        onClick={() => onSort(col.key)}
        aria-sort={active ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
      >
        <span>{col.label}</span>
        <SortIcon active={active} dir={sortDir} />
      </button>
    </th>
  );
}

export function SocialView({ syncTick, search }) {
  const { rows: liveRows, sheetStatus } = useDashboardDataWithFallback('social', FALLBACK, syncTick);
  const rows = liveRows ?? FALLBACK;
  const [tableSearch, setTableSearch] = useState('');
  const [sortKey, setSortKey] = useState('application');
  const [sortDir, setSortDir] = useState('asc');

  const filtered = useMemo(
    () => rows.filter((r) => matchesCombinedSearch(r, search, tableSearch)),
    [rows, search, tableSearch],
  );

  const shown = useMemo(() => {
    const copy = [...filtered];
    copy.sort((a, b) => {
      const av = sortValue(a, sortKey);
      const bv = sortValue(b, sortKey);
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return copy;
  }, [filtered, sortKey, sortDir]);

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(METRIC_KEYS.includes(key) ? 'desc' : 'asc');
    }
  };

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

  const totalCategories = useMemo(
    () => new Set(shown.map((r) => r.category).filter(Boolean)).size,
    [shown],
  );

  const totalSocialFollowing = useMemo(() => {
    let sum = 0;
    for (const row of shown) {
      for (const key of SOCIAL_FOLLOW_KEYS) sum += parseCompactMetric(row[key]);
    }
    return sum;
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
            label="Total applications"
            value={shown.length}
            sub={`${rows.length} in portfolio`}
            filled
          />
        </div>
        <div className="nu-rise" data-i="1">
          <KpiCard
            label="Total categories"
            value={totalCategories}
            sub="Distinct verticals"
          />
        </div>
        <div className="nu-rise" data-i="2">
          <KpiCard
            label="Total social following"
            value={totalSocialFollowing ? formatCompactMetric(totalSocialFollowing) : '—'}
            sub="FB + IG + TikTok + LinkedIn"
          />
        </div>
        <div className="nu-rise" data-i="3">
          <KpiCard
            label="Top Play Store downloads"
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
            <table className="nu-table nu-table--sortable" style={{ minWidth: 1080 }}>
              <thead>
                <tr>
                  {COLUMNS.map((col) => (
                    <SortableTh
                      key={col.key}
                      col={col}
                      sortKey={sortKey}
                      sortDir={sortDir}
                      onSort={handleSort}
                    />
                  ))}
                </tr>
              </thead>
              <tbody>
                {shown.map((row, i) => (
                  <tr key={`${row.application}-${i}`}>
                    {COLUMNS.map((col) => {
                      const raw = cellValue(row[col.key]);
                      const numeric = col.heat ? parseCompactMetric(row[col.key]) : 0;
                      if (col.key === 'category') {
                        return (
                          <td key={col.key}>
                            <span className="nu-social-cat" title={raw}>{raw}</span>
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
