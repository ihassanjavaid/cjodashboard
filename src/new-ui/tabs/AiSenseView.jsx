// CJO AI Sense — chat tab. A GPT/Claude-style conversation UI that answers
// questions about live numbers across every other tab (design, std, process,
// social, product tracker) via /api/ai-chat.

import { AiSenseThread, useAiSenseChat } from '../components/AiSenseChat.jsx';

function ChatIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

export function AiSenseView() {
  const { messages, busy, startNewChat } = useAiSenseChat();

  return (
    <section className="nu-page nu-page--chat">
      <header className="nu-page__head">
        <div className="nu-page__heading">
          <h1>CJO AI Sense</h1>
          <p>Unlock real-time intelligence across Design & Usability, Product Optimization & Process Innovation.</p>
        </div>
        <div className="nu-page__actions">
          <button
            type="button"
            className="nu-chat__new"
            onClick={startNewChat}
            disabled={busy || messages.length === 0}
          >
            <ChatIcon />
            New Chat
          </button>
        </div>
      </header>

      <AiSenseThread />
    </section>
  );
}
