// RFC 4180 escaping. The dataset carries free-text-ish values (a source name,
// a date) and nulls that must stay distinguishable from an empty string —
// blank means "no data for that field on that day", which is the whole point
// of keeping the provenance layers apart.

export function escapeCsvValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") {
    // NaN/Infinity have no CSV meaning; a spreadsheet reads them as text.
    return Number.isFinite(value) ? String(value) : "";
  }
  if (typeof value === "boolean") return value ? "true" : "false";

  const text = String(value);
  // A leading =, +, - or @ makes Excel treat the cell as a formula. Prefixing
  // a quote is the standard defusal and shows the original text back.
  const risky = /^[=+\-@\t\r]/.test(text);
  const escaped = risky ? `'${text}` : text;

  return /[",\n\r]/.test(escaped) ? `"${escaped.replace(/"/g, '""')}"` : escaped;
}

export function toCsv<T extends Record<string, unknown>>(
  rows: readonly T[],
  columns: readonly { key: keyof T & string; header: string }[],
): string {
  const head = columns.map((c) => escapeCsvValue(c.header)).join(",");
  const body = rows.map((row) => columns.map((c) => escapeCsvValue(row[c.key])).join(","));
  // CRLF because that is what RFC 4180 specifies and what Excel expects.
  return [head, ...body].join("\r\n");
}

export function downloadCsv(filename: string, csv: string) {
  // The BOM is what makes Excel read the file as UTF-8 rather than the local
  // codepage, which otherwise mangles any non-ASCII text.
  const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
