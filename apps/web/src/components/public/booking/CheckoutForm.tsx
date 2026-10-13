"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarCheck, Lock, MapPin, Percent, Ticket, UserCheck, UtensilsCrossed, CircleCheck, Tags } from "lucide-react";
import { Field, inputClass } from "@/components/public/form/Field";
import { useOrderQuote } from "@/hooks/use-order-quote";
import { formatINR } from "@showbuzz/utils/money";
import { contactDetailsSchema, type ContactDetailsInput } from "@showbuzz/schemas/booking";
import { couponCodeSchema } from "@showbuzz/schemas/offer";
import { useAuthStore } from "@/stores/auth";
import { useBookingCart } from "@/stores/booking-cart";
import { toast, useUiStore } from "@/stores/ui";
import { GiftCardApply } from "./GiftCardApply";
import { PriceBreakdown } from "./PriceBreakdown";
import { QuoteFallback } from "./QuoteFallback";

const QUICK_COUPONS = [
  { code: "SHOW50", label: "SHOW50 (50% Off)", className: "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100" },
  { code: "UPIFIRST", label: "UPIFIRST (₹75 Off)", className: "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100" },
];

export function CheckoutForm() {
  const router = useRouter();
  const quoteState = useOrderQuote();
  const user = useAuthStore((s) => s.user);
  const authStatus = useAuthStore((s) => s.status);
  const openAuthModal = useUiStore((s) => s.openAuthModal);
  const savedContact = useBookingCart((s) => s.contact);
  const couponCode = useBookingCart((s) => s.couponCode);
  const setCoupon = useBookingCart((s) => s.setCoupon);
  const setContact = useBookingCart((s) => s.setContact);
  const [couponInput, setCouponInput] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(true);

  const form = useForm<ContactDetailsInput>({
    resolver: zodResolver(contactDetailsSchema),
    defaultValues: { name: "", phone: "", email: "" },
  });

  // Prefill once persisted state has loaded, without overwriting what the user typed.
  useEffect(() => {
    if (form.formState.isDirty) return;
    const source = savedContact ?? (user ? { name: user.name, phone: user.phone ?? "", email: user.email ?? "" } : undefined);
    if (source) form.reset(source);
  }, [savedContact, user, form]);

  // Surface server-side coupon rejections once, then drop the code from the cart.
  const couponError = quoteState.status === "ready" ? quoteState.quote.couponError : undefined;
  useEffect(() => {
    if (!couponError) return;
    toast(couponError, "error");
    setCoupon(undefined);
  }, [couponError, setCoupon]);

  if (quoteState.status !== "ready") return <QuoteFallback state={quoteState} />;
  const { quote } = quoteState;

  const applyCoupon = (raw: string) => {
    const parsed = couponCodeSchema.safeParse(raw);
    if (!parsed.success) {
      toast(parsed.error.issues[0]?.message ?? "Enter a valid coupon code", "error");
      return;
    }
    setCouponInput(parsed.data);
    setCoupon(parsed.data);
  };

  const proceed = form.handleSubmit((contact) => {
    if (!termsAccepted) {
      toast("Please accept the terms to proceed.", "warning");
      return;
    }
    setContact(contact);
    // Sign-in is required before payment; the modal brings the customer back to this step.
    if (authStatus !== "authenticated") {
      openAuthModal("/booking/checkout");
      return;
    }
    router.push("/booking/payment");
  });

  const backToFood = quote.foodAllowed ? "/booking/food" : undefined;

  return (
    <form onSubmit={proceed} noValidate className="grid grid-cols-1 gap-6 sm:gap-8 lg:grid-cols-3 xl:grid-cols-4">
      <div className="space-y-4 sm:space-y-6 lg:col-span-2 xl:col-span-3">
        <section className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs sm:p-8">
          <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3 sm:mb-6">
            <h2 className="flex items-center gap-2 text-base font-black text-slate-900 sm:text-lg">
              <Ticket className="h-4 w-4 text-rose-500" /> Booking Review
            </h2>
            <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-600 sm:text-xs">Reserved</span>
          </div>
          <div className="flex items-start gap-4 sm:gap-6">
            <Image
              src={quote.poster}
              alt=""
              width={112}
              height={168}
              className="aspect-[2/3] w-18 shrink-0 rounded-2xl object-cover shadow-md sm:w-28"
            />
            <div className="flex-1 space-y-1 sm:space-y-2">
              <div className="flex flex-wrap items-center gap-1.5">
                {quote.certificate && (
                  <span className="rounded bg-slate-100 px-1.5 text-[9px] font-extrabold text-slate-700">{quote.certificate}</span>
                )}
                {quote.format && (
                  <span className="rounded bg-rose-50 px-1.5 text-[9px] font-extrabold text-rose-600 uppercase">{quote.format}</span>
                )}
                {quote.language && <span className="text-[11px] font-semibold text-slate-500">{quote.language}</span>}
              </div>
              <h3 className="text-base leading-tight font-black text-slate-900 sm:text-xl">{quote.title}</h3>
              <p className="flex items-center gap-1 pt-0.5 text-[11px] font-semibold text-slate-600 sm:text-xs">
                <MapPin className="h-3 w-3 text-slate-400" /> {quote.venueName}
              </p>
              <p className="flex items-center gap-1 text-[11px] font-semibold text-slate-600 sm:text-xs">
                <CalendarCheck className="h-3 w-3 text-slate-400" /> {quote.scheduleLabel}
                {quote.screenName && <> &bull; {quote.screenName}</>}
              </p>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="text-xs font-bold text-slate-500">{quote.kind === "gift-card" ? "Item:" : "Seats:"}</span>
                {quote.seatLabels.map((s) => (
                  <span key={s} className="rounded-md bg-slate-100 px-2 text-xs font-bold text-slate-800">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        {quote.food.length > 0 && (
          <section className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs sm:p-6">
            <div className="mb-3 flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="flex items-center gap-2 text-xs font-extrabold text-slate-900 sm:text-sm">
                <UtensilsCrossed className="h-4 w-4 text-amber-500" /> Pre-Ordered Refreshments
              </h3>
              {backToFood && (
                <Link href={backToFood} className="tap-active text-xs font-bold text-rose-600 hover:underline">
                  Edit
                </Link>
              )}
            </div>
            <div className="space-y-1.5">
              {quote.food.map((f) => (
                <div key={f.foodItemId} className="flex items-center justify-between border-b border-slate-50 py-1 text-xs">
                  <span className="font-medium text-slate-700">
                    {f.name} &times; {f.quantity}
                  </span>
                  <span className="font-bold text-slate-900">{formatINR(f.totalPaise)}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {quote.kind !== "gift-card" && (
          <section className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs sm:p-6">
            <h3 className="mb-2.5 flex items-center gap-2 text-xs font-extrabold text-slate-900 sm:text-sm">
              <Tags className="h-4 w-4 text-rose-500" /> Apply Promo Code
            </h3>
            {quote.coupon ? (
              <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 p-2.5">
                <span className="flex items-center gap-2 text-xs font-bold text-emerald-800">
                  <CircleCheck className="h-4 w-4 text-emerald-600" />
                  Coupon <strong>{quote.coupon.code}</strong> applied! Saved {formatINR(quote.amounts.discountPaise)}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setCoupon(undefined);
                    setCouponInput("");
                    toast("Coupon removed.", "info");
                  }}
                  className="tap-active text-xs font-bold text-rose-600 hover:underline"
                >
                  Remove
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    value={couponInput}
                    onChange={(e) => setCouponInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        applyCoupon(couponInput);
                      }
                    }}
                    placeholder="Coupon Code (e.g. SHOW50)"
                    aria-label="Coupon code"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pr-3 pl-9 text-xs font-bold tracking-wider text-slate-800 uppercase focus:border-rose-500 focus:bg-white focus:outline-none"
                  />
                  <Percent className="absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                </div>
                <button
                  type="button"
                  onClick={() => applyCoupon(couponInput)}
                  disabled={!!couponCode}
                  className="gradient-btn tap-active rounded-xl px-5 py-2.5 text-xs font-black text-white shadow-md disabled:opacity-60"
                >
                  Apply
                </button>
              </div>
            )}
            <div className="mt-3 border-t border-slate-100 pt-3">
              <p className="mb-1.5 text-[10px] font-bold tracking-wider text-slate-400 uppercase">Quick Promo Codes</p>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_COUPONS.map((c) => (
                  <button
                    key={c.code}
                    type="button"
                    onClick={() => applyCoupon(c.code)}
                    className={`tap-active rounded-lg border px-2.5 py-1 text-[11px] font-extrabold ${c.className}`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
          </section>
        )}

        {quote.kind !== "gift-card" && <GiftCardApply quote={quote} />}

        <section className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs sm:p-6">
          <h3 className="mb-1 flex items-center gap-2 text-xs font-extrabold text-slate-900 sm:text-sm">
            <UserCheck className="h-4 w-4 text-blue-500" /> Contact for Digital M-Ticket
          </h3>
          <p className="mb-3 text-[11px] text-slate-500">The QR entry pass will be delivered to these details.</p>
          <div className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
            <Field id="cust-name" label="Full Name" error={form.formState.errors.name?.message}>
              <input id="cust-name" autoComplete="name" {...form.register("name")} aria-invalid={!!form.formState.errors.name} className={inputClass} />
            </Field>
            <Field id="cust-phone" label="Mobile Number" error={form.formState.errors.phone?.message}>
              <input
                id="cust-phone"
                type="tel"
                autoComplete="tel"
                readOnly={!!user?.phone}
                title={user?.phone ? "Your account's verified number" : undefined}
                {...form.register("phone")}
                aria-invalid={!!form.formState.errors.phone}
                className={inputClass}
              />
            </Field>
            <Field id="cust-email" label="Email Address" error={form.formState.errors.email?.message} className="sm:col-span-2">
              <input
                id="cust-email"
                type="email"
                autoComplete="email"
                readOnly={!!user?.email}
                title={user?.email ? "Your account's verified email" : undefined}
                {...form.register("email")}
                aria-invalid={!!form.formState.errors.email}
                className={inputClass}
              />
            </Field>
          </div>
        </section>
      </div>

      <aside className="lg:col-span-1">
        <div className="sticky top-24 rounded-3xl border border-slate-200/80 bg-white p-5 shadow-lg sm:p-7">
          <h3 className="border-b border-slate-100 pb-3 text-sm font-extrabold text-slate-900 sm:text-base">Payment Summary</h3>
          <div className="border-b border-slate-100 py-3">
            <PriceBreakdown quote={quote} />
          </div>
          <div className="flex items-baseline justify-between py-3">
            <span className="text-sm font-black text-slate-900 sm:text-base">
              {quote.amounts.giftCardPaise > 0 ? "Amount Payable" : "Total Amount"}
            </span>
            <span className="text-xl font-black text-rose-600 sm:text-2xl">{formatINR(quote.amounts.payablePaise, { exact: true })}</span>
          </div>
          <label className="mb-4 flex items-start gap-2">
            <input
              type="checkbox"
              checked={termsAccepted}
              onChange={(e) => setTermsAccepted(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded accent-rose-600"
            />
            <span className="text-[10px] leading-tight text-slate-500">
              I accept the admission and cancellation{" "}
              <Link href="/terms" className="text-slate-700 underline">
                terms
              </Link>
              .
            </span>
          </label>
          <button
            type="submit"
            className="gradient-btn tap-active flex w-full items-center justify-center gap-1.5 rounded-2xl py-3.5 text-xs font-black text-white shadow-xl shadow-rose-500/20 sm:text-sm"
          >
            Proceed to Payment <Lock className="h-3.5 w-3.5" />
          </button>
        </div>
      </aside>
    </form>
  );
}
