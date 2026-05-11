// Shared sheet schemas. Used by both frontend (direct-fetch in useDashboardData)
// and backend (api/_config/schemas.js re-exports from here).
//
// Design sheet header (verified 2026-05-09):
// Task no., Project / Work Item, Assigned To, Start Date, Concluded on,
// Stakeholders, Status, Count of Users (Usability& VOC), Number of Suggestions,
// Survey Type, Test Phone used

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const SHORT_MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

// Sheet uses DD/MM/YYYY (e.g. "12/09/2025" = 12 September 2025) or "DD/MM/YY".
// Returns the month name, or '' if unparseable so the row stays renderable.
function extractMonthName(dateStr) {
  if (!dateStr) return '';
  const parts = String(dateStr).split('/');
  if (parts.length !== 3) return '';
  const m = parseInt(parts[1], 10);
  if (m >= 1 && m <= 12) return MONTHS[m - 1];
  return '';
}

// Same date format as extractMonthName, but returns "Mon YY" so the dashboard's
// global period filter can sort chronologically across calendar-year boundaries
// (e.g. Dec 25 must sort before Jan 26, which a month-only label can't do).
function extractPeriod(dateStr) {
  if (!dateStr) return '';
  const parts = String(dateStr).split('/');
  if (parts.length !== 3) return '';
  const m = parseInt(parts[1], 10);
  let y = parseInt(parts[2], 10);
  if (!Number.isFinite(m) || m < 1 || m > 12) return '';
  if (!Number.isFinite(y)) return '';
  if (y >= 100) y = y % 100;
  return `${SHORT_MONTHS[m - 1]} ${String(y).padStart(2, '0')}`;
}

// Std-sheet "Month" column has inconsistent shapes — "Jan 2026", " Jan 2026"
// (leading space), "January", "Jan-26", "Mar-26". Normalize to the full month
// name so the dashboard's month filter matches across rows.
export function normalizeMonth(raw) {
  if (raw === undefined || raw === null) return '';
  const s = String(raw).trim();
  if (!s) return '';
  for (let i = 0; i < SHORT_MONTHS.length; i++) {
    const re = new RegExp(`\\b${SHORT_MONTHS[i]}\\b`, 'i');
    if (re.test(s)) return MONTHS[i];
  }
  return '';
}

// Derive a chronologically-comparable "Mon YY" label from the std-sheet "Month"
// column. Handles "Jan 2026", " Jan 2026", "Jan-26", "January 26", and bare
// "January" (year missing → returns just "Jan", which sorts after all dated rows).
export function normalizePeriod(raw) {
  if (raw === undefined || raw === null) return '';
  const s = String(raw).trim();
  if (!s) return '';
  let monthIdx = -1;
  for (let i = 0; i < SHORT_MONTHS.length; i++) {
    const re = new RegExp(`\\b${SHORT_MONTHS[i]}\\b`, 'i');
    if (re.test(s)) { monthIdx = i; break; }
  }
  if (monthIdx === -1) return '';
  const yearMatch = s.match(/\b(\d{4}|\d{2})\b/g);
  let year = null;
  if (yearMatch && yearMatch.length) {
    const four = yearMatch.find((t) => t.length === 4);
    const tok  = four ?? yearMatch[yearMatch.length - 1];
    let y = parseInt(tok, 10);
    if (Number.isFinite(y)) {
      if (y >= 100) y = y % 100;
      year = y;
    }
  }
  if (year === null) return SHORT_MONTHS[monthIdx];
  return `${SHORT_MONTHS[monthIdx]} ${String(year).padStart(2, '0')}`;
}

// Fold typo / whitespace / casing variants of the same person ("hasan", "Hasan ",
// "HASAN", "Hasan  Khan") into one canonical "Hasan" / "Hasan Khan" so charts
// don't show duplicate bars for what is really one resource.
function normalizeName(raw) {
  const s = String(raw || '').trim().replace(/\s+/g, ' ');
  if (!s) return '';
  return s.split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

// The "Survey Type" column in the Design sheet is mostly empty across month
// tabs. Infer the task type from the explicit column when filled, otherwise
// pattern-match against the project name. The dashboard's KPI cards filter on
// these exact values: "Usability", "Survey", "Sentiment Analysis",
// "App Pulse Reporting", "Expert Analysis", or "Misc.".
function inferDesignType(rawSurveyType, row) {
  const explicit = String(rawSurveyType || '').trim();
  const haystack = (explicit + ' ' + String(row?.['Project / Work Item'] || '')).toLowerCase();
  if (/sentiment/.test(haystack))                      return 'Sentiment Analysis';
  if (/pulse/.test(haystack))                          return 'App Pulse Reporting';
  if (/usability|user testing|voc/.test(haystack))     return 'Usability';
  if (/survey/.test(haystack))                         return 'Survey';
  if (/expert\s*analysis|heuristic|review/.test(haystack)) return 'Expert Analysis';
  return explicit || 'Misc.';
}

// Status in the Design sheet is sometimes blank for in-flight rows. Default
// blanks to "In Progress" so the Status Breakdown donut has a meaningful
// label instead of falling back to Recharts' generic "value" placeholder.
function normalizeDesignStatus(raw) {
  const s = String(raw || '').trim();
  return s || 'In Progress';
}

// The Design sheet has one worksheet per month (December → May+). Different
// months were created at different times by different people, so column
// headers vary slightly between tabs. The schema lists every header variant
// we've seen, in priority order. Case + whitespace are normalized by the
// mapper so minor typos like trailing spaces won't break matching.
export const designSchema = {
  month: {
    column: ['Start Date', 'Date', 'Date & Month', 'Date Started'],
    type: 'string',
    transform: extractMonthName,
  },
  period: {
    column: ['Start Date', 'Date', 'Date & Month', 'Date Started'],
    type: 'string',
    transform: extractPeriod,
  },
  project: {
    column: [
      'Project / Work Item', 'Project/Work Item', 'Project Name',
      'Project', 'Task Name', 'UAT Name', 'Work Item', 'Title',
    ],
    type: 'string',
  },
  assigned_to: {
    column: ['Assigned To', 'Assigned to', 'Owner', 'Resource', 'Person', 'Designer'],
    type: 'string',
    transform: normalizeName,
  },
  stakeholder: {
    column: [
      'Stakeholders', 'Stakeholder', 'Client', 'Department', 'Team',
      'Requested By', 'Requestor',
    ],
    type: 'string',
  },
  status: {
    column: ['Status', 'UAT Status', 'State'],
    type: 'string',
    transform: normalizeDesignStatus,
  },
  type: {
    column: ['Survey Type', 'Type', 'Task Type', 'Category', 'Activity Type'],
    type: 'string',
    transform: inferDesignType,
  },
  count_users: {
    column: [
      'Count of Users (Usability& VOC)', 'Count of Users (Usability & VOC)',
      'Count of Users', 'Number of Users', 'Users', 'User Count',
      'Participants', 'Respondents', '# of Users', 'No. of Users',
    ],
    type: 'number',
  },
};

// BAU worksheet schema — std sheet, BAU tab. Header is row 1 (no skip).
// Column "After launch Issues highlighted" appears twice in the sheet (cols 22
// and 26); when the values are deduped into a row object the second one wins.
// That's fine — both columns hold the same metric.
export const bauSchema = {
  source:             { column: '__SOURCE__',                          type: 'string', transform: () => 'BAU' },
  uat_name:           { column: 'UAT Name',                            type: 'string' },
  environment:        { column: 'Stagging/Live',                       type: 'string' },
  planned:            { column: 'Planned /Unplanned',                  type: 'string' },
  new_existing:       { column: 'New/Existing (Product/Service)',      type: 'string' },
  segment:            { column: 'Segment',                             type: 'string' },
  assigned_to:        { column: 'Assigned To',                         type: 'string' },
  assigned_by:        { column: 'Assigned By',                         type: 'string' },
  no_of_days:         { column: 'No. of Days',                         type: 'number' },
  uat_type:           { column: 'UAT Type',                            type: 'string' },
  month:              { column: 'Month',                               type: 'string', transform: normalizeMonth },
  period:             { column: 'Month',                               type: 'string', transform: normalizePeriod },
  manned_per_day:     { column: 'Manned Hours\n (Per Day)',            type: 'number' },
  total_manned:       { column: 'Total Manned\n (hrs)',                type: 'number' },
  total_cases:        { column: 'Total Test Cases',                    type: 'number' },
  pass_cases:         { column: 'Pass Test Cases',                     type: 'number' },
  failed_cases:       { column: 'Test Cases Failed',                   type: 'number' },
  issues_highlighted: { column: 'Issue Highlighted',                   type: 'number' },
  issues_fixed:       { column: 'Issues Fixed',                        type: 'number' },
  after_launch:       { column: 'After launch Issues highlighted',     type: 'number' },
  channel:            { column: 'Effected Channel(i.e IVR, SMS, USSD)', type: 'string' },
  uat_status:         { column: 'UAT Status',                          type: 'string' },
};

// JLV worksheet schema — std sheet, JLV tab. JLV has a 2-row header (group
// titles in row 1, blank row 2, actual headers in row 3), so the fetch layer
// must skipRows: 2 before treating row[skipRows] as the header.
//
// JLV doesn't have its own "Planned/Unplanned" or "Effected Channel" columns,
// so those are derived constants. "Test Cases Failed" is derived from
// total - pass. "segment" falls back to the Product value since JLV has no
// Segment column.
export const jlvSchema = {
  source:             { column: '__SOURCE__',                          type: 'string', transform: () => 'JLV' },
  uat_name:           { column: 'UAT Name',                            type: 'string' },
  platform:           { column: 'Platform((Android / iOS / Web)',      type: 'string' },
  app_variant:        { column: 'App Variant',                         type: 'string' },
  build_number:       { column: 'Build Number / Version',              type: 'string' },
  product:            { column: 'Product(i.e Apna clinic, tutor G)',   type: 'string' },
  environment:        { column: 'Environment (Stagging/Live)',         type: 'string' },
  new_existing:       { column: 'New / Existing (Product / Service)',  type: 'string' },
  assigned_to:        { column: 'Assigned To',                         type: 'string' },
  assigned_by:        { column: 'Assigned By',                         type: 'string' },
  no_of_days:         { column: 'No. of Days',                         type: 'number' },
  uat_type:           { column: 'UAT Type',                            type: 'string' },
  month:              { column: 'Month',                               type: 'string', transform: normalizeMonth },
  period:             { column: 'Month',                               type: 'string', transform: normalizePeriod },
  planned:            { column: '__PLANNED__',                         type: 'string', transform: () => 'Planned' },
  manned_per_day:     { column: 'Manned Hours\n (Per Day)',            type: 'number' },
  total_manned:       { column: 'Total Manned Hours',                  type: 'number' },
  total_cases:        { column: 'Total Test Cases',                    type: 'number' },
  pass_cases:         { column: 'Pass Test Cases',                     type: 'number' },
  failed_cases:       { column: '__DERIVED_FAILED__',                  type: 'number',
                        transform: (_raw, row) => {
                          const total = Number(row['Total Test Cases']);
                          const pass = Number(row['Pass Test Cases']);
                          if (Number.isFinite(total) && Number.isFinite(pass)) return total - pass;
                          return 0;
                        } },
  issues_highlighted: { column: 'Issue Highlighted',                   type: 'number' },
  issues_fixed:       { column: 'Issue Fixed',                         type: 'number' },
  after_launch:       { column: 'After launch Issues highlighted',     type: 'number' },
  channel:            { column: '__EMPTY__',                           type: 'string', transform: () => '' },
  uat_status:         { column: 'UAT Status',                          type: 'string' },
  segment:            { column: 'Product(i.e Apna clinic, tutor G)',   type: 'string' },
};

// Backwards-compat empty export for any callers still importing `stdSchema`.
// The std tab now uses per-stream schemas (bauSchema/jlvSchema) wired in
// api/_config/sheets.js.
export const stdSchema = {};
export const strategySchema = {};
