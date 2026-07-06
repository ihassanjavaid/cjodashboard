// Per-tab overrides for public Google Sheets CSV export. Kept in src/shared so
// both the Vite frontend (direct-fetch dev mode) and api/_config can import it.
export const SHEET_FETCH_OVERRIDES = {
  social: { range: 'A2:H', headersRow: true },
};
