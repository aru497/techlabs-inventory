// Turn any supported source (uploaded file OR Google Sheet URL) into rows of
// { header -> value }. Format detection is by extension / content; the
// normalization agent handles the messy column-naming afterwards.

import Papa from 'papaparse';
import * as XLSX from 'xlsx';

export type Row = Record<string, unknown>;

export interface ParsedSource {
  rows: Row[];
  headers: string[];
}

function headersFromRows(rows: Row[]): string[] {
  const seen = new Set<string>();
  for (const row of rows) {
    for (const key of Object.keys(row)) seen.add(key);
  }
  return [...seen];
}

function parseCsv(text: string): ParsedSource {
  const result = Papa.parse<Row>(text, {
    header: true,
    skipEmptyLines: 'greedy',
    dynamicTyping: false,
    transformHeader: (h) => h.trim(),
  });
  const rows = (result.data || []).filter(
    (r) => r && Object.values(r).some((v) => v !== null && v !== undefined && String(v).trim() !== ''),
  );
  return { rows, headers: headersFromRows(rows) };
}

function parseXlsx(buffer: ArrayBuffer): ParsedSource {
  const wb = XLSX.read(new Uint8Array(buffer), { type: 'array' });
  const firstSheet = wb.SheetNames[0];
  if (!firstSheet) return { rows: [], headers: [] };
  const sheet = wb.Sheets[firstSheet];
  const rows = XLSX.utils.sheet_to_json<Row>(sheet, { defval: null, raw: false });
  return { rows, headers: headersFromRows(rows) };
}

function parseJson(text: string): ParsedSource {
  const data = JSON.parse(text);
  let rows: Row[];
  if (Array.isArray(data)) {
    rows = data as Row[];
  } else if (data && typeof data === 'object') {
    // Accept { items: [...] } / { data: [...] } / { rows: [...] } wrappers.
    const arr = (data.items || data.data || data.rows || data.records) as Row[] | undefined;
    rows = Array.isArray(arr) ? arr : [data as Row];
  } else {
    rows = [];
  }
  return { rows, headers: headersFromRows(rows) };
}

/** Parse an uploaded file into rows, dispatching on filename/extension. */
export async function parseFile(filename: string, buffer: ArrayBuffer): Promise<ParsedSource> {
  const ext = filename.toLowerCase().split('.').pop() || '';
  if (ext === 'csv' || ext === 'tsv' || ext === 'txt') {
    return parseCsv(new TextDecoder().decode(buffer));
  }
  if (ext === 'xlsx' || ext === 'xls') {
    return parseXlsx(buffer);
  }
  if (ext === 'json') {
    return parseJson(new TextDecoder().decode(buffer));
  }
  // Fallback: try CSV, it's the most forgiving.
  return parseCsv(new TextDecoder().decode(buffer));
}

/**
 * Convert an arbitrary Google Sheets URL into its CSV-export endpoint.
 * Works for links shared as "anyone with the link can view".
 */
export function googleSheetCsvUrl(url: string): string | null {
  const m = url.match(/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (!m) return null;
  const id = m[1];
  // Preserve a specific tab if a gid is present.
  const gidMatch = url.match(/[#&?]gid=([0-9]+)/);
  const gid = gidMatch ? gidMatch[1] : '0';
  return `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}`;
}

/** Fetch a public Google Sheet and parse it as CSV. */
export async function parseGoogleSheet(url: string): Promise<ParsedSource> {
  const csvUrl = googleSheetCsvUrl(url);
  if (!csvUrl) {
    throw new Error('Not a recognizable Google Sheets URL.');
  }
  const res = await fetch(csvUrl, { redirect: 'follow' });
  if (!res.ok) {
    throw new Error(
      `Could not fetch the sheet (HTTP ${res.status}). Make sure link sharing is set to "Anyone with the link — Viewer".`,
    );
  }
  const text = await res.text();
  if (text.trimStart().toLowerCase().startsWith('<!doctype html') || text.includes('<html')) {
    throw new Error('The sheet returned an HTML page instead of CSV — it is probably not publicly shared.');
  }
  return parseCsv(text);
}
