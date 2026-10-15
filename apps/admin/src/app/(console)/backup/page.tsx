import type { Metadata } from "next";
import type { ReactNode } from "react";
import { CalendarPlus, DatabaseBackup, Download, ShieldCheck } from "lucide-react";
import { Card, NoAccess, PageHeader } from "@showbuzz/console-ui/PageParts";
import { requireStaffPage } from "@showbuzz/core/auth/admin/current-staff";
import { BACKUP_COLLECTIONS } from "@showbuzz/core/services/admin/backup.service";
import { hasPermission } from "@showbuzz/schemas/permissions";
import { TopUpShowsButton } from "@/components/catalog/TopUpShowsButton";

export const metadata: Metadata = { title: "Backup" };

/**
 * Prototype backup.html. Export is real; restore and factory reset are deliberately not offered (they would overwrite
 * live data): MongoDB Atlas backups restore the database, `pnpm db:seed` refreshes the demo catalogue.
 */
export default async function BackupPage() {
  const { staff } = await requireStaffPage("/backup");
  if (!hasPermission(staff.permissions, "backup:read")) return <NoAccess title="Backup" />;
  const canWrite = hasPermission(staff.permissions, "backup:write");

  return (
    <>
      <PageHeader
        title="Database Backup & Export"
        crumb="Backup"
        subtitle="Export a JSON snapshot and keep the demo stocked."
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="flex flex-col justify-between gap-4 p-5">
          <div className="space-y-2">
            <Title icon={<Download className="h-4 w-4" />} title="Export JSON database" />
            <p className="text-xs text-admin-muted">
              Downloads a snapshot of {BACKUP_COLLECTIONS.length} collections: catalogue, venues and seat layouts,
              shows, vendors, bookings, payments, refunds, payouts, invoices, reviews, content and settings.
            </p>
            <p className="flex items-start gap-1.5 text-[11px] text-admin-subtle">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              Left out for security: staff and vendor logins, passwords and sessions, OTPs, bank account numbers, KYC
              documents, gift card codes and customers&apos; phone numbers and emails.
            </p>
          </div>
          <a
            href="/api/v1/admin/backup"
            className="inline-flex w-fit items-center gap-2 rounded-md border border-admin-indigo bg-admin-indigo px-4 py-2 text-xs font-bold text-white hover:bg-admin-dark"
          >
            <Download className="h-4 w-4" aria-hidden /> Export database (.json)
          </a>
        </Card>

        <Card className="flex flex-col justify-between gap-4 p-5">
          <div className="space-y-2">
            <Title icon={<CalendarPlus className="h-4 w-4" />} title="Demo showtimes" />
            <p className="text-xs text-admin-muted">
              Fills the next 7 days of showtimes at the seeded demo cinemas (Kolkata Screens, Bengal Picture Palace)
              from their daily templates. Real vendors&apos; cinemas are never touched, and shows that already exist are
              kept. Showtimes also fill in automatically when visitors browse; use this before a demo.
            </p>
          </div>
          {canWrite ? <TopUpShowsButton /> : <p className="text-[11px] text-admin-subtle">Needs backup:write.</p>}
        </Card>
      </div>

      <Card className="space-y-2 p-5">
        <Title icon={<DatabaseBackup className="h-4 w-4" />} title="Restore and reset" />
        <p className="text-xs text-admin-muted">
          Restoring from an uploaded file or resetting to demo data would overwrite live bookings and payments, so it is
          not available here. To restore, use MongoDB Atlas point-in-time backups (Atlas → Backup). To refresh the demo
          catalogue, run <code className="rounded bg-slate-100 px-1 font-mono">pnpm db:seed</code>: it adds missing demo
          data and never deletes anything.
        </p>
      </Card>
    </>
  );
}

function Title({ icon, title }: { icon: ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-admin-active text-admin-indigo">
        {icon}
      </span>
      <h2 className="text-sm font-bold text-admin-dark">{title}</h2>
    </div>
  );
}
