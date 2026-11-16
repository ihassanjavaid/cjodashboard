import { describe, it, expect } from 'vitest';
import { parseProcessSheet } from './parseProcessSheet.js';

function row(fields) {
  return fields.join(',');
}

describe('dynamic month detection', () => {
  it('detects 9 months (Jan..Aug + YTD) from a wide productivity row', () => {
    // header row is irrelevant text-wise, only "Team Member" in col A matters
    const dataRow = ['Waqas', 12, 12, 16, 21, 0, 0, 13, 27, 1, 4, 2, 10, 8, 9, 2, 8, 54, 82];
    const csv = [
      row(['Month', ...Array(dataRow.length - 1).fill('')]),
      row(['Team Member', ...Array(dataRow.length - 1).fill('')]),
      row(dataRow),
    ].join('\n');
    const out = parseProcessSheet(csv);
    expect(out.productivityMonths).toEqual(['Jan','Feb','Mar','Apr','May','June','July','Aug','YTD']);
    expect(out.teamProductivity).toHaveLength(9);
    // Aug pair = indices 15,16 -> 2, 8 ; YTD pair = indices 17,18 -> 54, 82
    expect(out.teamProductivity.find(p => p.month === 'Aug')).toEqual({ teamMember: 'Waqas', month: 'Aug', new: 2, revamp: 8 });
    expect(out.teamProductivity.find(p => p.month === 'YTD')).toEqual({ teamMember: 'Waqas', month: 'YTD', new: 54, revamp: 82 });
  });

  it('detects 9 months for a TAT pair with an extended range', () => {
    // 9 value columns for the left team (Alpha), 1 blank separator, then
    // right team (Beta) name, then Beta's own 9 value columns.
    const headerRow = ['Alpha', ...Array(9).fill(''), '', 'Beta', ...Array(9).fill('')];
    // rightCol = index of 'Beta' = 1(Alpha) + 9(values) + 1(separator) = 11
    const dataRow = ['Immediate', 1,2,3,4,5,6,7,8,9, '', 'Immediate', 11,12,13,14,15,16,17,18,19];
    const csv = [row(headerRow), row(dataRow)].join('\n');
    const out = parseProcessSheet(csv);
    expect(out.tatMonths).toEqual(['Jan','Feb','Mar','Apr','May','June','July','Aug','YTD']);
    expect(out.tat).toHaveLength(18);
    expect(out.tat.find(t => t.team === 'Alpha' && t.month === 'YTD').value).toBe(9);
    expect(out.tat.find(t => t.team === 'Beta' && t.month === 'Jan').value).toBe(11);
    expect(out.tat.find(t => t.team === 'Beta' && t.month === 'YTD').value).toBe(19);
  });

  it('still works for a narrower 5-month sheet (backward compatible)', () => {
    const dataRow = ['Waqas', 12, 12, 16, 21, 0, 0, 13, 27, 41, 60];
    const csv = [
      row(['Month', ...Array(dataRow.length - 1).fill('')]),
      row(['Team Member', ...Array(dataRow.length - 1).fill('')]),
      row(dataRow),
    ].join('\n');
    const out = parseProcessSheet(csv);
    expect(out.productivityMonths).toEqual(['Jan','Feb','Mar','Apr','YTD']);
    expect(out.teamProductivity).toHaveLength(5);
  });
});
