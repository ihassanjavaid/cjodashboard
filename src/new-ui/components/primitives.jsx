// Small editorial primitives used across every tab.

import { useEffect, useRef, useState } from 'react';

// ── Kicker ─────────────────────────────────────────────────────────────────
// A small section heading: numbered + serif title + optional inline action.
export function Kicker({ num, children, action }) {
  return (
    <div className="nu-kicker">
      {num != null && <span className="nu-kicker__num">{num}</span>}
      <h2 className="nu-kicker__title">{children}</h2>
      {action && <span className="nu-kicker__action">{action}</span>}
    </div>
  );
}

// ── Stat — small inline metric inside a standfirst/sentence ───────────────
export function Stat({ value, label }) {
  return (
    <span className="nu-stat">
      <span className="nu-stat__value">{value}</span>
      <span className="nu-stat__label">{label}</span>
    </span>
  );
}

// ── Pill / Tag ────────────────────────────────────────────────────────────
export function Pill({ children, tone = 'default' }) {
  const cls =
    tone === 'accent'   ? 'nu-pill nu-pill--accent' :
    tone === 'positive' ? 'nu-pill nu-pill--positive' :
    tone === 'negative' ? 'nu-pill nu-pill--negative' :
    tone === 'warning'  ? 'nu-pill nu-pill--warning' :
                          'nu-pill';
  return <span className={cls}>{children}</span>;
}

// ── Progress ──────────────────────────────────────────────────────────────
export function Progress({ value }) {
  const v = Math.max(0, Math.min(100, Math.round(value || 0)));
  return (
    <div className="nu-progress">
      <div className="nu-progress__track">
        <div className="nu-progress__fill" style={{ width: `${v}%` }} />
      </div>
      <span className="nu-progress__value">{v}%</span>
    </div>
  );
}

// ── NumberCounter — count-up on mount (used sparingly, masthead figure) ───
export function NumberCounter({ value, duration = 700, format = (n) => n.toLocaleString() }) {
  const target = Number(value) || 0;
  const reduced = typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  // Initial state depends on reduced-motion preference. With reduction, we
  // render the target directly. Without, we animate from 0 in the effect.
  const [animated, setAnimated] = useState(reduced ? target : 0);
  const startedAt = useRef(null);

  // The animation effect — only runs when motion is allowed.
  useEffect(() => {
    if (reduced) return;
    let raf;
    startedAt.current = null;
    const step = (ts) => {
      if (startedAt.current == null) startedAt.current = ts;
      const elapsed = ts - startedAt.current;
      const t = Math.min(1, elapsed / duration);
      // ease-out quart
      const eased = 1 - Math.pow(1 - t, 4);
      setAnimated(Math.round(target * eased));
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => raf && cancelAnimationFrame(raf);
  }, [target, duration, reduced]);

  const display = reduced ? target : animated;
  return <>{format(display)}</>;
}

// ── Stale banner ──────────────────────────────────────────────────────────
export function StaleBanner({ status }) {
  if (status === 'live' || status === 'loading') return null;
  if (status === 'unconfigured' || status === 'never-synced' || status === 'hardcoded') {
    return (
      <div className="nu-stale">
        <span>Showing fallback data — sheet not configured</span>
      </div>
    );
  }
  if (status === 'error') {
    return (
      <div className="nu-stale">
        <span>Live sync failed — showing last known values</span>
      </div>
    );
  }
  return null;
}
