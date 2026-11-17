// Shared CJO AI Sense conversation. The full tab and the floating overlay
// both render AiSenseThread so a chat started in the bubble continues
// after expanding to the full screen.

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { auth } from '../../lib/firebase.js';

const SUGGESTIONS = [
  'How many usability sessions have been completed?',
  'Total surveys done in last month?',
  'How much processes are under 03 days TAT?',
  "What's Tamasha's LinkedIn following?",
  'How many total UATs do we have for JLV?',
  'How many UAT manned hours do we have for Simosa?'
];

export function SparkleIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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

const AiSenseChatContext = createContext(null);

export function AiSenseChatProvider({ children }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const messagesRef = useRef(messages);
  const inputRef = useRef(input);
  messagesRef.current = messages;
  inputRef.current = input;

  const send = useCallback(async (text) => {
    const trimmed = (text ?? inputRef.current).trim();
    if (!trimmed || busy) return;

    const history = messagesRef.current.slice(-10);
    setInput('');
    setMessages((current) => [...current, { role: 'user', content: trimmed }]);
    setBusy(true);

    try {
      const res = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed, history }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
      setMessages((current) => [...current, { role: 'assistant', content: data.reply || "I couldn't find an answer for that." }]);
    } catch (e) {
      setMessages((current) => [...current, { role: 'assistant', content: `Sorry — ${e.message || 'something went wrong'}. Try again?`, isError: true }]);
    } finally {
      setBusy(false);
    }
  }, [busy]);

  const startNewChat = useCallback(() => {
    setMessages([]);
    setInput('');
  }, []);

  return (
    <AiSenseChatContext.Provider value={{ messages, input, setInput, busy, send, startNewChat }}>
      {children}
    </AiSenseChatContext.Provider>
  );
}

export function useAiSenseChat() {
  const ctx = useContext(AiSenseChatContext);
  if (!ctx) throw new Error('useAiSenseChat must be used inside AiSenseChatProvider');
  return ctx;
}

export function AiSenseThread({ compact = false, autoFocus = false }) {
  const { messages, input, setInput, busy, send } = useAiSenseChat();
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const textareaRef = useRef(null);
  const userInitial = (auth.currentUser?.email?.[0] || 'U').toUpperCase();
  const suggestions = compact ? SUGGESTIONS.slice(0, 3) : SUGGESTIONS;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, busy]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, compact ? 96 : 160)}px`;
  }, [input, compact]);

  const wasBusy = useRef(false);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  useEffect(() => {
    if (wasBusy.current && !busy) inputRef.current?.focus();
    wasBusy.current = busy;
  }, [busy]);

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div className="nu-chat">
      <div className="nu-chat__messages" ref={scrollRef}>
        {messages.length === 0 && (
          <div className="nu-chat__empty">
            <div className="nu-chat__empty-icon"><SparkleIcon /></div>
            <h3>Ask CJO AI Sense anything!</h3>
            <p>{compact
              ? 'Ask about live numbers across the dashboard.'
              : 'It reads live numbers in detail, a truly intelligent tracker.'}</p>
            <div className="nu-chat__suggestions">
              {suggestions.map((s) => (
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
              {m.role === 'user' ? userInitial : <SparkleIcon size={14} />}
            </div>
            <div className={`nu-chat__bubble${m.isError ? ' nu-chat__bubble--error' : ''}`}>
              {m.content}
            </div>
          </div>
        ))}

        {busy && (
          <div className="nu-chat__row nu-chat__row--assistant">
            <div className="nu-chat__avatar" data-role="assistant" aria-hidden="true"><SparkleIcon size={14} /></div>
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
          placeholder="Hi, can you tell me about…"
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
  );
}
