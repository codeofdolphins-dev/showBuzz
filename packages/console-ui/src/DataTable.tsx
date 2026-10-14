import type { ReactNode } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Inbox } from "lucide-react";
import { cn } from "@showbuzz/utils/cn";
import { buildHref, sortParam, type ListParams, type SearchParamsRecord } from "./search-params";

/**
 * Server-rendered list table (prototype admin.css .data-table). Paging and sorting are plain links that change the
 * URL search params, so the page re-renders on the server with the new list; nothing is fetched on the client.
 */

export interface DataTableColumn<Row> {
  key: string;
  header: ReactNode;
  /** Field name for `sort=`; the column header becomes a sort link. Must be in the page's `sortable` list. */
  sortField?: string;
  className?: string;
  cell: (row: Row) => ReactNode;
}

interface DataTableProps<Row> {
  columns: DataTableColumn<Row>[];
  rows: Row[];
  rowKey: (row: Row) => string;
  /** Total matching rows (for paging). */
  total: number;
  params: ListParams;
  /** The page's path and current search params, so links keep every filter. */
  pathname: string;
  searchParams: SearchParamsRecord;
  /** Buttons/links for one row (edit, view, a status change...). */
  rowActions?: (row: Row) => ReactNode;
  /** Shown when there are no rows; defaults to a generic message. */
  empty?: ReactNode;
  caption?: string;
}

export function DataTable<Row>({
  columns,
  rows,
  rowKey,
  total,
  params,
  pathname,
  searchParams,
  rowActions,
  empty,
  caption,
}: DataTableProps<Row>) {
  const href = (overrides: Record<string, string | number | undefined>) => buildHref(pathname, searchParams, overrides);

  return (
    <div className="overflow-hidden rounded-xl border border-admin-border bg-white shadow-card">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          {caption ? <caption className="sr-only">{caption}</caption> : null}
          <thead className="bg-slate-50 text-[11px] tracking-wider text-admin-muted uppercase">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className={cn("px-4 py-2.5 font-bold whitespace-nowrap", column.className)}
                >
                  {column.sortField ? (
                    <SortLink column={column} field={column.sortField} params={params} href={href} />
                  ) : (
                    column.header
                  )}
                </th>
              ))}
              {rowActions ? (
                <th scope="col" className="px-4 py-2.5 text-right font-bold">
                  Actions
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (rowActions ? 1 : 0)} className="p-0">
                  {empty ?? <EmptyState title="Nothing here yet" description="No records match these filters." />}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={rowKey(row)} className="hover:bg-slate-50/60">
                  {columns.map((column) => (
                    <td key={column.key} className={cn("px-4 py-3 text-admin-text", column.className)}>
                      {column.cell(row)}
                    </td>
                  ))}
                  {rowActions ? (
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">{rowActions(row)}</div>
                    </td>
                  ) : null}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <Pagination total={total} params={params} href={href} />
    </div>
  );
}

function SortLink<Row>({
  column,
  field,
  params,
  href,
}: {
  column: DataTableColumn<Row>;
  field: string;
  params: ListParams;
  href: (overrides: Record<string, string | number | undefined>) => string;
}) {
  const active = params.sort.field === field;
  const nextDirection = active && params.sort.direction === "asc" ? "desc" : "asc";
  const Icon = !active ? ArrowUpDown : params.sort.direction === "asc" ? ArrowUp : ArrowDown;
  return (
    <Link
      href={href({ sort: sortParam({ field, direction: nextDirection }), page: undefined })}
      className={cn("inline-flex items-center gap-1 hover:text-admin-indigo", active && "text-admin-indigo")}
      aria-label={`Sort by ${typeof column.header === "string" ? column.header : field}, ${nextDirection === "asc" ? "ascending" : "descending"}`}
    >
      {column.header}
      <Icon className="h-3 w-3" aria-hidden />
    </Link>
  );
}

function Pagination({
  total,
  params,
  href,
}: {
  total: number;
  params: ListParams;
  href: (overrides: Record<string, string | number | undefined>) => string;
}) {
  const pages = Math.max(1, Math.ceil(total / params.limit));
  const page = Math.min(params.page, pages);
  const from = total === 0 ? 0 : (page - 1) * params.limit + 1;
  const to = Math.min(total, page * params.limit);
  const linkClass = (disabled: boolean) =>
    cn(
      "inline-flex h-8 w-8 items-center justify-center rounded-md border border-admin-border bg-white text-admin-muted hover:border-admin-indigo hover:text-admin-indigo",
      disabled && "pointer-events-none opacity-40",
    );

  return (
    <div className="flex flex-col items-center justify-between gap-2 border-t border-admin-border bg-slate-50/50 px-4 py-3 text-[11px] text-admin-muted sm:flex-row">
      <span>
        Showing <b className="text-admin-dark">{from}</b>–<b className="text-admin-dark">{to}</b> of{" "}
        <b className="text-admin-dark">{total.toLocaleString("en-IN")}</b>
      </span>
      <nav aria-label="Pagination" className="flex items-center gap-1.5">
        <Link
          href={href({ page: page - 1 > 1 ? page - 1 : undefined })}
          className={linkClass(page <= 1)}
          aria-label="Previous page"
          aria-disabled={page <= 1}
          tabIndex={page <= 1 ? -1 : undefined}
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
        </Link>
        <span className="px-2 font-semibold text-admin-dark">
          Page {page} of {pages}
        </span>
        <Link
          href={href({ page: page + 1 })}
          className={linkClass(page >= pages)}
          aria-label="Next page"
          aria-disabled={page >= pages}
          tabIndex={page >= pages ? -1 : undefined}
        >
          <ChevronRight className="h-4 w-4" aria-hidden />
        </Link>
      </nav>
    </div>
  );
}

/** Empty list / empty section placeholder. */
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-admin-subtle">
        <Inbox className="h-5 w-5" aria-hidden />
      </span>
      <p className="text-sm font-bold text-admin-dark">{title}</p>
      {description ? <p className="max-w-sm text-xs text-admin-muted">{description}</p> : null}
      {action}
    </div>
  );
}

/** A list that failed to load (render from the page's catch or an error.tsx boundary). */
export function TableError({ message, action }: { message?: string; action?: ReactNode }) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-2 rounded-xl border border-red-200 bg-red-50/50 px-6 py-10 text-center"
    >
      <AlertTriangle className="h-6 w-6 text-admin-danger" aria-hidden />
      <p className="text-sm font-bold text-admin-dark">This list couldn&apos;t be loaded</p>
      <p className="max-w-sm text-xs text-admin-muted">{message ?? "Please try again in a moment."}</p>
      {action}
    </div>
  );
}

/** Suspense fallback / loading.tsx for a list page. */
export function TableSkeleton({ rows = 6, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <div className="overflow-hidden rounded-xl border border-admin-border bg-white shadow-card" aria-busy="true">
      <span className="sr-only">Loading…</span>
      <div className="h-9 bg-slate-50" />
      <div className="divide-y divide-slate-100">
        {Array.from({ length: rows }, (_, r) => (
          <div key={r} className="flex gap-4 px-4 py-3.5">
            {Array.from({ length: columns }, (_, c) => (
              <div key={c} className="h-3 flex-1 animate-pulse rounded bg-slate-100" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
