import { designSchema, stdSchema, strategySchema, bauSchema, jlvSchema, socialSchema } from './schemas.js';
import { SHEET_FETCH_OVERRIDES } from '../../src/shared/sheetFetchOverrides.js';
import { SOCIAL_SHEET_ID, SOCIAL_SHEET_GID } from '../../src/shared/socialSheetDefaults.js';

export const ALL_TABS = ['design', 'std', 'process', 'strategy', 'social'];

const STATIC_PER_TAB = {
  // Design pulls from a sheet with one worksheet per month (December, January,
  // …). `fetchAllWorksheets: true` enumerates and concatenates them all so the
  // dashboard sees every month's data. Uses OAuth (mode:auth) since worksheet
  // enumeration requires the Sheets API metadata endpoint.
  //
  // Each month tab has 5 metadata rows above the column headers:
  //   1: "PROJECT TRACKING SHEET - CX DESIGN & USABILITY"
  //   2: blank
  //   3: month label e.g. "December 2025"
  //   4: blank
  //   5: blank
  //   6: actual column headers — "Task no., Project / Work Item, Assigned To, …"
  // skipRows: 5 drops them so row 6 becomes the header.
  design:   { mode: 'auth',   parser: 'tabular',        schema: designSchema, fetchAllWorksheets: true, skipRows: 5 },
  process:  { mode: 'public', parser: 'process-blocks', schema: null },
  std:      { mode: 'auth',   parser: 'tabular',        schema: stdSchema },
  strategy: { mode: 'auth',   parser: 'tabular',        schema: strategySchema },
  social:   { mode: 'public', parser: 'tabular', schema: socialSchema, ...SHEET_FETCH_OVERRIDES.social },
};

export function getSheetConfig(tab) {
  if (!ALL_TABS.includes(tab)) return null;
  let sheetId = process.env[`SHEET_ID_${tab.toUpperCase()}`];
  if (!sheetId && tab === 'social') sheetId = SOCIAL_SHEET_ID;
  if (!sheetId) return null;

  // std reads two worksheets (BAU + JLV) from the same spreadsheet, so it
  // requires both gids to be set. If either is missing, treat the tab as
  // unconfigured and let the StandardizationTab fall back to hardcoded data.
  //
  // The two worksheets have different column structures so each gets its own
  // schema. JLV has a 2-row header (group titles in row 1, blank row 2,
  // actual headers in row 3) — skipRows.jlv = 2 drops those before the
  // fetch layer treats row[skipRows] as the header.
  if (tab === 'std') {
    const bauGid = process.env.SHEET_GID_STD_BAU;
    const jlvGid = process.env.SHEET_GID_STD_JLV;
    if (!bauGid || !jlvGid) return null;
    return {
      id: 'std',
      sheetId,
      gids: { bau: bauGid, jlv: jlvGid },
      schemas: { bau: bauSchema, jlv: jlvSchema },
      skipRows: { bau: 0, jlv: 2 },
      mode: 'auth',
      parser: 'tabular',
    };
  }

  const staticConfig = STATIC_PER_TAB[tab];
  // When fetchAllWorksheets is set, the gid env var is irrelevant — drop it
  // so fetchAuthSheet routes to the all-worksheets branch.
  if (staticConfig.fetchAllWorksheets) {
    return { id: tab, sheetId, ...staticConfig };
  }
  const gid = process.env[`SHEET_GID_${tab.toUpperCase()}`]
    ?? (tab === 'social' ? SOCIAL_SHEET_GID : '0');
  return { id: tab, sheetId, gid, ...staticConfig };
}

export function isTabConfigured(tab) {
  return getSheetConfig(tab) !== null;
}

export function getConfiguredTabs() {
  return ALL_TABS.filter(isTabConfigured);
}
