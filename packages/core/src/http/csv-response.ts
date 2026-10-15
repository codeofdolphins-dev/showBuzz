import "server-only";
import type { ReportColumn, ReportRow } from "@showbuzz/schemas/report";
import { CSV_BOM, csvLine } from "@showbuzz/utils/csv";
import { log } from "@showbuzz/runtime/log";

const istDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" });
const istTime = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Kolkata",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** A cell for a spreadsheet: money in rupees with 2 decimals, dates as IST "YYYY-MM-DD" (+ " HH:mm"). */
export function csvValue(column: ReportColumn, value: ReportRow[string]): string | number | null {
  if (value === null || value === undefined || value === "") return null;
  switch (column.type) {
    case "money":
      return typeof value === "number" ? (value / 100).toFixed(2) : null;
    case "int":
      return typeof value === "number" ? value : null;
    case "date":
    case "datetime": {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return null;
      return column.type === "date" ? istDate.format(date) : `${istDate.format(date)} ${istTime.format(date)}`;
    }
    default:
      return String(value);
  }
}

/**
 * Streams a report as a CSV download: the header line first, then one line per row as the cursor yields it, so a
 * large export never sits in memory. An error mid-stream is logged and ends the file with a marker line.
 */
export function csvResponse(filename: string, columns: ReportColumn[], rows: AsyncIterable<ReportRow>): Response {
  const encoder = new TextEncoder();
  const iterator = rows[Symbol.asyncIterator]();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(CSV_BOM + csvLine(columns.map((c) => c.label))));
    },
    async pull(controller) {
      try {
        const lines: string[] = [];
        // Batch a few rows per chunk.
        for (let i = 0; i < 200; i++) {
          const next = await iterator.next();
          if (next.done) {
            if (lines.length) controller.enqueue(encoder.encode(lines.join("")));
            controller.close();
            return;
          }
          lines.push(csvLine(columns.map((c) => csvValue(c, next.value[c.key]))));
        }
        controller.enqueue(encoder.encode(lines.join("")));
      } catch (err) {
        log.error("CSV export failed", {
          event: "report.export_failed",
          error: err instanceof Error ? err.message : "unknown",
        });
        controller.enqueue(encoder.encode(csvLine(["Export interrupted: please try again."])));
        controller.close();
      }
    },
    async cancel() {
      await iterator.return?.();
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename.replace(/[^a-zA-Z0-9._-]/g, "_")}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
