/**
 * CSV (RFC 4180) for report exports. Text cells that a spreadsheet would run as a formula (starting with = + - @,
 * tab or carriage return) get a leading apostrophe, so an exported title or name can't execute in Excel/Sheets.
 * Numbers are written as numbers.
 */

const FORMULA_START = /^[=+\-@\t\r]/;

export function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  const safe = FORMULA_START.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function csvLine(values: (string | number | null | undefined)[]): string {
  return `${values.map(csvCell).join(",")}\r\n`;
}

/** UTF-8 byte order mark: Excel needs it to read ₹ and non-Latin names correctly. */
export const CSV_BOM = "﻿";
