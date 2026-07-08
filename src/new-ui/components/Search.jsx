// Quiet search input with clear action and keyboard-hint affordance.

export function Search({
  value,
  onChange,
  placeholder = 'Search...',
  inputRef,
  id = 'nu-global-search',
  hint = 'Ctrl K',
}) {
  return (
    <label className="nu-search" htmlFor={id}>
      <span className="nu-search__icon" aria-hidden="true">
        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
      </span>
      <input
        id={id}
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck="false"
        aria-label="Search dashboard"
      />
      {value ? (
        <button type="button" className="nu-search__clear" onClick={() => onChange('')} aria-label="Clear search">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </button>
      ) : hint ? (
        <span className="nu-search__kbd" aria-hidden="true">{hint}</span>
      ) : null}
    </label>
  );
}
