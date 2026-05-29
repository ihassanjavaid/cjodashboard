import { getMeta, setMeta } from './_lib/kv.js';
import { loadDashboardRows } from './_lib/loadDashboardRows.js';
import { chatCompletion } from './_lib/aiClient.js';
import { buildSummaryPayload, buildFallbackNarrative } from '../src/shared/buildSummaryPayload.js';

function cacheMetaKey(period, lastSyncedAt) {
  const stamp = lastSyncedAt || 'none';
  return `aiSummary:${period}:${stamp}`;
}

function buildAiMessages(payload) {
  const metricsJson = JSON.stringify({
    period: payload.period,
    previousPeriod: payload.previousPeriod,
    metrics: payload.metrics,
    deltas: payload.deltas,
    processMonth: payload.processMonth,
  });

  return [
    {
      role: 'system',
      content: [
        'You are an executive analyst for the Jazz World CJO (Customer Journey Operations) dashboard.',
        'Write a concise, friendly summary for leadership using ONLY the JSON metrics provided.',
        'Start with a time-appropriate greeting (Good morning/afternoon/evening).',
        'Cover all three teams: Design & Usability, Product Optimization (standardization/UAT), and Process Innovation.',
        'Mention month-over-month trends when previousPeriod is present.',
        'Use 4–6 short paragraphs. You may use **bold** for team names. No invented numbers.',
        'End with one sentence on what to watch next month.',
      ].join(' '),
    },
    {
      role: 'user',
      content: `Metrics JSON:\n${metricsJson}`,
    },
  ];
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  res.setHeader('Cache-Control', 'public, max-age=120, stale-while-revalidate=600');

  const periodParam = req.query?.period;
  const requested = periodParam && periodParam !== 'All' ? periodParam : null;

  const [design, std, process] = await Promise.all([
    loadDashboardRows('design'),
    loadDashboardRows('std'),
    loadDashboardRows('process'),
  ]);
  const lastSyncedAt = await getMeta('lastSyncedAt');

  const payload = buildSummaryPayload({ design, std, process, period: requested });
  if (!payload) {
    return res.status(200).json({
      period: null,
      narrative: null,
      charts: null,
      source: 'empty',
      error: 'No period data available. Run Sync now after connecting sheets.',
    });
  }

  const cacheKey = cacheMetaKey(payload.period, lastSyncedAt);
  const cached = await getMeta(cacheKey);
  if (cached?.narrative && !req.query?.refresh) {
    return res.status(200).json({
      ...payload,
      narrative: cached.narrative,
      source: cached.source || 'ai',
      generatedAt: cached.generatedAt,
      lastSyncedAt,
    });
  }

  let narrative;
  let source = 'fallback';

  try {
    const aiText = await chatCompletion(buildAiMessages(payload));
    if (aiText) {
      narrative = aiText;
      source = 'ai';
    }
  } catch (e) {
    console.error('[ai-summary]', e.message);
  }

  if (!narrative) {
    narrative = buildFallbackNarrative(payload);
    source = source === 'ai' ? 'ai' : 'fallback';
  }

  const generatedAt = new Date().toISOString();
  await setMeta(cacheKey, { narrative, source, generatedAt });

  return res.status(200).json({
    ...payload,
    narrative,
    source,
    generatedAt,
    lastSyncedAt,
  });
}
