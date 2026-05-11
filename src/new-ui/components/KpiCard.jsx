// KpiCard — Donezo-style metric card.
// Default: light card with arrow icon top-right + label + big number + sub.
// Filled variant: crimson background, used for the headline KPI.

import { NumberCounter } from './primitives.jsx';

export function KpiCard({ label, value, sub, filled = false, format }) {
  const cls = `nu-kpi ${filled ? 'nu-kpi--filled' : ''}`;
  return (
    <div className={cls}>
      <div className="nu-kpi__head">
        <div className="nu-kpi__label">{label}</div>
        <span className="nu-kpi__arrow" aria-hidden="true">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M7 17 17 7" />
            <path d="M8 7h9v9" />
          </svg>
        </span>
      </div>
      <div className="nu-kpi__value">
        {typeof value === 'number'
          ? <NumberCounter value={value} format={format} />
          : value}
      </div>
      {sub && <div className="nu-kpi__sub">{sub}</div>}
    </div>
  );
}
