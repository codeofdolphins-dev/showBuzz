import type { Metadata } from "next";
import { Lock } from "lucide-react";
import { TableError } from "@showbuzz/console-ui/DataTable";
import { Card, NoAccess, PageHeader } from "@showbuzz/console-ui/PageParts";
import { requireStaffPage } from "@showbuzz/core/auth/admin/current-staff";
import { getSettingsForm } from "@showbuzz/core/services/admin/settings-admin.service";
import { listCityOptions } from "@showbuzz/core/services/partner/onboarding.service";
import { hasPermission } from "@showbuzz/schemas/permissions";
import { formatDateShort, formatTime } from "@showbuzz/utils/dates";
import { SettingsForm } from "@/components/settings/SettingsForm";
import { load } from "@/lib/load";

export const metadata: Metadata = { title: "Platform Settings" };

/** Prototype settings.html: platform contact, box office rules and the defaults new vendors get. */
export default async function SettingsPage() {
  const { staff } = await requireStaffPage("/settings");
  if (!hasPermission(staff.permissions, "settings:read")) return <NoAccess title="Platform Settings" />;
  const result = await load(async () => {
    const form = await getSettingsForm();
    return { form, cities: await listCityOptions(form.values.defaultCityId) };
  });

  return (
    <>
      <PageHeader
        title="Platform & Ticketing Engine Settings"
        crumb="Settings"
        subtitle={
          result.ok && result.data.form.updatedAt
            ? `Last saved ${formatDateShort(new Date(result.data.form.updatedAt))}, ${formatTime(new Date(result.data.form.updatedAt))}`
            : "Using the built-in defaults until the first save."
        }
      />
      <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
        <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        Payment gateway keys are not stored here: they are set as environment variables on the server (no gateway is
        chosen yet; payments are simulated).
      </p>
      {!result.ok ? (
        <TableError message="Settings couldn't be loaded. Please try again." />
      ) : (
        <Card className="p-6">
          <SettingsForm
            defaults={result.data.form.values}
            cities={result.data.cities}
            canWrite={hasPermission(staff.permissions, "settings:write")}
          />
        </Card>
      )}
    </>
  );
}
