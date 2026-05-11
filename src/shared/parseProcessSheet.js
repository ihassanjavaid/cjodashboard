// Multi-block parser for the Process Team sheet.
//
// The sheet stacks 4 distinct tables vertically with blank rows between them:
//   1) Process counts by channel       (col A = team, col B = count)
//   2) TAT distribution per team       (side-by-side pairs of teams, 11 buckets, 5 month columns)
//   3) BVS / Non-BVS                   (single row of 2 numbers)
//   4) Team Member productivity        (5 months × New/Revamp per row)
//
// Block ordering in the actual sheet is not stable — block 3 (BVS) appears
// between the two TAT pairs. So we detect each block by its header signature
// rather than by absolute row position.
//
// Lives in src/shared/ so it can be imported from both the backend (api/_lib/fetchSheet.js)
// and the frontend direct-fetch path (src/hooks/useDashboardData.js) without
// crossing the /api/* URL namespace that Vercel routes to serverless functions.
import Papa from 'papaparse';

const TAT_BUCKETS = new Set([
  'Immediate', '2 Hours', '4 Hours', '6 Hours', '24 Hours',
  '1 Day', '2 Days', '3 Days', '4 Days', '5 Days', '13 Days',
]);
const TAT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'YTD'];
const PRODUCTIVITY_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'YTD'];

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
    teamProductivity: [],
  };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (isBlankRow(row)) continue;

    const a = cell(row, 0);
    const b = cell(row, 1);
    const h = cell(row, 7);

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

    // Block 2: TAT pair. Two team names (cols A and H) with blank value cols (B, I).
    // We require col A to NOT match any of the other block headers we already
    // handled above (already filtered) and to NOT be a TAT bucket name.
    if (a !== '' && h !== '' && b === '' && cell(row, 8) === '' && !TAT_BUCKETS.has(a)) {
      i = readTatPair(rows, i + 1, a, h, result);
      continue;
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

function readTatPair(rows, start, leftTeam, rightTeam, result) {
  let i = start;
  for (; i < rows.length; i++) {
    const row = rows[i];
    if (isBlankRow(row)) break;
    const leftBucket = cell(row, 0);
    const rightBucket = cell(row, 7);
    if (!TAT_BUCKETS.has(leftBucket) && !TAT_BUCKETS.has(rightBucket)) break;
    if (TAT_BUCKETS.has(leftBucket)) {
      for (let m = 0; m < TAT_MONTHS.length; m++) {
        result.tat.push({
          team: leftTeam,
          bucket: leftBucket,
          month: TAT_MONTHS[m],
          value: num(cell(row, 1 + m)),
        });
      }
    }
    if (TAT_BUCKETS.has(rightBucket)) {
      for (let m = 0; m < TAT_MONTHS.length; m++) {
        result.tat.push({
          team: rightTeam,
          bucket: rightBucket,
          month: TAT_MONTHS[m],
          value: num(cell(row, 8 + m)),
        });
      }
    }
  }
  return i - 1;
}

function readProductivityBlock(rows, start, result) {
  let i = start;
  for (; i < rows.length; i++) {
    const row = rows[i];
    if (isBlankRow(row)) break;
    const name = cell(row, 0);
    if (name === '') break;
    // 5 months × {new, revamp} = 10 numeric cells starting at col B.
    for (let m = 0; m < PRODUCTIVITY_MONTHS.length; m++) {
      result.teamProductivity.push({
        teamMember: name,
        month: PRODUCTIVITY_MONTHS[m],
        new: num(cell(row, 1 + m * 2)),
        revamp: num(cell(row, 1 + m * 2 + 1)),
      });
    }
  }
  return i - 1;
}
