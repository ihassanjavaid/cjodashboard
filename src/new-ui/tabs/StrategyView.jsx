// Strategic Overview — KPIs + initiative table.

import { useDashboardDataWithFallback } from '../../hooks/useDashboardDataWithFallback.js';
import { KpiCard } from '../components/KpiCard.jsx';
import { Pill, Progress, StaleBanner } from '../components/primitives.jsx';
import { ChartFrame } from '../components/ChartFrame.jsx';
import { normalizeQuery, rowMatchesSearch } from '../lib/utils.js';

const FALLBACK = [];

export function StrategyView({ syncTick, search }) {
  const { rows: liveRows, sheetStatus } = useDashboardDataWithFallback('strategy', FALLBACK, syncTick);
  const rows = liveRows ?? FALLBACK;
  const query = normalizeQuery(search);
  const shown = rows.filter((r) => rowMatchesSearch(r, [
    'name',
    'team',
    'dependent',
    'priority',
    'action',
    'startMonth',
    'endMonth',
  ], query));

  const total = shown.length;
  const avgPct = total
    ? Math.round(shown.reduce((s, r) => s + (Number(r.pct) || 0), 0) / total * 100)
    : 0;
  const veryHigh = shown.filter((r) => r.priority === 'Very High').length;
  const high     = shown.filter((r) => r.priority === 'High').length;
  const teamsSet = new Set(shown.map((r) => r.team).filter(Boolean));

  const priorityTone = {
    'Very High': 'negative',
    'High':      'warning',
    'Medium':    'positive',
    '—':         'default',
  };

  return (
    <section className="nu-page">
      <header className="nu-page__head">
        <div className="nu-page__heading">
          <h1>Strategic Overview</h1>
          <p>CJO initiative portfolio with team ownership, completion, and priority signal.</p>
        </div>
      </header>

      <StaleBanner status={sheetStatus} />

      <div className="nu-kpi-row">
        <div className="nu-rise" data-i="0">
          <KpiCard label="Initiatives in flight" value={total} sub={`${teamsSet.size} teams · ${avgPct}% avg complete`} filled />
        </div>
        <div className="nu-rise" data-i="1">
          <KpiCard label="Very high priority" value={veryHigh} sub={`${total ? Math.round((veryHigh / total) * 100) : 0}% of portfolio`} />
        </div>
        <div className="nu-rise" data-i="2">
          <KpiCard label="High priority" value={high} sub={`${total ? Math.round((high / total) * 100) : 0}% of portfolio`} />
        </div>
        <div className="nu-rise" data-i="3">
          <KpiCard label="Average completion" value={`${avgPct}%`} sub="Across all initiatives" />
        </div>
      </div>

      <div className="nu-grid nu-grid--full">
        <ChartFrame
          title="CJO initiatives"
          caption={`${shown.length} of ${rows.length}`}
          empty={shown.length === 0}
        >
          <div className="nu-table-wrap">
            <table className="nu-table" style={{ minWidth: 1080 }}>
              <thead>
                <tr>
                  <th style={{ width: 36 }}>#</th>
                  <th>Initiative</th>
                  <th className="nu-mute">Dependent</th>
                  <th className="nu-mute">Team</th>
                  <th className="nu-mute">Start</th>
                  <th className="nu-mute">End</th>
                  <th style={{ minWidth: 200 }}>Completion</th>
                  <th>Priority</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((row, i) => {
                  const pctv = Math.round((Number(row.pct) || 0) * 100);
                  const tone = priorityTone[row.priority] || 'default';
                  const hasAction = row.action && row.action !== '—';
                  return (
                    <tr key={`${row.sr}-${i}`}>
                      <td className="nu-num nu-mute">{row.sr}</td>
                      <td className="nu-strong">{row.name}</td>
                      <td className="nu-mute">{row.dependent || '—'}</td>
                      <td className="nu-mute" style={{ fontSize: 12 }}>{row.team || '—'}</td>
                      <td className="nu-mute nu-num" style={{ textAlign: 'left' }}>{row.startMonth || '—'}</td>
                      <td className="nu-mute nu-num" style={{ textAlign: 'left' }}>{row.endMonth || '—'}</td>
                      <td><Progress value={pctv} /></td>
                      <td><Pill tone={tone}>{row.priority || '—'}</Pill></td>
                      <td className={hasAction ? 'nu-acc nu-strong' : 'nu-mute'}>{row.action || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </ChartFrame>
      </div>
    </section>
  );
}
