// Process Team — KPIs + channel distribution + BVS donut + TAT heatmap + productivity heatmap.

import { useEffect, useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList, Cell,
} from 'recharts';
import { useDashboardDataWithFallback } from '../../hooks/useDashboardDataWithFallback.js';
import { KpiCard } from '../components/KpiCard.jsx';
import { StaleBanner } from '../components/primitives.jsx';
import { ChartFrame, NUTooltip } from '../components/ChartFrame.jsx';
import { DonutChart } from '../components/DonutChart.jsx';
import { Filter, ViewToggle } from '../components/Filters.jsx';
import { axisProps, gridProps, chartColors, chartMargins } from '../lib/chartTheme.js';
import { heatTint, normalizeQuery, rowMatchesSearch } from '../lib/utils.js';

const TAT_BUCKET_ORDER = [
  'Immediate', '2 Hours', '4 Hours', '6 Hours', '24 Hours',
  '1 Day', '2 Days', '3 Days', '4 Days', '5 Days', '13 Days',
];
const TAT_MONTHS  = ['Jan', 'Feb', 'Mar', 'Apr', 'YTD'];
const PROD_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'YTD'];

function usePersistentToggle(key, initial) {
  const [value, setValue] = useState(() => {
    if (typeof window === 'undefined') return initial;
    try { return window.localStorage.getItem(key) || initial; } catch { return initial; }
  });
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try { window.localStorage.setItem(key, value); } catch { /* no-op */ }
  }, [key, value]);
  return [value, setValue];
}

export function ProcessView({ syncTick, search }) {
  const live = useDashboardDataWithFallback('process', null, syncTick);
  const data = live.rows;
  const colors = chartColors();
  const query = normalizeQuery(search);

  const [tatTeam, setTatTeam]     = useState('');
  const [tatView, setTatView]     = usePersistentToggle('nu:processTatView', 'table');
  const [prodView, setProdView]   = usePersistentToggle('nu:processProdView', 'table');

  const counts = useMemo(() => data?.counts ?? [], [data?.counts]);
  const unique = data?.unique ?? 0;
  const bvs    = data?.bvs ?? { bvs: 0, nonBvs: 0 };
  const tat    = useMemo(() => data?.tat ?? [],              [data?.tat]);
  const prod   = useMemo(() => data?.teamProductivity ?? [], [data?.teamProductivity]);
  const countsShown = useMemo(() => counts.filter((r) => rowMatchesSearch(r, ['team'], query)), [counts, query]);
  const tatShown = useMemo(() => tat.filter((r) => rowMatchesSearch(r, ['team', 'bucket', 'month'], query)), [tat, query]);
  const prodShown = useMemo(() => prod.filter((r) => rowMatchesSearch(r, ['teamMember', 'month'], query)), [prod, query]);

  const tatTeams = useMemo(() => [...new Set(tatShown.map((r) => r.team))], [tatShown]);
  const effectiveTatTeam = (tatTeam && tatTeams.includes(tatTeam)) ? tatTeam : (tatTeams[0] || '');

  const tatRows = useMemo(() => {
    const teamRows = tatShown.filter((r) => r.team === effectiveTatTeam);
    return TAT_BUCKET_ORDER.map((bucket) => {
      const byMonth = Object.fromEntries(TAT_MONTHS.map((m) => [m, 0]));
      teamRows.filter((r) => r.bucket === bucket).forEach((r) => { byMonth[r.month] = r.value; });
      return { bucket, ...byMonth };
    }).filter((row) => TAT_MONTHS.some((m) => row[m] > 0));
  }, [tatShown, effectiveTatTeam]);

  const tatMax = useMemo(() => {
    let m = 0;
    for (const row of tatRows) {
      for (const month of TAT_MONTHS) if (row[month] > m) m = row[month];
    }
    return m;
  }, [tatRows]);

  const tatChartData = useMemo(() => ['Jan', 'Feb', 'Mar', 'Apr'].map((month) => {
    const point = { month };
    for (const row of tatRows) point[row.bucket] = row[month];
    return point;
  }), [tatRows]);

  const prodMembers = useMemo(() => [...new Set(prodShown.map((r) => r.teamMember))], [prodShown]);

  const prodGrid = useMemo(() => prodMembers.map((member) => {
    const row = { teamMember: member };
    for (const month of PROD_MONTHS) {
      const entry = prodShown.find((p) => p.teamMember === member && p.month === month);
      row[`${month}_new`]    = entry?.new ?? 0;
      row[`${month}_revamp`] = entry?.revamp ?? 0;
    }
    return row;
  }), [prodShown, prodMembers]);

  const prodMax = useMemo(() => {
    let m = 0;
    for (const row of prodGrid) {
      for (const month of PROD_MONTHS) {
        if (row[`${month}_new`]    > m) m = row[`${month}_new`];
        if (row[`${month}_revamp`] > m) m = row[`${month}_revamp`];
      }
    }
    return m;
  }, [prodGrid]);

  const prodChartData = useMemo(() => prodGrid.map((r) => ({
    teamMember: r.teamMember,
    New:    r.YTD_new,
    Revamp: r.YTD_revamp,
  })), [prodGrid]);

  const channelBarData = [...countsShown].sort((a, b) => b.count - a.count);
  const totalProcesses = query ? channelBarData.reduce((sum, row) => sum + (row.count || 0), 0) : (unique || 0);
  const bvsTotal = bvs.bvs + bvs.nonBvs;
  const bvsPct = bvsTotal ? Math.round((bvs.bvs / bvsTotal) * 100) : 0;

  return (
    <section className="nu-page">
      <header className="nu-page__head">
        <div className="nu-page__heading">
          <h1>Process Team</h1>
          <p>Process inventory across channels with turnaround and contributor productivity views.</p>
        </div>
      </header>

      <StaleBanner status={live.sheetStatus} />

      <div className="nu-kpi-row">
        <div className="nu-rise" data-i="0">
          <KpiCard label="Unique processes" value={totalProcesses} sub="Across process inventory" filled />
        </div>
        <div className="nu-rise" data-i="1">
          <KpiCard label="Channels" value={countsShown.length} sub={`${counts.length} total channels`} />
        </div>
        <div className="nu-rise" data-i="2">
          <KpiCard label="BVS" value={bvs.bvs} sub={`${bvsPct}% of all processes`} />
        </div>
        <div className="nu-rise" data-i="3">
          <KpiCard label="Non-BVS" value={bvs.nonBvs} sub={`${100 - bvsPct}% of all processes`} />
        </div>
        <div className="nu-rise" data-i="4">
          <KpiCard label="TAT reduction areas" value={tatTeams.length} sub="With TAT distribution" />
        </div>
      </div>

      <div className="nu-grid">
        <ChartFrame
          title="By channel"
          caption={`${channelBarData.length} channels`}
          empty={channelBarData.length === 0}
        >
          <ResponsiveContainer width="100%" height={Math.max(280, channelBarData.length * 30)}>
            <BarChart
              data={channelBarData}
              layout="vertical"
              barCategoryGap={12}
              margin={chartMargins('vertical')}
              accessibilityLayer
              aria-label="Process count by channel"
            >
              <CartesianGrid {...gridProps(colors)} horizontal={false} vertical />
              <XAxis type="number" {...axisProps(colors, { side: 'x', minimal: true })} />
              <YAxis type="category" dataKey="team" width={140}
                     tick={{ fill: colors.ink2, fontSize: 11, fontFamily: 'Geist, sans-serif' }}
                     axisLine={false} tickLine={false} />
              <Tooltip content={<NUTooltip />} cursor={{ fill: colors.cursor }} />
              <Bar dataKey="count" name="Processes" barSize={18} radius={[0, 10, 10, 0]}>
                {channelBarData.map((_, i) => (
                  <Cell key={i} fill={i === 0 ? colors.accent : colors.ink} />
                ))}
                <LabelList dataKey="count" position="right" style={{ fill: colors.ink3, fontSize: 10, fontFamily: 'JetBrains Mono, monospace' }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartFrame>

        <ChartFrame
          title="BVS composition"
          caption="Banking value stream"
          empty={bvsTotal === 0}
        >
          <DonutChart
            data={[
              { name: 'BVS', value: bvs.bvs, fill: colors.accent },
              { name: 'Non-BVS', value: bvs.nonBvs, fill: colors.ink3 },
            ]}
            colors={colors}
            ariaLabel={`BVS composition: ${bvsPct}% BVS`}
            primaryName="BVS"
            totalLabel="total"
            height={230}
          />
        </ChartFrame>
      </div>

      <div className="nu-grid nu-grid--full" style={{ marginTop: 14 }}>
        <ChartFrame
          title="Turnaround distribution"
          caption={`${effectiveTatTeam || 'No team'} · ${tatRows.length} buckets`}
          action={
            <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
              <Filter
                value={effectiveTatTeam}
                options={tatTeams.length ? tatTeams : ['—']}
                onChange={setTatTeam}
              />
              <ViewToggle value={tatView} onChange={setTatView} />
            </span>
          }
          empty={tatRows.length === 0}
        >
          {tatView === 'table' ? (
            <div className="nu-table-wrap">
              <table className="nu-table">
                <thead>
                  <tr>
                    <th>Bucket</th>
                    {TAT_MONTHS.map((m) => (
                      <th key={m} style={{ textAlign: 'right', color: m === 'YTD' ? 'var(--nu-ink)' : undefined }}>{m}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tatRows.map((row) => (
                    <tr key={row.bucket}>
                      <td className="nu-strong">{row.bucket}</td>
                      {TAT_MONTHS.map((m) => (
                        <td key={m} className="nu-num nu-heat-cell" style={{
                          background: heatTint(row[m], tatMax),
                          fontWeight: m === 'YTD' ? 600 : 400,
                        }}>
                          {row[m] === 0 ? <span className="nu-mute">—</span> : row[m].toLocaleString()}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={340}>
              <BarChart
                data={tatChartData}
                barCategoryGap={28}
                margin={chartMargins()}
                accessibilityLayer
                aria-label={`Turnaround distribution for ${effectiveTatTeam || 'selected team'}`}
              >
                <CartesianGrid {...gridProps(colors)} />
                <XAxis dataKey="month" {...axisProps(colors, { side: 'x' })} />
                <YAxis {...axisProps(colors, { side: 'y', minimal: true })} />
                <Tooltip content={<NUTooltip />} cursor={{ fill: colors.cursor }} />
                {tatRows.map((row, i) => (
                  <Bar
                    key={row.bucket}
                    dataKey={row.bucket}
                    stackId="tat"
                    fill={colors.palette[i % colors.palette.length]}
                    barSize={36}
                    radius={i === tatRows.length - 1 ? [12, 12, 4, 4] : [0, 0, 0, 0]}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartFrame>
      </div>

      <div className="nu-grid nu-grid--full" style={{ marginTop: 14 }}>
        <ChartFrame
          title="Team productivity — new vs revamp"
          caption={`${prodGrid.length} contributors`}
          action={<ViewToggle value={prodView} onChange={setProdView} />}
          empty={prodGrid.length === 0}
        >
          {prodView === 'table' ? (
            <div className="nu-table-wrap">
              <table className="nu-table">
                <thead>
                  <tr>
                    <th rowSpan={2}>Team Member</th>
                    {PROD_MONTHS.map((m) => (
                      <th key={m} colSpan={2} style={{ textAlign: 'center', color: m === 'YTD' ? 'var(--nu-ink)' : undefined }}>{m}</th>
                    ))}
                  </tr>
                  <tr>
                    {PROD_MONTHS.flatMap((m) => [
                      <th key={`${m}-n`} style={{ textAlign: 'right', textTransform: 'none', fontSize: 9, letterSpacing: '0.06em' }}>New</th>,
                      <th key={`${m}-r`} style={{ textAlign: 'right', textTransform: 'none', fontSize: 9, letterSpacing: '0.06em' }}>Revamp</th>,
                    ])}
                  </tr>
                </thead>
                <tbody>
                  {prodGrid.map((row) => (
                    <tr key={row.teamMember}>
                      <td className="nu-strong">{row.teamMember}</td>
                      {PROD_MONTHS.flatMap((m) => [
                        <td key={`${m}-n`} className="nu-num nu-heat-cell" style={{
                          background: heatTint(row[`${m}_new`], prodMax),
                          fontWeight: m === 'YTD' ? 600 : 400,
                        }}>{row[`${m}_new`] === 0 ? <span className="nu-mute">—</span> : row[`${m}_new`].toLocaleString()}</td>,
                        <td key={`${m}-r`} className="nu-num nu-heat-cell" style={{
                          background: heatTint(row[`${m}_revamp`], prodMax),
                          fontWeight: m === 'YTD' ? 600 : 400,
                        }}>{row[`${m}_revamp`] === 0 ? <span className="nu-mute">—</span> : row[`${m}_revamp`].toLocaleString()}</td>,
                      ])}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(260, prodChartData.length * 50)}>
              <BarChart
                data={prodChartData}
                layout="vertical"
                barCategoryGap={12}
                margin={chartMargins('vertical')}
                accessibilityLayer
                aria-label="Team productivity comparing new and revamp work"
              >
                <CartesianGrid {...gridProps(colors)} horizontal={false} vertical />
                <XAxis type="number" {...axisProps(colors, { side: 'x', minimal: true })} />
                <YAxis type="category" dataKey="teamMember" width={120}
                       tick={{ fill: colors.ink2, fontSize: 11, fontFamily: 'Geist, sans-serif' }}
                       axisLine={false} tickLine={false} />
                <Tooltip content={<NUTooltip />} cursor={{ fill: colors.cursor }} />
                <Bar dataKey="New" stackId="ytd" fill={colors.accent} barSize={18} radius={[10, 0, 0, 10]}>
                  <LabelList dataKey="New" position="insideLeft" style={{ fill: colors.surface, fontSize: 10, fontFamily: 'JetBrains Mono, monospace', fontWeight: 700 }} />
                </Bar>
                <Bar dataKey="Revamp" stackId="ytd" fill={colors.ink} barSize={18} radius={[0, 10, 10, 0]}>
                  <LabelList dataKey="Revamp" position="insideRight" style={{ fill: colors.surface, fontSize: 10, fontFamily: 'JetBrains Mono, monospace', fontWeight: 700 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartFrame>
      </div>
    </section>
  );
}

// ── BVS Dial — minimal SVG donut ──────────────────────────────────────────
