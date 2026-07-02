// Sidebar — Jazz World logo, nav items with active stripe, sync card at bottom.

import { useEffect, useState } from 'react';
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
  social: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
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
const MISC_TAB_IDS = ['social'];
const OVERVIEW_TAB_IDS = ['strategy'];
const DISABLED_TAB_IDS = ['strategy']; // temporarily disabled

const NAV_GROUPS = [
  { id: 'teams', label: 'Teams', tabIds: TEAM_TAB_IDS },
  { id: 'misc', label: 'Miscellaneous', tabIds: MISC_TAB_IDS },
  { id: 'overview', label: 'Overview', tabIds: OVERVIEW_TAB_IDS },
];

function NavGroup({ id, label, children, tabIds = [], activeTab }) {
  const storageKey = `nu:nav:collapsed:${id}`;
  const hasActiveChild = tabIds.includes(activeTab);
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    if (hasActiveChild) return false;
    try {
      const stored = window.localStorage.getItem(storageKey);
      if (stored === '1') return true;
      if (stored === '0') return false;
    } catch { /* no-op */ }
    return false;
  });

  useEffect(() => {
    if (hasActiveChild) setCollapsed(false);
  }, [hasActiveChild]);

  const toggle = () => {
    setCollapsed((open) => {
      const next = !open;
      try { window.localStorage.setItem(storageKey, next ? '1' : '0'); } catch { /* no-op */ }
      return next;
    });
  };

  return (
    <div className="nu-nav__group" data-collapsed={collapsed}>
      <button
        type="button"
        className="nu-nav__group-toggle"
        onClick={toggle}
        aria-expanded={!collapsed}
      >
        <span className="nu-nav__label">{label}</span>
        <svg
          className="nu-nav__group-chevron"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      <div className="nu-nav__group-body">{children}</div>
    </div>
  );
}

export function Sidebar({ tabs, activeTab, onChangeTab, lastSyncedAt, onSyncComplete, syncStatus, onLogout }) {
  const tabById = Object.fromEntries(tabs.map((t) => [t.id, t]));

  const renderItem = (t) => {
    const disabled = DISABLED_TAB_IDS.includes(t.id);
    return (
      <button
        key={t.id}
        type="button"
        className="nu-nav__item"
        data-active={t.id === activeTab}
        data-disabled={disabled}
        onClick={() => !disabled && onChangeTab(t.id)}
        aria-current={t.id === activeTab ? 'page' : undefined}
        aria-disabled={disabled}
        title={disabled ? 'Coming soon' : undefined}
      >
        <span className="nu-nav__item-icon">{ICONS[t.id]}</span>
        <span>{t.label}</span>
        {disabled
          ? <span className="nu-nav__badge">Soon</span>
          : t.count != null && <span className="nu-nav__count">{t.count}</span>
        }
      </button>
    );
  };

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
        {NAV_GROUPS.map((group) => {
          const groupTabs = group.tabIds.map((id) => tabById[id]).filter(Boolean);
          if (groupTabs.length === 0) return null;
          return (
            <NavGroup key={group.id} id={group.id} label={group.label} tabIds={group.tabIds} activeTab={activeTab}>
              {groupTabs.map(renderItem)}
            </NavGroup>
          );
        })}

        <NavGroup id="general" label="General">
          <span className="nu-nav__item" data-disabled="true" aria-disabled="true" title="Disabled">
            <span className="nu-nav__item-icon">{ICONS.diagnostics}</span>
            <span>Diagnostics</span>
            <span className="nu-nav__badge">Disabled</span>
          </span>
        </NavGroup>

        <div style={{ flex: 1 }} />

        <SyncCard
          status={syncStatus}
          lastSyncedAt={lastSyncedAt}
          onSyncComplete={onSyncComplete}
        />

        {onLogout && (
          <button
            type="button"
            className="nu-nav__item"
            onClick={onLogout}
            style={{
  marginTop: 8,
  color: 'var(--nu-ink-3)',
  borderTop: '1px solid var(--nu-border)',
  paddingTop: 10,
  borderRadius: 0,
  opacity: 0.7,
}}
          >
            <span className="nu-nav__item-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </span>
            <span>Log out</span>
          </button>
        )}
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