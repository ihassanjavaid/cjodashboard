// PeriodControl - period range using two Dropdown pills.

import { Dropdown } from './Dropdown.jsx';

export function PeriodControl({ from, to, options, onChange, onClear }) {
  const ALL = '__all__';
  const fromIdx = options.indexOf(from);

  const handleFrom = (v) => {
    const next = v === ALL ? 'All' : v;
    if (to !== 'All' && options.indexOf(next) > options.indexOf(to)) {
      onChange(next, next);
    } else {
      onChange(next, to);
    }
  };
  const handleTo = (v) => {
    const next = v === ALL ? 'All' : v;
    if (from !== 'All' && options.indexOf(next) < options.indexOf(from)) {
      onChange(next, next);
    } else {
      onChange(from, next);
    }
  };

  const fromOpts = [{ value: ALL, label: 'All time' }, ...options.map((o) => ({ value: o, label: o }))];
  const toOpts = [{ value: ALL, label: 'Now' },
    ...options.filter((_, i) => fromIdx === -1 || i >= fromIdx).map((o) => ({ value: o, label: o }))];

  const showClear = from !== 'All' || to !== 'All';

  return (
    <span className="nu-period">
      <span className="nu-period__label">Period</span>
      <Dropdown
        value={from === 'All' ? ALL : from}
        options={fromOpts}
        onChange={handleFrom}
        align="right"
        trigger={
          <button type="button" className="nu-filter__pill" data-active={from !== 'All'}>
            {from === 'All' ? 'All time' : from}
          </button>
        }
      />
      <span className="nu-period__arrow" aria-hidden="true">to</span>
      <Dropdown
        value={to === 'All' ? ALL : to}
        options={toOpts}
        onChange={handleTo}
        align="right"
        trigger={
          <button type="button" className="nu-filter__pill" data-active={to !== 'All'}>
            {to === 'All' ? 'Now' : to}
          </button>
        }
      />
      {showClear && (
        <button type="button" className="nu-filter__reset" onClick={onClear}>Clear</button>
      )}
    </span>
  );
}
