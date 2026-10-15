import type { Metadata } from "next";
import { Card, NoAccess, PageHeader } from "@showbuzz/console-ui/PageParts";
import { requireStaffPage } from "@showbuzz/core/auth/admin/current-staff";
import { hasPermission } from "@showbuzz/schemas/permissions";
import { StreamForm } from "@/components/catalog/StreamForm";

export const metadata: Metadata = { title: "Add stream title" };

export default async function NewStreamPage() {
  const { staff } = await requireStaffPage("/streaming/new");
  if (!hasPermission(staff.permissions, "streaming:write")) return <NoAccess title="Add stream title" />;
  return (
    <>
      <PageHeader title="Add stream title" crumb="Online Streams" subtitle="It joins the end of the /stream shelf." />
      <Card className="max-w-3xl p-6">
        <StreamForm />
      </Card>
    </>
  );
}
