// POST /api/ai-chat — CJO AI Sense.
//
// Uses Groq's free, OpenAI-compatible chat completions API with tool calling.
// The model never invents numbers: it calls query_data (see api/_lib/aiQuery.js),
// which filters/aggregates the *actual* dashboard data pulled fresh from KV on
// every request, and the model only phrases the final answer around the exact
// result it gets back.
//
// Requires env var GROQ_API_KEY (free — see console.groq.com). Model is
// overridable via GROQ_MODEL; defaults to a Groq-hosted Llama model that
// supports tool calling.

import { buildDatasets } from './_lib/aiDataset.js';
import { runQuery, describeSource, DATA_SOURCES } from './_lib/aiQuery.js';
import { SYSTEM_PROMPT } from './_lib/aiPrompt.js';

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
const MAX_TOOL_STEPS = 6;
const HISTORY_LIMIT = 10;

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'query_data',
      description: 'Filter and aggregate rows from one dashboard data source (see system prompt for the field list per source). This is the only way to get real numbers — never answer with a computed/guessed number.',
      parameters: {
        type: 'object',
        properties: {
          source: { type: 'string', enum: DATA_SOURCES, description: 'Which data source to query.' },
          filters: {
            type: 'object',
            description: 'Field/value pairs to filter rows by. String values match case-insensitively as a substring. Omit or use {} for no filter.',
            additionalProperties: true,
          },
          aggregate: {
            type: 'string',
            enum: ['count', 'sum', 'avg', 'min', 'max', 'list'],
            description: '"count" = number of matching rows. "sum"/"avg"/"min"/"max" require "field". "list" returns raw matching rows (use sparingly, only when the user wants to see records).',
          },
          field: { type: 'string', description: 'Numeric field to aggregate. Required for sum/avg/min/max.' },
          groupBy: { type: 'string', description: 'Optional field name to break the aggregate down by distinct value.' },
          limit: { type: 'number', description: 'Max rows to return when aggregate="list" (default 20, max 50).' },
        },
        required: ['source', 'aggregate'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'describe_source',
      description: 'List the field names and example values actually present in a data source. Use this when unsure of an exact field name or value spelling before calling query_data.',
      parameters: {
        type: 'object',
        properties: { source: { type: 'string', enum: DATA_SOURCES } },
        required: ['source'],
      },
    },
  },
];

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: 'GROQ_API_KEY is not configured. Add a free key from console.groq.com to your environment variables.',
    });
  }

  const { message, history } = req.body || {};
  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: 'message is required' });
  }

  let datasets;
  try {
    datasets = await buildDatasets();
  } catch (e) {
    return res.status(500).json({ error: `Failed to load dashboard data: ${e.message}` });
  }

  const priorTurns = Array.isArray(history)
    ? history
      .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
      .slice(-HISTORY_LIMIT)
      .map((m) => ({ role: m.role, content: m.content }))
    : [];

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...priorTurns,
    { role: 'user', content: message.trim() },
  ];

  try {
    const reply = await converse(messages, datasets, apiKey);
    return res.status(200).json({ reply });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'AI request failed' });
  }
}

async function converse(messages, datasets, apiKey) {
  for (let step = 0; step < MAX_TOOL_STEPS; step++) {
    const data = await callGroq(messages, apiKey);
    const msg = data.choices?.[0]?.message;
    if (!msg) throw new Error('No response from the model.');

    if (!msg.tool_calls || msg.tool_calls.length === 0) {
      return msg.content?.trim() || "I couldn't find an answer for that.";
    }

    messages.push({ role: 'assistant', content: msg.content || null, tool_calls: msg.tool_calls });

    for (const call of msg.tool_calls) {
      let result;
      try {
        const args = call.function.arguments ? JSON.parse(call.function.arguments) : {};
        result = executeTool(call.function.name, args, datasets);
      } catch (e) {
        result = { error: `Tool call failed: ${e.message}` };
      }
      messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(result) });
    }
  }
  return "I looked into a few things but couldn't finish — try asking a more specific question (e.g. name a tab, person, or month).";
}

function executeTool(name, args, datasets) {
  if (name === 'query_data') return runQuery(datasets, args);
  if (name === 'describe_source') return describeSource(datasets, args.source);
  return { error: `Unknown tool: ${name}` };
}

async function callGroq(messages, apiKey) {
  const resp = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      tools: TOOLS,
      tool_choice: 'auto',
      temperature: 0.2,
    }),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`Groq API error ${resp.status}: ${text.slice(0, 300)}`);
  }
  return resp.json();
}
