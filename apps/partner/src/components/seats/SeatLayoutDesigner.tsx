"use client";

import { Fragment, useEffect, useMemo, useState, useTransition, type KeyboardEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  Accessibility,
  ArrowDown,
  ArrowUp,
  Ban,
  Columns2,
  Lock,
  Plus,
  Save,
  Tag,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import { cn } from "@showbuzz/utils/cn";
import { Card } from "@showbuzz/console-ui/PageParts";
import { MoneyInput } from "@showbuzz/console-ui/fields";
import { Button, FormMessage, Input, Select } from "@showbuzz/console-ui/form";
import { useToast } from "@showbuzz/console-ui/Toaster";
import { SEAT_CATEGORY_PRESETS, seatLayoutInputSchema } from "@showbuzz/schemas/partner-venue";
import type { LayoutConflictShow, SeatLayoutView } from "@showbuzz/schemas/types/partner-venue";
import { MAX_SEATS_PER_ROW, SEAT_ACCENTS, type SeatAccent } from "@showbuzz/schemas/venue";
import { saveSeatLayoutAction } from "@/app/_actions/venues";
import { ConflictShows } from "@/components/venues/ConflictShows";
import { ACCENT_LABELS, ACCENT_SEAT, ACCENT_SWATCH, SEAT_CELL } from "./seat-styles";
import { useSeatSelection } from "./use-seat-selection";

/**
 * Prototype seat-layout.html (+ assets/js/seats.js): categories with a colour and default price, rows of seats per
 * category, aisles, wheelchair spots and blocked seats. Seats are picked by click or drag (Shift/Ctrl adds) and the
 * toolbar applies an action to the selection. Seats sold or in checkout for upcoming shows are locked (padlock):
 * they can't be removed, blocked or moved to another category. The server checks the same rule on save.
 */

interface Category {
  key: string;
  /** Stored id; absent for categories added in this session. */
  id?: string;
  name: string;
  description: string;
  accent: SeatAccent;
  recliner: boolean;
  pricePaise: number | undefined;
}

interface Row {
  key: string;
  letter: string;
  category: string;
  count: number;
  aisles: number[];
  accessible: number[];
  blocked: number[];
}

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const sorted = (values: Iterable<number>) => [...new Set(values)].sort((a, b) => a - b);

let keySeq = 0;
const newKey = (prefix: string) => `${prefix}-${(keySeq += 1)}`;

function initialState(layout: SeatLayoutView) {
  const categories: Category[] = layout.screen.zones.map((z) => ({
    key: z.id,
    id: z.id,
    name: z.name,
    description: z.description === z.name ? "" : z.description,
    accent: z.accent,
    recliner: z.recliner,
    pricePaise: z.defaultPricePaise,
  }));
  const rows: Row[] = layout.screen.zones.flatMap((z) =>
    z.rows.map((r) => ({
      key: newKey("row"),
      letter: r.row,
      category: z.id,
      count: r.count,
      aisles: [...r.aislesAfter],
      accessible: [...r.accessibleSeats],
      blocked: [...r.blockedSeats],
    })),
  );
  return { categories, rows };
}

interface DesignerProps {
  venueId: string;
  layout: SeatLayoutView;
}

export function SeatLayoutDesigner({ venueId, layout }: DesignerProps) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [{ categories, rows }, setState] = useState(() => initialState(layout));
  const [dirty, setDirty] = useState(false);
  const [newRowCategory, setNewRowCategory] = useState(() => layout.screen.zones.at(-1)?.id ?? "");
  const [messages, setMessages] = useState<string[]>([]);
  const [conflicts, setConflicts] = useState<LayoutConflictShow[]>([]);

  /** Locked seat id → the category (stored id) it was sold in. */
  const locked = useMemo(() => new Map(layout.lockedSeats.map((s) => [s.seatId, s.zoneId])), [layout.lockedSeats]);

  const displayRows = useMemo(
    () => categories.flatMap((c) => rows.filter((r) => r.category === c.key)),
    [categories, rows],
  );
  const gridRows = useMemo(() => displayRows.map((r) => ({ letter: r.letter, count: r.count })), [displayRows]);
  const { selected, clear, gridHandlers, setSelected } = useSeatSelection(gridRows);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function update(next: { categories?: Category[]; rows?: Row[] }) {
    setState((current) => ({ categories: next.categories ?? current.categories, rows: next.rows ?? current.rows }));
    setDirty(true);
  }

  const lockedIn = (row: Row) =>
    Array.from({ length: row.count }, (_, i) => i + 1).filter((n) => locked.has(`${row.letter}${n}`));

  // ---- categories

  function addCategory(presetName: string) {
    const preset = SEAT_CATEGORY_PRESETS.find((p) => p.name === presetName);
    const taken = new Set(categories.map((c) => c.name.toLowerCase()));
    let name = preset?.name ?? "New category";
    for (let n = 2; taken.has(name.toLowerCase()); n += 1) name = `${preset?.name ?? "New category"} ${n}`;
    const category: Category = {
      key: newKey("cat"),
      name,
      description: "",
      accent: preset?.accent ?? SEAT_ACCENTS[categories.length % SEAT_ACCENTS.length] ?? "indigo",
      recliner: preset?.recliner ?? false,
      pricePaise: preset?.pricePaise ?? 25_000,
    };
    update({ categories: [...categories, category] });
    setNewRowCategory(category.key);
  }

  function patchCategory(key: string, patch: Partial<Category>) {
    update({ categories: categories.map((c) => (c.key === key ? { ...c, ...patch } : c)) });
  }

  function moveCategory(key: string, direction: -1 | 1) {
    const index = categories.findIndex((c) => c.key === key);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= categories.length) return;
    const next = [...categories];
    [next[index], next[target]] = [next[target] as Category, next[index] as Category];
    update({ categories: next });
  }

  function removeCategory(key: string) {
    update({ categories: categories.filter((c) => c.key !== key) });
    if (newRowCategory === key) setNewRowCategory(categories.find((c) => c.key !== key)?.key ?? "");
  }

  // ---- rows

  function addRow() {
    const used = new Set(rows.map((r) => r.letter));
    const last = displayRows.at(-1)?.letter;
    const after = last ? LETTERS.slice(LETTERS.indexOf(last) + 1) : LETTERS;
    const letter = after.find((l) => !used.has(l)) ?? LETTERS.find((l) => !used.has(l));
    const category = categories.find((c) => c.key === newRowCategory) ?? categories.at(-1);
    if (!letter) return toast.error("All 26 row letters are in use.");
    if (!category) return toast.error("Add a seat category first.");
    const template = [...rows].reverse().find((r) => r.category === category.key);
    update({
      rows: [
        ...rows,
        {
          key: newKey("row"),
          letter,
          category: category.key,
          count: template?.count ?? 12,
          aisles: template ? [...template.aisles] : [],
          accessible: [],
          blocked: [],
        },
      ],
    });
  }

  function patchRow(key: string, patch: Partial<Row>) {
    const row = rows.find((r) => r.key === key);
    if (!row) return;
    const sold = lockedIn(row);
    if (patch.count !== undefined && sold.some((n) => n > (patch.count ?? 0))) {
      return toast.error(`Row ${row.letter} has seats sold up to ${Math.max(...sold)}: it can't be shorter.`);
    }
    if (patch.letter !== undefined && patch.letter !== row.letter && sold.length > 0) {
      return toast.error(`Row ${row.letter} has sold seats, so its letter can't change.`);
    }
    if (patch.category !== undefined && patch.category !== row.category && sold.length > 0) {
      return toast.error(`Row ${row.letter} has sold seats, so it can't move to another category.`);
    }
    const count = patch.count ?? row.count;
    const fit = (values: number[]) => values.filter((n) => n <= count);
    update({
      rows: rows.map((r) =>
        r.key === key
          ? {
              ...r,
              ...patch,
              aisles: fit(patch.aisles ?? r.aisles).filter((n) => n < count),
              accessible: fit(patch.accessible ?? r.accessible),
              blocked: fit(patch.blocked ?? r.blocked),
            }
          : r,
      ),
    });
  }

  function moveRow(key: string, direction: -1 | 1) {
    const row = rows.find((r) => r.key === key);
    if (!row) return;
    const same = rows.filter((r) => r.category === row.category);
    const swapWith = same[same.indexOf(row) + direction];
    if (!swapWith) return;
    update({
      rows: rows.map((r) => (r.key === row.key ? swapWith : r.key === swapWith.key ? row : r)),
    });
  }

  function removeRow(key: string) {
    const row = rows.find((r) => r.key === key);
    if (!row) return;
    if (lockedIn(row).length > 0) return toast.error(`Row ${row.letter} has seats sold for upcoming shows.`);
    update({ rows: rows.filter((r) => r.key !== key) });
  }

  // ---- selection actions

  /** Selected seat numbers per row key. */
  function selectionByRow(): Map<string, number[]> {
    const byRow = new Map<string, number[]>();
    for (const row of rows) {
      const numbers = Array.from({ length: row.count }, (_, i) => i + 1).filter((n) =>
        selected.has(`${row.letter}${n}`),
      );
      if (numbers.length > 0) byRow.set(row.key, numbers);
    }
    return byRow;
  }

  function applyToSelection(fn: (row: Row, numbers: number[]) => Row) {
    const byRow = selectionByRow();
    if (byRow.size === 0) return toast.info("Select seats first: click, or drag across the grid.");
    update({ rows: rows.map((r) => (byRow.has(r.key) ? fn(r, byRow.get(r.key) ?? []) : r)) });
  }

  function blockSelection(block: boolean) {
    let skipped = 0;
    applyToSelection((row, numbers) => {
      if (!block) return { ...row, blocked: row.blocked.filter((n) => !numbers.includes(n)) };
      const allowed = numbers.filter((n) => !locked.has(`${row.letter}${n}`));
      skipped += numbers.length - allowed.length;
      return { ...row, blocked: sorted([...row.blocked, ...allowed]) };
    });
    if (skipped > 0) toast.info(`${skipped} seat(s) are sold for upcoming shows and stay sellable.`);
  }

  function accessibleSelection(on: boolean) {
    applyToSelection((row, numbers) => ({
      ...row,
      accessible: on ? sorted([...row.accessible, ...numbers]) : row.accessible.filter((n) => !numbers.includes(n)),
    }));
  }

  function aisleAfterSelection() {
    applyToSelection((row, numbers) => {
      const edge = Math.max(...numbers);
      if (edge >= row.count) return row;
      return {
        ...row,
        aisles: row.aisles.includes(edge) ? row.aisles.filter((n) => n !== edge) : sorted([...row.aisles, edge]),
      };
    });
  }

  function categoryForSelection(categoryKey: string) {
    const refused: string[] = [];
    applyToSelection((row) => {
      if (row.category !== categoryKey && lockedIn(row).length > 0) {
        refused.push(row.letter);
        return row;
      }
      return { ...row, category: categoryKey };
    });
    if (refused.length > 0) toast.info(`Rows ${refused.join(", ")} have sold seats and keep their category.`);
  }

  // ---- save

  function save() {
    setMessages([]);
    setConflicts([]);
    const payload = {
      expectedUpdatedAt: layout.updatedAt,
      zones: categories.map((c) => ({
        ...(c.id ? { id: c.id } : {}),
        name: c.name,
        description: c.description,
        accent: c.accent,
        recliner: c.recliner,
        defaultPricePaise: c.pricePaise,
        rows: rows
          .filter((r) => r.category === c.key)
          .map((r) => ({
            row: r.letter,
            count: r.count,
            aislesAfter: r.aisles,
            accessibleSeats: r.accessible,
            blockedSeats: r.blocked,
          })),
      })),
    };
    const parsed = seatLayoutInputSchema.safeParse(payload);
    if (!parsed.success) {
      setMessages(
        [
          ...new Set(
            parsed.error.issues.map((issue) => {
              const index = issue.path[0] === "zones" ? issue.path[1] : undefined;
              const name = typeof index === "number" ? categories[index]?.name : undefined;
              const text = issue.path.includes("defaultPricePaise") ? "Enter a default price" : issue.message;
              return name ? `${name}: ${text}` : text;
            }),
          ),
        ].slice(0, 8),
      );
      return;
    }
    startTransition(async () => {
      const result = await saveSeatLayoutAction(venueId, layout.screen.id, parsed.data);
      if (!result.success) {
        setConflicts((result.error.details?.shows as LayoutConflictShow[] | undefined) ?? []);
        setMessages([result.error.message]);
        return;
      }
      toast.success(`Layout saved: ${result.data.capacity.toLocaleString("en-IN")} sellable seats.`);
      setDirty(false);
      router.refresh();
    });
  }

  function reset() {
    setState(initialState(layout));
    setDirty(false);
    clear();
  }

  const capacity = rows.reduce((sum, r) => sum + r.count - r.blocked.length, 0);
  const usedLetters = new Set(rows.map((r) => r.letter));
  const categoryOf = (key: string) => categories.find((c) => c.key === key);
  const unusedPresets = SEAT_CATEGORY_PRESETS.filter(
    (p) => !categories.some((c) => c.name.toLowerCase() === p.name.toLowerCase()),
  );

  function onSeatKey(event: KeyboardEvent<HTMLButtonElement>, id: string) {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  return (
    <div className="space-y-6">
      {messages.length > 0 ? (
        <FormMessage tone="error">
          <ul className="list-inside list-disc space-y-0.5">
            {messages.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </FormMessage>
      ) : null}
      {conflicts.length > 0 ? <ConflictShows shows={conflicts} /> : null}

      {/* Toolbar: capacity, save */}
      <Card className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-3 text-[11px] font-semibold text-admin-muted">
          {categories.map((c) => (
            <span key={c.key} className="flex items-center gap-1.5">
              <span className={cn("h-3.5 w-3.5 rounded", ACCENT_SWATCH[c.accent])} aria-hidden />
              {c.name}
            </span>
          ))}
          <span className="flex items-center gap-1.5">
            <Accessibility className="h-3.5 w-3.5" aria-hidden /> Wheelchair
          </span>
          <span className="flex items-center gap-1.5">
            <Ban className="h-3.5 w-3.5" aria-hidden /> Blocked
          </span>
          <span className="flex items-center gap-1.5">
            <Lock className="h-3.5 w-3.5" aria-hidden /> Sold for an upcoming show
          </span>
          <span className="border-l border-admin-border pl-3 text-xs font-bold text-admin-indigo">
            {capacity.toLocaleString("en-IN")} sellable seats
          </span>
        </div>
        <div className="flex items-center gap-2">
          {dirty ? <span className="text-[11px] font-semibold text-amber-700">Unsaved changes</span> : null}
          <Button type="button" variant="secondary" onClick={reset} disabled={!dirty || pending}>
            <Undo2 className="h-4 w-4" aria-hidden /> Discard
          </Button>
          <Button type="button" onClick={save} disabled={pending}>
            <Save className="h-4 w-4" aria-hidden /> {pending ? "Saving…" : "Save layout"}
          </Button>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[22rem_1fr]">
        {/* Categories */}
        <Card className="space-y-4 p-4">
          <div>
            <h2 className="text-sm font-bold text-admin-dark">Seat categories</h2>
            <p className="text-[11px] text-admin-subtle">
              Listed front to back. New shows start with these prices; each show can change them.
            </p>
          </div>
          <ul className="space-y-3">
            {categories.map((c, index) => {
              const rowCount = rows.filter((r) => r.category === c.key).length;
              return (
                <li key={c.key} className="space-y-2 rounded-lg border border-admin-border p-3">
                  <div className="flex items-center gap-2">
                    <span className={cn("h-4 w-4 shrink-0 rounded", ACCENT_SWATCH[c.accent])} aria-hidden />
                    <Input
                      value={c.name}
                      onChange={(e) => patchCategory(c.key, { name: e.target.value })}
                      aria-label="Category name"
                      maxLength={40}
                      className="font-bold"
                    />
                    <IconButton label="Move up" disabled={index === 0} onClick={() => moveCategory(c.key, -1)}>
                      <ArrowUp className="h-3.5 w-3.5" />
                    </IconButton>
                    <IconButton
                      label="Move down"
                      disabled={index === categories.length - 1}
                      onClick={() => moveCategory(c.key, 1)}
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </IconButton>
                    <IconButton
                      label={rowCount > 0 ? "Move its rows to another category first" : "Remove category"}
                      disabled={rowCount > 0}
                      onClick={() => removeCategory(c.key)}
                      danger
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </IconButton>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <MoneyInput
                      label="Default price"
                      value={c.pricePaise}
                      onChange={(value) => patchCategory(c.key, { pricePaise: value })}
                    />
                    <label className="block">
                      <span className="mb-1 block text-[13px] font-semibold text-admin-text">Colour</span>
                      <Select
                        value={c.accent}
                        onChange={(e) => patchCategory(c.key, { accent: e.target.value as SeatAccent })}
                      >
                        {SEAT_ACCENTS.map((a) => (
                          <option key={a} value={a}>
                            {ACCENT_LABELS[a]}
                          </option>
                        ))}
                      </Select>
                    </label>
                  </div>
                  <Input
                    value={c.description}
                    onChange={(e) => patchCategory(c.key, { description: e.target.value })}
                    placeholder="Label on the seat map (optional), e.g. Luxury recliners with blankets"
                    aria-label="Label on the seat map"
                    maxLength={80}
                  />
                  <label className="flex items-center gap-2 text-[11px] font-semibold text-admin-muted">
                    <input
                      type="checkbox"
                      checked={c.recliner}
                      onChange={(e) => patchCategory(c.key, { recliner: e.target.checked })}
                      className="h-4 w-4 accent-indigo-600"
                    />
                    Recliner seats (shown wider on movie seat maps) · {rowCount} row{rowCount === 1 ? "" : "s"}
                  </label>
                </li>
              );
            })}
          </ul>
          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold text-admin-muted">Add a category</p>
            <div className="flex flex-wrap gap-1.5">
              {unusedPresets.map((p) => (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => addCategory(p.name)}
                  className="inline-flex items-center gap-1 rounded-full border border-admin-border px-2.5 py-1 text-[11px] font-semibold text-admin-text hover:border-admin-indigo hover:text-admin-indigo"
                >
                  <span className={cn("h-2.5 w-2.5 rounded-sm", ACCENT_SWATCH[p.accent])} aria-hidden />
                  {p.name}
                </button>
              ))}
              <button
                type="button"
                onClick={() => addCategory("")}
                className="inline-flex items-center gap-1 rounded-full border border-dashed border-admin-border px-2.5 py-1 text-[11px] font-semibold text-admin-muted hover:border-admin-indigo hover:text-admin-indigo"
              >
                <Plus className="h-3 w-3" aria-hidden /> Own name
              </button>
            </div>
          </div>
        </Card>

        {/* Grid */}
        <Card className="min-w-0 space-y-4 p-4">
          <div className="flex flex-col gap-2 border-b border-admin-border pb-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-[11px] font-bold text-admin-dark">
                {selected.size > 0 ? `${selected.size} selected:` : "Select seats, then:"}
              </span>
              <ActionButton onClick={() => blockSelection(true)} icon={Ban} label="Block" />
              <ActionButton onClick={() => blockSelection(false)} icon={Undo2} label="Unblock" />
              <ActionButton onClick={() => accessibleSelection(true)} icon={Accessibility} label="Wheelchair" />
              <ActionButton onClick={() => accessibleSelection(false)} icon={X} label="Not wheelchair" />
              <ActionButton onClick={aisleAfterSelection} icon={Columns2} label="Aisle after" />
              <label className="flex items-center gap-1 text-[11px] font-semibold text-admin-muted">
                <Tag className="h-3.5 w-3.5" aria-hidden />
                <select
                  value=""
                  onChange={(e) => e.target.value && categoryForSelection(e.target.value)}
                  className="rounded-md border border-admin-border bg-white px-1.5 py-1 text-xs text-admin-text"
                  aria-label="Move the selected rows to a category"
                >
                  <option value="">Rows to category…</option>
                  {categories.map((c) => (
                    <option key={c.key} value={c.key}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              {selected.size > 0 ? (
                <button
                  type="button"
                  onClick={clear}
                  className="text-[11px] font-bold text-admin-muted hover:underline"
                >
                  Clear
                </button>
              ) : null}
            </div>
            <div className="flex items-center gap-1.5">
              <select
                value={newRowCategory}
                onChange={(e) => setNewRowCategory(e.target.value)}
                className="rounded-md border border-admin-border bg-white px-1.5 py-1.5 text-xs text-admin-text"
                aria-label="Category for new rows"
              >
                {categories.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.name}
                  </option>
                ))}
              </select>
              <Button type="button" variant="secondary" onClick={addRow}>
                <Plus className="h-4 w-4 text-admin-indigo" aria-hidden /> Add row
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto pb-2">
            <div className="mx-auto w-max min-w-full space-y-1.5" {...gridHandlers}>
              <div className="mx-auto mb-5 w-2/3 rounded-b-3xl border-t-4 border-admin-indigo/60 pt-1 text-center text-[10px] font-bold tracking-[0.3em] text-admin-subtle uppercase">
                {layout.screen.layoutType === "stadium" ? "Pitch / stage" : "Screen this way"}
              </div>
              {displayRows.length === 0 ? (
                <p className="py-12 text-center text-xs text-admin-muted">No rows yet. Use “Add row”.</p>
              ) : null}
              {displayRows.map((row, r) => {
                const category = categoryOf(row.category);
                const first = displayRows[r - 1]?.category !== row.category;
                const siblings = rows.filter((x) => x.category === row.category);
                return (
                  <Fragment key={row.key}>
                    {first && category ? (
                      <p className="pt-3 text-[11px] font-bold tracking-wider text-admin-muted uppercase">
                        {category.name}
                      </p>
                    ) : null}
                    <div className="flex items-center gap-2">
                      <select
                        value={row.letter}
                        onChange={(e) => patchRow(row.key, { letter: e.target.value })}
                        className="w-11 rounded-md border border-admin-border bg-white px-1 py-1 text-xs font-bold text-admin-dark"
                        aria-label={`Row ${row.letter} letter`}
                      >
                        {LETTERS.filter((l) => l === row.letter || !usedLetters.has(l)).map((l) => (
                          <option key={l} value={l}>
                            {l}
                          </option>
                        ))}
                      </select>
                      <div className="flex touch-none items-center gap-1">
                        {Array.from({ length: row.count }, (_, i) => {
                          const n = i + 1;
                          const id = `${row.letter}${n}`;
                          const isBlocked = row.blocked.includes(n);
                          const isAccessible = row.accessible.includes(n);
                          const isSelected = selected.has(id);
                          return (
                            <Fragment key={id}>
                              <button
                                type="button"
                                data-seat={id}
                                data-r={r}
                                data-n={n}
                                onKeyDown={(e) => onSeatKey(e, id)}
                                aria-pressed={isSelected}
                                aria-label={`Seat ${id}${isBlocked ? ", blocked" : ""}${isAccessible ? ", wheelchair" : ""}${locked.has(id) ? ", sold for an upcoming show" : ""}`}
                                className={cn(
                                  SEAT_CELL,
                                  "relative cursor-pointer",
                                  isBlocked
                                    ? "border-dashed border-slate-300 bg-white text-slate-300"
                                    : category
                                      ? ACCENT_SEAT[category.accent]
                                      : ACCENT_SEAT.slate,
                                  isSelected && "scale-110 ring-2 ring-admin-indigo ring-offset-1",
                                )}
                              >
                                {isBlocked ? (
                                  <Ban className="h-3 w-3" aria-hidden />
                                ) : isAccessible ? (
                                  <Accessibility className="h-3 w-3" aria-hidden />
                                ) : (
                                  n
                                )}
                                {locked.has(id) ? (
                                  <Lock
                                    className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-white text-admin-dark"
                                    aria-hidden
                                  />
                                ) : null}
                              </button>
                              {row.aisles.includes(n) ? <span className="w-4 shrink-0" aria-hidden /> : null}
                            </Fragment>
                          );
                        })}
                      </div>
                      <div className="flex items-center gap-1 pl-2">
                        <Input
                          type="number"
                          min={1}
                          max={MAX_SEATS_PER_ROW}
                          value={row.count}
                          onChange={(e) => {
                            const count = Math.min(MAX_SEATS_PER_ROW, Math.max(1, Math.floor(Number(e.target.value))));
                            if (Number.isFinite(count)) patchRow(row.key, { count });
                          }}
                          aria-label={`Seats in row ${row.letter}`}
                          className="w-16 py-1"
                        />
                        <IconButton
                          label="Move row up"
                          disabled={siblings[0]?.key === row.key}
                          onClick={() => moveRow(row.key, -1)}
                        >
                          <ArrowUp className="h-3.5 w-3.5" />
                        </IconButton>
                        <IconButton
                          label="Move row down"
                          disabled={siblings.at(-1)?.key === row.key}
                          onClick={() => moveRow(row.key, 1)}
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                        </IconButton>
                        <IconButton label={`Delete row ${row.letter}`} onClick={() => removeRow(row.key)} danger>
                          <Trash2 className="h-3.5 w-3.5" />
                        </IconButton>
                      </div>
                    </div>
                  </Fragment>
                );
              })}
            </div>
          </div>
          <p className="text-[11px] text-admin-subtle">
            Tip: drag across seats to select a block; hold Shift or Ctrl to add to the selection. Up to{" "}
            {MAX_SEATS_PER_ROW} seats per row and 26 rows (A–Z).
          </p>
        </Card>
      </div>
    </div>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={cn(
        "rounded-md p-1 text-admin-muted hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-30",
        danger ? "hover:text-admin-danger" : "hover:text-admin-indigo",
      )}
    >
      {children}
    </button>
  );
}

function ActionButton({ onClick, icon: Icon, label }: { onClick: () => void; icon: typeof Ban; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 rounded-md border border-admin-border bg-white px-2 py-1 text-[11px] font-bold text-admin-text hover:border-admin-indigo hover:text-admin-indigo"
    >
      <Icon className="h-3.5 w-3.5" aria-hidden /> {label}
    </button>
  );
}
