// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { parseCsv, parseCsvRaw } from './csv.js';

describe('parseCsv (with headers)', () => {
  it('parses a simple CSV with headers into row objects', () => {
    const csv = 'name,age\nAlice,30\nBob,25';
    expect(parseCsv(csv)).toEqual([
      { name: 'Alice', age: '30' },
      { name: 'Bob', age: '25' },
    ]);
  });

  it('skips empty lines', () => {
    const csv = 'name,age\nAlice,30\n\n\nBob,25\n';
    expect(parseCsv(csv)).toEqual([
      { name: 'Alice', age: '30' },
      { name: 'Bob', age: '25' },
    ]);
  });

  it('handles quoted fields containing commas', () => {
    const csv = 'name,note\n"Smith, John","hello, world"';
    expect(parseCsv(csv)).toEqual([
      { name: 'Smith, John', note: 'hello, world' },
    ]);
  });

  it('returns empty array for empty input', () => {
    expect(parseCsv('')).toEqual([]);
  });
});

describe('parseCsvRaw (no headers, returns 2D array)', () => {
  it('returns rows as arrays without header processing', () => {
    const csv = 'a,b,c\n1,2,3\n4,5,6';
    expect(parseCsvRaw(csv)).toEqual([
      ['a', 'b', 'c'],
      ['1', '2', '3'],
      ['4', '5', '6'],
    ]);
  });

  it('preserves blank cells as empty strings', () => {
    const csv = 'a,,c\n,2,';
    expect(parseCsvRaw(csv)).toEqual([
      ['a', '', 'c'],
      ['', '2', ''],
    ]);
  });
});
