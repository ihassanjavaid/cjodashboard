import Papa from 'papaparse';

export function parseCsv(csvText) {
  if (!csvText) return [];
  const result = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: true,
  });
  return result.data;
}

export function parseCsvRaw(csvText) {
  if (!csvText) return [];
  const result = Papa.parse(csvText, {
    header: false,
    skipEmptyLines: false,
  });
  return result.data;
}
