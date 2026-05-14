// Standardization — source toggle + KPI row + filters + chart cards + detailed stats table.

import { useMemo, useState } from 'react';
import {
  BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ComposedChart, Line, LabelList,
} from 'recharts';
import { useDashboardDataWithFallback } from '../../hooks/useDashboardDataWithFallback.js';
import { KpiCard } from '../components/KpiCard.jsx';
import { Pill, StaleBanner } from '../components/primitives.jsx';
import { ChartFrame, NUTooltip } from '../components/ChartFrame.jsx';
import { DonutChart } from '../components/DonutChart.jsx';
import { FilterRow, Filter, SourceToggle } from '../components/Filters.jsx';
import { axisProps, gridProps, chartColors, chartMargins } from '../lib/chartTheme.js';
import { cnt, toBarData, fmt, fmt1, normalizeQuery, pct, rowMatchesSearch, uniqueSorted } from '../lib/utils.js';

const FALLBACK = { bau: [], jlv: [] };

export function StandardizationView({ globalPeriodRange, syncTick, search }) {
  const live = useDashboardDataWithFallback('std', FALLBACK, syncTick);
  const data = live.rows ?? FALLBACK;
  const bauRows = data.bau ?? [];
  const jlvRows = data.jlv ?? [];
  const colors = chartColors();

  const [dataSource, setDataSource] = useState('BAU');
  const [segment, setSegment]       = useState('All');
  const [assignedTo, setAssignedTo] = useState('All');
  const [assignedBy, setAssignedBy] = useState('All');
  const [uatType, setUatType]       = useState('All');
  const [env, setEnv]               = useState('All');

  const isBau = dataSource === 'BAU';
  const sourceLabel = isBau ? 'Business as Usual' : 'Jazz Lifestyle Ventures';
  const activeRaw = isBau ? bauRows : jlvRows;
  const query = normalizeQuery(search);
  const searchedRaw = useMemo(() => activeRaw.filter((d) => rowMatchesSearch(d, [
    'uat_name',
    'environment',
    'planned',
    'new_existing',
    'segment',
    'assigned_to',
    'assigned_by',
    'uat_type',
    'month',
    'channel',
    'uat_status',
    'platform',
    'app_variant',
    'build_number',
    'product',
  ], query)), [activeRaw, query]);

  const handleSwitch = (src) => {
    setDataSource(src);
    setSegment('All'); setAssignedTo('All'); setAssignedBy('All');
    setUatType('All'); setEnv('All');
  };

  const segments    = ['All', ...uniqueSorted(activeRaw.map((d) => d.segment))];
  const assignedTos = ['All', ...uniqueSorted(activeRaw.map((d) => d.assigned_to))];
  const assignedBys = ['All', ...uniqueSorted(activeRaw.map((d) => d.assigned_by).filter((v) => v !== 'JLV'))];

  const filtered = useMemo(() => searchedRaw.filter((d) =>
    globalPeriodRange(d.period) &&
    (segment    === 'All' || d.segment    === segment) &&
    (assignedTo === 'All' || d.assigned_to === assignedTo) &&
    (assignedBy === 'All' || d.assigned_by === assignedBy) &&
    (uatType    === 'All' || d.uat_type    === uatType) &&
    (env        === 'All' || d.environment === env)
  ), [searchedRaw, globalPeriodRange, segment, assignedTo, assignedBy, uatType, env]);

  const totalUATs   = filtered.length;
  const totalManned = filtered.reduce((s, d) => s + (d.total_manned || 0), 0);
  const totalCases  = filtered.reduce((s, d) => s + (d.total_cases || 0), 0);
  const totalPass   = filtered.reduce((s, d) => s + (d.pass_cases || 0), 0);
  const issuesH     = filtered.reduce((s, d) => s + (d.issues_highlighted || 0), 0);
  const issuesF     = filtered.reduce((s, d) => s + (d.issues_fixed || 0), 0);
  const successRatio = pct(totalPass, totalCases, 1);
  const fixRate      = pct(issuesF, issuesH, 0);

  const monthlyData = ['January', 'February', 'March'].map((m) => {
    const sub = filtered.filter((d) => d.month === m);
    return {
      month: m.substring(0, 3),
      uats:     sub.length,
      manned:   sub.reduce((s, d) => s + (d.total_manned || 0), 0),
      issues_h: sub.reduce((s, d) => s + (d.issues_highlighted || 0), 0),
      issues_f: sub.reduce((s, d) => s + (d.issues_fixed || 0), 0),
    };
  });

  const assignedByData = toBarData(cnt(filtered, 'assigned_by')).map((d, i) => ({ ...d, fill: colors.palette[i % colors.palette.length] }));
  const segmentData    = toBarData(cnt(filtered, 'segment')).map((d, i) => ({ ...d, fill: colors.palette[i % colors.palette.length] }));
  const plannedData    = toBarData(cnt(filtered, 'planned')).map((d, i) => ({
    ...d,
    fill: i === 0 ? colors.accent : colors.palette[(i % (colors.palette.length - 1)) + 1],
  }));
  const channelData    = toBarData(cnt(filtered.filter((d) => d.channel), 'channel')).slice(0, 10);
  const statusData     = toBarData(cnt(filtered, 'uat_status')).map((d, i) => ({ ...d, fill: colors.palette[i % colors.palette.length] }));

  const individualData = Object.entries(cnt(filtered, 'assigned_to'))
    .sort((a, b) => b[1] - a[1])
    .map(([name, uats]) => {
      const sub = filtered.filter((d) => d.assigned_to === name);
      return {
        name,
        uats,
        cases:  sub.reduce((s, d) => s + (d.total_cases || 0), 0),
        pass:   sub.reduce((s, d) => s + (d.pass_cases || 0), 0),
        issues: sub.reduce((s, d) => s + (d.issues_highlighted || 0), 0),
      };
    });

  const detailRows = Object.entries(cnt(filtered, 'assigned_to'))
    .sort((a, b) => b[1] - a[1])
    .map(([name, total]) => {
      const sub = filtered.filter((d) => d.assigned_to === name);
      const cases    = sub.reduce((s, d) => s + (d.total_cases || 0), 0);
      const pass     = sub.reduce((s, d) => s + (d.pass_cases || 0), 0);
      const failed   = sub.reduce((s, d) => s + (d.failed_cases || 0), 0);
      const dIssuesH = sub.reduce((s, d) => s + (d.issues_highlighted || 0), 0);
      const dIssuesF = sub.reduce((s, d) => s + (d.issues_fixed || 0), 0);
      const manned   = sub.reduce((s, d) => s + (d.total_manned || 0), 0);
      const planned   = sub.filter((d) => d.planned === 'Planned').length;
      const unplanned = sub.filter((d) => d.planned === 'Unplanned').length;
      const dayUATs   = sub.filter((d) => d.uat_type === 'Day').length;
      const nightUATs = sub.filter((d) => d.uat_type === 'Night').length;
      const successPct = cases > 0 ? ((pass / cases) * 100).toFixed(1) : '0.0';
      const rowFixRate = dIssuesH > 0 ? Math.round((dIssuesF / dIssuesH) * 100) : 100;
      return { name, total, planned, unplanned, dayUATs, nightUATs, manned, cases, pass, failed, issuesH: dIssuesH, issuesF: dIssuesF, successPct, fixRate: rowFixRate };
    });

  const dt = detailRows.reduce((acc, r) => ({
    total: acc.total + r.total, planned: acc.planned + r.planned, unplanned: acc.unplanned + r.unplanned,
    dayUATs: acc.dayUATs + r.dayUATs, nightUATs: acc.nightUATs + r.nightUATs,
    manned: acc.manned + r.manned, cases: acc.cases + r.cases,
    pass: acc.pass + r.pass, failed: acc.failed + r.failed,
    issuesH: acc.issuesH + r.issuesH, issuesF: acc.issuesF + r.issuesF,
  }), { total:0, planned:0, unplanned:0, dayUATs:0, nightUATs:0, manned:0, cases:0, pass:0, failed:0, issuesH:0, issuesF:0 });
  const tFix  = dt.issuesH > 0 ? Math.round((dt.issuesF / dt.issuesH) * 100) : 100;
  const tSucc = dt.cases   > 0 ? ((dt.pass / dt.cases) * 100).toFixed(1) : '0.0';

  return (
    <section className="nu-page">
      <header className="nu-page__head">
        <div className="nu-page__heading">
          <h1>Product Optimization</h1>
          <p>UAT activity, issue resolution, and individual contribution across {sourceLabel}.</p>
        </div>
        <div className="nu-page__actions">
          <SourceToggle
            value={dataSource}
            options={[
              { key: 'BAU', label: 'Business as Usual' },
              { key: 'JLV', label: 'Jazz Lifestyle Ventures' },
            ]}
            onChange={handleSwitch}
          />
        </div>
      </header>

      <StaleBanner status={live.sheetStatus} />

      <div className="nu-kpi-row">
        <div className="nu-rise" data-i="0">
          <KpiCard label="Total UATs" value={totalUATs} sub={`${uniqueSorted(filtered.map((d) => d.assigned_to)).length} active resources`} filled />
        </div>
        <div className="nu-rise" data-i="1">
          <KpiCard label="Manned Hours" value={`${fmt1(totalManned)} hrs`} sub={`${totalUATs} UATs logged`} />
        </div>
        <div className="nu-rise" data-i="2">
          <KpiCard label="Success Ratio" value={`${successRatio}%`} sub={`${totalPass}/${totalCases} passed`} />
        </div>
        <div className="nu-rise" data-i="3">
          <KpiCard label="Issues Highlighted" value={issuesH} sub="Raised during UAT" />
        </div>
        <div className="nu-rise" data-i="4">
          <KpiCard label="Issues Fixed" value={issuesF} sub={`Fix rate: ${fixRate}%`} />
        </div>
        <div className="nu-rise" data-i="5">
          <KpiCard label="Test Cases" value={totalCases} sub={`${totalPass} passed`} />
        </div>
      </div>

      <FilterRow onReset={() => { setSegment('All'); setAssignedTo('All'); setAssignedBy('All'); setUatType('All'); setEnv('All'); }}>
        <Filter label="Segment"     value={segment}    options={segments}    onChange={setSegment} />
        <Filter label="Assigned to" value={assignedTo} options={assignedTos} onChange={setAssignedTo} />
        {isBau && <Filter label="Assigned by" value={assignedBy} options={assignedBys} onChange={setAssignedBy} />}
        <Filter label="UAT type"    value={uatType}    options={['All', 'Day', 'Night']}    onChange={setUatType} />
        <Filter label="Environment" value={env}        options={['All', 'Live', 'Staging']} onChange={setEnv} />
      </FilterRow>

      <div className="nu-grid">
        <ChartFrame
          title="Month over month"
          caption="UAT count and manned hours"
          empty={monthlyData.every((m) => m.uats === 0)}
          legend={[
            { label: 'UATs',         color: colors.accent },
            { label: 'Manned hours', color: colors.ink },
          ]}
        >
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart
              data={monthlyData}
              barCategoryGap={30}
              margin={chartMargins('composed')}
              accessibilityLayer
              aria-label="Monthly UAT count with manned hours trend"
            >
              <CartesianGrid {...gridProps(colors)} />
              <XAxis dataKey="month" {...axisProps(colors, { side: 'x' })} />
              <YAxis yAxisId="left"  {...axisProps(colors, { side: 'y', minimal: true })} />
              <YAxis yAxisId="right" orientation="right" {...axisProps(colors, { side: 'y', minimal: true })} />
              <Tooltip content={<NUTooltip />} cursor={{ fill: colors.cursor }} />
              <Bar yAxisId="left" dataKey="uats" name="UATs" fill={colors.accent} barSize={30} radius={[12, 12, 4, 4]}>
                <LabelList dataKey="uats" position="top" style={{ fill: colors.ink3, fontSize: 10, fontFamily: 'JetBrains Mono, monospace', fontWeight: 700 }} />
              </Bar>
              <Line
                yAxisId="right"
                dataKey="manned"
                name="Manned hours"
                stroke={colors.ink}
                strokeWidth={3.5}
                dot={{ fill: colors.surface, stroke: colors.ink, strokeWidth: 2.5, r: 4 }}
                activeDot={{ fill: colors.ink, stroke: colors.surface, strokeWidth: 3, r: 6 }}
                type="monotone"
              >
                <LabelList dataKey="manned" position="top" offset={12} style={{ fill: colors.ink3, fontSize: 10, fontFamily: 'JetBrains Mono, monospace', fontWeight: 700 }} />
              </Line>
            </ComposedChart>
          </ResponsiveContainer>
        </ChartFrame>

        <ChartFrame
          title="Issues — raised vs fixed"
          caption="By month"
          empty={monthlyData.every((m) => m.issues_h === 0 && m.issues_f === 0)}
          legend={[
            { label: 'Raised', color: colors.warning },
            { label: 'Fixed',  color: colors.positive },
          ]}
        >
          <ResponsiveContainer width="100%" height={280}>
            <BarChart
              data={monthlyData}
              barCategoryGap={26}
              barGap={8}
              margin={chartMargins()}
              accessibilityLayer
              aria-label="Monthly issues raised compared with issues fixed"
            >
              <CartesianGrid {...gridProps(colors)} />
              <XAxis dataKey="month" {...axisProps(colors, { side: 'x' })} />
              <YAxis {...axisProps(colors, { side: 'y', minimal: true })} />
              <Tooltip content={<NUTooltip />} cursor={{ fill: colors.cursor }} />
              <Bar dataKey="issues_h" name="Raised" fill={colors.warning}  barSize={26} radius={[12, 12, 4, 4]}>
                <LabelList dataKey="issues_h" position="top" style={{ fill: colors.ink3, fontSize: 10, fontFamily: 'JetBrains Mono, monospace', fontWeight: 700 }} />
              </Bar>
              <Bar dataKey="issues_f" name="Fixed"  fill={colors.positive} barSize={26} radius={[12, 12, 4, 4]}>
                <LabelList dataKey="issues_f" position="top" style={{ fill: colors.ink3, fontSize: 10, fontFamily: 'JetBrains Mono, monospace', fontWeight: 700 }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartFrame>
      </div>

      <div className="nu-grid nu-grid--full" style={{ marginTop: 14 }}>
        <ChartFrame
          title="Assigned by"
          caption={`${assignedByData.length} contributors`}
          empty={assignedByData.length === 0}
        >
          <ResponsiveContainer width="100%" height={Math.max(240, assignedByData.length * 30)}>
            <BarChart
              data={assignedByData}
              layout="vertical"
              barCategoryGap={12}
              margin={chartMargins('vertical')}
              accessibilityLayer
              aria-label="UAT contributors by assigned-by"
            >
              <CartesianGrid {...gridProps(colors)} horizontal={false} vertical />
              <XAxis type="number" {...axisProps(colors, { side: 'x', minimal: true })} />
              <YAxis type="category" dataKey="name" width={120}
                     tick={{ fill: colors.ink2, fontSize: 11, fontFamily: 'Geist, sans-serif' }}
                     axisLine={false} tickLine={false} />
              <Tooltip content={<NUTooltip />} cursor={{ fill: colors.cursor }} />
              <Bar dataKey="value" name="UATs" barSize={18} radius={[0, 10, 10, 0]}>
                {assignedByData.map((_, i) => (
                  <Cell key={i} fill={i === 0 ? colors.accent : colors.ink} />
                ))}
                <LabelList dataKey="value" position="right" style={{ fill: colors.ink3, fontSize: 10, fontFamily: 'JetBrains Mono, monospace' }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartFrame>
      </div>

      <div className="nu-grid nu-grid--3" style={{ marginTop: 14 }}>
        <ChartFrame
          title="Segment-wise UATs"
          caption={`${segmentData.length} segments`}
          empty={segmentData.length === 0}
        >
          <DonutChart
            data={segmentData}
            colors={colors}
            ariaLabel="UAT distribution by segment"
            totalLabel="total"
          />
        </ChartFrame>

        <ChartFrame
          title="Type of change"
          caption="Planned vs unplanned"
          empty={plannedData.length === 0}
        >
          <DonutChart
            data={plannedData}
            colors={colors}
            ariaLabel="UAT type of change distribution"
            primaryName="Planned"
            totalLabel="total"
          />
        </ChartFrame>

        <ChartFrame
          title="UAT status"
          caption={`${statusData.length} states`}
          empty={statusData.length === 0}
        >
          <DonutChart
            data={statusData}
            colors={colors}
            ariaLabel="UAT status distribution"
            totalLabel="total"
          />
        </ChartFrame>
      </div>

      <div className="nu-grid">
        <ChartFrame
          title="Individual performance"
          caption="Stacked: UATs · Issues raised"
          empty={individualData.length === 0}
          legend={[
            { label: 'UATs',   color: colors.accent },
            { label: 'Issues', color: colors.warning },
          ]}
        >
          <ResponsiveContainer width="100%" height={Math.max(240, individualData.length * 32)}>
            <BarChart
              data={individualData}
              layout="vertical"
              barCategoryGap={12}
              margin={chartMargins('vertical')}
              accessibilityLayer
              aria-label="Individual UAT volume stacked with issues raised"
            >
              <CartesianGrid {...gridProps(colors)} horizontal={false} vertical />
              <XAxis type="number" {...axisProps(colors, { side: 'x', minimal: true })} />
              <YAxis type="category" dataKey="name" width={110}
                     tick={{ fill: colors.ink2, fontSize: 11, fontFamily: 'Geist, sans-serif' }}
                     axisLine={false} tickLine={false} />
              <Tooltip content={<NUTooltip />} cursor={{ fill: colors.cursor }} />
              <Bar dataKey="uats" name="UATs" stackId="a" fill={colors.accent} barSize={18} radius={[10, 0, 0, 10]}>
                <LabelList dataKey="uats" position="insideLeft" style={{ fill: colors.surface, fontSize: 9.5, fontFamily: 'JetBrains Mono, monospace', fontWeight: 700 }} />
              </Bar>
              <Bar dataKey="issues" name="Issues" stackId="a" fill={colors.warning} barSize={18} radius={[0, 10, 10, 0]}>
                <LabelList dataKey="issues" position="right" style={{ fill: colors.ink3, fontSize: 9.5, fontFamily: 'JetBrains Mono, monospace' }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartFrame>

        <ChartFrame
          title="Channel distribution"
          caption={`Top ${Math.min(channelData.length, 10)}`}
          empty={channelData.length === 0}
        >
          <ResponsiveContainer width="100%" height={Math.max(240, channelData.length * 28)}>
            <BarChart
              data={channelData}
              layout="vertical"
              barCategoryGap={12}
              margin={chartMargins('vertical')}
              accessibilityLayer
              aria-label="UAT channel distribution"
            >
              <CartesianGrid {...gridProps(colors)} horizontal={false} vertical />
              <XAxis type="number" {...axisProps(colors, { side: 'x', minimal: true })} />
              <YAxis type="category" dataKey="name" width={110}
                     tick={{ fill: colors.ink2, fontSize: 10.5, fontFamily: 'Geist, sans-serif' }}
                     axisLine={false} tickLine={false} />
              <Tooltip content={<NUTooltip />} cursor={{ fill: colors.cursor }} />
              <Bar dataKey="value" name="UATs" fill={colors.ink} barSize={18} radius={[0, 10, 10, 0]}>
                <LabelList dataKey="value" position="right" style={{ fill: colors.ink3, fontSize: 9.5, fontFamily: 'JetBrains Mono, monospace' }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartFrame>
      </div>

      <div className="nu-grid nu-grid--full" style={{ marginTop: 14 }}>
        <ChartFrame
          title={`Resource detail — ${sourceLabel}`}
          caption={`${detailRows.length} contributors`}
          empty={detailRows.length === 0}
        >
          <div className="nu-table-wrap">
            <table className="nu-table" style={{ minWidth: 1080 }}>
              <thead>
                <tr>
                  <th>Resource</th>
                  <th style={{ textAlign: 'right' }}>Total</th>
                  <th style={{ textAlign: 'right' }} className="nu-mute">Planned</th>
                  <th style={{ textAlign: 'right' }} className="nu-mute">Unplanned</th>
                  <th style={{ textAlign: 'right' }} className="nu-mute">Day</th>
                  <th style={{ textAlign: 'right' }} className="nu-mute">Night</th>
                  <th style={{ textAlign: 'right' }}>Hours</th>
                  <th style={{ textAlign: 'right' }}>Cases</th>
                  <th style={{ textAlign: 'right' }} className="nu-mute">Pass</th>
                  <th style={{ textAlign: 'right' }} className="nu-mute">Failed</th>
                  <th style={{ textAlign: 'right' }} className="nu-mute">Raised</th>
                  <th style={{ textAlign: 'right' }} className="nu-mute">Fixed</th>
                  <th style={{ textAlign: 'right' }}>Fix rate</th>
                  <th style={{ textAlign: 'right' }}>Success</th>
                </tr>
              </thead>
              <tbody>
                {detailRows.map((row) => (
                  <tr key={row.name}>
                    <td className="nu-strong">{row.name}</td>
                    <td className="nu-num nu-strong">{fmt(row.total)}</td>
                    <td className="nu-num nu-mute">{row.planned}</td>
                    <td className="nu-num nu-mute">{row.unplanned}</td>
                    <td className="nu-num nu-mute">{row.dayUATs}</td>
                    <td className="nu-num nu-mute">{row.nightUATs}</td>
                    <td className="nu-num">{fmt1(row.manned)}</td>
                    <td className="nu-num">{row.cases}</td>
                    <td className="nu-num nu-mute">{row.pass}</td>
                    <td className="nu-num nu-mute" style={{ color: row.failed > 0 ? 'var(--nu-negative)' : undefined }}>{row.failed}</td>
                    <td className="nu-num nu-mute">{row.issuesH}</td>
                    <td className="nu-num nu-mute">{row.issuesF}</td>
                    <td className="nu-num">
                      <Pill tone={Number(row.fixRate) >= 80 ? 'positive' : Number(row.fixRate) >= 50 ? 'warning' : 'negative'}>{row.fixRate}%</Pill>
                    </td>
                    <td className="nu-num">
                      <Pill tone={Number(row.successPct) >= 90 ? 'positive' : Number(row.successPct) >= 70 ? 'warning' : 'negative'}>{row.successPct}%</Pill>
                    </td>
                  </tr>
                ))}
                {detailRows.length > 0 && (
                  <tr className="nu-table__total">
                    <td className="nu-strong">Total</td>
                    <td className="nu-num">{fmt(dt.total)}</td>
                    <td className="nu-num">{dt.planned}</td>
                    <td className="nu-num">{dt.unplanned}</td>
                    <td className="nu-num">{dt.dayUATs}</td>
                    <td className="nu-num">{dt.nightUATs}</td>
                    <td className="nu-num">{fmt1(dt.manned)}</td>
                    <td className="nu-num">{dt.cases}</td>
                    <td className="nu-num">{dt.pass}</td>
                    <td className="nu-num" style={{ color: dt.failed > 0 ? 'var(--nu-negative)' : undefined }}>{dt.failed}</td>
                    <td className="nu-num">{dt.issuesH}</td>
                    <td className="nu-num">{dt.issuesF}</td>
                    <td className="nu-num"><Pill tone="positive">{tFix}%</Pill></td>
                    <td className="nu-num"><Pill tone="positive">{tSucc}%</Pill></td>
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
