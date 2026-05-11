// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest';
import { getSheetConfig, getConfiguredTabs, isTabConfigured, ALL_TABS } from './sheets.js';

describe('sheet config registry', () => {
  beforeEach(() => {
    delete process.env.SHEET_ID_DESIGN;
    delete process.env.SHEET_ID_STD;
    delete process.env.SHEET_ID_STRATEGY;
    delete process.env.SHEET_ID_PROCESS;
    delete process.env.SHEET_GID_DESIGN;
    delete process.env.SHEET_GID_STD;
    delete process.env.SHEET_GID_STRATEGY;
    delete process.env.SHEET_GID_PROCESS;
    delete process.env.SHEET_GID_STD_BAU;
    delete process.env.SHEET_GID_STD_JLV;
  });

  it('lists all four canonical tab ids', () => {
    expect(ALL_TABS).toEqual(['design', 'std', 'process', 'strategy']);
  });

  it('returns null for an unknown tab id', () => {
    expect(getSheetConfig('nonsense')).toBeNull();
  });

  it('marks a tab as unconfigured when SHEET_ID_<TAB> env var is missing', () => {
    expect(isTabConfigured('design')).toBe(false);
  });

  it('marks a tab as configured when SHEET_ID_<TAB> is set', () => {
    process.env.SHEET_ID_DESIGN = 'abc123';
    expect(isTabConfigured('design')).toBe(true);
  });

  it('builds a full design config that fetches all worksheets via OAuth', () => {
    process.env.SHEET_ID_DESIGN = 'abc123';
    // SHEET_GID_DESIGN is intentionally ignored for design (multi-worksheet
    // mode) — the env var is harmless if set but should not appear in the
    // returned config.
    process.env.SHEET_GID_DESIGN = '99';
    const config = getSheetConfig('design');
    expect(config).toMatchObject({
      id: 'design',
      sheetId: 'abc123',
      mode: 'auth',
      parser: 'tabular',
      fetchAllWorksheets: true,
    });
    expect(config.gid).toBeUndefined();
    expect(config.schema).toBeDefined();
    expect(config.schema.month.column).toBeDefined();
  });

  it('defaults gid to "0" when SHEET_GID_<TAB> is unset (gid-based tabs)', () => {
    process.env.SHEET_ID_STRATEGY = 'abc123';
    expect(getSheetConfig('strategy').gid).toBe('0');
  });

  it('getConfiguredTabs returns only tabs with sheet IDs set', () => {
    process.env.SHEET_ID_DESIGN = 'a';
    process.env.SHEET_ID_PROCESS = 'b';
    expect(getConfiguredTabs().sort()).toEqual(['design', 'process']);
  });

  it('std requires SHEET_ID_STD plus BOTH SHEET_GID_STD_BAU and SHEET_GID_STD_JLV', () => {
    process.env.SHEET_ID_STD = 'sid';
    expect(getSheetConfig('std')).toBeNull();
    process.env.SHEET_GID_STD_BAU = '111';
    expect(getSheetConfig('std')).toBeNull();
    process.env.SHEET_GID_STD_JLV = '222';
    expect(getSheetConfig('std')).toMatchObject({
      id: 'std',
      sheetId: 'sid',
      gids: { bau: '111', jlv: '222' },
      mode: 'auth',
      parser: 'tabular',
    });
  });
});
