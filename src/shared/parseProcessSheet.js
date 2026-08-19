// Multi-block parser for the Process Team sheet.
//
// The sheet stacks 4 distinct tables vertically with blank rows between them:
//   1) Process counts by channel       (col A = team, col B = count)
//   2) TAT distribution per team       (side-by-side pairs of teams, 11 buckets, N month columns)
//   3) BVS / Non-BVS                   (single row of 2 numbers)
//   4) Team Member productivity        (N months × New/Revamp per row)
//
// Block ordering in the actual sheet is not stable — block 3 (BVS) appears
// between the two TAT pairs. So we detect each block by its header signature
// rather than by absolute row position.
//
// Month columns are DYNAMIC: the sheet grows a new Jan/Feb/Mar/... column
// pair each month, so instead of hardcoding a fixed month list we look at
// how many populated columns are actually in each block and derive the
// month labels from that (see monthLabels()). This means both the TAT block
// and the Team Productivity block automatically pick up new months without
// a code change. The detected labels are exposed on the result as
// `tatMonths` / `productivityMonths` so the frontend doesn't need to guess.
//
// Lives in src/shared/ so it can be imported from both the backend (api/_lib/fetchSheet.js)
// and the frontend direct-fetch path (src/hooks/useDashboardData.js) without
// crossing the /api/* URL namespace that Vercel routes to serverless functions.
import Papa from 'papaparse';

const TAT_BUCKETS = new Set([
  'Immediate', '2 Hours', '4 Hours', '6 Hours', '24 Hours',
  '1 Day', '2 Days', '3 Days', '4 Days', '5 Days', '13 Days',
]);

const CALENDAR_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'June', 'July', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Given a count of month "slots" detected in a block, produce labels:
// the last slot is always YTD, the rest are calendar months in order
// starting from Jan. e.g. monthLabels(9) -> [Jan..Aug, YTD]
function monthLabels(count) {
  if (count <= 0) return [];
  if (count === 1) return ['YTD'];
  return [...CALENDAR_MONTHS.slice(0, count - 1), 'YTD'];
}

function num(v) {
  if (v === undefined || v === null || v === '') return 0;
  const n = Number(String(v).replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : 0;
}

function isBlankRow(row) {
  if (!row) return true;
  return row.every(c => c === undefined || c === null || String(c).trim() === '');
}

function cell(row, i) {
  return row && row[i] !== undefined && row[i] !== null ? String(row[i]).trim() : '';
}

// Index of the last non-empty cell in a row, or -1 if the row is all blank.
function lastNonEmptyIndex(row) {
  if (!row) return -1;
  for (let i = row.length - 1; i >= 0; i--) {
    if (cell(row, i) !== '') return i;
  }
  return -1;
}

// Index of the first non-empty cell at or after `from`, or -1 if none.
function firstNonEmptyFrom(row, from) {
  if (!row) return -1;
  for (let i = from; i < row.length; i++) {
    if (cell(row, i) !== '') return i;
  }
  return -1;
}

function toRows(input) {
  if (Array.isArray(input)) return input;
  // Accept raw CSV text. Use header:false so we get a 2D array.
  const result = Papa.parse(input ?? '', { header: false, skipEmptyLines: false });
  return result.data;
}

export function parseProcessSheet(input) {
  const rows = toRows(input);
  const result = {
    counts: [],
    unique: 0,
    bvs: { bvs: 0, nonBvs: 0 },
    tat: [],
    tatMonths: [],
    teamProductivity: [],
    productivityMonths: [],
  };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (isBlankRow(row)) continue;

    const a = cell(row, 0);
    const b = cell(row, 1);

    // Block 1: Process counts. Header is "Processes" in col A, col B blank.
    if (a === 'Processes' && b === '') {
      i = readCountsBlock(rows, i + 1, result);
      continue;
    }

    // Block 3: BVS / Non-BVS. Header is "BVS" in col A, col B blank.
    if (a === 'BVS' && b === '') {
      i = readBvsBlock(rows, i + 1, result);
      continue;
    }

    // Block 4: Team productivity. The sheet uses a 2-row header — row 1 has
    // "Month" in col A, row 2 has "Team Member" in col A. We anchor on "Team Member".
    if (a === 'Team Member') {
      i = readProductivityBlock(rows, i + 1, result);
      continue;
    }
    // Skip the "Month" header line; the "Team Member" branch will pick up the data.
    if (a === 'Month' && b === '') continue;

    // Block 2: TAT pair. Two team names side by side, e.g.
    // "TeamA,,,,,,,TeamB,,,,,". Col A has the left team name, col B is blank
    // (value columns haven't started yet), and somewhere further along the
    // row is the right team's name followed by more blanks. We don't assume
    // a fixed column for the right team — we scan for it — so this adapts
    // automatically as the month range (and therefore column count) grows.
    if (a !== '' && b === '' && !TAT_BUCKETS.has(a)) {
      const rightCol = firstNonEmptyFrom(row, 1);
      const rightTeam = rightCol > 1 ? cell(row, rightCol) : '';
      // A genuine team-pair header has nothing else populated after the
      // right team name on that row.
      if (rightCol > 1 && firstNonEmptyFrom(row, rightCol + 1) === -1) {
        i = readTatPair(rows, i + 1, a, rightTeam, rightCol, result);
        continue;
      }
    }
  }

  return result;
}

function readCountsBlock(rows, start, result) {
  let i = start;
  for (; i < rows.length; i++) {
    const row = rows[i];
    if (isBlankRow(row)) break;
    const a = cell(row, 0);
    const b = cell(row, 1);
    if (a === '' || b === '') break;
    const count = num(b);
    if (a === 'Unique') {
      result.unique = count;
    } else {
      result.counts.push({ team: a, count });
    }
  }
  return i - 1; // outer loop will i++
}

function readBvsBlock(rows, start, result) {
  // The first non-blank row after "BVS" header has the two values in cols A and B.
  for (let i = start; i < rows.length; i++) {
    const row = rows[i];
    if (isBlankRow(row)) continue;
    result.bvs = { bvs: num(cell(row, 0)), nonBvs: num(cell(row, 1)) };
    return i;
  }
  return start;
}

// leftTeam's bucket rows run cols [1 .. rightCol-2] (that's rightCol-2 columns,
// since col rightCol-1 is the blank separator before the right team's bucket
// column at `rightCol`). The right team's values then run the same number of
// columns starting at rightCol+1. Both sides always carry the same month
// range in this sheet, so one detected column count covers both.
function readTatPair(rows, start, leftTeam, rightTeam, rightCol, result) {
  const monthCount = Math.max(0, rightCol - 2);
  const months = monthLabels(monthCount);
  if (months.length > result.tatMonths.length) result.tatMonths = months;
  const rightDataStart = rightCol + 1;

  let i = start;
  for (; i < rows.length; i++) {
    const row = rows[i];
    if (isBlankRow(row)) break;
    const leftBucket = cell(row, 0);
    const rightBucket = cell(row, rightCol);
    if (!TAT_BUCKETS.has(leftBucket) && !TAT_BUCKETS.has(rightBucket)) break;
    if (TAT_BUCKETS.has(leftBucket)) {
      for (let m = 0; m < months.length; m++) {
        result.tat.push({
          team: leftTeam,
          bucket: leftBucket,
          month: months[m],
          value: num(cell(row, 1 + m)),
        });
      }
    }
    if (TAT_BUCKETS.has(rightBucket)) {
      for (let m = 0; m < months.length; m++) {
        result.tat.push({
          team: rightTeam,
          bucket: rightBucket,
          month: months[m],
          value: num(cell(row, rightDataStart + m)),
        });
      }
    }
  }
  return i - 1;
}

function readProductivityBlock(rows, start, result) {
  let i = start;
  const blockRows = [];
  for (; i < rows.length; i++) {
    const row = rows[i];
    if (isBlankRow(row)) break;
    const name = cell(row, 0);
    if (name === '') break;
    blockRows.push(row);
  }

  // Each month is a New/Revamp pair of columns starting at col B (index 1).
  // Find the widest row (by last populated cell) to know how many pairs
  // actually have data, so newly-added months are picked up automatically.
  let maxIdx = -1;
  for (const row of blockRows) {
    const idx = lastNonEmptyIndex(row);
    if (idx > maxIdx) maxIdx = idx;
  }
  const numPairs = maxIdx <= 0 ? 0 : Math.round(maxIdx / 2);
  const months = monthLabels(numPairs);
  if (months.length > result.productivityMonths.length) result.productivityMonths = months;

  for (const row of blockRows) {
    const name = cell(row, 0);
    for (let m = 0; m < months.length; m++) {
      result.teamProductivity.push({
        teamMember: name,
        month: months[m],
        new: num(cell(row, 1 + m * 2)),
        revamp: num(cell(row, 1 + m * 2 + 1)),
      });
    }
  }

  return i - 1;
}
