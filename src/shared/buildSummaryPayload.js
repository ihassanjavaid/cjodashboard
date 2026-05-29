// Aggregates cross-tab metrics for the AI Summary (BETA) view.
// Safe to import from api/* and the frontend.

const SHORT_MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

function sortPeriods(periods) {
  const key = (p) => {
    const parts = String(p || '').trim().split(/\s+/);
    const mIdx = SHORT_MONTHS.findIndex((m) => m.toLowerCase() === (parts[0] || '').toLowerCase());
    if (mIdx === -1) return Number.POSITIVE_INFINITY;
    const year = parseInt(parts[1], 10);
    if (!Number.isFinite(year)) return Number.POSITIVE_INFINITY - (12 - mIdx);
    return year * 12 + mIdx;
  };
  return [...new Set(periods.filter(Boolean))].sort((a, b) => key(a) - key(b));
}

function collectDesignPeriods(rows) {
  if (!Array.isArray(rows)) return [];
  return rows.map((r) => r?.period).filter(Boolean);
}

function collectStdPeriods(rows) {
  if (!rows || typeof rows !== 'object') return [];
  return [
    ...(rows.bau ?? []).map((r) => r?.period),
    ...(rows.jlv ?? []).map((r) => r?.period),
  ].filter(Boolean);
}

export function resolveSummaryPeriod(allPeriods, requested) {
  const sorted = sortPeriods(allPeriods);
  if (!sorted.length) return null;
  if (requested && requested !== 'All') {
    const hit = sorted.find((p) => p.toLowerCase() === String(requested).toLowerCase());
    if (hit) return hit;
  }
  const now = new Date();
  const candidate = `${SHORT_MONTHS[now.getMonth()]} ${String(now.getFullYear()).slice(-2)}`;
  const calendar = sorted.find((p) => p.toLowerCase() === candidate.toLowerCase());
  return calendar ?? sorted[sorted.length - 1];
}

function periodToProcessMonth(period) {
  return String(period || '').trim().split(/\s+/)[0] || null;
}

function filterDesignPeriod(rows, period) {
  return (rows ?? []).filter((r) => r?.period === period);
}

function filterStdPeriod(rows, period) {
  const bau = (rows?.bau ?? []).filter((r) => r?.period === period);
  const jlv = (rows?.jlv ?? []).filter((r) => r?.period === period);
  return { bau, jlv };
}

function summarizeDesign(rows) {
  const usability = rows.filter((d) => d.type === 'Usability').length;
  const expert = rows.filter((d) => d.type === 'Expert Analysis').length;
  const survey = rows.filter((d) => d.type === 'Survey').length;
  const sentiment = rows.filter((d) => d.type === 'Sentiment Analysis').length;
  const pulse = rows.filter((d) => d.type === 'App Pulse Reporting').length;
  const totalTasks = usability + expert + survey + sentiment + pulse;
  const completed = rows.filter((d) => d.status === 'Completed').length;
  const inProgress = rows.filter((d) => d.status === 'In Progress').length;
  return {
    totalTasks,
    completed,
    inProgress,
    completionPct: totalTasks ? Math.round((completed / totalTasks) * 100) : 0,
    usability,
    expert,
    survey,
    sentiment,
    pulse,
  };
}

function summarizeStd(bau, jlv) {
  const all = [...bau, ...jlv];
  const totalUATs = all.length;
  const totalCases = all.reduce((s, d) => s + (d.total_cases || 0), 0);
  const totalPass = all.reduce((s, d) => s + (d.pass_cases || 0), 0);
  const issuesH = all.reduce((s, d) => s + (d.issues_highlighted || 0), 0);
  const issuesF = all.reduce((s, d) => s + (d.issues_fixed || 0), 0);
  return {
    totalUATs,
    totalCases,
    passRatePct: totalCases ? Math.round((totalPass / totalCases) * 1000) / 10 : 0,
    issuesHighlighted: issuesH,
    issuesFixed: issuesF,
    bauCount: bau.length,
    jlvCount: jlv.length,
  };
}

function summarizeProcess(data, processMonth) {
  if (!data || !processMonth) {
    return { unique: 0, channelTotal: 0, bvsPct: 0, tatImmediate: 0, prodNew: 0, prodRevamp: 0, month: processMonth };
  }
  const channelTotal = (data.counts ?? []).reduce((s, r) => s + (r.count || 0), 0);
  const bvs = data.bvs ?? { bvs: 0, nonBvs: 0 };
  const bvsDen = (bvs.bvs || 0) + (bvs.nonBvs || 0);
  const tatImmediate = (data.tat ?? [])
    .filter((r) => r.month === processMonth && r.bucket === 'Immediate')
    .reduce((s, r) => s + (r.value || 0), 0);
  const prodRows = (data.teamProductivity ?? []).filter((r) => r.month === processMonth);
  const prodNew = prodRows.reduce((s, r) => s + (r.new || 0), 0);
  const prodRevamp = prodRows.reduce((s, r) => s + (r.revamp || 0), 0);
  return {
    unique: data.unique ?? 0,
    channelTotal,
    bvsPct: bvsDen ? Math.round((bvs.bvs / bvsDen) * 100) : 0,
    tatImmediate,
    prodNew,
    prodRevamp,
    month: processMonth,
  };
}

/**
 * @param {{ design?: unknown, std?: unknown, process?: unknown, period?: string|null }} input
 */
export function buildSummaryPayload({ design, std, process, period: requested }) {
  const allPeriods = [
    ...collectDesignPeriods(design),
    ...collectStdPeriods(std),
  ];
  const period = resolveSummaryPeriod(allPeriods, requested);
  if (!period) return null;

  const sorted = sortPeriods(allPeriods);
  const idx = sorted.indexOf(period);
  const previousPeriod = idx > 0 ? sorted[idx - 1] : null;
  const processMonth = periodToProcessMonth(period);

  const designNow = filterDesignPeriod(design, period);
  const designPrev = previousPeriod ? filterDesignPeriod(design, previousPeriod) : [];
  const stdNow = filterStdPeriod(std, period);
  const stdPrev = previousPeriod ? filterStdPeriod(std, previousPeriod) : { bau: [], jlv: [] };

  const designMetrics = summarizeDesign(designNow);
  const designPrevMetrics = summarizeDesign(designPrev);
  const stdMetrics = summarizeStd(stdNow.bau, stdNow.jlv);
  const stdPrevMetrics = summarizeStd(stdPrev.bau, stdPrev.jlv);
  const processMetrics = summarizeProcess(process, processMonth);
  const processPrevMetrics = previousPeriod
    ? summarizeProcess(process, periodToProcessMonth(previousPeriod))
    : summarizeProcess(process, null);

  const teamComparison = [
    { name: 'Design', value: designMetrics.totalTasks },
    { name: 'Product Opt.', value: stdMetrics.totalUATs },
    { name: 'Process', value: processMetrics.prodNew + processMetrics.prodRevamp },
  ];

  const monthTrend = [
    {
      name: 'Design tasks',
      current: designMetrics.totalTasks,
      previous: designPrevMetrics.totalTasks,
    },
    {
      name: 'UAT cycles',
      current: stdMetrics.totalUATs,
      previous: stdPrevMetrics.totalUATs,
    },
    {
      name: 'Process delivery',
      current: processMetrics.prodNew + processMetrics.prodRevamp,
      previous: processPrevMetrics.prodNew + processPrevMetrics.prodRevamp,
    },
  ];

  return {
    period,
    previousPeriod,
    processMonth,
    metrics: {
      design: designMetrics,
      std: stdMetrics,
      process: processMetrics,
    },
    deltas: {
      designTasks: designMetrics.totalTasks - designPrevMetrics.totalTasks,
      stdUats: stdMetrics.totalUATs - stdPrevMetrics.totalUATs,
      processDelivery: (processMetrics.prodNew + processMetrics.prodRevamp)
        - (processPrevMetrics.prodNew + processPrevMetrics.prodRevamp),
    },
    charts: { teamComparison, monthTrend },
  };
}

export function buildFallbackNarrative(payload) {
  const { period, previousPeriod, metrics: m, deltas: d } = payload;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const prevNote = previousPeriod
    ? `Compared with ${previousPeriod}, Design tasks moved ${d.designTasks >= 0 ? 'up' : 'down'} by ${Math.abs(d.designTasks)}, UAT cycles by ${Math.abs(d.stdUats)}, and Process deliveries by ${Math.abs(d.processDelivery)}.`
    : 'There is no earlier month in the synced data to compare against yet.';

  return [
    `${greeting} — here is your CJO dashboard snapshot for **${period}**.`,
    '',
    `**Design & Usability** logged ${m.design.totalTasks} activities with ${m.design.completionPct}% marked completed (${m.design.completed} done, ${m.design.inProgress} in progress). Usability studies (${m.design.usability}) and expert analysis (${m.design.expert}) lead the mix, with ${m.design.survey} surveys and ${m.design.sentiment + m.design.pulse} sentiment/pulse items.`,
    '',
    `**Product Optimization** ran ${m.std.totalUATs} UAT cycles across BAU and JLV, with a ${m.std.passRatePct}% case pass rate on ${m.std.totalCases} executed cases. The team highlighted ${m.std.issuesHighlighted} issues and fixed ${m.std.issuesFixed}.`,
    '',
    `**Process Innovation** shows ${m.process.unique} unique processes, ~${m.process.bvsPct}% BVS coverage, ${m.process.tatImmediate} immediate TAT responses in ${m.process.month || 'the month'}, and ${m.process.prodNew + m.process.prodRevamp} productivity items (${m.process.prodNew} new, ${m.process.prodRevamp} revamp).`,
    '',
    prevNote,
    '',
    '_This summary was generated locally from synced sheet data. Add `GROQ_API_KEY` (free tier) for AI-written narrative._',
  ].join('\n');
}
