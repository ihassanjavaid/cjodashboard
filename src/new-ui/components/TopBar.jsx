// TopBar - search input and period range.

import { useEffect, useRef } from 'react';
import { PeriodControl } from './PeriodControl.jsx';
import { Search } from './Search.jsx';

export function TopBar({
  search, onSearchChange,
  periodFrom, periodTo, periodOptions, onPeriodChange, onPeriodClear, showPeriod,
}) {
  const searchRef = useRef(null);

  useEffect(() => {
    const onKeyDown = (event) => {
      const target = event.target;
      const isTyping = target instanceof HTMLElement &&
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
        return;
      }

      if (event.key === 'Escape' && document.activeElement === searchRef.current && search) {
        event.preventDefault();
        onSearchChange('');
        return;
      }

      if (!isTyping && event.key === '/' && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onSearchChange, search]);

  return (
    <header className="nu-topbar">
      <Search
        value={search}
        onChange={onSearchChange}
        inputRef={searchRef}
        placeholder="Search projects, tasks, resources..."
      />

      <span className="nu-topbar__spacer" />

      {showPeriod && (
        <PeriodControl
          from={periodFrom}
          to={periodTo}
          options={periodOptions}
          onChange={onPeriodChange}
          onClear={onPeriodClear}
        />
      )}
    </header>
  );
}
