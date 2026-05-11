// ChartFrame wraps charts and dense data lists in the same card vocabulary.

import { useId } from 'react';

export function ChartFrame({ title, caption, action, children, empty, legend, sunk = false, span }) {
  const titleId = useId();
  const captionId = useId();
  const cls = `nu-card nu-chart-card ${sunk ? 'nu-card--sunk' : ''}`;
  const style = span ? { gridColumn: `span ${span}` } : undefined;
  return (
    <section
      className={cls}
      style={style}
      role="group"
      aria-labelledby={titleId}
      aria-describedby={caption ? captionId : undefined}
    >
      <header className="nu-card__head">
        <div>
          <h3 className="nu-card__title" id={titleId}>{title}</h3>
          {caption ? <div className="nu-card__caption" id={captionId}>{caption}</div> : null}
        </div>
        {action ? <span className="nu-card__action">{action}</span> : null}
      </header>
      <div className="nu-card__body">
        {empty ? <div className="nu-card__empty">No data for current selection</div> : children}
      </div>
      {legend && legend.length > 0 && (
        <div className="nu-card__legend">
          {legend.map((l, i) => (
            <span key={i} className="nu-card__legend-item">
              <span className="nu-card__legend-swatch" style={{ background: l.color }} />
              <span>{l.label}</span>
            </span>
          ))}
        </div>
      )}
    </section>
  );
}

export function NUTooltip({ active, payload, label, formatter }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="nu-tooltip" role="tooltip">
      {label != null && <div className="nu-tooltip__label">{label}</div>}
      <div className="nu-tooltip__items">
        {payload.map((p, i) => {
          const value = formatter ? formatter(p.value, p.name, p) : (
            typeof p.value === 'number' ? p.value.toLocaleString() : p.value
          );
          const color = p.color || p.fill || p.stroke || 'var(--nu-accent)';
          return (
            <div key={`${p.name}-${i}`} className="nu-tooltip__row">
              <span className="nu-tooltip__name">
                <span className="nu-tooltip__dot" style={{ background: color }} />
                {p.name}
              </span>
              <span className="nu-tooltip__value">{value}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
