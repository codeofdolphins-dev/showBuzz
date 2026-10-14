/**
 * List state in the URL (`?page=&limit=&sort=&q=` plus filters), so lists are server-rendered, shareable and survive
 * a reload. Pages parse it with `parseListParams` and pass the result to their service and to DataTable.
 */

export type SearchParamsRecord = Record<string, string | string[] | undefined>;

export type SortDirection = "asc" | "desc";

export interface ListParams {
  page: number;
  limit: number;
  q: string;
  sort: { field: string; direction: SortDirection };
}

export interface ListParamsOptions {
  /** Fields the list may be sorted by; anything else falls back to `defaultSort`. */
  sortable: readonly string[];
  defaultSort: { field: string; direction: SortDirection };
  defaultLimit?: number;
  maxLimit?: number;
}

export const LIMIT_CHOICES = [10, 25, 50, 100] as const;

/** First value of a search param. */
export function param(searchParams: SearchParamsRecord, name: string): string | undefined {
  const value = searchParams[name];
  return Array.isArray(value) ? value[0] : value;
}

/** `sort=-createdAt` means createdAt descending, `sort=name` ascending. */
export function parseListParams(searchParams: SearchParamsRecord, options: ListParamsOptions): ListParams {
  const maxLimit = options.maxLimit ?? 100;
  const page = Math.max(1, Math.floor(Number(param(searchParams, "page")) || 1));
  const limit = Math.min(
    maxLimit,
    Math.max(1, Math.floor(Number(param(searchParams, "limit")) || options.defaultLimit || 25)),
  );
  const q = (param(searchParams, "q") ?? "").trim().slice(0, 100);

  const rawSort = param(searchParams, "sort") ?? "";
  const direction: SortDirection = rawSort.startsWith("-") ? "desc" : "asc";
  const field = rawSort.replace(/^-/, "");
  const sort = options.sortable.includes(field) ? { field, direction } : options.defaultSort;
  return { page, limit, q, sort };
}

export function sortParam(sort: { field: string; direction: SortDirection }): string {
  return sort.direction === "desc" ? `-${sort.field}` : sort.field;
}

/** The current URL with `overrides` applied (undefined/"" removes a param). Keeps every other filter. */
export function buildHref(
  pathname: string,
  current: SearchParamsRecord,
  overrides: Record<string, string | number | undefined>,
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(current)) {
    const first = Array.isArray(value) ? value[0] : value;
    if (first !== undefined && first !== "") params.set(key, first);
  }
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined || value === "") params.delete(key);
    else params.set(key, String(value));
  }
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}
