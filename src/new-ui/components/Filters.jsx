// Inline filter row, segmented tabs, and view toggles.

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Dropdown } from './Dropdown.jsx';

export function FilterRow({ children, onReset }) {
  return (
    <div className="nu-filters">
      {children}
      {onReset && <button type="button" className="nu-filter__reset" onClick={onReset}>Reset</button>}
    </div>
  );
}

export function Filter({ label, value, options, onChange }) {
  const active = value && value !== 'All';
  const opts = options.map((o) => ({ value: o, label: o === 'All' ? 'All' : o }));
  return (
    <span className="nu-filter">
      {label ? <span className="nu-filter__label">{label}</span> : null}
      <Dropdown
        value={value}
        options={opts}
        onChange={onChange}
        trigger={
          <button type="button" className="nu-filter__pill" data-active={active}>
            {value === 'All' ? 'All' : value}
          </button>
        }
      />
    </span>
  );
}

export function FilterSep() {
  return <span className="nu-filter__sep" aria-hidden="true" />;
}

export function SegmentedTabs({
  value,
  options,
  onChange,
  ariaLabel,
  className = 'nu-segment',
  buttonClassName = 'nu-segment__btn',
  pillClassName = 'nu-segment__pill',
}) {
  const refs = useRef({});
  const containerRef = useRef(null);
  const [pill, setPill] = useState({ left: 0, width: 0, ready: false });

  const measure = useCallback(() => {
    const el = refs.current[value];
    const container = containerRef.current;
    if (!el || !container) return;
    const elBox = el.getBoundingClientRect();
    const containerBox = container.getBoundingClientRect();
    setPill({
      left: elBox.left - containerBox.left,
      width: elBox.width,
      ready: true,
    });
  }, [value]);

  useLayoutEffect(() => { measure(); }, [measure, options]);
  useEffect(() => {
    const onResize = () => measure();
    let cancelled = false;
    window.addEventListener('resize', onResize);
    document.fonts?.ready?.then(() => {
      if (!cancelled) measure();
    });

    let observer;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(measure);
      if (containerRef.current) observer.observe(containerRef.current);
      Object.values(refs.current).forEach((el) => {
        if (el) observer.observe(el);
      });
    }

    return () => {
      cancelled = true;
      window.removeEventListener('resize', onResize);
      observer?.disconnect();
    };
  }, [measure]);

  const moveByKeyboard = (event, direction) => {
    const currentIdx = options.findIndex((o) => o.key === value);
    if (currentIdx === -1) return;
    event.preventDefault();
    const nextIdx = direction === 'home'
      ? 0
      : direction === 'end'
        ? options.length - 1
        : (currentIdx + direction + options.length) % options.length;
    const next = options[nextIdx];
    if (next && !next.disabled) {
      onChange(next.key);
      refs.current[next.key]?.focus();
    }
  };

  return (
    <div className={className} ref={containerRef} role="tablist" aria-label={ariaLabel}>
      <span
        className={pillClassName}
        style={{
          transform: `translateX(${pill.left}px)`,
          width: pill.width,
          opacity: pill.ready ? 1 : 0,
        }}
        aria-hidden="true"
      />
      {options.map((o) => {
        const active = value === o.key;
        return (
          <button
            key={o.key}
            ref={(el) => { refs.current[o.key] = el; }}
            type="button"
            className={buttonClassName}
            data-active={active}
            onClick={() => !o.disabled && onChange(o.key)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowRight' || event.key === 'ArrowDown') moveByKeyboard(event, 1);
              if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') moveByKeyboard(event, -1);
              if (event.key === 'Home') moveByKeyboard(event, 'home');
              if (event.key === 'End') moveByKeyboard(event, 'end');
            }}
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            disabled={o.disabled}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function SourceToggle({ value, options, onChange }) {
  return (
    <SegmentedTabs
      value={value}
      options={options}
      onChange={onChange}
      ariaLabel="Data source"
      className="nu-source"
      buttonClassName="nu-source__btn"
      pillClassName="nu-source__pill"
    />
  );
}

export function ViewToggle({ value, onChange, options = [
  { key: 'table', label: 'Table' },
  { key: 'chart', label: 'Chart' },
] }) {
  return (
    <SegmentedTabs
      value={value}
      options={options}
      onChange={onChange}
      ariaLabel="View"
      className="nu-toggle"
      buttonClassName="nu-toggle__btn"
      pillClassName="nu-toggle__pill"
    />
  );
}
