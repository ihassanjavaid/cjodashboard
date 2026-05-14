import { useState, useCallback, useEffect } from "react";
import { DesignTab } from './tabs/DesignTab.jsx';
import { JW_LOGO, C } from './shared/dashboardKit.jsx';
import { StandardizationTab } from './tabs/StandardizationTab.jsx';
import { StrategyTab } from './tabs/StrategyTab.jsx';
import { ProcessTab } from './tabs/ProcessTab.jsx';
import { SyncButton } from './components/SyncButton.jsx';
import { Diagnostics } from './pages/Diagnostics.jsx';
import NewUI from './new-ui/NewUI.jsx';
import { LoginScreen } from './components/LoginScreen.jsx';


// ─── MAIN ─────────────────────────────────────────────────────────────────────

const TABS = [
  { id: "design", label: "Design & Usability" },
  { id: "std", label: "Standardization" },
  { id: "process", label: "Process Team" },
  { id: "strategy", label: "Strategic Overview" },
];

const DROPDOWN_ARROW = "url('data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2710%27 height=%276%27%3E%3Cpath d=%27M0 0l5 6 5-6z%27 fill=%27%2394a3b8%27/%3E%3C/svg%3E')";

function formatRelative(iso) {
  if (!iso) return null;
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

function isAuthenticated() {
  const expected = import.meta.env.VITE_APP_PASSWORD;
  if (!expected) return true; // gate disabled if no password set
  return sessionStorage.getItem('cjo_auth') === '1';
}

export default function CJODashboard() {
  const [authed, setAuthed] = useState(() => isAuthenticated());

  if (!authed) {
    return <LoginScreen onSuccess={() => setAuthed(true)} />;
  }

  if (typeof window !== 'undefined' && window.location.pathname === '/diagnostics') {
    return <Diagnostics />;
  }
  if (typeof window !== 'undefined' && window.location.pathname === '/new-ui') {
    return <NewUI />;
  }
  const [activeTab, setActiveTab] = useState("design");
  const [monthFrom, setMonthFrom] = useState("All");
  const [monthTo,   setMonthTo]   = useState("All");
  const [lastSyncedAt, setLastSyncedAt] = useState(null);
  const [syncTick, setSyncTick] = useState(0);
  const [availableMonths, setAvailableMonths] = useState([]);

  // Probe for lastSyncedAt + the union of months that actually appear in any
  // tab's data, so the period dropdown only offers months the sheets contain.
  useEffect(() => {
    const collectMonths = (rows) => {
      if (!rows) return [];
      if (Array.isArray(rows)) return rows.map(r => r?.month).filter(Boolean);
      if (typeof rows === 'object') {
        // std returns { bau, jlv } shape
        return [...collectMonths(rows.bau), ...collectMonths(rows.jlv)];
      }
      return [];
    };
    const MONTH_ORDER = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    Promise.all([
      fetch('/api/data?tab=design').then(r => r.json()).catch(() => ({})),
      fetch('/api/data?tab=std').then(r => r.json()).catch(() => ({})),
    ]).then(([design, std]) => {
      if (design.lastSyncedAt) setLastSyncedAt(design.lastSyncedAt);
      const all = new Set([...collectMonths(design.rows), ...collectMonths(std.rows)]);
      setAvailableMonths(MONTH_ORDER.filter(m => all.has(m)));
    });
  }, [syncTick]);

  const onSyncComplete = useCallback((data) => {
    setLastSyncedAt(data.lastSyncedAt);
    setSyncTick(t => t + 1);
  }, []);

  const showMonthFilter = activeTab !== "process";

  // Use months derived from live data; fall back to the calendar order so the
  // filter still works while the initial fetch is in flight.
  const ALL_MONTHS = availableMonths.length > 0
    ? availableMonths
    : ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const dynamicMonthOptions = ["All", ...ALL_MONTHS];
  const globalMonthRange = useCallback((month) => {
    if (monthFrom === "All" && monthTo === "All") return true;
    const mi = ALL_MONTHS.indexOf(month);
    const lo = monthFrom === "All" ? 0 : ALL_MONTHS.indexOf(monthFrom);
    const hi = monthTo   === "All" ? ALL_MONTHS.length - 1 : ALL_MONTHS.indexOf(monthTo);
    return mi >= lo && mi <= hi;
  }, [monthFrom, monthTo]);

  return (
    <div style={{ background: C.bg, minHeight: "100vh", fontFamily: "Poppins,sans-serif", color: C.text }}>
      <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet" />

      {/* ── HEADER ────────────────────────────────────────────────────────── */}
      <div style={{ background: C.card, borderBottom: `1px solid ${C.cardBorder}`, position: "sticky", top: 0, zIndex: 100, boxShadow: "0 1px 0 #E5E7EB" }}>
        <div className="cjo-header-inner">

          <div className="cjo-header-row" style={{ minHeight: 64, padding: "10px 0" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
              <img src={JW_LOGO} alt="Jazz World" style={{ width: 40, height: 40, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: "Poppins,sans-serif", fontWeight: 700, fontSize: 16, color: C.text, letterSpacing: "-0.02em" }}>
                  Customer Journey Optimization | Dashboard
                </div>
                <div style={{ fontSize: 11, color: C.textSub, fontFamily: "Poppins,sans-serif" }}>Performance Observatory & Data Command Center</div>

              </div>
            </div>

            {showMonthFilter && (
              <div className="cjo-period">
                <span style={{ fontSize: 12, fontWeight: 500, color: C.textSub, fontFamily: "Poppins,sans-serif" }}>Period</span>
                <select value={monthFrom} onChange={e => { setMonthFrom(e.target.value); if (monthTo !== "All" && dynamicMonthOptions.indexOf(e.target.value) > dynamicMonthOptions.indexOf(monthTo)) setMonthTo(e.target.value); }}
                  style={{ padding: "7px 28px 7px 12px", borderRadius: 8, border: `1px solid ${C.cardBorder}`, background: "#F8FAFC", color: C.text, fontSize: 12, fontFamily: "Poppins,sans-serif", fontWeight: 500, cursor: "pointer", outline: "none", appearance: "none", backgroundImage: DROPDOWN_ARROW, backgroundRepeat: "no-repeat", backgroundPosition: "right 8px center" }}>
                  {dynamicMonthOptions.map(m => <option key={m} value={m}>{m === "All" ? "Start" : m}</option>)}
                </select>
                <span style={{ color: C.muted, fontSize: 16 }}>→</span>
                <select value={monthTo} onChange={e => { setMonthTo(e.target.value); if (monthFrom !== "All" && dynamicMonthOptions.indexOf(e.target.value) < dynamicMonthOptions.indexOf(monthFrom)) setMonthFrom(e.target.value); }}
                  style={{ padding: "7px 28px 7px 12px", borderRadius: 8, border: `1px solid ${C.cardBorder}`, background: "#F8FAFC", color: C.text, fontSize: 12, fontFamily: "Poppins,sans-serif", fontWeight: 500, cursor: "pointer", outline: "none", appearance: "none", backgroundImage: DROPDOWN_ARROW, backgroundRepeat: "no-repeat", backgroundPosition: "right 8px center" }}>
                  {dynamicMonthOptions.map(m => <option key={m} value={m}>{m === "All" ? "End" : m}</option>)}
                </select>
                {(monthFrom !== "All" || monthTo !== "All") && (
                  <button onClick={() => { setMonthFrom("All"); setMonthTo("All"); }}
                    style={{ width: 28, height: 28, borderRadius: 7, border: `1px solid ${C.cardBorder}`, background: "#fff", color: C.muted, fontSize: 13, fontFamily: "Poppins,sans-serif", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
                )}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12, padding: '6px 0' }}>
            <span style={{ fontSize: 12, color: '#9E9089', fontFamily: 'Poppins,sans-serif' }}>
              {lastSyncedAt
                ? `Last synced: ${formatRelative(lastSyncedAt)}`
                : 'Never synced'}
            </span>
            <SyncButton onSyncComplete={onSyncComplete} />
          </div>

          {/* Tab navigation */}
          <div style={{ display: "flex", gap: 0, borderTop: `1px solid ${C.cardBorder}`, justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" }}>
            <div className="cjo-tabs">
              {TABS.filter(t => t.id !== "strategy").map(t => {
                const active = activeTab === t.id;
                return (
                  <button key={t.id} onClick={() => setActiveTab(t.id)}
                    style={{ padding: "12px 20px", background: "none", border: "none", cursor: "pointer", fontFamily: "Poppins,sans-serif", fontSize: 13, fontWeight: active ? 600 : 400, color: active ? C.accent : C.textSub, transition: "color 0.15s", borderBottom: active ? `2px solid ${C.accent}` : "2px solid transparent", marginBottom: -1 }}>
                    {t.label}
                  </button>
                );
              })}
            </div>
            <div>
              {(() => {
                const t = TABS.find(t => t.id === "strategy");
                const active = activeTab === "strategy";
                return (
                  <button onClick={() => setActiveTab(t.id)}
                    style={{ padding: "12px 20px", background: active ? C.accent + "12" : "none", border: "none", cursor: "pointer", fontFamily: "Poppins,sans-serif", fontSize: 13, fontWeight: active ? 600 : 400, color: active ? C.accent : C.textSub, transition: "all 0.15s", borderBottom: active ? `2px solid ${C.accent}` : "2px solid transparent", marginBottom: -1, borderRadius: "6px 6px 0 0", display: "flex", alignItems: "center", gap: 6 }}>
                    <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>
                    {t.label}
                  </button>
                );
              })()}
            </div>
          </div>
        </div>
      </div>

      {/* ── CONTENT ───────────────────────────────────────────────────────── */}
      <div className="cjo-page">
        {activeTab === "design"  && <DesignTab globalMonthRange={globalMonthRange} syncTick={syncTick} />}
        {activeTab === "std"     && <StandardizationTab globalMonthRange={globalMonthRange} syncTick={syncTick} />}
        {activeTab === "process"  && <ProcessTab syncTick={syncTick} />}
        {activeTab === "strategy" && <StrategyTab syncTick={syncTick} />}
      </div>
    </div>
  );
}
