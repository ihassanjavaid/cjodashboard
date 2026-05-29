// Summary (BETA) — AI narrative + cross-team charts for the focus month.

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from 'recharts';
import { ChartFrame, NUTooltip } from '../components/ChartFrame.jsx';
import { DonutChart } from '../components/DonutChart.jsx';
import { KpiCard } from '../components/KpiCard.jsx';
import { Pill } from '../components/primitives.jsx';
import { axisProps, chartColors, chartMargins, gridProps } from '../lib/chartTheme.js';
import { relativeTime } from '../lib/utils.js';

function renderInlineBold(text) {
  const parts = String(text).split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}

function buildInsights(metrics, deltas, period, previousPeriod) {
  if (!metrics) return [];
  const { design, std, process } = metrics;
  const bullets = [
    `**Design & Usability** — ${design.totalTasks} tasks in ${period}; ${design.completionPct}% completed (${design.completed} done, ${design.inProgress} in progress).`,
    `**Product Optimization** — ${std.totalUATs} UAT cycles with ${std.passRatePct}% case success; ${std.issuesFixed} issues fixed of ${std.issuesHighlighted} highlighted.`,
    `**Process Innovation** — ${process.prodNew + process.prodRevamp} deliveries (${process.prodNew} new, ${process.prodRevamp} revamped); ${process.bvsPct}% BVS coverage.`,
  ];
  if (previousPeriod && deltas) {
    const fmtDelta = (n, label) => {
      if (n === 0) return `${label} held steady vs ${previousPeriod}.`;
      const dir = n > 0 ? 'up' : 'down';
      return `${label} is ${dir} ${Math.abs(n)} vs ${previousPeriod}.`;
    };
    bullets.push(fmtDelta(deltas.designTasks, 'Design volume'));
    bullets.push(fmtDelta(deltas.stdUats, 'UAT volume'));
    bullets.push(fmtDelta(deltas.processDelivery, 'Process delivery'));
  }
  return bullets;
}

function NarrativeBody({ text }) {
  const blocks = useMemo(
    () => String(text || '').split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean),
    [text],
  );
  return (
    <div className="nu-summary__narrative">
      {blocks.map((para, i) => (
        <p key={i}>{renderInlineBold(para)}</p>
      ))}
    </div>
  );
}

export function SummaryView({ focusPeriod, syncTick }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const colors = chartColors();

  const load = useCallback(async (refresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      if (focusPeriod) qs.set('period', focusPeriod);
      if (refresh) qs.set('refresh', '1');
      const res = await fetch(`/api/ai-summary?${qs}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setData(json);
    } catch (e) {
      setError(e.message || 'Failed to load summary');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [focusPeriod]);

  useEffect(() => { load(false); }, [load, syncTick]);

  const m = data?.metrics;
  const teamData = data?.charts?.teamComparison ?? [];
  const insights = useMemo(
    () => buildInsights(m, data?.deltas, data?.period, data?.previousPeriod),
    [m, data?.deltas, data?.period, data?.previousPeriod],
  );
  const designMix = useMemo(() => {
    if (!m?.design) return [];
    return [
      { name: 'Usability', value: m.design.usability },
      { name: 'Expert analysis', value: m.design.expert },
      { name: 'Survey', value: m.design.survey },
      { name: 'Sentiment', value: m.design.sentiment },
      { name: 'App pulse', value: m.design.pulse },
    ].filter((d) => d.value > 0);
  }, [m]);

  return (
    <main className="nu-page nu-summary">
      <header className="nu-page__head">
        <div className="nu-page__heading">
          <h1>Summary</h1>
          <p>AI-generated overview across Design & Usability, Product Optimization, and Process Innovation for the selected time period.</p>
        </div>
        <div className="nu-page__actions">
          {data?.period && <Pill>{data.period}</Pill>}
          {data?.source && (
            <Pill tone={data.source === 'ai' ? 'positive' : 'neutral'}>
              {data.source === 'ai' ? 'AI generated' : 'Local Summary'}
            </Pill>
          )}
          <button
            type="button"
            className="nu-btn nu-btn--ghost"
            onClick={() => load(true)}
            disabled={loading}
          >
            Refresh
          </button>
        </div>
      </header>

      {loading && !data && (
        <div className="nu-summary__loading" aria-live="polite">Generating summary…</div>
      )}

      {error && (
        <div className="nu-summary__error" role="alert">{error}</div>
      )}

      {data?.period && m && (
        <>
          <div className="nu-kpi-row">
            <KpiCard label="Design, Usability & VOC Tasks" value={m.design.totalTasks} sub={`${m.design.completionPct} Completed`} />
            <KpiCard label="UAT Cycles/Tasks" value={m.std.totalUATs} sub={`${m.std.passRatePct}% Success Rate`} filled />
            <KpiCard
              label="Process Optimization"
              value={m.process.prodNew + m.process.prodRevamp}
              sub={`${m.process.prodNew} New · ${m.process.prodRevamp} Revamped`}
            />
            {/* <KpiCard label="Unique processes" value={m.process.unique} sub={`${m.process.bvsPct}% BVS`} /> */}
          </div>

          <section className="nu-card nu-chart-card nu-summary__narrative-card">
            <header className="nu-card__head">
              <div>
                <h3 className="nu-card__title">Executive summary</h3>
                <div className="nu-card__caption">AI narrative for {data.period}</div>
              </div>
            </header>
            <div className="nu-card__body">
              {data.narrative
                ? <NarrativeBody text={data.narrative} />
                : <p className="nu-summary__empty">No narrative available.</p>}
              <footer className="nu-summary__meta">
                {data.generatedAt && <span>Generated {relativeTime(data.generatedAt)}</span>}
                {data.lastSyncedAt && <span>Data synced {relativeTime(data.lastSyncedAt)}</span>}
                {data.previousPeriod && <span>Compared with {data.previousPeriod}</span>}
              </footer>
            </div>
          </section>

          <div className="nu-summary__charts">
            <ChartFrame title="Activity by team" caption={data.period}>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={teamData} margin={chartMargins()}>
                  <CartesianGrid {...gridProps(colors)} />
                  <XAxis dataKey="name" {...axisProps(colors)} />
                  <YAxis allowDecimals={false} {...axisProps(colors, { side: 'y' })} />
                  <Tooltip content={<NUTooltip />} />
                  <Bar dataKey="value" name="Count" radius={[6, 6, 0, 0]}>
                    {teamData.map((_, i) => (
                      <Cell key={i} fill={[colors.accent, colors.positive, colors.warning][i % 3]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartFrame>

            <ChartFrame title="Design work mix" caption={`${data.period} · task types`}>
              <DonutChart
                data={designMix}
                colors={colors}
                primaryName="Usability"
                totalLabel="tasks"
                ariaLabel="Design task types for the period"
              />
            </ChartFrame>
          </div>

          <section className="nu-card nu-chart-card nu-summary__insights">
            <header className="nu-card__head">
              <div>
                <h3 className="nu-card__title">Key insights</h3>
                <div className="nu-card__caption">Derived from synced dashboard metrics</div>
              </div>
            </header>
            <ul className="nu-summary__insights-list">
              {insights.map((line, i) => (
                <li key={i}>{renderInlineBold(line)}</li>
              ))}
            </ul>
          </section>
        </>
      )}

      {!loading && !error && !data?.period && (
        <p className="nu-summary__empty">
          Sync sheet data to generate a cross-team summary.
        </p>
      )}
    </main>
  );
}
