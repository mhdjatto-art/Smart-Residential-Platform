/**
 * CSV helpers. Pure functions — safe to import from anywhere.
 */

/** Escape a value for CSV output. Quote if it contains comma, quote, or newline. */
export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function toCsv(headers: string[], rows: Array<Array<unknown>>): string {
  const headerLine = headers.map(csvCell).join(",");
  const body = rows.map((r) => r.map(csvCell).join(",")).join("\n");
  // Prepend BOM so Excel opens UTF-8 correctly.
  return "﻿" + headerLine + "\n" + body + "\n";
}

export function csvResponse(content: string, filename: string): Response {
  return new Response(content, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
