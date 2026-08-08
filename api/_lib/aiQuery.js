// AI Sense — deterministic query engine.
//
// The LLM never computes numbers itself. It calls the `query_data` tool with
// a source + filters + aggregate, and this file does the actual counting/
// summing in plain JS against the same data the rest of the dashboard renders.
// That keeps every number the bot reports exact and re-derivable, instead of
// relying on the model to "read" a wall of rows and do arithmetic in its head.

export const DATA_SOURCES = [
  'design',
  'std_bau',
  'std_jlv',
  'process_counts',
  'process_productivity',
  'process_tat',
  'process_bvs',
  'social',
  'stdtracker',
];

// Follower / count columns from the social sheet sometimes arrive as
// "12,345", "1.2K", "3.4M", or already-numeric. Normalize all of them.
const SUFFIX_MULTIPLIER = { k: 1e3, m: 1e6, b: 1e9 };

export function toNumber(raw) {
  if (raw === null || raw === undefined || raw === '') return 0;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : 0;
  const s = String(raw).trim().replace(/,/g, '');
  const suffixMatch = s.match(/^(-?[\d.]+)\s*([kKmMbB])$/);
  if (suffixMatch) {
    return parseFloat(suffixMatch[1]) * (SUFFIX_MULTIPLIER[suffixMatch[2].toLowerCase()] || 1);
  }
  const n = parseFloat(s.replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

// Case-insensitive substring match for strings (so "ali hamza" matches
// "Ali Hamza", "ALI HAMZA ", etc.) and exact numeric match for numbers.
function matchesFilter(rowValue, filterValue) {
  if (filterValue === null || filterValue === undefined || filterValue === '') return true;
  if (typeof filterValue === 'number') return toNumber(rowValue) === filterValue;
  const rv = String(rowValue ?? '').toLowerCase();
  const fv = String(filterValue).toLowerCase();
  return rv.includes(fv);
}

function matchRow(row, filters) {
  if (!filters) return true;
  return Object.entries(filters).every(([key, value]) => matchesFilter(row[key], value));
}

function computeAggregate(rows, aggregate, field, limit) {
  switch (aggregate) {
    case 'count':
      return rows.length;
    case 'sum':
      return round2(rows.reduce((s, r) => s + toNumber(r[field]), 0));
    case 'avg':
      return rows.length ? round2(rows.reduce((s, r) => s + toNumber(r[field]), 0) / rows.length) : 0;
    case 'min':
      return rows.length ? round2(Math.min(...rows.map((r) => toNumber(r[field])))) : null;
    case 'max':
      return rows.length ? round2(Math.max(...rows.map((r) => toNumber(r[field])))) : null;
    case 'list':
      return rows.slice(0, Math.min(Math.max(limit || 20, 1), 50));
    default:
      return { error: `Unknown aggregate "${aggregate}". Use count, sum, avg, min, max, or list.` };
  }
}

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

export function runQuery(datasets, args = {}) {
  const { source, filters = {}, aggregate = 'count', field, groupBy, limit = 20 } = args;

  const rows = datasets[source];
  if (!rows) {
    return { error: `Unknown source "${source}". Valid sources: ${DATA_SOURCES.join(', ')}` };
  }
  if ((aggregate === 'sum' || aggregate === 'avg' || aggregate === 'min' || aggregate === 'max') && !field) {
    return { error: `aggregate "${aggregate}" requires a "field" (numeric column name).` };
  }

  const filtered = rows.filter((r) => matchRow(r, filters));

  if (groupBy) {
    const groups = new Map();
    for (const row of filtered) {
      const raw = row[groupBy];
      const key = raw === undefined || raw === null || raw === '' ? '(blank)' : String(raw);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(row);
    }
    const result = {};
    for (const [key, subset] of groups.entries()) {
      result[key] = computeAggregate(subset, aggregate, field, limit);
    }
    return {
      source, filters, groupBy, aggregate, field: field || null,
      matchedRows: filtered.length,
      result,
    };
  }

  return {
    source, filters, aggregate, field: field || null,
    matchedRows: filtered.length,
    result: computeAggregate(filtered, aggregate, field, limit),
  };
}

// Fallback discovery tool: lets the model inspect field names and sample
// values for a source when the system-prompt schema summary isn't enough
// (e.g. it's unsure of exact status labels or product-type spellings).
export function describeSource(datasets, source) {
  const rows = datasets[source];
  if (!rows) return { error: `Unknown source "${source}". Valid sources: ${DATA_SOURCES.join(', ')}` };
  const sample = rows[0] || {};
  const fields = Object.keys(sample);
  const exampleValues = {};
  for (const f of fields) {
    const values = [...new Set(
      rows.slice(0, 300).map((r) => r[f]).filter((v) => v !== '' && v !== null && v !== undefined)
    )].slice(0, 8);
    exampleValues[f] = values;
  }
  return { source, rowCount: rows.length, fields, exampleValues };
}
