import { useMemo, useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LabelList,
} from 'recharts';
import {
  C, PIE_COLORS, ICON, KpiCard, ChartCard, SectionTitle, Sel, CT,
  renderPieLabel, pieLegendFormatter,
} from '../shared/dashboardKit.jsx';
import { useDashboardDataWithFallback } from '../hooks/useDashboardDataWithFallback.js';
import { SkeletonState } from '../components/states/SkeletonState.jsx';
import { StaleBanner } from '../components/StaleBanner.jsx';

// Bucket display order for the TAT grid — short→long, then "Days".
const TAT_BUCKET_ORDER = [
  'Immediate', '2 Hours', '4 Hours', '6 Hours', '24 Hours',
  '1 Day', '2 Days', '3 Days', '4 Days', '5 Days', '13 Days',
];
const TAT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'YTD'];
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

// Linear opacity tint for table heatmap cells. We pass a max so each table
// keeps its own scale (TAT max is much higher than Productivity max).
function tintColor(value, max) {
  if (!max || value <= 0) return 'transparent';
  const alpha = Math.min(0.85, 0.05 + (value / max) * 0.55);
  // C.accent ("#8B1A1A") + 8-bit alpha as hex
  const a = Math.round(alpha * 255).toString(16).padStart(2, '0');
  return `${C.accent}${a}`;
}

const ToggleBtn = ({ label, active, onClick }) => (
  <button
    onClick={onClick}
    style={{
      padding: '5px 12px', fontSize: 11, fontFamily: 'Poppins,sans-serif',
      fontWeight: active ? 600 : 500,
      color: active ? '#fff' : C.textSub,
      background: active ? C.accent : '#F8FAFC',
      border: `1px solid ${active ? C.accent : C.cardBorder}`,
      borderRadius: 6, cursor: 'pointer', transition: 'all 0.15s',
    }}
  >
    {label}
  </button>
);

const ToggleGroup = ({ value, onChange }) => (
  <div style={{ display: 'flex', gap: 6 }}>
    <ToggleBtn label="Table" active={value === 'table'} onClick={() => onChange('table')} />
    <ToggleBtn label="Chart" active={value === 'chart'} onClick={() => onChange('chart')} />
  </div>
);

export function ProcessTab({ syncTick }) {
  const live = useDashboardDataWithFallback('process', null, syncTick);
  const data = live.rows;
  const { sheetStatus, lastSyncedAt } = live;

  const [tatTeam, setTatTeam]     = useState('');
  const [tatView, setTatView]     = usePersistentToggle('cjo:processTatView', 'table');
  const [prodView, setProdView]   = usePersistentToggle('cjo:processProdView', 'table');

  // Hooks must run on every render, so derive everything BEFORE any early return.
  const counts = data?.counts ?? [];
  const unique = data?.unique ?? 0;
  const bvs    = data?.bvs ?? { bvs: 0, nonBvs: 0 };
  const tat    = data?.tat ?? [];
  const prod   = data?.teamProductivity ?? [];

  const tatTeams = useMemo(() => [...new Set(tat.map(r => r.team))], [tat]);

  // Use the user's selection if it's still valid, otherwise default to the first
  // available team. Computed at render time (no effect) — avoids cascading renders
  // and means the default updates correctly when the team list changes.
  const effectiveTatTeam = (tatTeam && tatTeams.includes(tatTeam)) ? tatTeam : (tatTeams[0] || '');

  // --- Row 3 TAT data, scoped to selected team ---
  const tatRows = useMemo(() => {
    const teamRows = tat.filter(r => r.team === effectiveTatTeam);
    // pivot: rows = bucket, cols = month
    return TAT_BUCKET_ORDER.map(bucket => {
      const byMonth = Object.fromEntries(TAT_MONTHS.map(m => [m, 0]));
      teamRows.filter(r => r.bucket === bucket).forEach(r => { byMonth[r.month] = r.value; });
      return { bucket, ...byMonth };
    }).filter(row => TAT_MONTHS.some(m => row[m] > 0));
  }, [tat, effectiveTatTeam]);

  const tatMax = useMemo(() => {
    let m = 0;
    for (const row of tatRows) {
      for (const month of TAT_MONTHS) if (row[month] > m) m = row[month];
    }
    return m;
  }, [tatRows]);

  // Chart-form: x-axis = month (excl. YTD), grouped bars per bucket.
  const tatChartData = useMemo(() => {
    return ['Jan', 'Feb', 'Mar', 'Apr'].map(month => {
      const point = { month };
      for (const row of tatRows) point[row.bucket] = row[month];
      return point;
    });
  }, [tatRows]);

  // --- Row 4 productivity data ---
  const prodMembers = useMemo(() => [...new Set(prod.map(r => r.teamMember))], [prod]);
  const prodGrid = useMemo(() => {
    return prodMembers.map(member => {
      const row = { teamMember: member };
      for (const month of PROD_MONTHS) {
        const entry = prod.find(p => p.teamMember === member && p.month === month);
        row[`${month}_new`]    = entry?.new ?? 0;
        row[`${month}_revamp`] = entry?.revamp ?? 0;
      }
      return row;
    });
  }, [prod, prodMembers]);

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

  const prodChartData = useMemo(() => {
    return prodGrid.map(r => ({
      teamMember: r.teamMember,
      New:    r.YTD_new,
      Revamp: r.YTD_revamp,
    }));
  }, [prodGrid]);

  // Loading: show skeleton. Error/unconfigured falls back to null rows via the
  // wrapper — we just render the chrome and empty cards in that case.
  if (sheetStatus === 'loading') return <SkeletonState />;

  // --- Row 2 chart data (cheap, derived synchronously after the early return) ---
  const channelBarData = [...counts].sort((a, b) => b.count - a.count);
  const bvsPieData = [
    { name: 'BVS',      value: bvs.bvs,    fill: C.accent },
    { name: 'Non-BVS',  value: bvs.nonBvs, fill: C.muted },
  ];

  // --- Common cell styles for tables ---
  const th = {
    padding: '10px 12px', fontSize: 11, fontWeight: 600, color: C.textSub,
    textAlign: 'left', borderBottom: `1px solid ${C.cardBorder}`,
    fontFamily: 'Poppins,sans-serif', letterSpacing: '0.02em', textTransform: 'uppercase',
  };
  const td = {
    padding: '10px 12px', fontSize: 12, color: C.text,
    fontFamily: 'Poppins,sans-serif', borderBottom: `1px solid ${C.cardBorder}`,
  };

  return (
    <>
      <StaleBanner sheetStatus={sheetStatus} lastSyncedAt={lastSyncedAt} />
      <div style={{ paddingBottom: 40 }}>

        {/* ── Row 1: KPIs ──────────────────────────────────────────────────── */}
        <SectionTitle>Process Team Overview</SectionTitle>
        <div className="cjo-kpi-row">
          <KpiCard label="Unique Processes" value={unique.toLocaleString()} color={C.accent}  icon={ICON.sops} />
          <KpiCard label="Channels"         value={String(counts.length)}    color={C.accent2} icon={ICON.processes} />
          <KpiCard label="BVS"              value={bvs.bvs.toLocaleString()}    color={C.success} icon={ICON.check} />
          <KpiCard label="Non-BVS"          value={bvs.nonBvs.toLocaleString()} color={C.muted}   icon={ICON.tasks} />
        </div>

        {/* ── Row 2: Channel distribution + BVS donut ─────────────────────── */}
        <div className="cjo-grid-2-1" style={{ marginBottom: 16 }}>
          <ChartCard title="Process Distribution by Channel">
            {channelBarData.length === 0 ? (
              <div style={{ padding: 40, color: C.textSub, fontFamily: 'Poppins,sans-serif', fontSize: 13 }}>No data</div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={channelBarData} layout="vertical" barSize={18}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.gridLine} horizontal={false} />
                  <XAxis type="number" tick={{ fill: C.textSub, fontSize: 11, fontFamily: 'Poppins' }} axisLine={false} tickLine={false} />
                  <YAxis dataKey="team" type="category" tick={{ fill: C.text, fontSize: 11, fontFamily: 'Poppins' }} axisLine={false} tickLine={false} width={130} />
                  <Tooltip content={<CT />} cursor={{ fill: C.accent + '08' }} />
                  <Bar dataKey="count" name="Processes" radius={[0, 6, 6, 0]}>
                    {channelBarData.map((e, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    <LabelList dataKey="count" position="right" style={{ fill: C.textSub, fontSize: 10, fontFamily: 'Poppins', fontWeight: 600 }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          <ChartCard title="BVS Composition">
            {(bvs.bvs + bvs.nonBvs) === 0 ? (
              <div style={{ padding: 40, color: C.textSub, fontFamily: 'Poppins,sans-serif', fontSize: 13 }}>No data</div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={bvsPieData} dataKey="value" nameKey="name" cx="50%" cy="50%"
                       outerRadius={95} innerRadius={55} paddingAngle={3}
                       label={renderPieLabel} labelLine={false}>
                    {bvsPieData.map((e, i) => <Cell key={i} fill={e.fill} />)}
                  </Pie>
                  <Tooltip content={<CT />} />
                  <Legend wrapperStyle={{ fontSize: 11, fontFamily: 'Poppins', paddingTop: 8 }} formatter={pieLegendFormatter} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        </div>

        {/* ── Row 3: TAT distribution ───────────────────────────────────────── */}
        <ChartCard
          title="TAT Distribution"
          action={
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <Sel label="Team" value={effectiveTatTeam} onChange={setTatTeam} options={tatTeams.length ? tatTeams : ['—']} />
              <ToggleGroup value={tatView} onChange={setTatView} />
            </div>
          }
        >
          {tatRows.length === 0 ? (
            <div style={{ padding: 40, color: C.textSub, fontFamily: 'Poppins,sans-serif', fontSize: 13 }}>No data for this team</div>
          ) : tatView === 'table' ? (
            <div className="cjo-scroll-x">
              <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'Poppins,sans-serif' }}>
                <thead>
                  <tr>
                    <th style={th}>Bucket</th>
                    {TAT_MONTHS.map(m => (
                      <th key={m} style={{ ...th, textAlign: 'right', fontWeight: m === 'YTD' ? 700 : 600, color: m === 'YTD' ? C.text : C.textSub }}>{m}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tatRows.map(row => (
                    <tr key={row.bucket}>
                      <td style={{ ...td, fontWeight: 500 }}>{row.bucket}</td>
                      {TAT_MONTHS.map(m => (
                        <td key={m} style={{
                          ...td,
                          textAlign: 'right',
                          fontWeight: m === 'YTD' ? 700 : 500,
                          background: tintColor(row[m], tatMax),
                        }}>
                          {row[m].toLocaleString()}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={tatChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.gridLine} vertical={false} />
                <XAxis dataKey="month" tick={{ fill: C.textSub, fontSize: 11, fontFamily: 'Poppins' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: C.textSub, fontSize: 11, fontFamily: 'Poppins' }} axisLine={false} tickLine={false} />
                <Tooltip content={<CT />} cursor={{ fill: C.accent + '08' }} />
                <Legend wrapperStyle={{ fontSize: 10, fontFamily: 'Poppins', paddingTop: 8 }} />
                {tatRows.map((row, i) => (
                  <Bar key={row.bucket} dataKey={row.bucket} stackId="tat" fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* ── Row 4: Team Member productivity ───────────────────────────────── */}
        <div style={{ marginTop: 16 }}>
          <ChartCard
            title="Team Member Productivity — New vs Revamp"
            action={<ToggleGroup value={prodView} onChange={setProdView} />}
          >
            {prodGrid.length === 0 ? (
              <div style={{ padding: 40, color: C.textSub, fontFamily: 'Poppins,sans-serif', fontSize: 13 }}>No data</div>
            ) : prodView === 'table' ? (
              <div className="cjo-scroll-x">
                <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'Poppins,sans-serif' }}>
                  <thead>
                    <tr>
                      <th style={th} rowSpan={2}>Team Member</th>
                      {PROD_MONTHS.map(m => (
                        <th key={m} colSpan={2} style={{
                          ...th, textAlign: 'center',
                          fontWeight: m === 'YTD' ? 700 : 600,
                          color: m === 'YTD' ? C.text : C.textSub,
                          borderLeft: `1px solid ${C.cardBorder}`,
                        }}>{m}</th>
                      ))}
                    </tr>
                    <tr>
                      {PROD_MONTHS.flatMap(m => [
                        <th key={`${m}-n`} style={{ ...th, textAlign: 'right', textTransform: 'none', fontSize: 10, borderLeft: `1px solid ${C.cardBorder}` }}>New</th>,
                        <th key={`${m}-r`} style={{ ...th, textAlign: 'right', textTransform: 'none', fontSize: 10 }}>Revamp</th>,
                      ])}
                    </tr>
                  </thead>
                  <tbody>
                    {prodGrid.map(row => (
                      <tr key={row.teamMember}>
                        <td style={{ ...td, fontWeight: 500 }}>{row.teamMember}</td>
                        {PROD_MONTHS.flatMap(m => [
                          <td key={`${m}-n`} style={{
                            ...td, textAlign: 'right',
                            fontWeight: m === 'YTD' ? 700 : 500,
                            background: tintColor(row[`${m}_new`], prodMax),
                            borderLeft: `1px solid ${C.cardBorder}`,
                          }}>{row[`${m}_new`].toLocaleString()}</td>,
                          <td key={`${m}-r`} style={{
                            ...td, textAlign: 'right',
                            fontWeight: m === 'YTD' ? 700 : 500,
                            background: tintColor(row[`${m}_revamp`], prodMax),
                          }}>{row[`${m}_revamp`].toLocaleString()}</td>,
                        ])}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(220, prodChartData.length * 50)}>
                <BarChart data={prodChartData} layout="vertical" barSize={20}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.gridLine} horizontal={false} />
                  <XAxis type="number" tick={{ fill: C.textSub, fontSize: 11, fontFamily: 'Poppins' }} axisLine={false} tickLine={false} />
                  <YAxis dataKey="teamMember" type="category" tick={{ fill: C.text, fontSize: 11, fontFamily: 'Poppins' }} axisLine={false} tickLine={false} width={100} />
                  <Tooltip content={<CT />} cursor={{ fill: C.accent + '08' }} />
                  <Legend wrapperStyle={{ fontSize: 11, fontFamily: 'Poppins', paddingTop: 8 }} />
                  <Bar dataKey="New"    stackId="ytd" fill={C.accent}  radius={[0, 0, 0, 0]}>
                    <LabelList dataKey="New"    position="insideLeft"  style={{ fill: '#fff', fontSize: 10, fontFamily: 'Poppins', fontWeight: 600 }} />
                  </Bar>
                  <Bar dataKey="Revamp" stackId="ytd" fill={C.accent3} radius={[0, 6, 6, 0]}>
                    <LabelList dataKey="Revamp" position="insideRight" style={{ fill: '#fff', fontSize: 10, fontFamily: 'Poppins', fontWeight: 600 }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        </div>

      </div>
    </>
  );
}
