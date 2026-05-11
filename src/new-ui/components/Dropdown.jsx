// Dropdown — custom styled menu replacing native <select>.
// Click-outside, Escape to close, arrow-key navigation, scroll-into-view.
// Renders inline (positioned absolutely under its trigger).

import { useCallback, useEffect, useRef, useState } from 'react';

export function Dropdown({ trigger, value, options, onChange, align = 'left' }) {
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const wrapperRef = useRef(null);
  const menuRef = useRef(null);
  const itemRefs = useRef([]);

  const close = useCallback(() => setOpen(false), []);

  const openMenu = useCallback(() => {
    // Seed activeIdx to the currently selected option BEFORE opening, so the
    // menu mounts already in the right state — no setState-in-effect needed.
    const i = options.findIndex((o) => (typeof o === 'string' ? o : o.value) === value);
    setActiveIdx(i >= 0 ? i : 0);
    setOpen(true);
  }, [options, value]);

  const toggle = useCallback(() => {
    if (open) close(); else openMenu();
  }, [open, close, openMenu]);

  // Click outside / Escape
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e) => {
      if (!wrapperRef.current?.contains(e.target)) close();
    };
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); close(); }
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, close]);

  // Focus menu after it mounts. rAF defers past the entrance keyframe.
  useEffect(() => {
    if (!open) return;
    const raf = requestAnimationFrame(() => menuRef.current?.focus());
    return () => cancelAnimationFrame(raf);
  }, [open]);

  // Keep the active row scrolled into view as the user navigates.
  useEffect(() => {
    if (open && activeIdx >= 0) {
      itemRefs.current[activeIdx]?.scrollIntoView({ block: 'nearest' });
    }
  }, [open, activeIdx]);

  const handleMenuKey = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => Math.min(options.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(0, i - 1));
    } else if (e.key === 'Home') {
      e.preventDefault();
      setActiveIdx(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setActiveIdx(options.length - 1);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (activeIdx >= 0 && activeIdx < options.length) {
        const opt = options[activeIdx];
        if (!opt.disabled) {
          onChange(typeof opt === 'string' ? opt : opt.value);
          close();
        }
      }
    }
  };

  return (
    <span ref={wrapperRef} style={{ position: 'relative', display: 'inline-flex' }}>
      <span onClick={toggle} aria-haspopup="listbox" aria-expanded={open}>
        {trigger}
      </span>
      {open && (
        <div
          ref={menuRef}
          tabIndex={-1}
          role="listbox"
          className={`nu-menu ${align === 'right' ? 'nu-menu--right' : ''}`}
          onKeyDown={handleMenuKey}
        >
          {options.map((opt, i) => {
            const optValue = typeof opt === 'string' ? opt : opt.value;
            const optLabel = typeof opt === 'string' ? opt : (opt.label ?? opt.value);
            const selected = optValue === value;
            return (
              <button
                key={optValue}
                ref={(el) => { itemRefs.current[i] = el; }}
                type="button"
                role="option"
                aria-selected={selected}
                data-selected={selected}
                className="nu-menu__item"
                onClick={() => { onChange(optValue); close(); }}
                onMouseEnter={() => setActiveIdx(i)}
                style={i === activeIdx ? { background: 'var(--nu-card-sunk)' } : undefined}
              >
                {optLabel}
              </button>
            );
          })}
        </div>
      )}
    </span>
  );
}
