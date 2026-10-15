import type { Metadata } from "next";
import { Card, NoAccess, PageHeader } from "@showbuzz/console-ui/PageParts";
import { requireStaffPage } from "@showbuzz/core/auth/admin/current-staff";
import { listGiftCardDesignOptions } from "@showbuzz/core/services/admin/gift-card-admin.service";
import { hasPermission } from "@showbuzz/schemas/permissions";
import { IssueGiftCardForm } from "@/components/marketing/IssueGiftCardForm";

export const metadata: Metadata = { title: "Issue gift card" };

export default async function IssueGiftCardPage() {
  const { staff } = await requireStaffPage("/gift-cards/new");
  if (!hasPermission(staff.permissions, "gift-cards:issue")) return <NoAccess title="Issue gift card" />;
  const designs = await listGiftCardDesignOptions();
  return (
    <>
      <PageHeader
        title="Issue a complimentary gift card"
        crumb="Gift Cards"
        subtitle="ShowBuzz funds it: using it for tickets doesn't reduce the vendor's share."
      />
      <Card className="max-w-2xl p-6">
        <IssueGiftCardForm designs={designs} />
      </Card>
    </>
  );
}
