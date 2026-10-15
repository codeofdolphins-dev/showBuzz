import type { Metadata } from "next";
import Link from "next/link";
import { Star } from "lucide-react";
import { DataTable, EmptyState, TableError, type DataTableColumn } from "@showbuzz/console-ui/DataTable";
import { FilterBar } from "@showbuzz/console-ui/FilterBar";
import { NoAccess, PageHeader } from "@showbuzz/console-ui/PageParts";
import { StatusBadge } from "@showbuzz/console-ui/StatusBadge";
import { param, parseListParams } from "@showbuzz/console-ui/search-params";
import { requireStaffPage } from "@showbuzz/core/auth/admin/current-staff";
import {
  REVIEW_SORT_FIELDS,
  listReviewedMovieOptions,
  listReviewsAdmin,
} from "@showbuzz/core/services/admin/review-admin.service";
import { reviewStatusSchema } from "@showbuzz/schemas/admin-platform";
import { hasPermission } from "@showbuzz/schemas/permissions";
import type { ReviewRow } from "@showbuzz/schemas/types/admin-platform";
import { formatDateShort } from "@showbuzz/utils/dates";
import { moderateReviewAction } from "@/app/_actions/operations";
import { PromptActionButton } from "@/components/common/PromptActionButton";
import { defined, enumParam } from "@/lib/filters";
import { load } from "@/lib/load";

export const metadata: Metadata = { title: "Customer Reviews" };

const STATUS_OPTIONS = [
  { value: "published", label: "Published" },
  { value: "hidden", label: "Hidden" },
];
const RATING_OPTIONS = [5, 4, 3, 2, 1].map((n) => ({ value: String(n), label: `${n} star${n === 1 ? "" : "s"}` }));

function Stars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex" aria-label={`${rating} of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={n <= rating ? "h-3.5 w-3.5 fill-amber-400 text-amber-400" : "h-3.5 w-3.5 text-slate-300"}
          aria-hidden
        />
      ))}
    </span>
  );
}

const COLUMNS: DataTableColumn<ReviewRow>[] = [
  {
    key: "review",
    header: "Review",
    cell: (r) => (
      <span className="block max-w-xl space-y-1">
        <span className="flex flex-wrap items-center gap-2">
          <Link href={`/customers/${r.customerId}`} className="font-bold text-admin-dark hover:text-admin-indigo">
            {r.authorName}
          </Link>
          <span className="text-[11px] text-admin-subtle">
            for{" "}
            <Link href={`/movies/${r.movieId}`} className="hover:text-admin-indigo">
              {r.movieTitle}
            </Link>
          </span>
        </span>
        <span className="block text-xs text-admin-text">&ldquo;{r.text}&rdquo;</span>
      </span>
    ),
  },
  { key: "rating", header: "Rating", sortField: "rating", cell: (r) => <Stars rating={r.rating} /> },
  { key: "date", header: "Posted", sortField: "updatedAt", cell: (r) => formatDateShort(new Date(r.updatedAt)) },
  { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
];

/**
 * Prototype reviews.html: customer movie reviews. Hiding a review removes it from the movie page and from the
 * film's average rating (and publishing puts it back), in one transaction.
 */
export default async function ReviewsPage({ searchParams }: PageProps<"/reviews">) {
  const { staff } = await requireStaffPage("/reviews");
  if (!hasPermission(staff.permissions, "reviews:read")) return <NoAccess title="Customer Reviews" />;
  const sp = await searchParams;
  const params = parseListParams(sp, {
    sortable: REVIEW_SORT_FIELDS,
    defaultSort: { field: "updatedAt", direction: "desc" },
  });
  const rating = Number(param(sp, "rating"));
  const [result, movies] = await Promise.all([
    load(() =>
      listReviewsAdmin({
        ...params,
        ...defined({
          status: enumParam(sp, "status", reviewStatusSchema),
          movieId: param(sp, "movie"),
          rating: Number.isInteger(rating) && rating >= 1 && rating <= 5 ? rating : undefined,
        }),
      }),
    ),
    listReviewedMovieOptions().catch(() => []),
  ]);
  const canWrite = hasPermission(staff.permissions, "reviews:write");

  return (
    <>
      <PageHeader
        title="Customer Ratings & Review Moderation"
        crumb="Customer Reviews"
        subtitle="Hidden reviews disappear from the movie page and its average rating; customers can still edit them (they stay hidden)."
      />
      <FilterBar
        searchPlaceholder="Search review text or author…"
        filters={[
          { name: "status", label: "Status", options: STATUS_OPTIONS },
          { name: "movie", label: "Movie", options: movies, allLabel: "All movies" },
          { name: "rating", label: "Rating", options: RATING_OPTIONS },
        ]}
      />
      {!result.ok ? (
        <TableError />
      ) : (
        <DataTable
          columns={COLUMNS}
          rows={result.data.rows}
          rowKey={(r) => r.id}
          total={result.data.total}
          params={params}
          pathname="/reviews"
          searchParams={sp}
          caption="Reviews"
          rowActions={
            canWrite
              ? (r) =>
                  r.status === "published" ? (
                    <PromptActionButton
                      label="Hide"
                      title="Hide this review?"
                      description={`It disappears from ${r.movieTitle} and stops counting in its rating.`}
                      confirmLabel="Hide review"
                      tone="danger"
                      action={moderateReviewAction.bind(null, r.id, { status: "hidden" })}
                      success="Review hidden."
                    />
                  ) : (
                    <PromptActionButton
                      label="Publish"
                      title="Publish this review?"
                      description={`It shows on ${r.movieTitle} again and counts in its rating.`}
                      confirmLabel="Publish"
                      action={moderateReviewAction.bind(null, r.id, { status: "published" })}
                      success="Review published."
                    />
                  )
              : undefined
          }
          empty={<EmptyState title="No reviews match" description="Try another search or filter." />}
        />
      )}
    </>
  );
}
