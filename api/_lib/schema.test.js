// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { mapRowToSchema } from './schema.js';

describe('mapRowToSchema', () => {
  const schema = {
    month:        { column: 'Month',          type: 'string' },
    project:      { column: 'Project',        type: 'string' },
    count_users:  { column: 'Count of Users', type: 'number' },
  };

  it('maps sheet column names to JS field names', () => {
    const row = { Month: 'January', Project: 'Tamasha', 'Count of Users': '16' };
    expect(mapRowToSchema(row, schema)).toEqual({
      month: 'January',
      project: 'Tamasha',
      count_users: 16,
    });
  });

  it('coerces numeric strings to numbers', () => {
    const row = { Month: 'Feb', Project: 'X', 'Count of Users': '0' };
    expect(mapRowToSchema(row, schema).count_users).toBe(0);
  });

  it('returns null for invalid numbers and logs a warning', () => {
    const row = { Month: 'Feb', Project: 'X', 'Count of Users': 'N/A' };
    expect(mapRowToSchema(row, schema).count_users).toBeNull();
  });

  it('uses empty string when source column is missing', () => {
    const row = { Month: 'March' };
    const result = mapRowToSchema(row, schema);
    expect(result.month).toBe('March');
    expect(result.project).toBe('');
    expect(result.count_users).toBeNull();
  });

  it('trims whitespace from string fields', () => {
    const row = { Month: '  January  ', Project: 'X', 'Count of Users': '5' };
    expect(mapRowToSchema(row, schema).month).toBe('January');
  });

  it('invokes transform even when source column is missing (purely-derived fields)', () => {
    const derivedSchema = {
      source:       { column: '__SOURCE__', type: 'string', transform: () => 'BAU' },
      failed_cases: { column: '__DERIVED__', type: 'number',
                      transform: (_raw, row) => Number(row.Total) - Number(row.Pass) },
    };
    const row = { Total: '10', Pass: '7' };
    expect(mapRowToSchema(row, derivedSchema)).toEqual({
      source: 'BAU',
      failed_cases: 3,
    });
  });
});
