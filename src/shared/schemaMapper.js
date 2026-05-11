// Shared schema mapper. Used by both the frontend (direct-fetch mode in
// useDashboardData) and the backend (api/_lib/fetchSheet via re-export).
// Lives in src/shared/ so imports never cross the /api/* URL namespace
// (Vercel routes /api/* to serverless functions).
//
// Field definition shape:
//   { column: 'Sheet Header' | ['Header A', 'Header B', ...],
//     type: 'string'|'number',
//     transform?: (raw, row) => value }
//
// `column` accepts a single string OR an array of candidate header names,
// tried in order. The mapper also does case-insensitive + whitespace-trimmed
// matching so column variants like "Assigned To" / "Assigned to" / " Assigned
// To " all resolve to the same field.
//
// If `transform` is defined, it is invoked even when the raw value is missing —
// this lets schemas declare purely-derived fields. Transforms also receive the
// full row as the second argument so they can read other columns.
function findColumnValue(row, column) {
  const candidates = Array.isArray(column) ? column : [column];
  // Direct exact match first (fast path, preserves original behavior)
  for (const c of candidates) {
    const v = row[c];
    if (v !== undefined && v !== null && v !== '') return v;
  }
  // Fuzzy match: case-insensitive, whitespace-trimmed
  const rowKeys = Object.keys(row);
  if (rowKeys.length === 0) return undefined;
  const norm = s => String(s).toLowerCase().replace(/\s+/g, ' ').trim();
  const normedKeys = rowKeys.map(norm);
  for (const c of candidates) {
    const target = norm(c);
    const idx = normedKeys.indexOf(target);
    if (idx !== -1) {
      const v = row[rowKeys[idx]];
      if (v !== undefined && v !== null && v !== '') return v;
    }
  }
  return undefined;
}

export function mapRowToSchema(row, schema) {
  const result = {};
  for (const [field, def] of Object.entries(schema)) {
    const raw = findColumnValue(row, def.column);
    if (def.transform) {
      const value = def.transform(raw, row);
      if (def.type === 'number') {
        const n = Number(value);
        result[field] = Number.isFinite(n) ? n : null;
      } else {
        result[field] = (value === '' || value === null || value === undefined)
          ? ''
          : String(value).trim();
      }
      continue;
    }
    if (raw === undefined || raw === null || raw === '') {
      result[field] = def.type === 'number' ? null : '';
      continue;
    }
    if (def.type === 'number') {
      const n = Number(raw);
      result[field] = Number.isFinite(n) ? n : null;
    } else {
      result[field] = String(raw).trim();
    }
  }
  return result;
}
