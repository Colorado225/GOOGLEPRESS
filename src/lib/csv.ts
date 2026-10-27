/**
 * Export CSV 100 % frontend.
 * Séparateur « ; » et BOM UTF-8 : ouverture directe dans Excel en français,
 * accents préservés, nombres exportés bruts (réutilisables en tableur).
 */

function escapeCsvCell(value: string | number): string {
  const s = typeof value === 'number' ? String(value) : value;
  if (/[";\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function buildCsv(headers: string[], rows: (string | number)[][]): string {
  const lines = [headers, ...rows].map((row) => row.map(escapeCsvCell).join(';'));
  return '﻿' + lines.join('\r\n') + '\r\n';
}

export function downloadCsv(
  filename: string,
  headers: string[],
  rows: (string | number)[][]
): void {
  const csv = buildCsv(headers, rows);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
