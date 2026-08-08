// CJO AI Sense — chat tab. A GPT/Claude-style conversation UI that answers
// questions about live numbers across every other tab (design, std, process,
// social, product tracker) via /api/ai-chat.

import { useEffect, useRef, useState } from 'react';

const SUGGESTIONS = [
  'How many usability sessions have been completed?',
  'Total surveys done in January',
  'How much did Ali Hamza work on?',
  "What's Tamasha's LinkedIn following?",
  'How many total VAS projects do we have?',
];

function SparkleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4" />
      <path d="M12 8a4 4 0 0 0 4 4 4 4 0 0 0-4 4 4 4 0 0 0-4-4 4 4 0 0 0 4-4z" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 2 11 13" />
      <path d="M22 2 15 22l-4-9-9-4 20-7z" />
    </svg>
  );
}

export function AiSenseView() {
  const [messages, setMessages] = useState([]); // { role: 'user' | 'assistant', content }
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, busy]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [input]);

  const send = async (text) => {
    const trimmed = (text ?? input).trim();
    if (!trimmed || busy) return;

    setInput('');
    const history = messages.slice(-10);
    const nextMessages = [...messages, { role: 'user', content: trimmed }];
    setMessages(nextMessages);
    setBusy(true);

    try {
      const res = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed, history }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
      setMessages((m) => [...m, { role: 'assistant', content: data.reply || "I couldn't find an answer for that." }]);
    } catch (e) {
      setMessages((m) => [...m, { role: 'assistant', content: `Sorry — ${e.message || 'something went wrong'}. Try again?`, isError: true }]);
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <section className="nu-page nu-page--chat">
      <header className="nu-page__head">
        <div className="nu-page__heading">
          <h1>CJO AI Sense</h1>
          <p>Ask about usability, surveys, VAS products, social reach, or team output — answers come straight from live dashboard data.</p>
        </div>
      </header>

      <div className="nu-chat">
        <div className="nu-chat__messages" ref={scrollRef}>
          {messages.length === 0 && (
            <div className="nu-chat__empty">
              <div className="nu-chat__empty-icon"><SparkleIcon /></div>
              <h3>Ask CJO AI Sense anything about the dashboard</h3>
              <p>It reads live numbers from every tab — design, std, process, social, and product tracker — no guessing.</p>
              <div className="nu-chat__suggestions">
                {SUGGESTIONS.map((s) => (
                  <button key={s} type="button" className="nu-chat__chip" onClick={() => send(s)}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className={`nu-chat__row nu-chat__row--${m.role}`}>
              <div className="nu-chat__avatar" data-role={m.role} aria-hidden="true">
                {m.role === 'user' ? 'You' : <SparkleIcon />}
              </div>
              <div className={`nu-chat__bubble${m.isError ? ' nu-chat__bubble--error' : ''}`}>
                {m.content}
              </div>
            </div>
          ))}

          {busy && (
            <div className="nu-chat__row nu-chat__row--assistant">
              <div className="nu-chat__avatar" data-role="assistant" aria-hidden="true"><SparkleIcon /></div>
              <div className="nu-chat__bubble nu-chat__bubble--typing" aria-label="CJO AI Sense is thinking">
                <span /><span /><span />
              </div>
            </div>
          )}
        </div>

        <div className="nu-chat__composer">
          <textarea
            ref={(el) => { inputRef.current = el; textareaRef.current = el; }}
            rows={1}
            value={input}
            placeholder="Ask about usability, surveys, VAS projects, social reach…"
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
          />
          <button
            type="button"
            className="nu-chat__send"
            onClick={() => send()}
            disabled={busy || !input.trim()}
            aria-label="Send message"
          >
            <SendIcon />
          </button>
        </div>
      </div>
    </section>
  );
}
