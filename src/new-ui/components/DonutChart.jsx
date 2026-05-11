import { fmt } from '../lib/utils.js';

// Multi-slice donut: every category is a real arc on the ring. The center
// shows the primary slice's percentage; the right-side legend lists every
// slice with dot, name, value, and percent in a single dense row each.

export function DonutChart({
  data,
  colors,
  ariaLabel,
  primaryName,
  totalLabel = 'total',
  maxRows = 7,
  // height is kept for back-compat but no longer used — the dial
  // self-sizes against the chart card body.
  height: _ignoredHeight,
}) {
  const rows = (data || [])
    .map((row, i) => ({
      ...row,
      value: Number(row.value || 0),
      fill: row.fill || colors.palette[i % colors.palette.length],
    }))
    .filter((row) => row.value > 0);
  const total = rows.reduce((sum, r) => sum + r.value, 0);
  if (!total) return null;

  const primary =
    rows.find((r) => r.name === primaryName) ||
    rows.slice().sort((a, b) => b.value - a.value)[0];
  const primaryPct = Math.round((primary.value / total) * 100);

  const visible = rows.slice(0, maxRows);
  const hidden = rows.slice(maxRows);
  const hiddenTotal = hidden.reduce((s, r) => s + r.value, 0);
  const legendRows = hiddenTotal > 0
    ? [...visible, { name: 'Other', value: hiddenTotal, fill: colors.ink4 }]
    : visible;

  // Ring math — slices follow data order so legend top-to-bottom maps to
  // the ring clockwise from 12 o'clock.
  const r = 64;
  const sw = 16;
  const c = 2 * Math.PI * r;
  const gapDeg = rows.length > 1 ? 1.6 : 0;
  const gapArc = (gapDeg / 360) * c;
  let cum = 0;
  const segments = rows.map((row) => {
    const frac = row.value / total;
    const arc = Math.max(0.6, frac * c - gapArc);
    const offset = -cum;
    cum += frac * c;
    return { ...row, arc, offset };
  });

  return (
    <div
      className="nu-dial"
      role="img"
      aria-label={ariaLabel || `${primary.name} ${primaryPct}% of ${fmt(total)} ${totalLabel}`}
    >
      <div className="nu-dial__ring">
        <svg
          className="nu-dial__svg"
          viewBox="-90 -90 180 180"
          preserveAspectRatio="xMidYMid meet"
          aria-hidden="true"
        >
          <g transform="rotate(-90)">
            <circle className="nu-dial__track" r={r} fill="none" strokeWidth={sw} />
            {segments.map((s) => (
              <circle
                key={s.name}
                className={`nu-dial__seg ${s.name === primary.name ? 'is-primary' : ''}`}
                r={r}
                fill="none"
                stroke={s.fill}
                strokeWidth={sw}
                strokeLinecap="butt"
                strokeDasharray={`${s.arc} ${c - s.arc}`}
                strokeDashoffset={s.offset}
              />
            ))}
          </g>
        </svg>
        <div className="nu-dial__center">
          <div className="nu-dial__center-value" style={{ color: primary.fill }}>{primaryPct}%</div>
          <div className="nu-dial__center-label" title={primary.name}>{primary.name}</div>
        </div>
      </div>

      <ul className="nu-dial__legend">
        {legendRows.map((row) => {
          const pct = Math.round((row.value / total) * 100);
          const isPrimary = row.name === primary.name;
          return (
            <li
              key={row.name}
              className={`nu-dial__row ${isPrimary ? 'is-primary' : ''}`}
            >
              <span className="nu-dial__row-dot" style={{ background: row.fill }} aria-hidden="true" />
              <span className="nu-dial__row-name" title={row.name}>{row.name}</span>
              <span className="nu-dial__row-val">{fmt(row.value)}</span>
              <span className="nu-dial__row-pct">{pct}%</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
