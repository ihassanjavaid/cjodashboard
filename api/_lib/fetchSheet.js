import { google } from 'googleapis';
import { parseCsv } from './csv.js';
import { mapRowToSchema } from './schema.js';
import { parseProcessSheet } from '../../src/shared/parseProcessSheet.js';

export async function fetchPublicCsv({ sheetId, gid = '0' }) {
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&gid=${gid}`;
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`Sheet fetch failed: ${res.status}`);
  return parseCsv(await res.text());
}

// Process-blocks parser needs the raw CSV text (the rows aren't tabular —
// they're a stacked union of headers + data blocks), so we re-fetch as text
// rather than feeding it parsed objects.
export async function fetchPublicCsvText({ sheetId, gid = '0' }) {
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&gid=${gid}`;
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`Sheet fetch failed: ${res.status}`);
  return res.text();
}

// Lazily build an authorized Sheets client from the env-var refresh token.
// Throws if any of the three required env vars are missing.
function getSheetsClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
  const missing = [];
  if (!clientId) missing.push('GOOGLE_CLIENT_ID');
  if (!clientSecret) missing.push('GOOGLE_CLIENT_SECRET');
  if (!refreshToken) missing.push('GOOGLE_REFRESH_TOKEN');
  if (missing.length) {
    throw new Error(`Missing OAuth env vars: ${missing.join(', ')}. Run \`npm run auth\` to obtain a refresh token.`);
  }
  const auth = new google.auth.OAuth2(clientId, clientSecret);
  auth.setCredentials({ refresh_token: refreshToken });
  return google.sheets({ version: 'v4', auth });
}

// Convert a 2D array (first row = headers) into [{ header: cell, ... }] objects.
// `skipRows` drops the first N rows before treating row[skipRows] as the header
// — needed for worksheets like JLV where the actual header lives in row 3
// (group-title row + blank row above it).
export function valuesToRowObjects(values, skipRows = 0) {
  if (!values || values.length === 0) return [];
  const sliced = skipRows > 0 ? values.slice(skipRows) : values;
  if (sliced.length === 0) return [];
  const [headers, ...rest] = sliced;
  return rest.map(row => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = row[i] ?? ''; });
    return obj;
  });
}

// Resolve gid → sheet name via spreadsheet metadata. Sheets API ranges
// are addressed by sheet name (e.g. 'BAU'), not gid.
function buildGidToNameMap(spreadsheet) {
  const m = new Map();
  for (const sh of spreadsheet.sheets || []) {
    m.set(String(sh.properties.sheetId), sh.properties.title);
  }
  return m;
}

export async function fetchAuthSheet(config) {
  const sheets = getSheetsClient();

  // Auto-discover all worksheets and concatenate them into a single flat
  // array. Used by Design, where each worksheet is a month — the schema's
  // extractMonthName transform on the Start Date column produces the correct
  // `month` field regardless of which worksheet a row came from.
  if (config.fetchAllWorksheets) {
    const meta = await sheets.spreadsheets.get({
      spreadsheetId: config.sheetId,
      fields: 'sheets.properties',
    });
    const allSheets = (meta.data.sheets || []).map(s => s.properties.title);
    if (allSheets.length === 0) return [];

    const resp = await sheets.spreadsheets.values.batchGet({
      spreadsheetId: config.sheetId,
      ranges: allSheets,
    });
    const valueRanges = resp.data.valueRanges || [];

    const allRows = [];
    for (let i = 0; i < valueRanges.length; i++) {
      // skipRows accepts either a number (uniform skip across all worksheets —
      // used by Design where every month tab has the same 5-row metadata
      // preamble) or an object keyed by worksheet name (per-worksheet override).
      let skip = 0;
      if (typeof config.skipRows === 'number') skip = config.skipRows;
      else if (config.skipRows && typeof config.skipRows === 'object') skip = config.skipRows[allSheets[i]] || 0;
      const rows = valuesToRowObjects(valueRanges[i]?.values || [], skip);
      // __worksheet is a hidden debug aid; schema mapping won't preserve it
      // unless the schema explicitly references the column.
      for (const r of rows) r.__worksheet = allSheets[i];
      allRows.push(...rows);
    }
    return allRows;
  }

  // Single-gid case (back-compat with tabular schema flow).
  if (config.gid !== undefined && !config.gids) {
    const meta = await sheets.spreadsheets.get({ spreadsheetId: config.sheetId, fields: 'sheets.properties' });
    const name = buildGidToNameMap(meta.data).get(String(config.gid));
    if (!name) throw new Error(`gid ${config.gid} not found in spreadsheet ${config.sheetId}`);
    const resp = await sheets.spreadsheets.values.get({
      spreadsheetId: config.sheetId,
      range: name,
    });
    return valuesToRowObjects(resp.data.values || [], config.skipRows || 0);
  }

  // Multi-gid case: { bau: '123', jlv: '456' } → { bau: [...rows], jlv: [...rows] }.
  // `config.skipRows` is a per-key map (e.g. { bau: 0, jlv: 2 }).
  if (config.gids) {
    const meta = await sheets.spreadsheets.get({ spreadsheetId: config.sheetId, fields: 'sheets.properties' });
    const gidToName = buildGidToNameMap(meta.data);
    const entries = Object.entries(config.gids);
    const ranges = entries.map(([, gid]) => {
      const name = gidToName.get(String(gid));
      if (!name) throw new Error(`gid ${gid} not found in spreadsheet ${config.sheetId}`);
      return name;
    });
    const resp = await sheets.spreadsheets.values.batchGet({
      spreadsheetId: config.sheetId,
      ranges,
    });
    const valueRanges = resp.data.valueRanges || [];
    const out = {};
    entries.forEach(([key], i) => {
      const skip = (config.skipRows && config.skipRows[key]) || 0;
      out[key] = valuesToRowObjects(valueRanges[i]?.values || [], skip);
    });
    return out;
  }

  throw new Error('fetchAuthSheet: config must have either `gid`, `gids`, or `fetchAllWorksheets`');
}

export async function fetchSheet(config) {
  if (config.parser === 'process-blocks') {
    if (config.mode !== 'public') {
      throw new Error('process-blocks parser currently only supports mode:public');
    }
    const csvText = await fetchPublicCsvText(config);
    return parseProcessSheet(csvText);
  }

  const raw = config.mode === 'public'
    ? await fetchPublicCsv(config)
    : await fetchAuthSheet(config);

  if (config.parser === 'tabular') {
    // Multi-gid auth result: { key: [...rows] }.
    if (raw && !Array.isArray(raw) && typeof raw === 'object') {
      // Per-stream schemas (config.schemas) take precedence — each key gets
      // its own schema, used by std where BAU and JLV have different columns.
      if (config.schemas) {
        const out = {};
        for (const [k, rows] of Object.entries(raw)) {
          const s = config.schemas[k];
          out[k] = s && Object.keys(s).length
            ? rows.map(row => mapRowToSchema(row, s))
            : rows;
        }
        return out;
      }
      // Legacy single-schema applied to every stream.
      const out = {};
      for (const [k, rows] of Object.entries(raw)) {
        out[k] = config.schema && Object.keys(config.schema).length
          ? rows.map(row => mapRowToSchema(row, config.schema))
          : rows;
      }
      return out;
    }
    // Single-array path: empty schema means passthrough (preserve original headers).
    if (!config.schema || Object.keys(config.schema).length === 0) return raw;
    return raw.map(row => mapRowToSchema(row, config.schema));
  }
  throw new Error(`Unknown parser strategy: ${config.parser}`);
}
