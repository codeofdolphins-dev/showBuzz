import type { ReactNode } from "react";
import Link from "next/link";
import { TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@showbuzz/utils/cn";
import { Card } from "./PageParts";

/**
 * Dashboard building blocks shared by the admin and partner dashboards: period tabs, KPI tiles with the change vs
 * the previous period, a single-series bar trend and ranked bar lists. Plain HTML/CSS (no chart library): one hue
 * per chart, values always written as text, a screen-reader table for the trend, and a native tooltip per bar.
 */

export function RangeTabs({
  current,
  options,
  hrefFor,
}: {
  current: string;
  options: { value: string; label: string }[];
  hrefFor: (value: string) => string;
}) {
  return (
    <nav aria-label="Period" className="flex rounded-lg border border-admin-border bg-white p-0.5 shadow-card">
      {options.map((o) => (
        <Link
          key={o.value}
          href={hrefFor(o.value)}
          aria-current={o.value === current ? "page" : undefined}
          className={cn(
            "rounded-md px-3 py-1.5 text-xs font-semibold whitespace-nowrap",
            o.value === current ? "bg-admin-indigo text-white" : "text-admin-muted hover:text-admin-indigo",
          )}
        >
          {o.label}
        </Link>
      ))}
    </nav>
  );
}

/** "+12.4% vs previous period" (null when there is nothing to compare with). */
function delta(current: number, previous: number): { text: string; up: boolean } | null {
  if (previous === 0) return current > 0 ? { text: "New this period", up: true } : null;
  const change = ((current - previous) / previous) * 100;
  const rounded = Math.abs(change) >= 10 ? change.toFixed(0) : change.toFixed(1);
  return { text: `${change >= 0 ? "+" : ""}${rounded}% vs previous period`, up: change >= 0 };
}

export function KpiCard({
  label,
  value,
  icon,
  tone,
  note,
  current,
  previous,
}: {
  label: string;
  value: string;
  icon: ReactNode;
  tone: string;
  note?: string;
  /** With `previous`, shows the change vs the previous period. */
  current?: number;
  previous?: number;
}) {
  const change = current !== undefined && previous !== undefined ? delta(current, previous) : null;
  return (
    <Card className="space-y-2 p-4">
      <div className="flex items-center justify-between text-admin-subtle">
        <span className="text-[11px] font-bold tracking-wider uppercase">{label}</span>
        <span className={cn("flex h-7 w-7 items-center justify-center rounded-lg", tone)} aria-hidden>
          {icon}
        </span>
      </div>
      <p className="text-xl font-black tracking-tight text-admin-dark">{value}</p>
      {change ? (
        <p
          className={cn(
            "flex items-center gap-1 text-[10px] font-bold",
            change.up ? "text-emerald-700" : "text-admin-danger",
          )}
        >
          {change.up ? (
            <TrendingUp className="h-3 w-3" aria-hidden />
          ) : (
            <TrendingDown className="h-3 w-3" aria-hidden />
          )}
          {change.text}
        </p>
      ) : null}
      {note ? <p className="text-[10px] text-admin-subtle">{note}</p> : null}
    </Card>
  );
}

export function SectionTitle({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <div>
        <h2 className="text-sm font-bold text-admin-dark">{title}</h2>
        {subtitle ? <p className="text-[11px] text-admin-subtle">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

export interface TrendBar {
  key: string;
  label: string;
  value: number;
  /** Tooltip / table text for the value. */
  display: string;
}

/** Vertical bars over time (one series). Every 2nd–5th axis label is skipped when bars get dense. */
export function TrendChart({ bars, caption }: { bars: TrendBar[]; caption: string }) {
  const max = Math.max(1, ...bars.map((b) => b.value));
  const labelEvery = bars.length > 20 ? 5 : bars.length > 10 ? 2 : 1;
  const peak = bars.reduce<TrendBar | null>((best, b) => (b.value > (best?.value ?? 0) ? b : best), null);
  return (
    <figure className="space-y-2">
      <div className="flex h-56 items-end gap-0.5 border-b border-admin-border sm:gap-1" aria-hidden>
        {bars.map((b) => (
          <div
            key={b.key}
            className="group relative flex h-full flex-1 flex-col justify-end"
            title={`${b.label}: ${b.display}`}
          >
            <div
              className={cn(
                "w-full rounded-t-[4px] transition-colors",
                b.value > 0 ? "bg-admin-indigo/80 group-hover:bg-admin-indigo" : "bg-transparent",
              )}
              style={{ height: `${(b.value / max) * 100}%`, minHeight: b.value > 0 ? 2 : 0 }}
            />
          </div>
        ))}
      </div>
      <div className="flex gap-0.5 sm:gap-1" aria-hidden>
        {bars.map((b, i) => (
          <span key={b.key} className="flex-1 truncate text-center text-[9px] text-admin-subtle">
            {i % labelEvery === 0 ? b.label : ""}
          </span>
        ))}
      </div>
      <figcaption className="text-[11px] text-admin-muted">
        {peak ? `Peak: ${peak.label}, ${peak.display}.` : "No sales in this period."}
      </figcaption>
      <table className="sr-only">
        <caption>{caption}</caption>
        <tbody>
          {bars.map((b) => (
            <tr key={b.key}>
              <th scope="row">{b.label}</th>
              <td>{b.display}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

export interface BarListItem {
  key: string;
  label: string;
  detail?: string;
  value: number;
  display: string;
  /** Small text after the value, e.g. "128 tickets". */
  extra?: string;
  href?: string;
}

/** Ranked horizontal bars (one hue); the value is always written next to the label. */
export function BarList({ items, empty }: { items: BarListItem[]; empty: string }) {
  if (items.length === 0) return <p className="py-6 text-center text-xs text-admin-muted">{empty}</p>;
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <ul className="space-y-3">
      {items.map((item) => {
        const label = (
          <span className="min-w-0 truncate text-admin-text">
            {item.label}
            {item.detail ? <span className="ml-1 text-[10px] text-admin-subtle">· {item.detail}</span> : null}
          </span>
        );
        return (
          <li key={item.key} className="space-y-1" title={`${item.label}: ${item.display}`}>
            <div className="flex justify-between gap-3 text-xs">
              {item.href ? (
                <Link href={item.href} className="min-w-0 truncate hover:text-admin-indigo hover:underline">
                  {label}
                </Link>
              ) : (
                label
              )}
              <span className="shrink-0 text-right">
                <span className="font-bold text-admin-dark">{item.display}</span>
                {item.extra ? <span className="ml-1 text-[10px] text-admin-subtle">{item.extra}</span> : null}
              </span>
            </div>
            <div className="h-2 rounded-full bg-slate-100" aria-hidden>
              <div
                className="h-2 rounded-full bg-admin-teal"
                style={{ width: `${Math.max(1, (item.value / max) * 100)}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** Sold / capacity as a percentage with a small meter. */
export function OccupancyMeter({ sold, capacity }: { sold: number; capacity: number }) {
  if (capacity <= 0) return <span className="text-admin-subtle">{sold} sold</span>;
  const pct = Math.min(100, Math.round((sold / capacity) * 100));
  return (
    <span className="flex items-center gap-2" title={`${sold} of ${capacity} sold`}>
      <span className="h-1.5 w-16 rounded-full bg-slate-100" aria-hidden>
        <span
          className={cn("block h-1.5 rounded-full", pct >= 80 ? "bg-admin-success" : "bg-admin-indigo")}
          style={{ width: `${Math.max(pct, sold > 0 ? 4 : 0)}%` }}
        />
      </span>
      <span className="font-mono text-[11px] text-admin-text">
        {pct}%{" "}
        <span className="text-admin-subtle">
          ({sold}/{capacity})
        </span>
      </span>
    </span>
  );
}
