import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Card, NoAccess, PageHeader } from "@showbuzz/console-ui/PageParts";
import { requireStaffPage } from "@showbuzz/core/auth/admin/current-staff";
import { getStreamAdmin } from "@showbuzz/core/services/admin/stream-admin.service";
import { hasPermission } from "@showbuzz/schemas/permissions";
import { StreamForm } from "@/components/catalog/StreamForm";

export const metadata: Metadata = { title: "Edit stream title" };

export default async function EditStreamPage({ params }: PageProps<"/streaming/[streamId]/edit">) {
  const { streamId } = await params;
  const { staff } = await requireStaffPage(`/streaming/${streamId}/edit`);
  if (!hasPermission(staff.permissions, "streaming:write")) return <NoAccess title="Edit stream title" />;
  const stream = await getStreamAdmin(streamId);
  if (!stream) notFound();
  return (
    <>
      <PageHeader title={`Edit ${stream.values.title}`} crumb="Online Streams" />
      <Card className="max-w-3xl p-6">
        <StreamForm streamId={stream.id} defaults={stream.values} />
      </Card>
    </>
  );
}
