// CSV parsing for supporter imports (RFC 4180: quotes, escaped quotes, CRLF, BOM).
// Also neutralises spreadsheet formula injection when values are written back out.

export const MAX_ROWS = 5000;

export function parseCsv(text) {
  text = String(text ?? '').replace(/^﻿/, '');
  const rows = [];
  let row = [], field = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; }
      else field += ch;
    } else if (ch === '"' && field === '') q = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some((c) => c.trim() !== '')) rows.push(row);
      row = [];
      if (rows.length > MAX_ROWS + 1) throw new Error(`CSV has more than ${MAX_ROWS} rows; split it.`);
    } else field += ch;
  }
  row.push(field);
  if (row.some((c) => c.trim() !== '')) rows.push(row);
  if (!rows.length) return { headers: [], records: [] };
  const headers = rows[0].map((h) => h.trim());
  const records = rows.slice(1).map((r) => Object.fromEntries(headers.map((h, i) => [h, (r[i] ?? '').trim()])));
  return { headers, records };
}

/** Guess which column holds which field, from common export header names. */
export function guessMapping(headers) {
  const find = (...re) => headers.find((h) => re.some((r) => r.test(h))) || '';
  return {
    display_name: find(/^display.?name$/i, /^name$/i, /full.?name/i, /^credit/i),
    handle: find(/handle/i, /user.?name/i, /^x$/i, /twitter/i, /^account/i),
    profile_url: find(/url/i, /link/i, /profile/i, /website/i),
    status: find(/status/i, /active/i),
    since: find(/since/i, /start/i, /joined/i, /date/i),
    visibility: find(/visib/i, /public/i, /consent/i, /anonym/i),
    note: find(/note/i, /comment/i),
  };
}

export function csvEscape(v) {
  let s = String(v ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;          // formula injection guard
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

export function toCsv(headers, rows) {
  return [headers.map(csvEscape).join(','), ...rows.map((r) => headers.map((h) => csvEscape(r[h])).join(','))].join('\r\n');
}
