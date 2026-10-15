import { requirePermission } from "@showbuzz/core/auth/admin/current-staff";
import { apiHandler } from "@showbuzz/core/http/api-handler";
import { logActivity } from "@showbuzz/core/services/activity-log.service";
import { backupJsonChunks } from "@showbuzz/core/services/admin/backup.service";
import { istDateKey } from "@showbuzz/utils/dates";
import { log } from "@showbuzz/runtime/log";
import { actorOf } from "@/lib/actor";

/**
 * JSON export of the database for records and audits (`backup:read`, Super Admin by default). Streamed collection by
 * collection; logins, password hashes, sessions, OTPs, bank account numbers, KYC files, gift card codes and customer
 * contact details are left out (see backup.service.ts). Every export is written to the activity log.
 */
export const GET = apiHandler({}, async () => {
  const current = await requirePermission("backup:read");
  const now = new Date();
  await logActivity(actorOf(current), {
    action: "backup_export",
    resource: "backup",
    summary: "Exported the database (JSON)",
    changedFields: [],
  });
  const encoder = new TextEncoder();
  const chunks = backupJsonChunks(now)[Symbol.asyncIterator]();
  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const next = await chunks.next();
        if (next.done) controller.close();
        else controller.enqueue(encoder.encode(next.value));
      } catch (err) {
        log.error("Backup export failed", {
          event: "backup.export_failed",
          error: err instanceof Error ? err.message : "unknown",
        });
        controller.error(err);
      }
    },
    async cancel() {
      await chunks.return?.(undefined);
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="showbuzz-backup-${istDateKey(now)}.json"`,
      "X-Content-Type-Options": "nosniff",
    },
  });
});
