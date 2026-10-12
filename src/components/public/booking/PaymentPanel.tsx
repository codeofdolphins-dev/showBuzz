"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Landmark, CreditCard, FlaskConical, QrCode, ShieldCheck, Wallet } from "lucide-react";
import { placeOrderAction } from "@/app/(public)/_actions/booking";
import { useOrderQuote } from "@/hooks/use-order-quote";
import { cn } from "@/lib/cn";
import { formatINR } from "@/lib/money";
import type { PaymentMethod } from "@/schemas/booking";
import { useBookingCart } from "@/stores/booking-cart";
import { toast } from "@/stores/ui";
import { QuoteFallback } from "./QuoteFallback";

const METHODS: { value: PaymentMethod; label: string; icon: typeof QrCode }[] = [
  { value: "upi", label: "UPI (GPay / PhonePe)", icon: QrCode },
  { value: "card", label: "Credit / Debit Cards", icon: CreditCard },
  { value: "netbanking", label: "Net Banking", icon: Landmark },
  { value: "wallet", label: "Mobile Wallets", icon: Wallet },
];

const BANKS = ["HDFC Bank", "ICICI Bank", "State Bank of India", "Axis Bank", "Kotak Bank", "Other Banks"];
const WALLETS = ["Paytm Wallet", "Amazon Pay Balance", "Mobikwik"];

/**
 * Method picker. Card, bank and wallet details are entered on the payment gateway's own
 * page (Razorpay/Cashfree, still to be chosen), never in this app.
 */
export function PaymentPanel({ demoMode }: { demoMode: boolean }) {
  const router = useRouter();
  const quoteState = useOrderQuote();
  const cart = useBookingCart();
  const [method, setMethod] = useState<PaymentMethod>("upi");
  const [bank, setBank] = useState(BANKS[0]);
  const [wallet, setWallet] = useState(WALLETS[0]);
  const [isPending, startTransition] = useTransition();

  if (quoteState.status !== "ready") return <QuoteFallback state={quoteState} />;
  const { quote } = quoteState;

  if (!cart.contact || !cart.tickets) {
    return (
      <div className="rounded-3xl border border-slate-200/80 bg-white p-8 text-center shadow-xs">
        <h3 className="text-base font-bold text-slate-900">Add your contact details first</h3>
        <Link href="/booking/checkout" className="gradient-btn mt-4 inline-block rounded-xl px-5 py-2.5 text-xs font-bold text-white">
          Back to Checkout
        </Link>
      </div>
    );
  }

  const total = formatINR(quote.amounts.totalPaise, { exact: true });

  const pay = () => {
    const { tickets, food, couponCode, contact } = cart;
    if (!tickets || !contact) return;
    startTransition(async () => {
      const result = await placeOrderAction({ tickets, food, couponCode, contact, paymentMethod: method });
      if (!result.success) {
        if (result.error.code === "SEAT_UNAVAILABLE" || result.error.code === "COUPON_INVALID") {
          toast(result.error.message, "error");
          return;
        }
        router.push(`/booking/failure?reason=${encodeURIComponent(result.error.code)}`);
        return;
      }
      cart.clear();
      router.replace(`/booking/success?id=${result.data.code}`);
    });
  };

  return (
    <>
      <div className="mb-6 flex items-center justify-between gap-4 rounded-3xl border border-slate-200/80 bg-white p-4 shadow-xs sm:p-6">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-sm font-extrabold text-slate-900 sm:text-base">Secure Checkout</h1>
            <p className="text-[11px] text-slate-500">Card and bank details are entered on our payment partner&apos;s page</p>
          </div>
        </div>
        <div className="text-right">
          <span className="block text-[10px] font-bold text-slate-400 uppercase">Payable Total</span>
          <span className="text-base font-black text-rose-600 sm:text-2xl">{total}</span>
        </div>
      </div>

      {demoMode && (
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800">
          <FlaskConical className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            <strong>Test mode.</strong> No payment gateway is connected yet, so paying here simulates a successful payment
            and no money is charged. This is disabled in production.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-lg md:grid-cols-3">
        <div role="tablist" aria-label="Payment method" className="no-scrollbar flex gap-1 overflow-x-auto border-r border-slate-200/80 bg-slate-50 p-2 sm:p-4 md:flex-col">
          {METHODS.map((m) => (
            <button
              key={m.value}
              type="button"
              role="tab"
              aria-selected={method === m.value}
              onClick={() => setMethod(m.value)}
              className={cn(
                "tap-active flex w-full shrink-0 items-center gap-3 rounded-2xl p-3 text-left text-xs font-bold transition-all md:shrink",
                method === m.value ? "border border-rose-200 bg-white text-rose-600 shadow-sm" : "text-slate-700 hover:bg-white",
              )}
            >
              <m.icon className="h-4 w-5 shrink-0" />
              <span className="truncate">{m.label}</span>
            </button>
          ))}
        </div>

        <div className="space-y-5 p-5 sm:p-8 md:col-span-2">
          {method === "upi" && (
            <div className="flex flex-col items-center gap-6 rounded-2xl border border-slate-200/80 bg-slate-50 p-4 sm:flex-row sm:p-6">
              <span className="flex h-28 w-28 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-300">
                <QrCode className="h-16 w-16" />
              </span>
              <div>
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-extrabold text-emerald-700 uppercase">Instant</span>
                <h4 className="mt-1 text-sm font-bold text-slate-900">Pay with any UPI app</h4>
                <p className="mt-0.5 text-xs text-slate-500">
                  Google Pay, PhonePe, Paytm, BHIM or Cred. A UPI QR and collect request open on the next screen.
                </p>
              </div>
            </div>
          )}

          {method === "card" && (
            <p className="rounded-2xl border border-slate-200/80 bg-slate-50 p-4 text-xs leading-relaxed text-slate-600">
              Visa, Mastercard, RuPay and Amex are accepted. You&apos;ll enter your card details on the secure gateway page;
              ShowBuzz never sees or stores your card number.
            </p>
          )}

          {method === "netbanking" && (
            <fieldset>
              <legend className="mb-2 text-xs font-bold text-slate-700">Select Your Bank</legend>
              <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
                {BANKS.map((b) => (
                  <label
                    key={b}
                    className="tap-active flex cursor-pointer items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-3 font-semibold hover:bg-slate-100"
                  >
                    <input type="radio" name="bank" checked={bank === b} onChange={() => setBank(b)} className="accent-rose-600" /> {b}
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          {method === "wallet" && (
            <fieldset className="space-y-2 text-xs">
              <legend className="mb-2 text-xs font-bold text-slate-700">Choose Wallet</legend>
              {WALLETS.map((w) => (
                <label
                  key={w}
                  className="tap-active flex cursor-pointer items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 p-3.5 font-bold hover:bg-slate-100"
                >
                  <span className="flex items-center gap-2.5">
                    <Wallet className="h-4 w-4 text-rose-500" /> {w}
                  </span>
                  <input type="radio" name="wallet" checked={wallet === w} onChange={() => setWallet(w)} className="accent-rose-600" />
                </label>
              ))}
            </fieldset>
          )}

          <button
            type="button"
            onClick={pay}
            disabled={isPending}
            className="gradient-btn tap-active w-full rounded-2xl py-3.5 text-xs font-black text-white shadow-xl shadow-rose-500/20 disabled:opacity-60 sm:text-sm"
          >
            Pay Securely {total}
          </button>
        </div>
      </div>

      {isPending && (
        <div className="animate-fade-in fixed inset-0 z-[1500] flex items-center justify-center bg-slate-900/80 p-4 backdrop-blur-md">
          <div className="w-full max-w-sm space-y-4 rounded-3xl bg-white p-8 text-center shadow-2xl" role="status">
            <div className="mx-auto h-16 w-16 animate-spin rounded-full border-4 border-rose-500 border-t-transparent" />
            <h3 className="text-lg font-black text-slate-900">Processing Payment...</h3>
            <p className="text-xs leading-relaxed text-slate-500">
              Securing your seats and generating your M-ticket. Please do not refresh.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
