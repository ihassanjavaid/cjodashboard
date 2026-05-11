// Design & Usability — KPI row + filters + chart cards + records table.

import { useEffect, useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ComposedChart, Line, LabelList, Cell,
} from 'recharts';
import { useDashboardDataWithFallback } from '../../hooks/useDashboardDataWithFallback.js';
import { KpiCard } from '../components/KpiCard.jsx';
import { Pill, StaleBanner } from '../components/primitives.jsx';
import { ChartFrame, NUTooltip } from '../components/ChartFrame.jsx';
import { DonutChart } from '../components/DonutChart.jsx';
import { FilterRow, Filter, ViewToggle } from '../components/Filters.jsx';
import { axisProps, gridProps, chartColors, chartMargins } from '../lib/chartTheme.js';
import {
  cnt,
  fmt,
  MONTH_ORDER,
  normalizeName,
  normalizeQuery,
  personKey,
  personLabel,
  rowMatchesSearch,
  toBarData,
  uniqueSorted,
  firstWord,
} from '../lib/utils.js';

const FALLBACK = [];

export function DesignView({ globalPeriodRange, syncTick, search }) {
  const { rows, sheetStatus } = useDashboardDataWithFallback('design', FALLBACK, syncTick);
  const designRows = rows ?? FALLBACK;
  const colors = chartColors();

  const [person, setPerson]           = useState('All');
  const [type, setType]               = useState('All');
  const [stakeholder, setStakeholder] = useState('All');
  const [status, setStatus]           = useState('All');
  const query = normalizeQuery(search);

  // TEMP debug: log unique assigned_to values + their personKey on every fresh
  // data load, so we can see exactly what's flowing through the chart and
  // confirm the bundle is actually current. Remove once duplicates are gone.
  useEffect(() => {
    if (!designRows.length) return;
    const map = {};
    for (const d of designRows) {
      const k = personKey(d.assigned_to);
      const codes = String(d.assigned_to || '')
        .split('').map((c) => c.charCodeAt(0).toString(16).padStart(4, '0')).join(' ');
      if (!map[k]) map[k] = [];
      const entry = `"${d.assigned_to}" [${codes}]`;
      if (!map[k].includes(entry)) map[k].push(entry);
    }
    // eslint-disable-next-line no-console
    console.log('[DesignView] assigned_to grouped by personKey:', map);
  }, [designRows]);

  const searchedRows = useMemo(() => designRows.filter((d) => rowMatchesSearch(d, [
    'project',
    'assigned_to',
    'type',
    'stakeholder',
    'status',
    'month',
  ], query)), [designRows, query]);

  const filtered = useMemo(() => searchedRows.filter((d) =>
    globalPeriodRange(d.period) &&
    (person      === 'All' || personLabel(personKey(d.assigned_to)) === person) &&
    (type        === 'All' || d.type        === type) &&
    (stakeholder === 'All' || d.stakeholder === stakeholder) &&
    (status      === 'All' || d.status      === status)
  ), [searchedRows, globalPeriodRange, person, type, stakeholder, status]);

  const persons      = ['All', ...uniqueSorted([...new Set(designRows.map((d) => personLabel(personKey(d.assigned_to))).filter(Boolean))])];
  const types        = ['All', ...uniqueSorted(designRows.map((d) => d.type))];
  const stakeholders = ['All', ...uniqueSorted(designRows.map((d) => d.stakeholder))];

  const totalTasks      = filtered.length;
  const usabilityCount  = filtered.filter((d) => d.type === 'Usability').length;
  const expertCount     = filtered.filter((d) => d.type === 'Expert Analysis').length;
  const totalStudies    = usabilityCount + expertCount;
  const surveyCount     = filtered.filter((d) => d.type === 'Survey').length;
  const sentimentCount  = filtered.filter((d) => d.type === 'Sentiment Analysis').length;
  const pulseCount      = filtered.filter((d) => d.type === 'App Pulse Reporting').length;
  const completedCount  = filtered.filter((d) => d.status === 'Completed').length;
  const usabilityParticipants = filtered.filter((d) => d.type === 'Usability').reduce((s, d) => s + (d.count_users || 0), 0);
  const surveyUsers = filtered.filter((d) => d.type === 'Survey').reduce((s, d) => s + (d.count_users || 0), 0);
  const completionPct = totalTasks ? Math.round((completedCount / totalTasks) * 100) : 0;

  const typeData = toBarData(cnt(filtered, 'type'));

  // Group by personKey (first-word-of-name, lowercased, punctuation stripped)
  // so "Hasan", "hasan", "Hasan ", "Hasan A", "Hasan." all collapse into one
  // bar — robust against typos, hidden whitespace, and accidental last-name
  // additions in the sheet.
  const personData = Object.values(filtered.reduce((acc, d) => {
    const key = personKey(d.assigned_to);
    if (!key) return acc;
    if (!acc[key]) acc[key] = { name: personLabel(key), tasks: 0, usability: 0, surveys: 0, other: 0 };
    acc[key].tasks++;
    if (d.type === 'Usability')      acc[key].usability++;
    else if (d.type === 'Survey')    acc[key].surveys++;
    else                              acc[key].other++;
    return acc;
  }, {})).sort((a, b) => b.tasks - a.tasks);

  const EXCLUDED = ['Survey', 'CFL', 'VOC'];
  const stakeholderData = toBarData(
    cnt(filtered.filter((d) => d.stakeholder && !EXCLUDED.includes(d.stakeholder)), 'stakeholder')
  ).slice(0, 10);
  const statusData = toBarData(cnt(filtered, 'status'));
  const statusDonutData = statusData.map((d) => ({
    ...d,
    fill: d.name === 'Completed' ? colors.positive : d.name === 'In Progress' ? colors.warning : colors.ink4,
  }));

  const monthsInData = MONTH_ORDER.filter((m) => filtered.some((d) => d.month === m));
  const monthData = monthsInData.map((m) => {
    const sub = filtered.filter((d) => d.month === m);
    return {
      month: m.substring(0, 3),
      tasks: sub.length,
      completed: sub.filter((d) => d.status === 'Completed').length,
    };
  });
  const participantsSummary = [
    { name: 'Usability participants', value: usabilityParticipants, fill: colors.palette[1] },
    { name: 'Survey respondents', value: surveyUsers, fill: colors.positive },
  ];
  const participantMonthData = monthsInData.map((m) => {
    const sub = filtered.filter((d) => d.month === m);
    return {
      month: m.substring(0, 3),
      usability_participants: sub.filter((d) => d.type === 'Usability').reduce((s, d) => s + (d.count_users || 0), 0),
      survey_users: sub.filter((d) => d.type === 'Survey').reduce((s, d) => s + (d.count_users || 0), 0),
    };
  });

  const personMax = Math.max(1, ...personData.map((d) => d.tasks));

  // Tables — search prop from topbar narrows project list.
  const [recordsTab, setRecordsTab] = useState('surveys');
  const surveyList = filtered
    .filter((d) => d.type === 'Survey')
    .map((d) => ({ project: d.project, assigned_to: normalizeName(d.assigned_to), month: d.month, respondents: d.count_users ?? 0 }));
  const usabilityList = filtered
    .filter((d) => d.type === 'Usability')
    .map((d) => ({ project: d.project, assigned_to: normalizeName(d.assigned_to), month: d.month, participants: d.count_users ?? 0 }));

  const surveysShown    = surveyList;
  const usabilityShown  = usabilityList;
  const searchSuffix = query ? ` matching "${search.trim()}"` : '';

  return (
    <section className="nu-page">
      <header className="nu-page__head">
        <div className="nu-page__heading">
          <h1>Design & Usability</h1>
          <p>Plan, prioritize, and track every research and design task across the portfolio.</p>
        </div>
      </header>

      <StaleBanner status={sheetStatus} />

      {/* KPI row — one filled hero */}
      <div className="nu-kpi-row">
        <div className="nu-rise" data-i="0">
          <KpiCard
            label="Total tasks"
            value={totalTasks}
            sub={`${completionPct}% completed this period`}
            filled
          />
        </div>
        <div className="nu-rise" data-i="1">
          <KpiCard
            label="Total studies"
            value={totalStudies}
            sub={`${usabilityCount} usability · ${expertCount} expert`}
          />
        </div>
        <div className="nu-rise" data-i="2">
          <KpiCard
            label="Surveys"
            value={surveyCount}
            sub={`${fmt(surveyUsers)} respondents`}
          />
        </div>
        <div className="nu-rise" data-i="3">
          <KpiCard
            label="Sentiment Analysis"
            value={sentimentCount}
            sub={`Avg. ${Math.round(sentimentCount / ([...new Set(filtered.map((d) => d.month))].length || 1))} / month`}
          />
        </div>
        <div className="nu-rise" data-i="4">
          <KpiCard
            label="Pulse Reports"
            value={pulseCount}
            sub={`Avg. ${Math.round(pulseCount / ([...new Set(filtered.map((d) => d.month))].length || 1))} / month`}
          />
        </div>
      </div>

      <FilterRow onReset={() => { setPerson('All'); setType('All'); setStakeholder('All'); setStatus('All'); }}>
        <Filter label="Resource"     value={person}      options={persons}      onChange={setPerson} />
        <Filter label="Type"         value={type}        options={types}        onChange={setType} />
        <Filter label="Stakeholder"  value={stakeholder} options={stakeholders} onChange={setStakeholder} />
        <Filter label="Status"       value={status}      options={['All', 'Completed', 'In Progress']} onChange={setStatus} />
      </FilterRow>

      {/* Row 1: month over month + by type */}
      <div className="nu-grid nu-grid--3">
        <ChartFrame
          title="Task throughput"
          caption="Total · Completed by month"
          empty={monthData.length === 0}
          legend={[
            { label: 'Total tasks', color: colors.ink4 },
            { label: 'Completed',   color: colors.accent },
          ]}
        >
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={monthData} barCategoryGap={24} barGap={8} margin={chartMargins()} accessibilityLayer aria-label="Monthly task throughput comparing total and completed tasks">
              <CartesianGrid {...gridProps(colors)} />
              <XAxis dataKey="month" {...axisProps(colors, { side: 'x' })} />
              <YAxis {...axisProps(colors, { side: 'y', minimal: true })} />
              <Tooltip content={<NUTooltip />} cursor={{ fill: colors.cursor }} />
              <Bar dataKey="tasks"     name="Total tasks" fill={colors.ink4}   barSize={28} radius={[12, 12, 4, 4]} />
              <Bar dataKey="completed" name="Completed"   fill={colors.accent} barSize={28} radius={[12, 12, 4, 4]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartFrame>

        <ChartFrame
          title="By type"
          caption={`${typeData.length} categories`}
          empty={typeData.length === 0}
        >
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={typeData} layout="vertical" barCategoryGap={12} margin={chartMargins('vertical')} accessibilityLayer aria-label="Tasks grouped by type">
              <CartesianGrid {...gridProps(colors)} horizontal={false} vertical />
              <XAxis type="number" {...axisProps(colors, { side: 'x', minimal: true })} />
              <YAxis type="category" dataKey="name" width={110}
                     tick={{ fill: colors.ink2, fontSize: 11, fontFamily: 'Geist, sans-serif' }}
                     axisLine={false} tickLine={false} />
              <Tooltip content={<NUTooltip />} cursor={{ fill: colors.cursor }} />
              <Bar dataKey="value" name="Tasks" barSize={18} radius={[0, 10, 10, 0]}>
                {typeData.map((_, i) => (
                  <Cell key={i} fill={i === 0 ? colors.accent : colors.ink3} />
                ))}
                <LabelList
                  dataKey="value"
                  position="right"
                  style={{ fill: colors.ink3, fontSize: 10, fontFamily: 'JetBrains Mono, monospace' }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartFrame>

        <ChartFrame
          title="Status breakdown"
          caption={`${statusData.length} states`}
          empty={statusData.length === 0}
        >
          <DonutChart
            data={statusDonutData}
            colors={colors}
            ariaLabel="Task status breakdown"
            primaryName="Completed"
            totalLabel="total"
            height={230}
          />
        </ChartFrame>
      </div>

      {/* Row 2: team performance + reach summary */}
      <div className="nu-grid">
        <ChartFrame
          title="Resource performance"
          caption="Stacked: Usability · Surveys · Other"
          empty={personData.length === 0}
          legend={[
            { label: 'Usability', color: colors.accent },
            { label: 'Surveys',   color: colors.palette[2] },
            { label: 'Other',     color: colors.ink4 },
          ]}
        >
          <div className="nu-bars">
            {personData.map((p, i) => (
              <div key={p.name} className="nu-bar nu-rise" data-i={Math.min(7, i)}>
                <span className="nu-bar__name" title={p.name}>{firstWord(p.name)}</span>
                <span className="nu-bar__track">
                  {[
                    { val: p.usability, color: colors.accent },
                    { val: p.surveys,   color: colors.palette[2] },
                    { val: p.other,     color: colors.ink4 },
                  ].filter((s) => s.val > 0).map((s, j) => {
                    const w = (s.val / personMax) * 100;
                    return (
                      <span key={j} className="nu-bar__seg" style={{ width: `${w}%`, background: s.color }}>
                        {w > 11 && s.val}
                      </span>
                    );
                  })}
                </span>
                <span className="nu-bar__total">{p.tasks}</span>
              </div>
            ))}
          </div>
        </ChartFrame>

        <ChartFrame
          title="Stakeholder requests"
          caption="Top 10 by task count"
          empty={stakeholderData.length === 0}
        >
          <ResponsiveContainer width="100%" height={Math.max(220, stakeholderData.length * 28)}>
            <BarChart data={stakeholderData} layout="vertical" barCategoryGap={12} margin={chartMargins('vertical')} accessibilityLayer aria-label="Top stakeholder requests by task count">
              <CartesianGrid {...gridProps(colors)} horizontal={false} vertical />
              <XAxis type="number" {...axisProps(colors, { side: 'x', minimal: true })} />
              <YAxis type="category" dataKey="name" width={92}
                     tick={{ fill: colors.ink2, fontSize: 10.5, fontFamily: 'Geist, sans-serif' }}
                     axisLine={false} tickLine={false} />
              <Tooltip content={<NUTooltip />} cursor={{ fill: colors.cursor }} />
              <Bar dataKey="value" name="Requests" fill={colors.ink} barSize={18} radius={[0, 10, 10, 0]}>
                <LabelList dataKey="value" position="right" style={{ fill: colors.ink3, fontSize: 10, fontFamily: 'JetBrains Mono, monospace' }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartFrame>
      </div>

      {/* Row 3: research reach */}
      <div className="nu-grid nu-grid--2" style={{ marginTop: 14 }}>
        <ChartFrame
          title="Usability participants vs survey respondents"
          caption="Research reach"
          empty={participantsSummary.every((d) => d.value === 0)}
          legend={participantsSummary.map((d) => ({ label: d.name, color: d.fill }))}
        >
          <ResponsiveContainer width="100%" height={240}>
            <BarChart
              data={participantsSummary}
              barCategoryGap={38}
              margin={chartMargins()}
              accessibilityLayer
              aria-label="Usability participants compared with survey respondents"
            >
              <CartesianGrid {...gridProps(colors)} />
              <XAxis dataKey="name" {...axisProps(colors, { side: 'x' })} tick={{ ...axisProps(colors, { side: 'x' }).tick, fontSize: 10 }} />
              <YAxis {...axisProps(colors, { side: 'y', minimal: true })} />
              <Tooltip content={<NUTooltip />} cursor={{ fill: colors.cursor }} />
              <Bar dataKey="value" name="Count" barSize={46} radius={[14, 14, 4, 4]}>
                {participantsSummary.map((entry) => (
                  <Cell key={entry.name} fill={entry.fill} />
                ))}
                <LabelList dataKey="value" position="top" style={{ fill: colors.ink3, fontSize: 10, fontFamily: 'JetBrains Mono, monospace', fontWeight: 700 }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartFrame>

        <ChartFrame
          title="Participants by month"
          caption="Usability participants · survey respondents"
          empty={participantMonthData.every((d) => d.usability_participants === 0 && d.survey_users === 0)}
          legend={[
            { label: 'Usability participants', color: colors.palette[1] },
            { label: 'Survey respondents', color: colors.positive },
          ]}
        >
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart
              data={participantMonthData}
              barCategoryGap={28}
              margin={chartMargins('composed')}
              accessibilityLayer
              aria-label="Participants and survey respondents by month"
            >
              <CartesianGrid {...gridProps(colors)} />
              <XAxis dataKey="month" {...axisProps(colors, { side: 'x' })} />
              <YAxis {...axisProps(colors, { side: 'y', minimal: true })} />
              <Tooltip content={<NUTooltip />} cursor={{ fill: colors.cursor }} />
              <Bar dataKey="usability_participants" name="Usability participants" fill={colors.palette[1]} barSize={30} radius={[12, 12, 4, 4]}>
                <LabelList dataKey="usability_participants" position="top" style={{ fill: colors.ink3, fontSize: 10, fontFamily: 'JetBrains Mono, monospace', fontWeight: 700 }} />
              </Bar>
              <Line
                dataKey="survey_users"
                name="Survey respondents"
                stroke={colors.positive}
                strokeWidth={3.5}
                dot={{ fill: colors.surface, stroke: colors.positive, strokeWidth: 2.5, r: 4 }}
                activeDot={{ fill: colors.positive, stroke: colors.surface, strokeWidth: 3, r: 6 }}
                type="monotone"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartFrame>
      </div>

      {/* Records — tabs inside one card */}
      <div className="nu-grid nu-grid--full" style={{ marginTop: 14 }}>
        <ChartFrame
          title="Records"
          caption={recordsTab === 'surveys'
            ? `${surveysShown.length} surveys${searchSuffix}`
            : `${usabilityShown.length} studies${searchSuffix}`}
          action={
            <ViewToggle
              value={recordsTab}
              onChange={setRecordsTab}
              options={[
                { key: 'surveys', label: 'Surveys' },
                { key: 'usability', label: 'Studies' },
              ]}
            />
          }
          empty={recordsTab === 'surveys' ? surveysShown.length === 0 : usabilityShown.length === 0}
        >
          <div className="nu-table-wrap">
            <table className="nu-table">
              <thead>
                <tr>
                  <th>{recordsTab === 'surveys' ? 'Survey' : 'Study'}</th>
                  <th>Resource</th>
                  <th>Month</th>
                  <th style={{ textAlign: 'right' }}>{recordsTab === 'surveys' ? 'Respondents' : 'Participants'}</th>
                </tr>
              </thead>
              <tbody>
                {recordsTab === 'surveys'
                  ? surveysShown.map((r, i) => (
                    <tr key={`s-${i}`}>
                      <td className="nu-strong">{r.project || '—'}</td>
                      <td className="nu-mute">{r.assigned_to || '—'}</td>
                      <td><Pill>{r.month || '—'}</Pill></td>
                      <td className="nu-num nu-strong">{fmt(r.respondents)}</td>
                    </tr>
                  ))
                  : usabilityShown.map((r, i) => (
                    <tr key={`u-${i}`}>
                      <td className="nu-strong">{r.project || '—'}</td>
                      <td className="nu-mute">{r.assigned_to || '—'}</td>
                      <td><Pill tone="accent">{r.month || '—'}</Pill></td>
                      <td className="nu-num nu-strong">{fmt(r.participants)}</td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </div>
        </ChartFrame>
      </div>
    </section>
  );
}
