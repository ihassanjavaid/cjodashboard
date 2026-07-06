import { useState, useEffect, useCallback } from 'react';
import Papa from 'papaparse';
import { mapRowToSchema } from '../shared/schemaMapper.js';
import { designSchema, stdSchema, strategySchema } from '../shared/sheetSchemas.js';
import { parseProcessSheet } from '../shared/parseProcessSheet.js';

const SCHEMA_BY_TAB = {
  design:   designSchema,
  std:      stdSchema,
  strategy: strategySchema,
  // process uses the block-detection parser, not a tabular schema — see fetchPublicCsvFromBrowser.
};

// Direct-fetch mode: when VITE_SHEET_ID_<TAB> is set, the frontend fetches the
// public Google Sheets CSV directly and bypasses /api/data entirely. This makes
// `npm run dev` work without needing the serverless backend or Vercel KV.
function getDirectSheetConfig(tab) {
  // Design uses fetchAllWorksheets on the backend (one worksheet per month —
  // December, January, February, …). Enumerating worksheets requires the
  // Sheets API metadata endpoint, which needs OAuth — not available from the
  // browser without heavy client-side OAuth state. Force design through
  // /api/data so the backend's multi-worksheet concatenation is preserved.
  if (tab === 'design') return null;
  const sheetId = import.meta.env[`VITE_SHEET_ID_${tab.toUpperCase()}`];
  if (!sheetId) return null;
  const gid = import.meta.env[`VITE_SHEET_GID_${tab.toUpperCase()}`] ?? '0';
  return { sheetId, gid };
}

async function fetchPublicCsvFromBrowser({ sheetId, gid }, tab, schema) {
  // gviz endpoint works for any "Anyone with the link can view" sheet without
  // requiring File → Publish to web. The /export?format=csv endpoint 400s on
  // sheets that aren't explicitly published.
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&gid=${gid}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Sheet fetch failed: ${res.status}`);
  const text = await res.text();
  // Process tab uses the multi-block parser instead of a tabular schema.
  if (tab === 'process') return parseProcessSheet(text);
  const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
  if (!schema || Object.keys(schema).length === 0) return parsed.data;
  return parsed.data.map(row => mapRowToSchema(row, schema));
}

export function useDashboardData(tab, refreshTrigger = 0) {
  const [state, setState] = useState({
    rows: null,
    lastSyncedAt: null,
    sheetStatus: 'loading',
    error: null,
  });

  const fetchData = useCallback(async () => {
    const direct = getDirectSheetConfig(tab);

    if (direct) {
      try {
        const schema = SCHEMA_BY_TAB[tab];
        const rows = await fetchPublicCsvFromBrowser(direct, tab, schema);
        setState({
          rows,
          lastSyncedAt: new Date().toISOString(),
          sheetStatus: 'ok',
          error: null,
        });
        return;
      } catch (e) {
        setState(prev => ({ ...prev, sheetStatus: 'error', error: e.message }));
        return;
      }
    }

    try {
      const res = await fetch(`/api/data?tab=${tab}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setState({
        rows: data.rows,
        lastSyncedAt: data.lastSyncedAt,
        sheetStatus: data.sheetStatus,
        error: null,
      });
    } catch (e) {
      setState(prev => ({ ...prev, sheetStatus: 'error', error: e.message }));
    }
  }, [tab]);

  useEffect(() => {
    fetchData();
  }, [fetchData, refreshTrigger]);

  return { ...state, refresh: fetchData };
}
