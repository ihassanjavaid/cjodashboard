// Sidebar — Jazz World logo, nav items with active stripe, sync card at bottom.

import { useState } from 'react';
import { JW_LOGO } from '../../shared/dashboardKit.jsx';
import { relativeTime } from '../lib/utils.js';

const ICONS = {
  design: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  ),
  std: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  ),
  process: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="5" r="2" />
      <circle cx="5" cy="19" r="2" />
      <circle cx="19" cy="19" r="2" />
      <path d="M12 7v3M12 13l-5 4M12 13l5 4" />
    </svg>
  ),
  strategy: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3v18h18" />
      <path d="M7 14l4-4 4 4 5-5" />
    </svg>
  ),
  diagnostics: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v4l2 2" />
    </svg>
  ),
};

const TEAM_TAB_IDS = ['design', 'std', 'process'];
const OVERVIEW_TAB_IDS = ['strategy'];

export function Sidebar({ tabs, activeTab, onChangeTab, lastSyncedAt, onSyncComplete, syncStatus }) {
  const tabById = Object.fromEntries(tabs.map((t) => [t.id, t]));
  const teamTabs     = TEAM_TAB_IDS.map((id) => tabById[id]).filter(Boolean);
  const overviewTabs = OVERVIEW_TAB_IDS.map((id) => tabById[id]).filter(Boolean);

  const renderItem = (t) => (
    <button
      key={t.id}
      type="button"
      className="nu-nav__item"
      data-active={t.id === activeTab}
      onClick={() => onChangeTab(t.id)}
      aria-current={t.id === activeTab ? 'page' : undefined}
    >
      <span className="nu-nav__item-icon">{ICONS[t.id]}</span>
      <span>{t.label}</span>
      {t.count != null && <span className="nu-nav__count">{t.count}</span>}
    </button>
  );

  return (
    <aside className="nu-sidebar">
      <div className="nu-brand">
        <img src={JW_LOGO} alt="Jazz World" className="nu-brand__logo" />
        <div className="nu-brand__name">
          <span className="nu-brand__title">CJO Dashboard</span>
          <span className="nu-brand__sub">Jazz World</span>
        </div>
      </div>

      <nav className="nu-nav" aria-label="Primary">
        <div className="nu-nav__group">
          <span className="nu-nav__label">Teams</span>
          {teamTabs.map(renderItem)}
        </div>

        {overviewTabs.length > 0 && (
          <div className="nu-nav__group">
            <span className="nu-nav__label">Overview</span>
            {overviewTabs.map(renderItem)}
          </div>
        )}

        <div className="nu-nav__group">
          <span className="nu-nav__label">General</span>
          <a className="nu-nav__item" href="/diagnostics">
            <span className="nu-nav__item-icon">{ICONS.diagnostics}</span>
            <span>Diagnostics</span>
          </a>
        </div>

        <div style={{ flex: 1 }} />

        <SyncCard
          status={syncStatus}
          lastSyncedAt={lastSyncedAt}
          onSyncComplete={onSyncComplete}
        />
      </nav>
    </aside>
  );
}

// ── Sync card (replaces Donezo's promo card) ─────────────────────────────

function SyncCard({ status, lastSyncedAt, onSyncComplete }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const handleSync = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/manual-sync', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (res.status === 429) {
        const seconds = data.retryAfterSeconds || 120;
        throw new Error(`Cooldown active. Try again in ${seconds}s.`);
      }
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      onSyncComplete?.(data);
    } catch (e) {
      setError(e.message || 'failed');
    } finally {
      setBusy(false);
    }
  };

  let dotClass = 'nu-sync-dot nu-sync-dot--idle';
  let label = 'Never synced';
  let timeText = '—';

  if (busy) {
    dotClass = 'nu-sync-dot nu-sync-dot--live';
    label = 'Syncing now';
    timeText = 'In progress';
  } else if (error) {
    dotClass = 'nu-sync-dot nu-sync-dot--error';
    label = 'Sync failed';
    timeText = error;
  } else if (lastSyncedAt) {
    dotClass = status === 'live' ? 'nu-sync-dot nu-sync-dot--live' : 'nu-sync-dot';
    label = 'Last synced';
    timeText = relativeTime(lastSyncedAt);
  } else if (status === 'unconfigured' || status === 'never-synced' || status === 'hardcoded') {
    label = 'Showing fallback';
    timeText = 'Sheet not synced';
  }

  return (
    <section className="nu-sync-card" aria-live="polite">
      <div className="nu-sync-card__label">{label}</div>
      <div className="nu-sync-card__time">
        <span className={dotClass} aria-hidden="true" />
        {timeText}
      </div>
      <button type="button" className="nu-sync-card__btn" onClick={handleSync} disabled={busy}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
          <path d="M21 3v5h-5" />
          <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
          <path d="M3 21v-5h5" />
        </svg>
        {busy ? 'Syncing…' : 'Sync now'}
      </button>
    </section>
  );
}
