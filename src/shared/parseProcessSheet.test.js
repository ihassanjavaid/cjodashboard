import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseProcessSheet } from './parseProcessSheet.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturePath = path.resolve(__dirname, '../../tests/fixtures/process-sheet.csv');

describe('parseProcessSheet — block detection', () => {
  it('extracts a counts row as { team, count }', () => {
    const csv = [
      'Processes,,,,,,,,,,,,',
      'Call Center,264,,,,,,,,,,,',
      'ROX,141,,,,,,,,,,,',
    ].join('\n');
    const out = parseProcessSheet(csv);
    expect(out.counts).toEqual([
      { team: 'Call Center', count: 264 },
      { team: 'ROX', count: 141 },
    ]);
  });

  it('routes the "Unique" row into blocks.unique, not counts', () => {
    const csv = [
      'Processes,,,,,,,,,,,,',
      'Call Center,264,,,,,,,,,,,',
      'Unique,498,,,,,,,,,,,',
    ].join('\n');
    const out = parseProcessSheet(csv);
    expect(out.unique).toBe(498);
    expect(out.counts.find(c => c.team === 'Unique')).toBeUndefined();
  });

  it('reads a TAT side-by-side row producing entries for BOTH teams', () => {
    const csv = [
      'Experiance Center,,,,,,,Franchise,,,,,',
      'Immediate,68,71,72,72,283,,Immediate,66,69,70,70,275',
    ].join('\n');
    const out = parseProcessSheet(csv);
    expect(out.tat).toHaveLength(10); // 2 teams × 5 months
    expect(out.tat).toContainEqual({ team: 'Experiance Center', bucket: 'Immediate', month: 'Jan', value: 68 });
    expect(out.tat).toContainEqual({ team: 'Experiance Center', bucket: 'Immediate', month: 'YTD', value: 283 });
    expect(out.tat).toContainEqual({ team: 'Franchise', bucket: 'Immediate', month: 'Jan', value: 66 });
    expect(out.tat).toContainEqual({ team: 'Franchise', bucket: 'Immediate', month: 'YTD', value: 275 });
  });

  it('reads BVS / Non-BVS into the bvs object', () => {
    const csv = [
      'BVS,,,,,,,,,,,,',
      '63,435,,,,,,,,,,,',
    ].join('\n');
    const out = parseProcessSheet(csv);
    expect(out.bvs).toEqual({ bvs: 63, nonBvs: 435 });
  });

  it('reads a Team Member row producing 5 monthly entries with new and revamp', () => {
    const csv = [
      'Month,,,,,,,Apr,,,,',
      'Team Member,,,,,,,New,,,,',
      'Waqas,12,12,16,21,0,0,13,27,41,60,,',
    ].join('\n');
    const out = parseProcessSheet(csv);
    const waqas = out.teamProductivity.filter(p => p.teamMember === 'Waqas');
    expect(waqas).toHaveLength(5);
    expect(waqas).toContainEqual({ teamMember: 'Waqas', month: 'Jan', new: 12, revamp: 12 });
    expect(waqas).toContainEqual({ teamMember: 'Waqas', month: 'Feb', new: 16, revamp: 21 });
    expect(waqas).toContainEqual({ teamMember: 'Waqas', month: 'Mar', new: 0, revamp: 0 });
    expect(waqas).toContainEqual({ teamMember: 'Waqas', month: 'Apr', new: 13, revamp: 27 });
    expect(waqas).toContainEqual({ teamMember: 'Waqas', month: 'YTD', new: 41, revamp: 60 });
  });

  it('produces the expected top-level shape on the real sheet fixture', () => {
    const csv = fs.readFileSync(fixturePath, 'utf8');
    const out = parseProcessSheet(csv);
    expect(out.counts).toHaveLength(9);
    expect(out.unique).toBe(498);
    expect(out.bvs.bvs).toBe(63);
    expect(out.bvs.nonBvs).toBe(435);
    // 4 teams × 11 buckets × 5 months
    expect(out.tat).toHaveLength(4 * 11 * 5);
    // 5 members × 5 months
    expect(out.teamProductivity).toHaveLength(5 * 5);
    const teams = [...new Set(out.tat.map(t => t.team))].sort();
    expect(teams).toEqual(['Backend', 'Call Center', 'Experiance Center', 'Franchise']);
  });
});
