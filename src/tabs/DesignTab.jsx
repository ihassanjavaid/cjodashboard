import { useState, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, ComposedChart, Line, LabelList,
} from 'recharts';
import {
  C, PIE_COLORS, ICON, KpiCard, ChartCard, SectionTitle,
  FilterRow, Sel, ResetBtn, CT, cnt, toBarData,
  renderPieLabel, pieLegendFormatter,
} from '../shared/dashboardKit.jsx';
import { useDashboardDataWithFallback } from '../hooks/useDashboardDataWithFallback.js';
import { SkeletonState } from '../components/states/SkeletonState.jsx';
import { StaleBanner } from '../components/StaleBanner.jsx';

export const DESIGN_RAW = [];


export function DesignTab({ globalMonthRange, syncTick }) {
  const { rows, sheetStatus, lastSyncedAt } =
    useDashboardDataWithFallback('design', DESIGN_RAW, syncTick);

  const designRows = rows ?? DESIGN_RAW;

  const [person, setPerson]           = useState("All");
  const [type, setType]               = useState("All");
  const [stakeholder, setStakeholder] = useState("All");
  const [status, setStatus]           = useState("All");
  const [surveySearch,    setSurveySearch]    = useState("");
  const [usabilitySearch, setUsabilitySearch] = useState("");

  const filtered = useMemo(() => designRows.filter(d =>
    globalMonthRange(d.month) &&
    (person      === "All" || d.assigned_to === person) &&
    (type        === "All" || d.type        === type) &&
    (stakeholder === "All" || d.stakeholder === stakeholder) &&
    (status      === "All" || d.status      === status)
  ), [designRows, globalMonthRange, person, type, stakeholder, status]);

  if (sheetStatus === 'loading') return <SkeletonState />;
  // sheetStatus === 'error' is intentionally NOT a blocking state here —
  // the fallback wrapper supplies hardcoded rows when the API is unreachable
  // (404 in `npm run dev`, network error, etc.), so we render normally.
  // The header sync button shows "Sync failed" so the user still sees the live-sync state.

  const persons      = ["All", ...[...new Set(designRows.map(d => d.assigned_to))].sort()];
  const types        = ["All", ...[...new Set(designRows.map(d => d.type))].sort()];
  const stakeholders = ["All", ...[...new Set(designRows.map(d => d.stakeholder).filter(Boolean))].sort()];

  const totalTasks           = filtered.length;
  const usabilityCount       = filtered.filter(d => d.type === "Usability").length;
  const expertCount          = filtered.filter(d => d.type === "Expert Analysis").length;
  const totalStudies         = usabilityCount + expertCount;
  const surveyCount          = filtered.filter(d => d.type === "Survey").length;
  const sentimentCount       = filtered.filter(d => d.type === "Sentiment Analysis").length;
  const pulseCount           = filtered.filter(d => d.type === "App Pulse Reporting").length;
  const usabilityParticipants = filtered.filter(d => d.type === "Usability").reduce((s, d) => s + (d.count_users || 0), 0);
  const surveyUsers          = filtered.filter(d => d.type === "Survey").reduce((s, d) => s + (d.count_users || 0), 0);

  const typeData        = toBarData(cnt(filtered, "type"));
  const personData      = Object.entries(cnt(filtered, "assigned_to")).sort((a, b) => b[1] - a[1]).map(([name, tasks]) => {
    const sub = filtered.filter(d => d.assigned_to === name);
    return { name, tasks, usability: sub.filter(d => d.type === "Usability").length, surveys: sub.filter(d => d.type === "Survey").length, other: sub.filter(d => !["Usability","Survey"].includes(d.type)).length };
  });
  const EXCLUDED_STAKEHOLDERS = ["Survey", "CFL", "VOC"];
  const stakeholderData = toBarData(cnt(filtered.filter(d => d.stakeholder && !EXCLUDED_STAKEHOLDERS.includes(d.stakeholder)), "stakeholder")).slice(0, 12);
  const MONTH_ORDER = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const monthsInData = MONTH_ORDER.filter(m => designRows.some(d => d.month === m));
  const monthData    = monthsInData.map(m => {
    const sub = designRows.filter(d => d.month === m);
    return { month: m.substring(0, 3), tasks: sub.length, completed: sub.filter(d => d.status === "Completed").length };
  });
  const statusData = toBarData(cnt(filtered, "status"));

  // Total participants chart data — two bars only
  const participantsSummary = [
    { name: "Usability Participants", value: usabilityParticipants, fill: C.accent2 },
    { name: "Survey Respondents",     value: surveyUsers,           fill: C.success },
  ];

  // Tables
  const surveyList    = filtered.filter(d => d.type === "Survey").map(d => ({ project: d.project, assigned_to: d.assigned_to, month: d.month, respondents: d.count_users ?? 0 }));
  const usabilityList = filtered.filter(d => d.type === "Usability").map(d => ({ project: d.project, assigned_to: d.assigned_to, month: d.month, participants: d.count_users ?? 0 }));

  const surveyFiltered    = surveySearch    ? surveyList.filter(r    => r.project.toLowerCase().includes(surveySearch.toLowerCase()))    : surveyList;
  const usabilityFiltered = usabilitySearch ? usabilityList.filter(r => r.project.toLowerCase().includes(usabilitySearch.toLowerCase())) : usabilityList;

  return (
    <>
      <StaleBanner sheetStatus={sheetStatus} lastSyncedAt={lastSyncedAt} />
      <div style={{ paddingBottom: 40 }}>

      {/* Filter Bar */}
      <FilterRow>
        <Sel label="Resource"    value={person}      onChange={setPerson}      options={persons} />
        <Sel label="Type"        value={type}        onChange={setType}        options={types} />
        <Sel label="Stakeholder" value={stakeholder} onChange={setStakeholder} options={stakeholders} />
        <Sel label="Status"      value={status}      onChange={setStatus}      options={["All", "Completed", "In Progress"]} />
        <ResetBtn onClick={() => { setPerson("All"); setType("All"); setStakeholder("All"); setStatus("All"); }} />
      </FilterRow>

      {/* ── KPI Cards ─────────────────────────────────────────────────────── */}
      <SectionTitle>Performance Overview</SectionTitle>
      <div className="cjo-kpi-row" style={{ marginBottom: 32 }}>
        <KpiCard
          label="Total Tasks"
          value={totalTasks}
          color={C.accent}
          icon={ICON.tasks}
          progress={totalTasks ? Math.round(filtered.filter(d => d.status === "Completed").length / totalTasks * 100) : 0}
        />
        <KpiCard
          label="Total Studies"
          value={totalStudies}
          color={C.accent2}
          icon={ICON.studies}
          sub={
            <div style={{ display: "flex", gap: 12, marginTop: 6 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: C.accent2, display: "inline-block" }} />
                <span style={{ fontWeight: 600, color: C.text }}>{usabilityCount}</span>
                <span style={{ color: C.textSub }}>Usability</span>
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: C.accent3, display: "inline-block" }} />
                <span style={{ fontWeight: 600, color: C.text }}>{expertCount}</span>
                <span style={{ color: C.textSub }}>Expert Analysis</span>
              </span>
            </div>
          }
        />
        <KpiCard
          label="Surveys"
          value={surveyCount}
          color={C.accent3}
          icon={ICON.surveys}
          sub={`${surveyUsers.toLocaleString()} respondents`}
        />
        <KpiCard
          label="Sentiment Analysis"
          value={String(sentimentCount).padStart(2, "0")}
          color={C.warning}
          icon={ICON.sentiment}
          sub={(() => { const months = [...new Set(filtered.map(d => d.month))].length || 1; const avg = Math.round(sentimentCount / months); return `Avg. ${String(avg).padStart(2,"0")} / month`; })()}
        />
        <KpiCard
          label="Pulse Reports"
          value={String(pulseCount).padStart(2, "0")}
          color={C.success}
          icon={ICON.pulse}
          sub={(() => { const months = [...new Set(filtered.map(d => d.month))].length || 1; const avg = Math.round(pulseCount / months); return `Avg. ${String(avg).padStart(2,"0")} / month`; })()}
        />
      </div>

      {/* ── Charts Row 1: Tasks overview ───────────────────────────────────── */}
      <SectionTitle>Task Insights</SectionTitle>
      <div className="cjo-grid-3" style={{ marginBottom: 16 }}>

        <ChartCard title="Month over Month Tasks">
          <ResponsiveContainer width="100%" height={210}>
            <BarChart data={monthData} barSize={28} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.gridLine} strokeOpacity={0.5} vertical={false} />
              <XAxis dataKey="month" tick={{ fill: C.textSub, fontSize: 12, fontFamily: "Poppins" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: C.textSub, fontSize: 11, fontFamily: "Poppins" }} axisLine={false} tickLine={false} />
              <Tooltip content={<CT />} cursor={{ fill: C.accent + "08" }} />
              <Legend wrapperStyle={{ fontSize: 12, fontFamily: "Poppins", paddingTop: 8 }} />
              <Bar dataKey="tasks"     name="Total"     fill={C.muted}   radius={[6, 6, 0, 0]} fillOpacity={0.5}>
                <LabelList dataKey="tasks"     position="top" style={{ fill: C.muted,   fontSize: 10, fontFamily: "Poppins", fontWeight: 600 }} />
              </Bar>
              <Bar dataKey="completed" name="Completed" fill={C.success} radius={[6, 6, 0, 0]}>
                <LabelList dataKey="completed" position="top" style={{ fill: C.success, fontSize: 10, fontFamily: "Poppins", fontWeight: 600 }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Task Type Breakdown">
          <ResponsiveContainer width="100%" height={210}>
            <BarChart data={typeData} layout="vertical" barSize={14}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.gridLine} strokeOpacity={0.5} horizontal={false} />
              <XAxis type="number" tick={{ fill: C.textSub, fontSize: 11, fontFamily: "Poppins" }} axisLine={false} tickLine={false} />
              <YAxis dataKey="name" type="category" tick={{ fill: C.text, fontSize: 11, fontFamily: "Poppins" }} axisLine={false} tickLine={false} width={110} />
              <Tooltip content={<CT />} cursor={{ fill: C.accent + "08" }} />
              <Bar dataKey="value" name="Tasks" radius={[0, 6, 6, 0]}>
                {typeData.map((e, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                <LabelList dataKey="value" position="right" style={{ fill: C.textSub, fontSize: 10, fontFamily: "Poppins", fontWeight: 600 }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Status Breakdown">
          <ResponsiveContainer width="100%" height={210}>
            <PieChart>
              <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={82} innerRadius={48} paddingAngle={3} strokeWidth={0} label={renderPieLabel} labelLine={false}>
                {statusData.map((e, i) => <Cell key={i} fill={e.name === "Completed" ? C.success : C.warning} />)}
              </Pie>
              <Tooltip content={<CT />} />
              <Legend wrapperStyle={{ fontSize: 12, fontFamily: "Poppins" }} formatter={pieLegendFormatter} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* ── Charts Row 2: Team performance ────────────────────────────────── */}
      <SectionTitle>Team Performance</SectionTitle>
      <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 16 }}>

        <ChartCard title="Individual Performance">
          <div style={{ display: "flex", gap: 12, marginBottom: 10 }}>
            {[["Usability", C.accent], ["Surveys", C.success], ["Misc", C.muted]].map(([label, color]) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: color }} />
                <span style={{ fontSize: 10, color: C.textSub, fontFamily: "Poppins,sans-serif" }}>{label}</span>
              </div>
            ))}
          </div>
          {(() => {
            const max = Math.max(...personData.map(d => d.tasks), 1);
            return personData.map((p, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: i < personData.length - 1 ? 6 : 0 }}>
                <div style={{ width: 42, fontSize: 11, fontWeight: 600, color: C.text, fontFamily: "Poppins,sans-serif", textAlign: "right", flexShrink: 0 }}>
                  {p.name.split(" ")[0]}
                </div>
                <div style={{ flex: 1, display: "flex", height: 24, borderRadius: 6, overflow: "hidden", gap: 1 }}>
                  {[
                    { val: p.usability, color: C.accent },
                    { val: p.surveys,   color: C.success },
                    { val: p.other,     color: C.muted   },
                  ].filter(s => s.val > 0).map((s, j) => (
                    <div key={j} style={{ width: `${(s.val / max) * 100}%`, background: s.color, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {(s.val / max) * 100 > 12 && <span style={{ fontSize: 9, color: "#fff", fontWeight: 700, fontFamily: "Poppins,sans-serif" }}>{s.val}</span>}
                    </div>
                  ))}
                  <div style={{ flex: 1, background: "#EDE8E5", borderRadius: "0 6px 6px 0" }} />
                </div>
                <div style={{ width: 22, fontSize: 11, fontWeight: 700, color: C.text, fontFamily: "Poppins,sans-serif", flexShrink: 0, textAlign: "right" }}>{p.tasks}</div>
              </div>
            ));
          })()}
        </ChartCard>

        <ChartCard title="Stakeholder Requests (Top 10)">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={stakeholderData.slice(0, 10)} layout="vertical" barSize={18}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.gridLine} strokeOpacity={0.4} horizontal={false} />
              <XAxis type="number" tick={{ fill: C.textSub, fontSize: 10, fontFamily: "Poppins" }} axisLine={false} tickLine={false} />
              <YAxis dataKey="name" type="category" tick={{ fill: C.text, fontSize: 12, fontFamily: "Poppins" }} axisLine={false} tickLine={false} width={80} />
              <Tooltip content={<CT />} cursor={{ fill: C.accent + "08" }} />
              <Bar dataKey="value" name="Tasks" radius={[0, 6, 6, 0]}>
                {stakeholderData.slice(0, 10).map((e, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                <LabelList dataKey="value" position="right" style={{ fill: C.textSub, fontSize: 11, fontFamily: "Poppins", fontWeight: 600 }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* ── Research Insights ─────────────────────────────────────────────── */}
      <SectionTitle>Research Insights</SectionTitle>
      <div className="cjo-grid-2" style={{ marginBottom: 32 }}>

        <ChartCard title="Usability Participants vs Survey Respondents">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={participantsSummary} barSize={60}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.gridLine} strokeOpacity={0.5} vertical={false} />
              <XAxis dataKey="name" tick={{ fill: C.textSub, fontSize: 11, fontFamily: "Poppins" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: C.textSub, fontSize: 11, fontFamily: "Poppins" }} axisLine={false} tickLine={false} />
              <Tooltip content={<CT />} cursor={{ fill: C.accent + "08" }} />
              <Bar dataKey="value" name="Count" radius={[8, 8, 0, 0]}>
                {participantsSummary.map((e, i) => <Cell key={i} fill={e.fill} />)}
                <LabelList dataKey="value" position="top" formatter={v => v.toLocaleString()} style={{ fill: C.textSub, fontSize: 11, fontFamily: "Poppins", fontWeight: 700 }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Participants by Month">
          <ResponsiveContainer width="100%" height={200}>
            <ComposedChart data={["January", "February", "March"].map(m => {
              const sub = filtered.filter(d => d.month === m);
              return { month: m.substring(0, 3), usability_participants: sub.filter(d => d.type === "Usability").reduce((s, d) => s + (d.count_users || 0), 0), survey_users: sub.filter(d => d.type === "Survey").reduce((s, d) => s + (d.count_users || 0), 0) };
            })}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.gridLine} strokeOpacity={0.5} vertical={false} />
              <XAxis dataKey="month" tick={{ fill: C.textSub, fontSize: 12, fontFamily: "Poppins" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: C.textSub, fontSize: 11, fontFamily: "Poppins" }} axisLine={false} tickLine={false} />
              <Tooltip content={<CT />} />
              <Legend wrapperStyle={{ fontSize: 12, fontFamily: "Poppins", paddingTop: 8 }} />
              <Bar  dataKey="usability_participants" name="Usability Participants" fill={C.accent2} radius={[6, 6, 0, 0]} barSize={28}>
                <LabelList dataKey="usability_participants" position="top" style={{ fill: C.accent2, fontSize: 10, fontFamily: "Poppins", fontWeight: 700 }} />
              </Bar>
              <Line dataKey="survey_users"           name="Survey Respondents"    stroke={C.accent3} strokeWidth={2.5} dot={{ fill: C.accent3, r: 4 }} type="monotone">
                <LabelList dataKey="survey_users" position="top" style={{ fill: C.accent3, fontSize: 10, fontFamily: "Poppins", fontWeight: 700 }} />
              </Line>
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* ── Tables ───────────────────────────────────────────────────────── */}
      <SectionTitle>Records</SectionTitle>
      <div className="cjo-grid-2">

        {/* Surveys table */}
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.text, fontFamily: "Poppins,sans-serif" }}>
              Surveys <span style={{ fontSize: 11, fontWeight: 500, color: C.textSub, marginLeft: 4 }}>({surveyList.length} total)</span>
            </div>
            <div style={{ position: "relative" }}>
              <input type="text" value={surveySearch} onChange={e => setSurveySearch(e.target.value)} placeholder="Search surveys…"
                style={{ padding: "7px 12px 7px 32px", borderRadius: 8, border: `1px solid ${C.cardBorder}`, fontFamily: "Poppins,sans-serif", fontSize: 12, color: C.text, outline: "none", width: "100%", maxWidth: 190, minWidth: 140, background: C.card, transition: "border-color 0.15s" }}
                onFocus={e => e.target.style.borderColor = C.accent}
                onBlur={e => e.target.style.borderColor = C.cardBorder}
              />
              <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: C.muted, pointerEvents: "none" }}>
                <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
              </span>
              {surveySearch && <button onClick={() => setSurveySearch("")} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: C.muted, fontSize: 14, lineHeight: 1, padding: 0 }}>✕</button>}
            </div>
          </div>
          <div style={{ background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 12, overflow: "hidden", boxShadow: C.shadow }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "Poppins,sans-serif", fontSize: 12 }}>
              <thead>
                <tr style={{ background: "#F8FAFC" }}>
                  {["Survey Name", "Resource", "Month", "Respondents"].map(h => (
                    <th key={h} style={{ padding: "10px 14px", textAlign: "left", color: C.textSub, fontWeight: 600, fontSize: 11, borderBottom: `1px solid ${C.cardBorder}`, whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
            </table>
            <div style={{ maxHeight: 320, overflowY: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "Poppins,sans-serif", fontSize: 12 }}>
                <tbody>
                  {surveyFiltered.length === 0
                    ? <tr><td colSpan={4} style={{ padding: "24px 14px", textAlign: "center", color: C.muted, fontSize: 12 }}>No surveys match</td></tr>
                    : surveyFiltered.map((row, i) => (
                      <tr key={i} style={{ borderBottom: `1px solid ${C.cardBorder}`, background: "#fff", transition: "background 0.12s" }}
                        onMouseEnter={e => e.currentTarget.style.background = "#F0F4FF"}
                        onMouseLeave={e => e.currentTarget.style.background = "#fff"}>
                        <td style={{ padding: "10px 14px", color: C.text, fontWeight: 500 }}>{row.project}</td>
                        <td style={{ padding: "10px 14px", color: C.textSub, whiteSpace: "nowrap" }}>{row.assigned_to}</td>
                        <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>
                          <span style={{ background: C.accent + "15", color: C.accent, padding: "2px 8px", borderRadius: 99, fontSize: 11, fontWeight: 500 }}>{row.month}</span>
                        </td>
                        <td style={{ padding: "10px 14px", fontWeight: 700, color: C.accent3, whiteSpace: "nowrap" }}>{row.respondents.toLocaleString()}</td>
                      </tr>
                    ))
                  }
                </tbody>
              </table>
            </div>
            <div style={{ padding: "8px 14px", background: "#F8FAFC", borderTop: `1px solid ${C.cardBorder}`, fontSize: 11, color: C.textSub, fontFamily: "Poppins,sans-serif" }}>
              {surveyFiltered.length} of {surveyList.length} surveys
            </div>
          </div>
        </div>

        {/* Usability Studies table */}
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.text, fontFamily: "Poppins,sans-serif" }}>
              Usability Studies <span style={{ fontSize: 11, fontWeight: 500, color: C.textSub, marginLeft: 4 }}>({usabilityList.length} total)</span>
            </div>
            <div style={{ position: "relative" }}>
              <input type="text" value={usabilitySearch} onChange={e => setUsabilitySearch(e.target.value)} placeholder="Search studies…"
                style={{ padding: "7px 12px 7px 32px", borderRadius: 8, border: `1px solid ${C.cardBorder}`, fontFamily: "Poppins,sans-serif", fontSize: 12, color: C.text, outline: "none", width: "100%", maxWidth: 190, minWidth: 140, background: C.card, transition: "border-color 0.15s" }}
                onFocus={e => e.target.style.borderColor = C.accent}
                onBlur={e => e.target.style.borderColor = C.cardBorder}
              />
              <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: C.muted, pointerEvents: "none" }}>
                <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
              </span>
              {usabilitySearch && <button onClick={() => setUsabilitySearch("")} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: C.muted, fontSize: 14, lineHeight: 1, padding: 0 }}>✕</button>}
            </div>
          </div>
          <div style={{ background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 12, overflow: "hidden", boxShadow: C.shadow }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "Poppins,sans-serif", fontSize: 12 }}>
              <thead>
                <tr style={{ background: "#F8FAFC" }}>
                  {["Study Name", "Resource", "Month", "Participants"].map(h => (
                    <th key={h} style={{ padding: "10px 14px", textAlign: "left", color: C.textSub, fontWeight: 600, fontSize: 11, borderBottom: `1px solid ${C.cardBorder}`, whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
            </table>
            <div style={{ maxHeight: 320, overflowY: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "Poppins,sans-serif", fontSize: 12 }}>
                <tbody>
                  {usabilityFiltered.length === 0
                    ? <tr><td colSpan={4} style={{ padding: "24px 14px", textAlign: "center", color: C.muted, fontSize: 12 }}>No studies match</td></tr>
                    : usabilityFiltered.map((row, i) => (
                      <tr key={i} style={{ borderBottom: `1px solid ${C.cardBorder}`, background: "#fff", transition: "background 0.12s" }}
                        onMouseEnter={e => e.currentTarget.style.background = "#F5F0FF"}
                        onMouseLeave={e => e.currentTarget.style.background = "#fff"}>
                        <td style={{ padding: "10px 14px", color: C.text, fontWeight: 500 }}>{row.project}</td>
                        <td style={{ padding: "10px 14px", color: C.textSub, whiteSpace: "nowrap" }}>{row.assigned_to}</td>
                        <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>
                          <span style={{ background: C.accent2 + "15", color: C.accent2, padding: "2px 8px", borderRadius: 99, fontSize: 11, fontWeight: 500 }}>{row.month}</span>
                        </td>
                        <td style={{ padding: "10px 14px", fontWeight: 700, color: C.accent2, whiteSpace: "nowrap" }}>{row.participants}</td>
                      </tr>
                    ))
                  }
                </tbody>
              </table>
            </div>
            <div style={{ padding: "8px 14px", background: "#F8FAFC", borderTop: `1px solid ${C.cardBorder}`, fontSize: 11, color: C.textSub, fontFamily: "Poppins,sans-serif" }}>
              {usabilityFiltered.length} of {usabilityList.length} studies
            </div>
          </div>
        </div>

      </div>
    </div>
    </>
  );
}
