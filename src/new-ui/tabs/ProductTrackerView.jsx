// Product Tracker — portfolio KPIs, charts, filters, and searchable table.

import { useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList,
} from 'recharts';
import { useDashboardDataWithFallback } from '../../hooks/useDashboardDataWithFallback.js';
import { KpiCard } from '../components/KpiCard.jsx';
import { Pill, StaleBanner } from '../components/primitives.jsx';
import { ChartFrame, NUTooltip } from '../components/ChartFrame.jsx';
import { DonutChart } from '../components/DonutChart.jsx';
import { FilterRow, Filter } from '../components/Filters.jsx';
import { Search } from '../components/Search.jsx';
import { axisProps, gridProps, chartColors, chartMargins } from '../lib/chartTheme.js';
import {
  cnt,
  normalizeQuery,
  pct,
  rowMatchesSearch,
  toBarData,
  uniqueSorted,
} from '../lib/utils.js';

const FALLBACK = [];

const COLUMNS = [
  { key: 'product_name',   label: 'Product Name',   sortable: true },
  { key: 'product_type',   label: 'Product Type',   sortable: true },
  { key: 'expired_live',   label: 'Expired/Live',   sortable: true },
  { key: 'category',       label: 'Category (cat)', sortable: true },
  { key: 'product_family', label: 'Product Family', sortable: true },
];

const SEARCH_FIELDS = COLUMNS.map((c) => c.key);

function cellValue(value) {
  const s = String(value ?? '').trim();
  return s || '—';
}

function normStatus(raw) {
  return String(raw ?? '').trim().toLowerCase();
}

function isLive(row) {
  return normStatus(row.expired_live) === 'live';
}

function isExpired(row) {
  return normStatus(row.expired_live) === 'expired';
}

function isCommercial(row) {
  return normStatus(row.category) === 'commercial';
}

function matchesCombinedSearch(row, globalSearch, tableSearch) {
  const global = normalizeQuery(globalSearch);
  const local = normalizeQuery(tableSearch);
  if (global && !rowMatchesSearch(row, SEARCH_FIELDS, global)) return false;
  if (local && !rowMatchesSearch(row, SEARCH_FIELDS, local)) return false;
  return true;
}

function sortValue(row, key) {
  return String(row[key] ?? '').toLowerCase();
}

function donutFill(name, colors) {
  const n = String(name || '').toLowerCase();
  if (n === 'live') return colors.positive;
  if (n === 'expired') return colors.warning;
  if (n === 'commercial') return colors.accent;
  return null;
}

function SortIcon({ active, dir }) {
  return (
    <svg
      className="nu-table__sort-icon"
      data-active={active}
      data-dir={dir}
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M8 9l4-4 4 4" />
      <path d="M8 15l4 4 4-4" />
    </svg>
  );
}

function SortableTh({ col, sortKey, sortDir, onSort }) {
  const active = sortKey === col.key;
  return (
    <th>
      <button
        type="button"
        className="nu-table__sort"
        onClick={() => onSort(col.key)}
        aria-sort={active ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
      >
        <span>{col.label}</span>
        <SortIcon active={active} dir={sortDir} />
      </button>
    </th>
  );
}

// Single-infographic dimension card — either a donut (pie) or a horizontal
// bar chart, never both, to avoid repeating the same breakdown twice.
function DimensionChart({ title, type, data, colors, primaryName, ariaLabel }) {
  if (type === 'donut') {
    const donutData = data.map((d, i) => ({
      ...d,
      fill: donutFill(d.name, colors) || colors.palette[i % colors.palette.length],
    }));

    return (
      <ChartFrame
        title={title}
        caption={`${data.length} categories`}
        empty={data.length === 0}
      >
        <DonutChart
          data={donutData}
          colors={colors}
          ariaLabel={ariaLabel}
          primaryName={primaryName}
          totalLabel="products"
          height={220}
        />
      </ChartFrame>
    );
  }

  return (
    <ChartFrame
      title={title}
      caption="Count by category"
      empty={data.length === 0}
    >
      <ResponsiveContainer width="100%" height={Math.max(220, data.length * 32)}>
        <BarChart data={data} layout="vertical" barCategoryGap={12} margin={chartMargins('vertical')} accessibilityLayer aria-label={ariaLabel}>
          <CartesianGrid {...gridProps(colors)} horizontal={false} vertical />
          <XAxis type="number" {...axisProps(colors, { side: 'x', minimal: true })} />
          <YAxis
            type="category"
            dataKey="name"
            width={110}
            tick={{ fill: colors.ink2, fontSize: 11, fontFamily: 'Geist, sans-serif' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<NUTooltip />} cursor={{ fill: colors.cursor }} />
          <Bar dataKey="value" name="Products" barSize={18} radius={[0, 10, 10, 0]}>
            {data.map((entry, i) => (
              <Cell key={entry.name} fill={donutFill(entry.name, colors) || (i === 0 ? colors.accent : colors.ink3)} />
            ))}
            <LabelList
              dataKey="value"
              position="right"
              style={{ fill: colors.ink3, fontSize: 10, fontFamily: 'JetBrains Mono, monospace' }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

export function ProductTrackerView({ syncTick, search }) {
  const { rows: liveRows, sheetStatus } = useDashboardDataWithFallback('stdtracker', FALLBACK, syncTick);
  const rows = liveRows ?? FALLBACK;
  const colors = chartColors();

  const [productName, setProductName] = useState('All');
  const [productType, setProductType] = useState('All');
  const [expiredLive, setExpiredLive] = useState('All');
  const [category, setCategory] = useState('All');
  const [productFamily, setProductFamily] = useState('All');
  const [tableSearch, setTableSearch] = useState('');
  const [sortKey, setSortKey] = useState('product_name');
  const [sortDir, setSortDir] = useState('asc');

  const productNames   = ['All', ...uniqueSorted(rows.map((r) => r.product_name))];
  const productTypes   = ['All', ...uniqueSorted(rows.map((r) => r.product_type))];
  const expiredLiveOpts = ['All', ...uniqueSorted(rows.map((r) => r.expired_live))];
  const categories     = ['All', ...uniqueSorted(rows.map((r) => r.category))];
  const productFamilies = ['All', ...uniqueSorted(rows.map((r) => r.product_family))];

  const filtered = useMemo(
    () => rows.filter((r) =>
      matchesCombinedSearch(r, search, tableSearch) &&
      (productName   === 'All' || r.product_name   === productName) &&
      (productType   === 'All' || r.product_type   === productType) &&
      (expiredLive   === 'All' || r.expired_live   === expiredLive) &&
      (category      === 'All' || r.category       === category) &&
      (productFamily === 'All' || r.product_family === productFamily)
    ),
    [rows, search, tableSearch, productName, productType, expiredLive, category, productFamily],
  );

  const shown = useMemo(() => {
    const copy = [...filtered];
    copy.sort((a, b) => {
      const av = sortValue(a, sortKey);
      const bv = sortValue(b, sortKey);
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return copy;
  }, [filtered, sortKey, sortDir]);

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const totalProducts = filtered.length;
  const liveCount = filtered.filter(isLive).length;
  const expiredCount = filtered.filter(isExpired).length;
  const commercialCount = filtered.filter(isCommercial).length;
  const typeCount = new Set(filtered.map((r) => r.product_type).filter(Boolean)).size;
  const categoryCount = new Set(filtered.map((r) => r.category).filter(Boolean)).size;
  const familyCount = new Set(filtered.map((r) => r.product_family).filter(Boolean)).size;

  const productTypeData = toBarData(cnt(filtered, 'product_type'));
  const statusData = toBarData(cnt(filtered, 'expired_live'));
  const categoryData = toBarData(cnt(filtered, 'category'));
  const familyData = toBarData(cnt(filtered, 'product_family'));

  const searchSuffix = normalizeQuery(search) || normalizeQuery(tableSearch)
    ? ` (${shown.length} shown)`
    : '';

  return (
    <section className="nu-page">
      <header className="nu-page__head">
        <div className="nu-page__heading">
          <h1>Product Tracker</h1>
          <p>Portfolio overview of product name, type, lifecycle status, category, and product family.</p>
        </div>
      </header>

      <StaleBanner status={sheetStatus} />

      <div className="nu-kpi-row">
        <div className="nu-rise" data-i="0">
          <KpiCard
            label="Total Products"
            value={totalProducts}
            sub={`${rows.length} in portfolio`}
            filled
          />
        </div>
        <div className="nu-rise" data-i="1">
          <KpiCard
            label="Live Products"
            value={liveCount}
            sub={`${pct(liveCount, totalProducts)}% of filtered`}
          />
        </div>
        <div className="nu-rise" data-i="2">
          <KpiCard
            label="Commercial Products"
            value={commercialCount}
            sub={`${pct(commercialCount, totalProducts)}% of filtered`}
          />
        </div>
        <div className="nu-rise" data-i="4">
          <KpiCard
            label="Product Types"
            value={typeCount}
            sub="Distinct types"
          />
        </div>
        <div className="nu-rise" data-i="5">
          <KpiCard
            label="Product Families"
            value={familyCount}
            sub={`${categoryCount} categories`}
          />
        </div>
      </div>

      <FilterRow onReset={() => {
        setProductName('All');
        setProductType('All');
        setExpiredLive('All');
        setCategory('All');
        setProductFamily('All');
      }}
      >
        <Filter label="Product Name"   value={productName}    options={productNames}    onChange={setProductName} />
        <Filter label="Product Type"   value={productType}    options={productTypes}    onChange={setProductType} />
        <Filter label="Expired/Live"   value={expiredLive}    options={expiredLiveOpts} onChange={setExpiredLive} />
        <Filter label="Category"       value={category}       options={categories}      onChange={setCategory} />
        <Filter label="Product Family" value={productFamily}  options={productFamilies} onChange={setProductFamily} />
      </FilterRow>

      <div className="nu-grid nu-grid--2" style={{ marginTop: 14 }}>
        <DimensionChart
          title="Product Type"
          type="donut"
          data={productTypeData}
          colors={colors}
          primaryName={productTypeData[0]?.name}
          ariaLabel="Product type breakdown"
        />

        <DimensionChart
          title="Product Family"
          type="donut"
          data={familyData}
          colors={colors}
          primaryName={familyData[0]?.name}
          ariaLabel="Product family breakdown"
        />
      </div>

      <div className="nu-grid nu-grid--2" style={{ marginTop: 14 }}>
        <DimensionChart
          title="Expired/Live"
          type="bar"
          data={statusData}
          colors={colors}
          ariaLabel="Products grouped by expired or live status"
        />

        <DimensionChart
          title="Category"
          type="bar"
          data={categoryData}
          colors={colors}
          ariaLabel="Products grouped by category"
        />
      </div>

      <div className="nu-grid nu-grid--full" style={{ marginTop: 14 }}>
        <ChartFrame
          title="Product Portfolio"
          caption={`${shown.length} of ${rows.length} products${searchSuffix}`}
          action={(
            <Search
              id="nu-product-tracker-table-search"
              className="nu-search--compact"
              value={tableSearch}
              onChange={setTableSearch}
              placeholder="Filter table..."
              hint=""
            />
          )}
          empty={shown.length === 0}
        >
          <div className="nu-table-wrap">
            <table className="nu-table nu-table--sortable" style={{ minWidth: 920 }}>
              <thead>
                <tr>
                  {COLUMNS.map((col) => (
                    <SortableTh
                      key={col.key}
                      col={col}
                      sortKey={sortKey}
                      sortDir={sortDir}
                      onSort={handleSort}
                    />
                  ))}
                </tr>
              </thead>
              <tbody>
                {shown.map((row, i) => (
                  <tr key={`${row.product_name}-${i}`}>
                    <td className="nu-strong">{cellValue(row.product_name)}</td>
                    <td>{cellValue(row.product_type)}</td>
                    <td>
                      <Pill tone={isLive(row) ? 'positive' : isExpired(row) ? 'warning' : undefined}>
                        {cellValue(row.expired_live)}
                      </Pill>
                    </td>
                    <td>
                      <span className="nu-social-cat" title={cellValue(row.category)}>
                        {cellValue(row.category)}
                      </span>
                    </td>
                    <td>{cellValue(row.product_family)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ChartFrame>
      </div>
    </section>
  );
}
