// Recharts theming for /new-ui. This keeps chart styling close to the
// shadcn/Recharts pattern: CSS-token colors, quiet grids, small mono axes, and
// dense tooltips that feel like product UI rather than standalone graphics.

const FALLBACK = {
  ink:        'oklch(22% 0.018 25)',
  ink2:       'oklch(40% 0.014 25)',
  ink3:       'oklch(58% 0.010 25)',
  ink4:       'oklch(74% 0.008 25)',
  line:       'oklch(90% 0.006 25)',
  surface:    'oklch(99% 0.003 25)',
  surface2:   'oklch(96% 0.005 25)',
  accent:     'oklch(38% 0.165 25)',
  accent2:    'oklch(48% 0.18 28)',
  accentSoft: 'oklch(38% 0.165 25 / 0.10)',
  positive:   'oklch(48% 0.10 145)',
  negative:   'oklch(45% 0.16 25)',
  warning:    'oklch(60% 0.12 75)',
};

function resolve(varName, fallback) {
  if (typeof window === 'undefined' || typeof getComputedStyle === 'undefined') return fallback;
  const root = document.querySelector('.nu');
  if (!root) return fallback;
  const v = getComputedStyle(root).getPropertyValue(varName).trim();
  return v || fallback;
}

export function chartColors() {
  return {
    ink:        resolve('--nu-ink', FALLBACK.ink),
    ink2:       resolve('--nu-ink-2', FALLBACK.ink2),
    ink3:       resolve('--nu-ink-3', FALLBACK.ink3),
    ink4:       resolve('--nu-ink-4', FALLBACK.ink4),
    line:       resolve('--nu-line', FALLBACK.line),
    surface:    resolve('--nu-card', FALLBACK.surface),
    surface2:   resolve('--nu-card-sunk', FALLBACK.surface2),
    accent:     resolve('--nu-accent', FALLBACK.accent),
    accent2:    resolve('--nu-accent-2', FALLBACK.accent2),
    accentSoft: resolve('--nu-accent-soft', FALLBACK.accentSoft),
    positive:   resolve('--nu-positive', FALLBACK.positive),
    negative:   resolve('--nu-negative', FALLBACK.negative),
    warning:    resolve('--nu-warning', FALLBACK.warning),
    cursor:     'oklch(38% 0.165 25 / 0.055)',
    palette: [
      resolve('--nu-chart-1', 'oklch(38% 0.165 25)'),
      resolve('--nu-chart-2', 'oklch(45% 0.10 230)'),
      resolve('--nu-chart-3', 'oklch(55% 0.12 145)'),
      resolve('--nu-chart-4', 'oklch(65% 0.13 75)'),
      resolve('--nu-chart-5', 'oklch(50% 0.08 305)'),
      resolve('--nu-chart-6', 'oklch(72% 0.05 25)'),
    ],
  };
}

export function axisProps(colors, opts = {}) {
  const { side = 'x', minimal = false } = opts;
  return {
    axisLine: false,
    tickLine: false,
    tick: {
      fill: colors.ink3,
      fontSize: 10.5,
      fontFamily: "'JetBrains Mono', monospace",
      letterSpacing: 0.4,
    },
    tickMargin: side === 'x' ? 10 : 8,
    minTickGap: minimal ? 32 : 4,
  };
}

export function gridProps(colors) {
  return {
    stroke: colors.line,
    strokeDasharray: '3 5',
    strokeOpacity: 0.78,
    vertical: false,
  };
}

export function chartMargins(type = 'default') {
  if (type === 'vertical') return { top: 8, right: 18, bottom: 4, left: 0 };
  if (type === 'composed') return { top: 10, right: 12, bottom: 4, left: 0 };
  return { top: 8, right: 10, bottom: 4, left: 0 };
}
