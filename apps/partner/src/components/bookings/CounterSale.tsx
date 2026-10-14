"use client";

import { Fragment, useMemo, useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Accessibility, Banknote, CheckCircle2, Loader2, Minus, Plus, RotateCcw, Smartphone } from "lucide-react";
import { cn } from "@showbuzz/utils/cn";
import { formatINR } from "@showbuzz/utils/money";
import { Card } from "@showbuzz/console-ui/PageParts";
import { TextField } from "@showbuzz/console-ui/fields";
import { Button, FormMessage, Input, Select } from "@showbuzz/console-ui/form";
import { useToast } from "@showbuzz/console-ui/Toaster";
import type { CounterPaymentMethod } from "@showbuzz/schemas/booking";
import { COUNTER_MAX_TICKETS } from "@showbuzz/schemas/partner-box-office";
import type {
  CounterPassListing,
  CounterSaleResult,
  CounterShowOption,
} from "@showbuzz/schemas/types/partner-box-office";
import type { ShowSeatBoard } from "@showbuzz/schemas/types/partner-venue";
import { sellAtCounterAction } from "@/app/_actions/box-office";
import { PAYMENT_METHOD_LABELS } from "@showbuzz/utils/payment";
import { ACCENT_SEAT, SEAT_CELL } from "@/components/seats/seat-styles";
import { TicketPass } from "./TicketPass";

interface CounterSaleProps {
  dateKey: string;
  seated: CounterShowOption[];
  passes: CounterShowOption[];
  /** The chosen seated show (live map), or the chosen pass listing. */
  board: ShowSeatBoard | null;
  listing: CounterPassListing | null;
  selectedId: string;
}

const PAYMENT_OPTIONS: { value: CounterPaymentMethod; icon: typeof Banknote; hint: string }[] = [
  { value: "counter_cash", icon: Banknote, hint: "Cash taken at the box office" },
  { value: "counter_upi", icon: Smartphone, hint: "UPI / QR paid at the counter" },
];

/**
 * Prototype booking-form.html "Box Office POS & Ticket Booking": 1 show → 2 seats (or passes) → 3 customer →
 * 4 payment, then the confirmed booking with its QR pass. Prices come from the server (show prices or tier price);
 * no convenience fee at the counter.
 */
export function CounterSale({ dateKey, seated, passes, board, listing, selectedId }: CounterSaleProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const toast = useToast();
  const [navigating, startNavigation] = useTransition();
  const [pending, startTransition] = useTransition();
  const [seats, setSeats] = useState<string[]>([]);
  const [tierId, setTierId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [method, setMethod] = useState<CounterPaymentMethod>("counter_cash");
  const [reference, setReference] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [sold, setSold] = useState<CounterSaleResult | null>(null);

  function navigate(changes: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    setSeats([]);
    setTierId("");
    setQuantity(1);
    setMessage(null);
    startNavigation(() => router.replace(`${pathname}?${params.toString()}`, { scroll: false }));
  }

  const seatPrice = useMemo(() => {
    const map = new Map<string, { zone: string; pricePaise: number }>();
    for (const zone of board?.zones ?? []) {
      for (const row of zone.rows)
        for (const seat of row.seats) map.set(seat.id, { zone: zone.name, pricePaise: zone.pricePaise });
    }
    return map;
  }, [board]);

  const tier = listing?.tiers.find((t) => t.id === tierId);
  const ticketsPaise = board
    ? seats.reduce((sum, id) => sum + (seatPrice.get(id)?.pricePaise ?? 0), 0)
    : tier
      ? tier.pricePaise * quantity
      : 0;
  const ticketCount = board ? seats.length : tier ? quantity : 0;

  function toggleSeat(id: string) {
    setSeats((current) => {
      if (current.includes(id)) return current.filter((s) => s !== id);
      if (current.length >= COUNTER_MAX_TICKETS) {
        toast.info(`At most ${COUNTER_MAX_TICKETS} seats per counter sale.`);
        return current;
      }
      return [...current, id];
    });
  }

  function submit() {
    setMessage(null);
    setPhoneError(null);
    const tickets = board
      ? { kind: "seats" as const, showId: board.show.id, seatIds: seats }
      : listing && tierId
        ? { kind: "passes" as const, eventId: listing.eventId, tierId, quantity }
        : null;
    if (!tickets || ticketCount === 0) {
      setMessage(board ? "Select at least one seat." : "Choose a ticket tier.");
      return;
    }
    startTransition(async () => {
      const result = await sellAtCounterAction({
        tickets,
        customer: { name, phone },
        paymentMethod: method,
        paymentReference: method === "counter_upi" ? reference : "",
      });
      if (!result.success) {
        const phoneMessage = result.error.fieldErrors?.["customer.phone"]?.[0];
        if (phoneMessage) setPhoneError(phoneMessage);
        else setMessage(result.error.message);
        if (result.error.code === "SEAT_UNAVAILABLE") router.refresh();
        return;
      }
      setSold(result.data);
      toast.success(`Booking ${result.data.code} confirmed.`);
    });
  }

  function newSale() {
    setSold(null);
    setSeats([]);
    setTierId("");
    setQuantity(1);
    setName("");
    setPhone("");
    setReference("");
    router.refresh();
  }

  if (sold) {
    return (
      <div className="mx-auto max-w-lg space-y-4">
        <Card className="space-y-2 p-5 text-center">
          <CheckCircle2 className="mx-auto h-10 w-10 text-admin-success" aria-hidden />
          <h2 className="text-lg font-black text-admin-dark">Booking confirmed!</h2>
          <p className="font-mono text-sm font-bold text-admin-indigo">{sold.code}</p>
          <p className="text-xs text-admin-muted">
            {formatINR(sold.totalPaise, { exact: true })} received by {PAYMENT_METHOD_LABELS[sold.paymentMethod]}.
          </p>
        </Card>
        <TicketPass
          code={sold.code}
          title={sold.title}
          venueLine={`${sold.venueName}${sold.screenName ? ` · ${sold.screenName}` : ""}`}
          scheduleLabel={sold.scheduleLabel}
          seats={sold.seatLabels.join(", ")}
          totalLabel={formatINR(sold.totalPaise, { exact: true })}
          customerName={sold.customerName}
          qrSvg={sold.qrSvg}
        />
        <div className="flex justify-center gap-2 print:hidden">
          <Button type="button" onClick={newSale}>
            <RotateCcw className="h-4 w-4" aria-hidden /> New sale
          </Button>
          <Link
            href={`/bookings/${sold.code}`}
            className="inline-flex items-center rounded-md border border-admin-border bg-white px-4 py-2 text-xs font-bold text-admin-text hover:bg-slate-50"
          >
            View booking
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
      <div className="space-y-6 xl:col-span-2">
        <Step number={1} title="Show or event">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-[12rem_1fr_auto] md:items-end">
            <label className="block">
              <span className="mb-1 block text-[13px] font-semibold text-admin-text">Date (IST)</span>
              <Input
                type="date"
                value={dateKey}
                onChange={(e) => navigate({ date: e.target.value, show: "", event: "" })}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[13px] font-semibold text-admin-text">Show / listing</span>
              <Select
                value={selectedId}
                onChange={(e) => {
                  const value = e.target.value;
                  const isPass = passes.some((p) => p.id === value);
                  navigate({ show: isPass ? "" : value, event: isPass ? value : "" });
                }}
                disabled={seated.length + passes.length === 0}
              >
                <option value="">
                  {seated.length + passes.length === 0 ? "Nothing on sale on this date" : "Choose a show"}
                </option>
                {seated.length > 0 ? (
                  <optgroup label="Seated shows">
                    {seated.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </optgroup>
                ) : null}
                {passes.length > 0 ? (
                  <optgroup label="Events & activities (passes)">
                    {passes.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label}
                      </option>
                    ))}
                  </optgroup>
                ) : null}
              </Select>
            </label>
            <span className="flex h-9 items-center">
              {navigating ? <Loader2 className="h-4 w-4 animate-spin text-admin-subtle" aria-label="Loading" /> : null}
            </span>
          </div>
        </Step>

        <Step number={2} title={listing ? "Passes" : "Seats"}>
          {board ? (
            <SeatGrid board={board} selected={seats} onToggle={toggleSeat} />
          ) : listing ? (
            <div className="space-y-3">
              <p className="text-[11px] text-admin-muted">
                {listing.venueName} · {listing.scheduleLabel}
              </p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {listing.tiers.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    disabled={t.remaining === 0}
                    onClick={() => {
                      setTierId(t.id);
                      setQuantity((q) => Math.min(Math.max(1, q), Math.max(1, t.remaining)));
                    }}
                    aria-pressed={tierId === t.id}
                    className={cn(
                      "rounded-lg border p-3 text-left text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                      tierId === t.id
                        ? "border-admin-indigo bg-admin-active"
                        : "border-admin-border hover:border-admin-indigo",
                    )}
                  >
                    <span className="block font-bold text-admin-dark">{t.name}</span>
                    <span className="block text-admin-muted">
                      {formatINR(t.pricePaise)} · {t.remaining === 0 ? "Sold out" : `${t.remaining} left`}
                    </span>
                  </button>
                ))}
              </div>
              {tier ? (
                <div className="flex items-center gap-3">
                  <span className="text-[13px] font-semibold text-admin-text">Quantity</span>
                  <Button
                    type="button"
                    variant="secondary"
                    aria-label="One fewer"
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  >
                    <Minus className="h-4 w-4" aria-hidden />
                  </Button>
                  <span className="w-8 text-center font-mono text-sm font-bold">{quantity}</span>
                  <Button
                    type="button"
                    variant="secondary"
                    aria-label="One more"
                    onClick={() => setQuantity((q) => Math.min(q + 1, tier.remaining, COUNTER_MAX_TICKETS))}
                  >
                    <Plus className="h-4 w-4" aria-hidden />
                  </Button>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="text-xs text-admin-muted">Choose a show first.</p>
          )}
        </Step>

        <Step number={3} title="Customer (optional)">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField
              label="Customer name"
              value={name}
              maxLength={80}
              onChange={(e) => setName(e.target.value)}
              placeholder="Walk-in"
            />
            <TextField
              label="Mobile number"
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="98301 44552"
              error={phoneError ?? undefined}
            />
          </div>
        </Step>
      </div>

      <div>
        <Card className="space-y-4 p-5 xl:sticky xl:top-20">
          <h2 className="flex items-center gap-2 text-sm font-bold text-admin-dark">
            <StepNumber n={4} /> Payment & billing
          </h2>
          <fieldset className="space-y-2">
            <legend className="sr-only">Payment mode</legend>
            {PAYMENT_OPTIONS.map(({ value, icon: Icon, hint }) => (
              <label
                key={value}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-xs",
                  method === value ? "border-admin-indigo bg-admin-active" : "border-admin-border",
                )}
              >
                <input
                  type="radio"
                  name="method"
                  value={value}
                  checked={method === value}
                  onChange={() => setMethod(value)}
                  className="sr-only"
                />
                <Icon className="h-4 w-4 text-admin-indigo" aria-hidden />
                <span>
                  <span className="block font-bold text-admin-dark">{PAYMENT_METHOD_LABELS[value]}</span>
                  <span className="block text-admin-muted">{hint}</span>
                </span>
              </label>
            ))}
          </fieldset>
          {method === "counter_upi" ? (
            <TextField
              label="UPI reference (optional)"
              value={reference}
              maxLength={60}
              onChange={(e) => setReference(e.target.value)}
              placeholder="UTR / transaction ID"
            />
          ) : null}
          <dl className="space-y-1.5 border-t border-admin-border pt-3 text-xs">
            <div className="flex justify-between">
              <dt>
                Tickets ({ticketCount}){board && seats.length > 0 ? `: ${seats.join(", ")}` : ""}
              </dt>
              <dd className="font-mono">{formatINR(ticketsPaise, { exact: true })}</dd>
            </div>
            <div className="flex justify-between text-admin-muted">
              <dt>Convenience fee</dt>
              <dd>Waived at the counter</dd>
            </div>
            <div className="flex justify-between border-t border-admin-border pt-2 text-sm font-black text-admin-dark">
              <dt>Total payable</dt>
              <dd className="font-mono">{formatINR(ticketsPaise, { exact: true })}</dd>
            </div>
          </dl>
          {message ? <FormMessage tone="error">{message}</FormMessage> : null}
          <Button type="button" className="w-full" onClick={submit} disabled={pending || ticketCount === 0}>
            {pending ? "Confirming…" : "Confirm & issue ticket"}
          </Button>
          <p className="text-[11px] text-admin-muted">
            Take the money before confirming. The ticket gets the same QR as online tickets.
          </p>
        </Card>
      </div>
    </div>
  );
}

function StepNumber({ n }: { n: number }) {
  return (
    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-admin-indigo text-[11px] font-black text-white">
      {n}
    </span>
  );
}

function Step({ number, title, children }: { number: number; title: string; children: ReactNode }) {
  return (
    <Card className="space-y-4 p-5">
      <h2 className="flex items-center gap-2 border-b border-admin-border pb-3 text-sm font-bold text-admin-dark">
        <StepNumber n={number} /> {title}
      </h2>
      {children}
    </Card>
  );
}

/** The show's live seats: free seats can be picked; sold, held and blocked seats can't. */
function SeatGrid({
  board,
  selected,
  onToggle,
}: {
  board: ShowSeatBoard;
  selected: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3 text-[11px] font-semibold text-admin-muted">
        {board.zones.map((z) => (
          <span key={z.id} className="flex items-center gap-1.5">
            <span className={cn("h-3.5 w-3.5 rounded border", ACCENT_SEAT[z.accent])} aria-hidden />
            {z.name} ({formatINR(z.pricePaise)})
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span className="h-3.5 w-3.5 rounded border border-admin-indigo bg-admin-indigo" aria-hidden /> Selected
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3.5 w-3.5 rounded border border-dashed border-slate-300 bg-slate-100" aria-hidden /> Booked
          / held / blocked
        </span>
      </div>
      <div className="overflow-x-auto pb-2">
        <div className="mx-auto w-max min-w-full space-y-1.5">
          <div className="mx-auto mb-4 w-2/3 rounded-b-3xl border-t-4 border-admin-indigo/60 pt-1 text-center text-[10px] font-bold tracking-[0.3em] text-admin-subtle uppercase">
            {board.layoutType === "stadium" ? "Pitch / stage" : "Screen this way"}
          </div>
          {board.zones.map((zone) => (
            <Fragment key={zone.id}>
              <p className="pt-2 text-[11px] font-bold tracking-wider text-admin-muted uppercase">
                {zone.name} · {formatINR(zone.pricePaise)}
              </p>
              {zone.rows.map((row) => (
                <div key={row.row} className="flex items-center justify-center gap-2">
                  <span className="w-5 text-center font-mono text-xs font-bold text-admin-muted">{row.row}</span>
                  <div className="flex items-center gap-1">
                    {row.seats.map((seat) => {
                      const free = seat.state === "free";
                      const isSelected = selected.includes(seat.id);
                      return (
                        <Fragment key={seat.id}>
                          <button
                            type="button"
                            disabled={!free}
                            onClick={() => onToggle(seat.id)}
                            aria-pressed={isSelected}
                            aria-label={`Seat ${seat.id}${free ? "" : ", not available"}`}
                            className={cn(
                              SEAT_CELL,
                              free
                                ? isSelected
                                  ? "scale-105 border-admin-indigo bg-admin-indigo text-white"
                                  : cn(ACCENT_SEAT[zone.accent], "cursor-pointer hover:scale-110")
                                : "cursor-not-allowed border-dashed border-slate-300 bg-slate-100 text-slate-400",
                            )}
                          >
                            {seat.accessible && free && !isSelected ? (
                              <Accessibility className="h-3 w-3" aria-hidden />
                            ) : (
                              seat.number
                            )}
                          </button>
                          {row.aislesAfter.includes(seat.number) ? <span className="w-4 shrink-0" aria-hidden /> : null}
                        </Fragment>
                      );
                    })}
                  </div>
                  <span className="w-5 text-center font-mono text-xs font-bold text-admin-muted">{row.row}</span>
                </div>
              ))}
            </Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}
