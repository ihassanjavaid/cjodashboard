// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock googleapis BEFORE importing the module under test so the import-time
// `import { google } from 'googleapis'` picks up the mock.
const mockSpreadsheetsGet = vi.fn();
const mockValuesGet = vi.fn();
const mockValuesBatchGet = vi.fn();
const mockSetCredentials = vi.fn();
class MockOAuth2 {
  setCredentials(...args) { mockSetCredentials(...args); }
}
vi.mock('googleapis', () => ({
  google: {
    auth: { OAuth2: MockOAuth2 },
    sheets: () => ({
      spreadsheets: {
        get: mockSpreadsheetsGet,
        values: { get: mockValuesGet, batchGet: mockValuesBatchGet },
      },
    }),
  },
}));

const { fetchPublicCsv, fetchSheet, fetchAuthSheet, valuesToRowObjects } = await import('./fetchSheet.js');

describe('fetchPublicCsv', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('builds the export URL and parses CSV into row objects', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => 'name,age\nAlice,30\nBob,25',
    });

    const rows = await fetchPublicCsv({ sheetId: 'SHEET123', gid: '0' });

    expect(fetch).toHaveBeenCalledWith(
      'https://docs.google.com/spreadsheets/d/SHEET123/gviz/tq?tqx=out:csv&gid=0',
      expect.objectContaining({ redirect: 'follow' }),
    );
    expect(rows).toEqual([
      { name: 'Alice', age: '30' },
      { name: 'Bob', age: '25' },
    ]);
  });

  it('throws on non-2xx response', async () => {
    fetch.mockResolvedValueOnce({ ok: false, status: 404, text: async () => '' });
    await expect(fetchPublicCsv({ sheetId: 'X', gid: '0' }))
      .rejects.toThrow(/404/);
  });

  it('uses default gid 0 when not provided', async () => {
    fetch.mockResolvedValueOnce({ ok: true, text: async () => 'a\n1' });
    await fetchPublicCsv({ sheetId: 'X' });
    expect(fetch.mock.calls[0][0]).toContain('gid=0');
  });
});

describe('fetchSheet dispatch', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    process.env.GOOGLE_CLIENT_ID = 'cid';
    process.env.GOOGLE_CLIENT_SECRET = 'csec';
    process.env.GOOGLE_REFRESH_TOKEN = 'rt';
    mockSpreadsheetsGet.mockReset();
    mockValuesGet.mockReset();
    mockValuesBatchGet.mockReset();
  });
  afterEach(() => {
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
    delete process.env.GOOGLE_REFRESH_TOKEN;
  });

  it('routes mode:public through fetchPublicCsv and applies schema mapping', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      text: async () => 'Project,Count of Users\nTamasha,16',
    });

    const config = {
      sheetId: 'X',
      gid: '0',
      mode: 'public',
      parser: 'tabular',
      schema: {
        project:     { column: 'Project',        type: 'string' },
        count_users: { column: 'Count of Users', type: 'number' },
      },
    };

    const rows = await fetchSheet(config);
    expect(rows).toEqual([{ project: 'Tamasha', count_users: 16 }]);
  });

  it('throws for unknown parser strategy', async () => {
    fetch.mockResolvedValueOnce({ ok: true, text: async () => 'a\n1' });
    const config = { sheetId: 'X', gid: '0', mode: 'public', parser: 'unknown', schema: {} };
    await expect(fetchSheet(config)).rejects.toThrow(/parser/i);
  });

  it('routes parser:process-blocks through parseProcessSheet and returns the parsed shape', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      text: async () => 'Processes,,,,,,,,,,,,\nCall Center,264,,,,,,,,,,,\nUnique,498,,,,,,,,,,,',
    });
    const config = { sheetId: 'X', gid: '0', mode: 'public', parser: 'process-blocks', schema: null };
    const result = await fetchSheet(config);
    expect(result).toMatchObject({
      counts: [{ team: 'Call Center', count: 264 }],
      unique: 498,
    });
  });

  it('fetchAuthSheet returns keyed object for multi-gid config', async () => {
    mockSpreadsheetsGet.mockResolvedValueOnce({
      data: { sheets: [
        { properties: { sheetId: 111, title: 'BAU' } },
        { properties: { sheetId: 222, title: 'JLV' } },
      ] },
    });
    mockValuesBatchGet.mockResolvedValueOnce({
      data: { valueRanges: [
        { values: [['name', 'count'], ['Alice', '5'], ['Bob', '3']] },
        { values: [['name', 'count'], ['Carol', '7']] },
      ] },
    });

    const result = await fetchAuthSheet({
      sheetId: 'SID',
      gids: { bau: '111', jlv: '222' },
    });

    expect(mockValuesBatchGet).toHaveBeenCalledWith({
      spreadsheetId: 'SID',
      ranges: ['BAU', 'JLV'],
    });
    expect(result).toEqual({
      bau: [{ name: 'Alice', count: '5' }, { name: 'Bob', count: '3' }],
      jlv: [{ name: 'Carol', count: '7' }],
    });
  });

  it('fetchAuthSheet throws clear error when OAuth env vars are missing', async () => {
    delete process.env.GOOGLE_REFRESH_TOKEN;
    await expect(fetchAuthSheet({ sheetId: 'X', gid: '0' }))
      .rejects.toThrow(/GOOGLE_REFRESH_TOKEN/);
  });

  it('fetchSheet routes multi-gid auth config through fetchAuthSheet and returns keyed object', async () => {
    mockSpreadsheetsGet.mockResolvedValueOnce({
      data: { sheets: [{ properties: { sheetId: 111, title: 'BAU' } }, { properties: { sheetId: 222, title: 'JLV' } }] },
    });
    mockValuesBatchGet.mockResolvedValueOnce({
      data: { valueRanges: [
        { values: [['col'], ['x']] },
        { values: [['col'], ['y']] },
      ] },
    });

    const result = await fetchSheet({
      sheetId: 'SID',
      gids: { bau: '111', jlv: '222' },
      mode: 'auth',
      parser: 'tabular',
      schema: {},
    });
    expect(result).toEqual({ bau: [{ col: 'x' }], jlv: [{ col: 'y' }] });
  });

  it('fetchAuthSheet honours per-stream skipRows when extracting headers', async () => {
    mockSpreadsheetsGet.mockResolvedValueOnce({
      data: { sheets: [
        { properties: { sheetId: 111, title: 'BAU' } },
        { properties: { sheetId: 222, title: 'JLV' } },
      ] },
    });
    mockValuesBatchGet.mockResolvedValueOnce({
      data: { valueRanges: [
        // BAU: header on row 1 — no skip.
        { values: [['name', 'count'], ['Alice', '5']] },
        // JLV: row 1 group titles, row 2 blank, row 3 actual headers.
        { values: [
          ['Group A', '', ''],
          ['', '', ''],
          ['name', 'count'],
          ['Carol', '7'],
        ] },
      ] },
    });

    const result = await fetchAuthSheet({
      sheetId: 'SID',
      gids: { bau: '111', jlv: '222' },
      skipRows: { bau: 0, jlv: 2 },
    });

    expect(result).toEqual({
      bau: [{ name: 'Alice', count: '5' }],
      jlv: [{ name: 'Carol', count: '7' }],
    });
  });

  it('fetchAuthSheet with fetchAllWorksheets enumerates and concatenates every worksheet', async () => {
    mockSpreadsheetsGet.mockResolvedValueOnce({
      data: { sheets: [
        { properties: { sheetId: 1, title: 'December' } },
        { properties: { sheetId: 2, title: 'January' } },
        { properties: { sheetId: 3, title: 'February' } },
      ] },
    });
    mockValuesBatchGet.mockResolvedValueOnce({
      data: { valueRanges: [
        { values: [['Project', 'Start Date'], ['A', '12/01/2024']] },
        { values: [['Project', 'Start Date'], ['B', '01/15/2025'], ['C', '01/20/2025']] },
        { values: [['Project', 'Start Date'], ['D', '02/05/2025']] },
      ] },
    });

    const result = await fetchAuthSheet({
      sheetId: 'SID',
      fetchAllWorksheets: true,
    });

    expect(mockSpreadsheetsGet).toHaveBeenCalledWith({
      spreadsheetId: 'SID',
      fields: 'sheets.properties',
    });
    expect(mockValuesBatchGet).toHaveBeenCalledWith({
      spreadsheetId: 'SID',
      ranges: ['December', 'January', 'February'],
    });
    expect(result).toEqual([
      { Project: 'A', 'Start Date': '12/01/2024', __worksheet: 'December' },
      { Project: 'B', 'Start Date': '01/15/2025', __worksheet: 'January' },
      { Project: 'C', 'Start Date': '01/20/2025', __worksheet: 'January' },
      { Project: 'D', 'Start Date': '02/05/2025', __worksheet: 'February' },
    ]);
  });

  it('fetchSheet applies tabular schema to fetchAllWorksheets concatenated output', async () => {
    mockSpreadsheetsGet.mockResolvedValueOnce({
      data: { sheets: [
        { properties: { sheetId: 1, title: 'December' } },
        { properties: { sheetId: 2, title: 'January' } },
      ] },
    });
    mockValuesBatchGet.mockResolvedValueOnce({
      data: { valueRanges: [
        { values: [['Project'], ['Alpha']] },
        { values: [['Project'], ['Beta']] },
      ] },
    });

    const result = await fetchSheet({
      sheetId: 'SID',
      mode: 'auth',
      parser: 'tabular',
      fetchAllWorksheets: true,
      schema: { project: { column: 'Project', type: 'string' } },
    });

    expect(result).toEqual([
      { project: 'Alpha' },
      { project: 'Beta' },
    ]);
  });

  it('fetchSheet applies per-stream schemas for multi-gid std-style configs', async () => {
    mockSpreadsheetsGet.mockResolvedValueOnce({
      data: { sheets: [
        { properties: { sheetId: 111, title: 'BAU' } },
        { properties: { sheetId: 222, title: 'JLV' } },
      ] },
    });
    mockValuesBatchGet.mockResolvedValueOnce({
      data: { valueRanges: [
        { values: [['UAT Name', 'Total'], ['BAU One', '10']] },
        { values: [['UAT Name', 'Cases'], ['JLV One', '20']] },
      ] },
    });

    const result = await fetchSheet({
      sheetId: 'SID',
      gids: { bau: '111', jlv: '222' },
      mode: 'auth',
      parser: 'tabular',
      schemas: {
        bau: {
          source:   { column: '__SOURCE__', type: 'string', transform: () => 'BAU' },
          uat_name: { column: 'UAT Name',   type: 'string' },
          total:    { column: 'Total',      type: 'number' },
        },
        jlv: {
          source:   { column: '__SOURCE__', type: 'string', transform: () => 'JLV' },
          uat_name: { column: 'UAT Name',   type: 'string' },
          cases:    { column: 'Cases',      type: 'number' },
        },
      },
    });

    expect(result).toEqual({
      bau: [{ source: 'BAU', uat_name: 'BAU One', total: 10 }],
      jlv: [{ source: 'JLV', uat_name: 'JLV One', cases: 20 }],
    });
  });
});

describe('valuesToRowObjects', () => {
  it('skips the configured number of rows before reading headers', () => {
    const values = [
      ['Group Title', '', ''],     // row 1: merged group titles (skipped)
      ['', '', ''],                 // row 2: blank (skipped)
      ['name', 'age', 'role'],     // row 3: actual headers
      ['Alice', '30', 'eng'],
      ['Bob', '25', 'pm'],
    ];
    expect(valuesToRowObjects(values, 2)).toEqual([
      { name: 'Alice', age: '30', role: 'eng' },
      { name: 'Bob', age: '25', role: 'pm' },
    ]);
  });
});
