"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Landmark, CreditCard, FlaskConical, Gift, QrCode, ShieldCheck, Wallet } from "lucide-react";
import { confirmPaymentAction, placeOrderAction } from "@/app/(public)/_actions/booking";
import { withAuthRetry } from "@/hooks/use-session-keep-alive";
import { useOrderQuote } from "@/hooks/use-order-quote";
import { useRazorpayCheckout } from "@/hooks/use-razorpay-checkout";
import { formatINR } from "@showbuzz/utils/money";
import { useBookingCart } from "@/stores/booking-cart";
import { useAuthStore } from "@/stores/auth";
import { toast, useUiStore } from "@/stores/ui";
import { QuoteFallback } from "./QuoteFallback";

/** What Razorpay's checkout offers. Listed to set expectations; the choice itself is made in its own modal. */
const ACCEPTED: { label: string; hint: string; icon: typeof QrCode }[] = [
  { label: "UPI", hint: "GPay, PhonePe, Paytm, BHIM, Cred", icon: QrCode },
  { label: "Cards", hint: "Visa, Mastercard, RuPay, Amex", icon: CreditCard },
  { label: "Net Banking", hint: "All major Indian banks", icon: Landmark },
  { label: "Wallets", hint: "Paytm, Amazon Pay, Mobikwik", icon: Wallet },
];

/**
 * Pay step. There is no method picker here: the gateway's own checkout is where the customer chooses UPI,
 * a card, net banking or a wallet, and it reports the method back, so asking twice only duplicated its
 * screen. Card, bank and wallet details are never entered in this app.
 */
/** `simulated`: PAYMENT_PROVIDER=simulated, so the panel shows the "Demo payment" label and a failure button. */
export function PaymentPanel({ simulated }: { simulated: boolean }) {
  const router = useRouter();
  const quoteState = useOrderQuote();
  const cart = useBookingCart();
  const [isPending, startTransition] = useTransition();
  const authStatus = useAuthStore((s) => s.status);
  const openAuthModal = useUiStore((s) => s.openAuthModal);
  const openCheckout = useRazorpayCheckout();

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
        placeOrderAction({ tickets, food, couponCode, giftCardCode, contact }),
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

      const { code, checkout } = placed.data;

      // A real gateway: the customer pays in its modal and we confirm with the signed result it returns.
      let handshake: { paymentId: string; signature: string } | undefined;
      if (checkout) {
        const result = await openCheckout(checkout, contact, code);
        if (result.status === "dismissed") {
          // Nothing was charged and the seats are still held, so the customer can simply try again.
          toast("Payment cancelled. Your seats are held until the timer runs out.", "info");
          return;
        }
        if (result.status === "failed") {
          toast(result.reason, "error");
          router.push(`/booking/failure?code=${code}`);
          return;
        }
        handshake = { paymentId: result.paymentId, signature: result.signature };
      }

      const confirmed = await withAuthRetry(() =>
        confirmPaymentAction({ code, ...(handshake ? { handshake } : { simulate }) }),
      );
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
              Payments are simulated here, so no gateway opens. <strong>Pay</strong> completes the booking without
              charging anything;{" "}
              <strong>Simulate failure</strong> shows what happens when a payment is declined.
            </p>
          </div>
        )}

        <div className="mx-auto max-w-xl space-y-5 rounded-3xl border border-slate-200/80 bg-white p-5 shadow-lg sm:p-8">
          {!simulated && (
            <>
              <div>
                <h2 className="text-sm font-black text-slate-900 sm:text-base">Choose how to pay on the next screen</h2>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">
                  Our payment partner&apos;s secure window opens when you continue. Pick your method there &mdash; ShowBuzz
                  never sees or stores your card, UPI id or bank login.
                </p>
              </div>

              <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {ACCEPTED.map((m) => (
                  <li key={m.label} className="flex items-start gap-3 rounded-2xl border border-slate-200/80 bg-slate-50 p-3">
                    <m.icon className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
                    <span className="min-w-0">
                      <span className="block text-xs font-bold text-slate-900">{m.label}</span>
                      <span className="block text-[11px] text-slate-500">{m.hint}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}

          <button
            type="button"
            onClick={() => pay("success")}
            disabled={isPending}
            className="gradient-btn tap-active w-full rounded-2xl py-3.5 text-xs font-black text-white shadow-xl shadow-rose-500/20 disabled:opacity-60 sm:text-sm"
          >
            {simulated ? `Pay ${total} (Demo)` : `Continue to Pay ${total}`}
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
