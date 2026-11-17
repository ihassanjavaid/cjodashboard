// Floating CJO AI Sense launcher. Maroon bubble, bottom-right, on every
// dashboard screen. Opens a compact chat; expand jumps to the full tab.

import { useEffect, useState } from 'react';
import { AiSenseThread, SparkleIcon } from './AiSenseChat.jsx';

function BubbleIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M5 5.5A2.5 2.5 0 0 1 7.5 3h9A2.5 2.5 0 0 1 19 5.5v7A2.5 2.5 0 0 1 16.5 15H10l-4.2 3.2A.8.8 0 0 1 4.5 17.5V5.5Z"
        fill="currentColor"
      />
      <path d="M12 6.2v1.2M12 12.6v1.2M8.6 10H9.8M14.2 10h1.2" stroke="#8B1A1A" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M12 8.1a1.9 1.9 0 0 0 1.9 1.9A1.9 1.9 0 0 0 12 11.9 1.9 1.9 0 0 0 10.1 10 1.9 1.9 0 0 0 12 8.1Z" fill="#8B1A1A" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

function ExpandIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M15 3h6v6" />
      <path d="M9 21H3v-6" />
      <path d="M21 3l-7 7" />
      <path d="M3 21l7-7" />
    </svg>
  );
}

export function AiSenseWidget({ onOpenFull }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const openFull = () => {
    setOpen(false);
    onOpenFull();
  };

  return (
    <div className="nu-aisense-dock">
      {open && (
        <section className="nu-aisense-panel" role="dialog" aria-label="CJO AI Sense">
          <header className="nu-aisense-panel__head">
            <div className="nu-aisense-panel__title">
              <span className="nu-aisense-panel__mark" aria-hidden="true"><SparkleIcon size={16} /></span>
              <div>
                <strong>CJO AI Sense</strong>
                <span>Ask about live dashboard numbers</span>
              </div>
            </div>
            <div className="nu-aisense-panel__actions">
              <button type="button" onClick={openFull} aria-label="Open full CJO AI Sense">
                <ExpandIcon />
              </button>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close chat">
                <CloseIcon />
              </button>
            </div>
          </header>
          <AiSenseThread compact autoFocus />
        </section>
      )}

      <button
        type="button"
        className="nu-aisense-fab"
        aria-expanded={open}
        aria-label={open ? 'Close CJO AI Sense' : 'Open CJO AI Sense'}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? <CloseIcon /> : <BubbleIcon />}
      </button>
    </div>
  );
}
