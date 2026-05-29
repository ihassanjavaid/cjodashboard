// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { buildSummaryPayload, resolveSummaryPeriod } from './buildSummaryPayload.js';

describe('buildSummaryPayload', () => {
  it('resolves requested period when present', () => {
    const periods = ['Dec 25', 'Jan 26'];
    expect(resolveSummaryPeriod(periods, 'Jan 26')).toBe('Jan 26');
  });

  it('builds metrics and charts for a month', () => {
    const payload = buildSummaryPayload({
      design: [
        { period: 'Jan 26', type: 'Usability', status: 'Completed' },
        { period: 'Jan 26', type: 'Survey', status: 'In Progress' },
        { period: 'Dec 25', type: 'Usability', status: 'Completed' },
      ],
      std: {
        bau: [{ period: 'Jan 26', total_cases: 10, pass_cases: 8, issues_highlighted: 2, issues_fixed: 1 }],
        jlv: [],
      },
      process: {
        unique: 42,
        counts: [{ team: 'A', count: 5 }],
        bvs: { bvs: 30, nonBvs: 12 },
        tat: [{ team: 'A', bucket: 'Immediate', month: 'Jan', value: 3 }],
        teamProductivity: [{ teamMember: 'Sam', month: 'Jan', new: 2, revamp: 1 }],
      },
      period: 'Jan 26',
    });

    expect(payload.period).toBe('Jan 26');
    expect(payload.metrics.design.totalTasks).toBe(2);
    expect(payload.metrics.std.totalUATs).toBe(1);
    expect(payload.charts.teamComparison).toHaveLength(3);
    expect(payload.charts.monthTrend[0].current).toBe(2);
    expect(payload.charts.monthTrend[0].previous).toBe(1);
  });
});
