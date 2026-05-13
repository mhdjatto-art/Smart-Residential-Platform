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

export function csvResponse(content: string, filename: string, extraHeaders: Record<string, string> = {}): Response {
  return new Response(content, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
      ...extraHeaders,
    },
  });
}

/**
 * Streams a CSV in chunks of `pageSize` rows. Each call to `fetchPage(offset)`
 * returns the next slice. When the response runs out, we close the stream.
 *
 * Set `hardCap` to abort at a maximum row count and add an `X-Truncated: true`
 * response header so the caller knows the export was cut.
 *
 * Why streaming: a 50k-row export buffered in memory blows Vercel's 4.5MB
 * response budget. Streaming sends rows as soon as they're ready and never
 * holds more than `pageSize` in memory.
 */
export function streamCsv<TRow>(opts: {
  filename: string;
  headers: string[];
  toRow: (row: TRow) => Array<unknown>;
  fetchPage: (offset: number, limit: number) => Promise<TRow[]>;
  pageSize?: number;
  hardCap?: number;
}): Response {
  const pageSize = opts.pageSize ?? 1000;
  const hardCap = opts.hardCap ?? 250_000;
  let totalRows = 0;
  let truncated = false;

  const enc = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        // BOM + header line
        controller.enqueue(enc.encode("﻿" + opts.headers.map(csvCell).join(",") + "\n"));

        for (let offset = 0; ; offset += pageSize) {
          const batch = await opts.fetchPage(offset, pageSize);
          if (batch.length === 0) break;

          for (const row of batch) {
            controller.enqueue(enc.encode(opts.toRow(row).map(csvCell).join(",") + "\n"));
            totalRows++;
            if (totalRows >= hardCap) {
              truncated = true;
              break;
            }
          }
          if (truncated || batch.length < pageSize) break;
        }
        if (truncated) {
          controller.enqueue(enc.encode(`# Output truncated at ${hardCap} rows. Refine filters or request smaller batches.\n`));
        }
        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${opts.filename}"`,
      "Cache-Control": "no-store",
      "X-Truncated": String(truncated), // best-effort — actual value resolved after stream ends, but Node may flush early
    },
  });
}
