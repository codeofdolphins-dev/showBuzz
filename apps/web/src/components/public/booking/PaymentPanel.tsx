"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Landmark, CreditCard, FlaskConical, Gift, QrCode, ShieldCheck, Wallet } from "lucide-react";
import { confirmPaymentAction, placeOrderAction } from "@/app/(public)/_actions/booking";
import { withAuthRetry } from "@/hooks/use-session-keep-alive";
import { useOrderQuote } from "@/hooks/use-order-quote";
import { cn } from "@showbuzz/utils/cn";
import { formatINR } from "@showbuzz/utils/money";
import type { PaymentMethod } from "@showbuzz/schemas/booking";
import { useBookingCart } from "@/stores/booking-cart";
import { useAuthStore } from "@/stores/auth";
import { toast, useUiStore } from "@/stores/ui";
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
/** `simulated`: PAYMENT_PROVIDER=simulated, so the panel shows the "Demo payment" label and a failure button. */
export function PaymentPanel({ simulated }: { simulated: boolean }) {
  const router = useRouter();
  const quoteState = useOrderQuote();
  const cart = useBookingCart();
  const [method, setMethod] = useState<PaymentMethod>("upi");
  const [bank, setBank] = useState(BANKS[0]);
  const [wallet, setWallet] = useState(WALLETS[0]);
  const [isPending, startTransition] = useTransition();
  const authStatus = useAuthStore((s) => s.status);
  const openAuthModal = useUiStore((s) => s.openAuthModal);

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

  const total = formatINR(quote.amounts.payablePaise, { exact: true });
  // A gift card covering everything means nothing goes through the payment gateway.
  const coveredByGiftCard = quote.amounts.payablePaise === 0 && quote.amounts.giftCardPaise > 0;

  /** Places the order, then asks the server to confirm the payment. `simulate` only matters for demo payments. */
  const pay = (simulate: "success" | "failure") => {
    const { tickets, food, couponCode, giftCardCode, contact, hold } = cart;
    if (!tickets || !contact) return;
    if (authStatus !== "authenticated") {
      openAuthModal("/booking/payment");
      return;
    }
    startTransition(async () => {
      const placed = await withAuthRetry(() =>
        placeOrderAction({ tickets, food, couponCode, giftCardCode, contact, paymentMethod: method }),
      );
      if (!placed.success) {
        // The session couldn't be renewed: the sign-in modal is already open, the cart is kept.
        if (placed.error.code === "UNAUTHENTICATED") return;
        if (placed.error.code === "HOLD_EXPIRED" && hold) {
          toast(placed.error.message, "warning");
          router.replace(hold.seatsHref);
          return;
        }
        if (["SEAT_UNAVAILABLE", "COUPON_INVALID", "VALIDATION_FAILED"].includes(placed.error.code)) {
          toast(placed.error.message, "error");
          return;
        }
        router.push(`/booking/failure?reason=${encodeURIComponent(placed.error.code)}`);
        return;
      }

      const { code } = placed.data;
      const confirmed = await withAuthRetry(() => confirmPaymentAction({ code, simulate }));
      if (confirmed.success && confirmed.data.status === "confirmed") {
        cart.clear();
        router.replace(`/booking/success?id=${code}`);
        return;
      }
      // The cart is kept so "Retry" can pay again (seated orders re-pick seats: their holds were released).
      router.push(`/booking/failure?code=${code}`);
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

      {coveredByGiftCard ? (
        <div className="mx-auto max-w-xl rounded-3xl border border-purple-200 bg-white p-6 text-center shadow-lg sm:p-8">
          <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-50 text-purple-600">
            <Gift className="h-6 w-6" />
          </span>
          <h2 className="text-base font-black text-slate-900">Your gift card covers this order</h2>
          <p className="mt-1 text-xs text-slate-500">
            {formatINR(quote.amounts.giftCardPaise, { exact: true })} will be deducted from gift card ••••
            {quote.giftCard?.last4} when you confirm. Nothing is charged to a card or bank.
          </p>
          <button
            type="button"
            onClick={() => pay("success")}
            disabled={isPending}
            className="gradient-btn tap-active mt-5 w-full rounded-2xl py-3.5 text-xs font-black text-white shadow-xl shadow-rose-500/20 disabled:opacity-60 sm:text-sm"
          >
            Confirm with Gift Card
          </button>
        </div>
      ) : (
        <>
        {simulated && (
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800">
            <FlaskConical className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              <span className="mr-1.5 rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-black uppercase">Demo payment</span>
              No payment gateway is connected yet. <strong>Pay</strong> completes the booking without charging anything;{" "}
              <strong>Simulate failure</strong> shows what happens when a payment is declined.
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
              onClick={() => pay("success")}
              disabled={isPending}
              className="gradient-btn tap-active w-full rounded-2xl py-3.5 text-xs font-black text-white shadow-xl shadow-rose-500/20 disabled:opacity-60 sm:text-sm"
            >
              {simulated ? `Pay ${total} (Demo)` : `Pay Securely ${total}`}
            </button>
            {simulated && (
              <button
                type="button"
                onClick={() => pay("failure")}
                disabled={isPending}
                className="tap-active w-full rounded-2xl border border-slate-200 bg-white py-3 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-60"
              >
                Simulate failure
              </button>
            )}
          </div>
        </div>

        </>
      )}

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
