import { C, SectionTitle } from '../shared/dashboardKit.jsx';
import { useDashboardDataWithFallback } from '../hooks/useDashboardDataWithFallback.js';

export const STRATEGY_DATA = [];

export function StrategyTab({ syncTick }) {
  const { rows: liveRows } = useDashboardDataWithFallback('strategy', STRATEGY_DATA, syncTick);
  const rows = liveRows ?? STRATEGY_DATA;

  const PRIORITY_META = {
    "Very High": { icon: "🔴", color: "#8B1A1A", bg: "#8B1A1A18", label: "Very High" },
    "High":      { icon: "🟠", color: "#B8860B", bg: "#B8860B18", label: "High" },
    "Medium":    { icon: "🟡", color: "#6B8E23", bg: "#6B8E2318", label: "Medium" },
    "—":         { icon: "⚪", color: "#9E9089", bg: "#9E908918", label: "—" },
  };

  return (
    <div style={{ paddingBottom: 40 }}>
      <SectionTitle>Strategic Overview — CJO Initiatives</SectionTitle>
      <div className="cjo-scroll-x" style={{ background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 14, boxShadow: C.shadow }}>
        <table style={{ width: "100%", minWidth: 1100, borderCollapse: "collapse", fontFamily: "Poppins,sans-serif", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#F5F2F0" }}>
              {[
                { key: "sr",         label: "Sr#",         w: 48  },
                { key: "name",       label: "Initiative",  w: 260 },
                { key: "dependent",  label: "Dependent",   w: 130 },
                { key: "team",       label: "Team",        w: 180 },
                { key: "startMonth", label: "Start",       w: 80  },
                { key: "endMonth",   label: "End",         w: 110 },
                { key: "pct",        label: "% Complete",  w: 180 },
                { key: "priority",   label: "Priority",    w: 100 },
                { key: "action",     label: "Action Item", w: 180 },
              ].map(col => (
                <th key={col.key} style={{ width: col.w, padding: "12px 14px", textAlign: "left", color: C.textSub, fontWeight: 600, fontSize: 11, borderBottom: `2px solid ${C.cardBorder}`, whiteSpace: "nowrap", letterSpacing: "0.02em" }}>{col.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const pri = PRIORITY_META[row.priority] || PRIORITY_META["—"];
              const pctInt = Math.round(row.pct * 100);
              const barColor = pctInt >= 50 ? C.success : pctInt >= 10 ? C.warning : C.accent;
              return (
                <tr key={i}
                  style={{ borderBottom: `1px solid ${C.cardBorder}`, background: i % 2 === 0 ? "#fff" : "#FAF7F5", transition: "background 0.12s" }}
                  onMouseEnter={e => e.currentTarget.style.background = "#F5EDE8"}
                  onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? "#fff" : "#FAF7F5"}>

                  {/* Sr# */}
                  <td style={{ padding: "13px 14px", color: C.muted, fontWeight: 600, fontSize: 12 }}>{row.sr}</td>

                  {/* Initiative name */}
                  <td style={{ padding: "13px 14px", color: C.text, fontWeight: 600, fontSize: 13 }}>{row.name}</td>

                  {/* Dependent */}
                  <td style={{ padding: "13px 14px", color: C.textSub, fontSize: 12 }}>{row.dependent}</td>

                  {/* Team */}
                  <td style={{ padding: "13px 14px", color: C.textSub, fontSize: 11 }}>{row.team}</td>

                  {/* Start */}
                  <td style={{ padding: "13px 14px", color: C.textSub, fontSize: 12, whiteSpace: "nowrap" }}>{row.startMonth}</td>

                  {/* End */}
                  <td style={{ padding: "13px 14px", color: C.textSub, fontSize: 12, whiteSpace: "nowrap" }}>{row.endMonth}</td>

                  {/* % Complete — progress bar */}
                  <td style={{ padding: "13px 14px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ flex: 1, height: 8, background: C.cardBorder, borderRadius: 99, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${pctInt}%`, background: barColor, borderRadius: 99, transition: "width 0.6s ease", minWidth: pctInt > 0 ? 4 : 0 }} />
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 700, color: barColor, minWidth: 34, textAlign: "right" }}>{pctInt}%</span>
                    </div>
                  </td>

                  {/* Priority — icon + badge */}
                  <td style={{ padding: "13px 14px" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: pri.bg, color: pri.color, padding: "4px 10px", borderRadius: 99, fontSize: 11, fontWeight: 600, whiteSpace: "nowrap" }}>
                      <span style={{ fontSize: 13 }}>{pri.icon}</span>
                      {pri.label}
                    </span>
                  </td>

                  {/* Action Item */}
                  <td style={{ padding: "13px 14px", color: row.action !== "—" ? C.accent : C.muted, fontSize: 12, fontWeight: row.action !== "—" ? 600 : 400 }}>{row.action}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
