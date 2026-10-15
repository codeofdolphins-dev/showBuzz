import type { Metadata } from "next";
import Link from "next/link";
import { Pencil, Plus } from "lucide-react";
import { DataTable, EmptyState, TableError, type DataTableColumn } from "@showbuzz/console-ui/DataTable";
import { LinkButton } from "@showbuzz/console-ui/LinkButton";
import { NoAccess, PageHeader } from "@showbuzz/console-ui/PageParts";
import { StatusBadge } from "@showbuzz/console-ui/StatusBadge";
import { parseListParams } from "@showbuzz/console-ui/search-params";
import { requireStaffPage } from "@showbuzz/core/auth/admin/current-staff";
import { listLanguagesAdmin } from "@showbuzz/core/services/admin/master-data-admin.service";
import { hasPermission } from "@showbuzz/schemas/permissions";
import type { LanguageRow } from "@showbuzz/schemas/types/admin-platform";
import { moveLanguageAction } from "@/app/_actions/master-data";
import { MoveButtons } from "@/components/common/MoveButtons";
import { load } from "@/lib/load";

export const metadata: Metadata = { title: "Languages" };

const COLUMNS: DataTableColumn<LanguageRow>[] = [
  { key: "name", header: "Language", cell: (l) => <span className="font-bold text-admin-dark">{l.name}</span> },
  { key: "native", header: "Native script", cell: (l) => l.nativeName || "—" },
  { key: "movies", header: "Movies", className: "text-right", cell: (l) => l.movies },
  { key: "status", header: "Status", cell: (l) => <StatusBadge status={l.status} /> },
];

/** Prototype languages.html: audio languages offered by the movie forms (both consoles), in this order. */
export default async function LanguagesPage({ searchParams }: PageProps<"/languages">) {
  const { staff } = await requireStaffPage("/languages");
  if (!hasPermission(staff.permissions, "languages:read")) return <NoAccess title="Languages" />;
  const sp = await searchParams;
  const result = await load(listLanguagesAdmin);
  const canWrite = hasPermission(staff.permissions, "languages:write");
  const rows = result.ok ? result.data : [];

  return (
    <>
      <PageHeader
        title="Audio & Subtitle Languages"
        crumb="Languages"
        subtitle="Vendors pick films' languages from the active ones. The first six (in this order) are the home page's language chips."
        actions={
          canWrite ? (
            <LinkButton href="/languages/new">
              <Plus className="h-4 w-4" aria-hidden /> Add language
            </LinkButton>
          ) : null
        }
      />
      {!result.ok ? (
        <TableError />
      ) : (
        <DataTable
          columns={COLUMNS}
          rows={rows}
          rowKey={(l) => l.id}
          total={rows.length}
          params={{
            ...parseListParams({}, { sortable: [], defaultSort: { field: "sortOrder", direction: "asc" } }),
            limit: Math.max(rows.length, 1),
          }}
          pathname="/languages"
          searchParams={sp}
          caption="Languages"
          rowActions={
            canWrite
              ? (l) => (
                  <>
                    <MoveButtons
                      id={l.id}
                      label={l.name}
                      first={rows[0]?.id === l.id}
                      last={rows.at(-1)?.id === l.id}
                      action={moveLanguageAction}
                    />
                    <Link
                      href={`/languages/${l.id}/edit`}
                      className="rounded-md p-1.5 text-admin-muted hover:bg-slate-100 hover:text-admin-indigo"
                      aria-label={`Edit ${l.name}`}
                    >
                      <Pencil className="h-4 w-4" aria-hidden />
                    </Link>
                  </>
                )
              : undefined
          }
          empty={<EmptyState title="No languages yet" description="Run pnpm db:seed or add the first language." />}
        />
      )}
    </>
  );
}
