import { useState, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, Line, ComposedChart, LabelList,
} from 'recharts';
import {
  C, PIE_COLORS, KpiCard, ChartCard, SectionLabel,
  FilterRow, Sel, ResetBtn, CT, cnt, toBarData,
  renderPieLabel, pieLegendFormatter,
} from '../shared/dashboardKit.jsx';
import { useDashboardDataWithFallback } from '../hooks/useDashboardDataWithFallback.js';

export const STD_BAU = [];

export const STD_JLV = [];

// Phase 2: when configured, the std tab fetches a restricted sheet via OAuth and
// returns a combined { bau: [...], jlv: [...] } object (see api/_lib/fetchSheet
// + api/_config/sheets). The fallback wrapper hands back the same shape with the
// hardcoded arrays when the sheet is unconfigured / never-synced / errored.
export function StandardizationTab({ globalMonthRange, syncTick }) {
  const live = useDashboardDataWithFallback('std', { bau: STD_BAU, jlv: STD_JLV }, syncTick);
  const data = live.rows ?? { bau: STD_BAU, jlv: STD_JLV };
  const bauRows = data.bau ?? STD_BAU;
  const jlvRows = data.jlv ?? STD_JLV;

  const [dataSource, setDataSource] = useState("BAU");
  const [segment, setSegment]       = useState("All");
  const [assignedTo, setAssignedTo] = useState("All");
  const [assignedBy, setAssignedBy] = useState("All");
  const [uatType, setUatType]       = useState("All");
  const [env, setEnv]               = useState("All");

  const isBau        = dataSource === "BAU";
  const sourceLabel  = isBau ? "Business As Usual" : "Jazz Lifestyle Ventures";
  const accentColor  = isBau ? C.accent : C.accent2;

  // Partition by source — JLV entries are those assigned by "JLV"
  const bauRaw    = bauRows;
  const jlvRaw    = jlvRows;
  const activeRaw = isBau ? bauRaw : jlvRaw;

  const handleSwitch = (src) => {
    setDataSource(src);
    setSegment("All"); setAssignedTo("All"); setAssignedBy("All");
    setUatType("All"); setEnv("All");
  };

  const segments    = ["All", ...[...new Set(activeRaw.map(d => d.segment))].sort()];
  const assignedTos = ["All", ...[...new Set(activeRaw.map(d => d.assigned_to))].sort()];
  const assignedBys = ["All", ...[...new Set(activeRaw.map(d => d.assigned_by))].filter(v => v !== "JLV").sort()];

  const filtered = useMemo(() => activeRaw.filter(d =>
    globalMonthRange(d.month) &&
    (segment    === "All" || d.segment    === segment) &&
    (assignedTo === "All" || d.assigned_to === assignedTo) &&
    (assignedBy === "All" || d.assigned_by === assignedBy) &&
    (uatType    === "All" || d.uat_type    === uatType) &&
    (env        === "All" || d.environment === env)
  ), [activeRaw, dataSource, globalMonthRange, segment, assignedTo, assignedBy, uatType, env]);

  const totalUATs   = filtered.length;
  const totalManned = filtered.reduce((s, d) => s + (d.total_manned || 0), 0);
  const totalCases  = filtered.reduce((s, d) => s + (d.total_cases || 0), 0);
  const totalPass   = filtered.reduce((s, d) => s + (d.pass_cases || 0), 0);
  const issuesH     = filtered.reduce((s, d) => s + (d.issues_highlighted || 0), 0);
  const issuesF     = filtered.reduce((s, d) => s + (d.issues_fixed || 0), 0);
  const successRatio = totalCases ? ((totalPass / totalCases) * 100).toFixed(1) : 0;
  const fixRate      = issuesH   ? ((issuesF / issuesH) * 100).toFixed(1) : 0;

  const monthlyData = ["January", "February", "March"].map(m => {
    const sub = activeRaw.filter(d => d.month === m);
    return {
      month: m.substring(0, 3),
      uats:      sub.length,
      manned:    sub.reduce((s, d) => s + (d.total_manned || 0), 0),
      issues_h:  sub.reduce((s, d) => s + (d.issues_highlighted || 0), 0),
      issues_f:  sub.reduce((s, d) => s + (d.issues_fixed || 0), 0),
    };
  });

  const assignedByData = toBarData(cnt(filtered, "assigned_by"));
  const segmentData    = toBarData(cnt(filtered, "segment"));
  const plannedData    = toBarData(cnt(filtered, "planned"));
  const individualData = Object.entries(cnt(filtered, "assigned_to")).sort((a, b) => b[1] - a[1]).map(([name, uats]) => {
    const sub = filtered.filter(d => d.assigned_to === name);
    return { name, uats, cases: sub.reduce((s, d) => s + (d.total_cases || 0), 0), pass: sub.reduce((s, d) => s + (d.pass_cases || 0), 0), issues: sub.reduce((s, d) => s + (d.issues_highlighted || 0), 0) };
  });

  // Detailed stats table — driven by active source (BAU or JLV)
  const detailTableData = Object.entries(cnt(activeRaw, "assigned_to")).sort((a, b) => b[1] - a[1]).map(([name, total]) => {
    const sub = activeRaw.filter(d => d.assigned_to === name);
    const cases    = sub.reduce((s, d) => s + (d.total_cases || 0), 0);
    const pass     = sub.reduce((s, d) => s + (d.pass_cases || 0), 0);
    const failed   = sub.reduce((s, d) => s + (d.failed_cases || 0), 0);
    const dIssuesH = sub.reduce((s, d) => s + (d.issues_highlighted || 0), 0);
    const dIssuesF = sub.reduce((s, d) => s + (d.issues_fixed || 0), 0);
    const manned   = sub.reduce((s, d) => s + (d.total_manned || 0), 0);
    const planned   = sub.filter(d => d.planned === "Planned").length;
    const unplanned = sub.filter(d => d.planned === "Unplanned").length;
    const dayUATs   = sub.filter(d => d.uat_type === "Day").length;
    const nightUATs = sub.filter(d => d.uat_type === "Night").length;
    const successPct = cases > 0 ? ((pass / cases) * 100).toFixed(1) : "0.0";
    const rowFixRate = dIssuesH > 0 ? ((dIssuesF / dIssuesH) * 100).toFixed(0) : "100";
    return { name, total, planned, unplanned, dayUATs, nightUATs, manned, cases, pass, failed, issuesH: dIssuesH, issuesF: dIssuesF, successPct, fixRate: rowFixRate };
  });

  const channelData = toBarData(cnt(filtered.filter(d => d.channel), "channel")).slice(0, 10);
  const statusData  = toBarData(cnt(filtered, "uat_status"));

  return (
    <div>

      {/* ── Source toggle ─────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 18,
                    background: "#f1f5f9", borderRadius: 12, padding: 4, maxWidth: "100%",
                    flexWrap: "wrap",
                    boxShadow: "inset 0 1px 3px rgba(0,0,0,0.08)" }}>
        {[
          { key: "BAU", label: "Business As Usual", color: C.accent },
          { key: "JLV", label: "Jazz Lifestyle Ventures", color: C.accent2 },
        ].map(opt => {
          const active = dataSource === opt.key;
          return (
            <button key={opt.key} onClick={() => handleSwitch(opt.key)}
              style={{
                padding: "8px 22px", borderRadius: 9, border: "none", cursor: "pointer",
                fontFamily: "Poppins,sans-serif", fontWeight: active ? 700 : 500,
                fontSize: 13, transition: "all 0.2s",
                background: active ? "#fff" : "transparent",
                color: active ? opt.color : C.textSub,
                boxShadow: active ? "0 2px 8px rgba(0,0,0,0.10)" : "none",
                transform: active ? "scale(1.02)" : "scale(1)",
              }}>
              {opt.label}
            </button>
          );
        })}
      </div>

      <FilterRow>
        <Sel label="Segment"     value={segment}    onChange={setSegment}    options={segments} />
        <Sel label="Assigned To" value={assignedTo} onChange={setAssignedTo} options={assignedTos} />
        {isBau && <Sel label="Assigned By" value={assignedBy} onChange={setAssignedBy} options={assignedBys} />}
        <Sel label="UAT Type"    value={uatType}    onChange={setUatType}    options={["All", "Day", "Night"]} />
        <Sel label="Environment" value={env}         onChange={setEnv}        options={["All", "Live", "Staging"]} />
        <ResetBtn onClick={() => { setSegment("All"); setAssignedTo("All"); setAssignedBy("All"); setUatType("All"); setEnv("All"); }} />
      </FilterRow>

      <div className="cjo-kpi-row" style={{ marginBottom: 16 }}>
        <KpiCard label="Total UATs"          value={totalUATs}                                        color={accentColor} />
        <KpiCard label="Manned Hours"        value={`${totalManned.toFixed(1)} hrs`}                  color={C.accent3} />
        <KpiCard label="Success Ratio"       value={`${successRatio}%`} sub={`${totalPass}/${totalCases} passed`} color={C.success} />
        <KpiCard label="Issues Highlighted"  value={issuesH}                                          color={C.warning} />
        <KpiCard label="Issues Fixed"        value={issuesF} sub={`Fix Rate: ${fixRate}%`}            color={C.danger} />
      </div>

      <div className="cjo-std-grid">
        <ChartCard title="M-o-M UAT Count & Manned Hours" span={2}>
          <ResponsiveContainer width="100%" height={210}>
            <ComposedChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.gridLine} />
              <XAxis dataKey="month" tick={{ fill: C.textSub, fontSize: 11, fontFamily: "Poppins" }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="left"  tick={{ fill: C.textSub, fontSize: 11, fontFamily: "Poppins" }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="right" orientation="right" tick={{ fill: C.textSub, fontSize: 11, fontFamily: "Poppins" }} axisLine={false} tickLine={false} />
              <Tooltip content={<CT />} />
              <Legend wrapperStyle={{ fontSize: 11, fontFamily: "Poppins" }} />
              <Bar  yAxisId="left"  dataKey="uats"   name="UAT Count"   fill={accentColor} radius={[4, 4, 0, 0]} barSize={28}>
                <LabelList dataKey="uats" position="top" style={{ fill: accentColor, fontSize: 10, fontFamily: "Poppins", fontWeight: 700 }} />
              </Bar>
              <Line yAxisId="right" dataKey="manned" name="Manned Hrs" stroke={C.accent3} strokeWidth={2.5} dot={{ fill: C.accent3, r: 4 }} type="monotone">
                <LabelList dataKey="manned" position="top" formatter={v => v.toFixed(1)} style={{ fill: C.accent3, fontSize: 10, fontFamily: "Poppins", fontWeight: 700 }} />
              </Line>
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Assigned By (Contributors)">
          <ResponsiveContainer width="100%" height={210}>
            <PieChart>
              <Pie data={assignedByData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={78} innerRadius={30} paddingAngle={3}
                   label={renderPieLabel} labelLine={false}>
                {assignedByData.map((e, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip content={<CT />} />
              <Legend wrapperStyle={{ fontSize: 11, fontFamily: "Poppins" }} formatter={pieLegendFormatter} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="M-o-M Issues: Highlighted vs Fixed" span={2}>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={monthlyData} barSize={22}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.gridLine} />
              <XAxis dataKey="month" tick={{ fill: C.textSub, fontSize: 11, fontFamily: "Poppins" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: C.textSub, fontSize: 11, fontFamily: "Poppins" }} axisLine={false} tickLine={false} />
              <Tooltip content={<CT />} />
              <Legend wrapperStyle={{ fontSize: 11, fontFamily: "Poppins" }} />
              <Bar dataKey="issues_h" name="Issues Highlighted" fill={C.warning} radius={[4, 4, 0, 0]}>
                <LabelList dataKey="issues_h" position="top" style={{ fill: C.warning, fontSize: 10, fontFamily: "Poppins", fontWeight: 700 }} />
              </Bar>
              <Bar dataKey="issues_f" name="Issues Fixed"       fill={C.success} radius={[4, 4, 0, 0]}>
                <LabelList dataKey="issues_f" position="top" style={{ fill: C.success, fontSize: 10, fontFamily: "Poppins", fontWeight: 700 }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Segment-Wise UATs">
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={segmentData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={78} innerRadius={30} paddingAngle={3}
                   label={renderPieLabel} labelLine={false}>
                {segmentData.map((e, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip content={<CT />} />
              <Legend wrapperStyle={{ fontSize: 10, fontFamily: "Poppins" }} formatter={pieLegendFormatter} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Individual Performance" span={2}>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={individualData} layout="vertical" barSize={16}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.gridLine} horizontal={false} />
              <XAxis type="number" tick={{ fill: C.textSub, fontSize: 10, fontFamily: "Poppins" }} axisLine={false} tickLine={false} />
              <YAxis dataKey="name" type="category" tick={{ fill: C.text, fontSize: 11, fontFamily: "Poppins" }} axisLine={false} tickLine={false} width={90} />
              <Tooltip content={<CT />} />
              <Legend wrapperStyle={{ fontSize: 11, fontFamily: "Poppins" }} />
              <Bar dataKey="uats"   name="UATs"   stackId="a" fill={accentColor}>
                <LabelList dataKey="uats" position="insideLeft" style={{ fill: "#fff", fontSize: 10, fontFamily: "Poppins", fontWeight: 700 }} />
              </Bar>
              <Bar dataKey="issues" name="Issues" stackId="a" fill={C.warning} radius={[0, 4, 4, 0]}>
                <LabelList dataKey="issues" position="right" style={{ fill: C.textSub, fontSize: 10, fontFamily: "Poppins", fontWeight: 700 }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Type of Change">
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={plannedData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={78} innerRadius={30} paddingAngle={4}
                   label={renderPieLabel} labelLine={false}>
                <Cell fill={accentColor} /><Cell fill={C.accent3} />
              </Pie>
              <Tooltip content={<CT />} />
              <Legend wrapperStyle={{ fontSize: 11, fontFamily: "Poppins" }} formatter={pieLegendFormatter} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Channel (Sub-Category) Distribution" span={2}>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={channelData} barSize={18}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.gridLine} />
              <XAxis dataKey="name" tick={{ fill: C.textSub, fontSize: 9, fontFamily: "Poppins" }} axisLine={false} tickLine={false} interval={0} angle={-20} textAnchor="end" height={40} />
              <YAxis tick={{ fill: C.textSub, fontSize: 11, fontFamily: "Poppins" }} axisLine={false} tickLine={false} />
              <Tooltip content={<CT />} />
              <Bar dataKey="value" name="Count" radius={[4, 4, 0, 0]}>
                {channelData.map((e, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                <LabelList dataKey="value" position="top" style={{ fill: C.textSub, fontSize: 10, fontFamily: "Poppins", fontWeight: 700 }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="UAT Status">
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={78} innerRadius={30} paddingAngle={3}
                   label={renderPieLabel} labelLine={false}>
                {statusData.map((e, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip content={<CT />} />
              <Legend wrapperStyle={{ fontSize: 11, fontFamily: "Poppins" }} formatter={pieLegendFormatter} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* ── Detailed Stats Table ───────────────────────────────────────── */}
      <SectionLabel>Individual Detailed Stats — {sourceLabel}</SectionLabel>
      <div className="cjo-scroll-x">
        <table style={{ width: "100%", minWidth: 1050, borderCollapse: "collapse", fontFamily: "Poppins,sans-serif", fontSize: 12, background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 10, overflow: "hidden", boxShadow: C.shadow }}>
          <thead>
            <tr style={{ background: "#f0f4f8" }}>
              <th rowSpan={2} style={{ padding: "10px 14px", textAlign: "left", color: C.text, fontWeight: 700, fontSize: 11, borderBottom: `2px solid ${C.cardBorder}`, borderRight: `1px solid ${C.cardBorder}`, whiteSpace: "nowrap" }}>Resource</th>
              <th colSpan={3} style={{ padding: "8px 14px", textAlign: "center", color: accentColor, fontWeight: 700, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", borderBottom: `1px solid ${C.cardBorder}`, borderRight: `1px solid ${C.cardBorder}`, background: accentColor + "0d" }}>UAT Counts</th>
              <th colSpan={2} style={{ padding: "8px 14px", textAlign: "center", color: C.accent3, fontWeight: 700, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", borderBottom: `1px solid ${C.cardBorder}`, borderRight: `1px solid ${C.cardBorder}`, background: C.accent3 + "0d" }}>Type</th>
              <th colSpan={1} style={{ padding: "8px 14px", textAlign: "center", color: C.accent2, fontWeight: 700, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", borderBottom: `1px solid ${C.cardBorder}`, borderRight: `1px solid ${C.cardBorder}`, background: C.accent2 + "0d" }}>Effort</th>
              <th colSpan={3} style={{ padding: "8px 14px", textAlign: "center", color: C.success, fontWeight: 700, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", borderBottom: `1px solid ${C.cardBorder}`, borderRight: `1px solid ${C.cardBorder}`, background: C.success + "0d" }}>Test Coverage</th>
              <th colSpan={2} style={{ padding: "8px 14px", textAlign: "center", color: C.warning, fontWeight: 700, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", borderBottom: `1px solid ${C.cardBorder}`, borderRight: `1px solid ${C.cardBorder}`, background: C.warning + "0d" }}>Issues</th>
              <th colSpan={2} style={{ padding: "8px 14px", textAlign: "center", color: C.textSub, fontWeight: 700, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", borderBottom: `1px solid ${C.cardBorder}`, background: "#f8fafc" }}>Rates</th>
            </tr>
            <tr style={{ background: "#f8fafc" }}>
              {[
                ["Total UATs", accentColor], ["Planned", accentColor], ["Unplanned", accentColor],
                ["Day", C.accent3], ["Night", C.accent3],
                ["Total Hrs", C.accent2],
                ["Total Cases", C.success], ["Pass", C.success], ["Failed", C.danger],
                ["Issues Highlighted", C.warning], ["Issues Fixed", C.warning],
                ["Fix Rate", C.textSub], ["Success %", C.textSub],
              ].map(([h, col], i) => (
                <th key={h} style={{ padding: "8px 12px", textAlign: "center", color: col, fontWeight: 600, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: `2px solid ${C.cardBorder}`, borderRight: i < 12 ? `1px solid ${C.cardBorder}` : "none", whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {detailTableData.map((row, i) => {
              const fixColor  = Number(row.fixRate) >= 80 ? C.success : Number(row.fixRate) >= 50 ? C.warning : C.danger;
              const succColor = Number(row.successPct) >= 90 ? C.success : Number(row.successPct) >= 70 ? C.warning : C.danger;
              const tdBase = { padding: "11px 12px", textAlign: "center", borderBottom: `1px solid ${C.cardBorder}` };
              return (
                <tr key={i} style={{ background: i % 2 === 0 ? "#fff" : "#fafbfd", transition: "background 0.15s" }}
                  onMouseEnter={e => e.currentTarget.style.background = "#f0f7ff"}
                  onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? "#fff" : "#fafbfd"}>
                  <td style={{ ...tdBase, textAlign: "left", fontWeight: 700, color: C.text, borderRight: `1px solid ${C.cardBorder}`, paddingLeft: 14, whiteSpace: "nowrap" }}>{row.name}</td>
                  <td style={{ ...tdBase, fontWeight: 700, color: accentColor, background: accentColor + "08", borderRight: "none" }}>{row.total}</td>
                  <td style={{ ...tdBase, color: accentColor, background: accentColor + "05" }}>{row.planned}</td>
                  <td style={{ ...tdBase, color: accentColor, background: accentColor + "05", borderRight: `1px solid ${C.cardBorder}` }}>{row.unplanned}</td>
                  <td style={{ ...tdBase, color: C.accent3, background: C.accent3 + "06" }}>{row.dayUATs}</td>
                  <td style={{ ...tdBase, color: C.accent3, background: C.accent3 + "06", borderRight: `1px solid ${C.cardBorder}` }}>{row.nightUATs}</td>
                  <td style={{ ...tdBase, color: C.accent2, fontWeight: 600, background: C.accent2 + "06", borderRight: `1px solid ${C.cardBorder}` }}>{row.manned.toFixed(1)}</td>
                  <td style={{ ...tdBase, color: C.text, background: C.success + "05" }}>{row.cases}</td>
                  <td style={{ ...tdBase, color: C.success, fontWeight: 600, background: C.success + "08" }}>{row.pass}</td>
                  <td style={{ ...tdBase, color: row.failed > 0 ? C.danger : C.muted, fontWeight: row.failed > 0 ? 600 : 400, background: row.failed > 0 ? C.danger + "08" : "transparent", borderRight: `1px solid ${C.cardBorder}` }}>{row.failed}</td>
                  <td style={{ ...tdBase, color: row.issuesH > 0 ? C.warning : C.muted, fontWeight: row.issuesH > 0 ? 600 : 400, background: row.issuesH > 0 ? C.warning + "08" : "transparent" }}>{row.issuesH}</td>
                  <td style={{ ...tdBase, color: C.success, fontWeight: 600, background: C.success + "05", borderRight: `1px solid ${C.cardBorder}` }}>{row.issuesF}</td>
                  <td style={{ ...tdBase }}>
                    <span style={{ background: fixColor + "18", color: fixColor, borderRadius: 20, padding: "3px 10px", fontSize: 11, fontWeight: 700 }}>{row.fixRate}%</span>
                  </td>
                  <td style={{ ...tdBase }}>
                    <span style={{ background: succColor + "18", color: succColor, borderRadius: 20, padding: "3px 10px", fontSize: 11, fontWeight: 700 }}>{row.successPct}%</span>
                  </td>
                </tr>
              );
            })}
            {(() => {
              const tot = detailTableData.reduce((acc, r) => ({
                total: acc.total + r.total, planned: acc.planned + r.planned, unplanned: acc.unplanned + r.unplanned,
                dayUATs: acc.dayUATs + r.dayUATs, nightUATs: acc.nightUATs + r.nightUATs,
                manned: acc.manned + r.manned, cases: acc.cases + r.cases,
                pass: acc.pass + r.pass, failed: acc.failed + r.failed,
                issuesH: acc.issuesH + r.issuesH, issuesF: acc.issuesF + r.issuesF,
              }), { total:0,planned:0,unplanned:0,dayUATs:0,nightUATs:0,manned:0,cases:0,pass:0,failed:0,issuesH:0,issuesF:0 });
              const tFix  = tot.issuesH > 0 ? ((tot.issuesF / tot.issuesH) * 100).toFixed(0) : 100;
              const tSucc = tot.cases   > 0 ? ((tot.pass  / tot.cases)   * 100).toFixed(1) : "0.0";
              const tdT   = { padding: "11px 12px", textAlign: "center", background: "#f0f4f8", fontWeight: 700, borderTop: `2px solid ${C.cardBorder}` };
              return (
                <tr>
                  <td style={{ ...tdT, textAlign: "left", paddingLeft: 14, color: C.text, borderRight: `1px solid ${C.cardBorder}` }}>Total</td>
                  <td style={{ ...tdT, color: accentColor }}>{tot.total}</td>
                  <td style={{ ...tdT, color: accentColor }}>{tot.planned}</td>
                  <td style={{ ...tdT, color: accentColor, borderRight: `1px solid ${C.cardBorder}` }}>{tot.unplanned}</td>
                  <td style={{ ...tdT, color: C.accent3 }}>{tot.dayUATs}</td>
                  <td style={{ ...tdT, color: C.accent3, borderRight: `1px solid ${C.cardBorder}` }}>{tot.nightUATs}</td>
                  <td style={{ ...tdT, color: C.accent2, borderRight: `1px solid ${C.cardBorder}` }}>{tot.manned.toFixed(1)}</td>
                  <td style={{ ...tdT, color: C.text }}>{tot.cases}</td>
                  <td style={{ ...tdT, color: C.success }}>{tot.pass}</td>
                  <td style={{ ...tdT, color: tot.failed > 0 ? C.danger : C.muted, borderRight: `1px solid ${C.cardBorder}` }}>{tot.failed}</td>
                  <td style={{ ...tdT, color: tot.issuesH > 0 ? C.warning : C.muted }}>{tot.issuesH}</td>
                  <td style={{ ...tdT, color: C.success, borderRight: `1px solid ${C.cardBorder}` }}>{tot.issuesF}</td>
                  <td style={{ ...tdT }}><span style={{ background: C.success+"18", color:C.success, borderRadius:20, padding:"3px 10px", fontSize:11 }}>{tFix}%</span></td>
                  <td style={{ ...tdT }}><span style={{ background: C.success+"18", color:C.success, borderRadius:20, padding:"3px 10px", fontSize:11 }}>{tSucc}%</span></td>
                </tr>
              );
            })()}
          </tbody>
        </table>
      </div>
    </div>
  );
}
