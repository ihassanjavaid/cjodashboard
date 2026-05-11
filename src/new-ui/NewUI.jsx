// NewUI — Jazz World CJO dashboard, mounted at /new-ui.
// Layout: left sidebar (logo + nav + sync card) | top bar (search + period + bell + user) + main page.

import { useCallback, useEffect, useState } from 'react';
import './new-ui.css';
import { Sidebar } from './components/Sidebar.jsx';
import { TopBar } from './components/TopBar.jsx';
import { sortPeriods } from './lib/utils.js';

import { DesignView } from './tabs/DesignView.jsx';
import { StandardizationView } from './tabs/StandardizationView.jsx';
import { ProcessView } from './tabs/ProcessView.jsx';
import { StrategyView } from './tabs/StrategyView.jsx';

const TABS = [
  { id: 'design',   label: 'Design & Usability' },
  { id: 'std',      label: 'Standardization' },
  { id: 'process',  label: 'Process Team' },
  { id: 'strategy', label: 'Strategic Overview' },
];

export default function NewUI() {
  const [activeTab, setActiveTab] = useState('design');
  const [periodFrom, setPeriodFrom] = useState('All');
  const [periodTo,   setPeriodTo]   = useState('All');
  const [lastSyncedAt, setLastSyncedAt] = useState(null);
  const [syncTick, setSyncTick] = useState(0);
  const [availablePeriods, setAvailablePeriods] = useState([]);
  const [overallStatus, setOverallStatus] = useState('loading');
  const [search, setSearch] = useState('');

  // Probe live data on mount + after sync to learn lastSyncedAt + periods in data.
  // Period options are scoped to the active tab so Design's dropdown only shows
  // months that actually exist in the design sheet (and likewise for std).
  useEffect(() => {
    const collectPeriods = (rows) => {
      if (!rows) return [];
      if (Array.isArray(rows)) return rows.map((r) => r?.period).filter(Boolean);
      if (typeof rows === 'object') {
        return [...collectPeriods(rows.bau), ...collectPeriods(rows.jlv)];
      }
      return [];
    };
    Promise.all([
      fetch('/api/data?tab=design').then((r) => r.json()).catch(() => ({})),
      fetch('/api/data?tab=std').then((r) => r.json()).catch(() => ({})),
    ]).then(([design, std]) => {
      if (design.lastSyncedAt) setLastSyncedAt(design.lastSyncedAt);
      const sourceForActiveTab = activeTab === 'std' ? std : design;
      setAvailablePeriods(sortPeriods([...new Set(collectPeriods(sourceForActiveTab.rows))]));
      const liveOk = (design.sheetStatus === 'live' || std.sheetStatus === 'live');
      const anyError = (design.sheetStatus === 'error' || std.sheetStatus === 'error');
      setOverallStatus(liveOk ? 'live' : anyError ? 'error' : 'unconfigured');
    }).catch(() => setOverallStatus('error'));
  }, [syncTick, activeTab]);

  const onSyncComplete = useCallback((data) => {
    if (data?.lastSyncedAt) setLastSyncedAt(data.lastSyncedAt);
    setSyncTick((t) => t + 1);
  }, []);

  const ALL_PERIODS = availablePeriods;

  const globalPeriodRange = useCallback((period) => {
    if (periodFrom === 'All' && periodTo === 'All') return true;
    const pi = ALL_PERIODS.indexOf(period);
    if (pi === -1) return false;
    const lo = periodFrom === 'All' ? 0 : ALL_PERIODS.indexOf(periodFrom);
    const hi = periodTo   === 'All' ? ALL_PERIODS.length - 1 : ALL_PERIODS.indexOf(periodTo);
    return pi >= lo && pi <= hi;
  }, [periodFrom, periodTo, ALL_PERIODS]);

  const clearPeriod = () => { setPeriodFrom('All'); setPeriodTo('All'); };
  const showPeriod = activeTab !== 'process';

  return (
    <div className="nu">
      <div className="nu-shell">
        <Sidebar
          tabs={TABS}
          activeTab={activeTab}
          onChangeTab={setActiveTab}
          lastSyncedAt={lastSyncedAt}
          onSyncComplete={onSyncComplete}
          syncStatus={overallStatus}
        />

        <div className="nu-main">
          <TopBar
            search={search}
            onSearchChange={setSearch}
            periodFrom={periodFrom}
            periodTo={periodTo}
            periodOptions={ALL_PERIODS}
            onPeriodChange={(f, t) => { setPeriodFrom(f); setPeriodTo(t); }}
            onPeriodClear={clearPeriod}
            showPeriod={showPeriod}
          />

          {activeTab === 'design'   && <DesignView   key="design"   globalPeriodRange={globalPeriodRange} syncTick={syncTick} search={search} />}
          {activeTab === 'std'      && <StandardizationView key="std" globalPeriodRange={globalPeriodRange} syncTick={syncTick} search={search} />}
          {activeTab === 'process'  && <ProcessView  key="process"  syncTick={syncTick} search={search} />}
          {activeTab === 'strategy' && <StrategyView key="strategy" syncTick={syncTick} search={search} />}
        </div>
      </div>
    </div>
  );
}
