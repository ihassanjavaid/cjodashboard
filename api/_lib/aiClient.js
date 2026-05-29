/**
 * OpenAI-compatible chat API (Groq free tier, OpenAI, etc.)
 * Set GROQ_API_KEY or AI_API_KEY in Vercel env.
 */
export async function chatCompletion(messages) {
  const apiKey = process.env.GROQ_API_KEY
    || process.env.AI_API_KEY
    || process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const baseUrl = (process.env.AI_BASE_URL || 'https://api.groq.com/openai/v1').replace(/\/$/, '');
  const model = process.env.AI_MODEL || 'llama-3.3-70b-versatile';

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.35,
      max_tokens: 1000,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error?.message || `AI request failed (${res.status})`;
    throw new Error(msg);
  }

  const content = data?.choices?.[0]?.message?.content;
  if (!content || typeof content !== 'string') {
    throw new Error('AI returned an empty response');
  }
  return content.trim();
}
