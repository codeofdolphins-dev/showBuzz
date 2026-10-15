import type { Metadata } from "next";
import { EmptyState, TableError } from "@showbuzz/console-ui/DataTable";
import { FilterBar } from "@showbuzz/console-ui/FilterBar";
import { NotificationsPager } from "@showbuzz/console-ui/NotificationsList";
import { Card, NoAccess, PageHeader } from "@showbuzz/console-ui/PageParts";
import { buildHref, param } from "@showbuzz/console-ui/search-params";
import { requireStaffPage } from "@showbuzz/core/auth/admin/current-staff";
import { listMedia } from "@showbuzz/core/services/admin/media-admin.service";
import { hasPermission } from "@showbuzz/schemas/permissions";
import { formatDateShort } from "@showbuzz/utils/dates";
import { MediaItemActions, MediaUploader } from "@/components/catalog/MediaControls";
import { load } from "@/lib/load";

export const metadata: Metadata = { title: "Media Library" };

const PAGE_SIZE = 24;

const size = (bytes: number) =>
  bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

/**
 * Prototype media-library.html: upload images once and reuse them by path (`/media/<id>`) in any image field.
 * Stand-in storage (MongoDB GridFS) until S3 / Vercel Blob is chosen.
 */
export default async function MediaLibraryPage({ searchParams }: PageProps<"/media-library">) {
  const { staff } = await requireStaffPage("/media-library");
  if (!hasPermission(staff.permissions, "media-library:read")) return <NoAccess title="Media Library" />;
  const sp = await searchParams;
  const page = Math.max(1, Math.floor(Number(param(sp, "page")) || 1));
  const q = (param(sp, "q") ?? "").trim().slice(0, 100);
  const result = await load(() => listMedia({ page, limit: PAGE_SIZE, q }));
  const canWrite = hasPermission(staff.permissions, "media-library:write");

  return (
    <>
      <PageHeader
        title="Media Library & File Assets"
        crumb="Media Library"
        subtitle="Images for posters, banners, stream titles and pages. Upload once, then paste the copied path into any image field."
      />
      {canWrite ? <MediaUploader /> : null}
      <FilterBar searchPlaceholder="Search file name or description…" />
      {!result.ok ? (
        <TableError />
      ) : result.data.rows.length === 0 ? (
        <Card>
          <EmptyState
            title={q ? "No images match" : "No images yet"}
            description={q ? "Try another search." : "Uploaded images appear here."}
          />
        </Card>
      ) : (
        <>
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {result.data.rows.map((m) => (
              <li key={m.id}>
                <Card className="overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element -- served by this app's /media route */}
                  <img
                    src={m.url}
                    alt={m.alt}
                    className="aspect-square w-full bg-slate-50 object-cover"
                    loading="lazy"
                  />
                  <div className="space-y-1 p-2.5">
                    <p className="truncate text-[11px] font-semibold text-admin-dark" title={m.filename}>
                      {m.filename}
                    </p>
                    <p className="text-[10px] text-admin-subtle">
                      {size(m.size)} · {m.uploadedBy} · {formatDateShort(new Date(m.createdAt))}
                    </p>
                    <p className="truncate font-mono text-[10px] text-admin-muted">{m.url}</p>
                    {canWrite ? <MediaItemActions id={m.id} url={m.url} filename={m.filename} /> : null}
                  </div>
                </Card>
              </li>
            ))}
          </ul>
          <NotificationsPager
            page={page}
            pages={Math.ceil(result.data.total / PAGE_SIZE)}
            hrefFor={[
              buildHref("/media-library", sp, { page: page - 1 }),
              buildHref("/media-library", sp, { page: page + 1 }),
            ]}
          />
        </>
      )}
    </>
  );
}
