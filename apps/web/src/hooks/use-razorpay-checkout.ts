"use client";

import { useCallback, useRef } from "react";

/**
 * Razorpay Standard Checkout. The script is fetched from Razorpay's CDN the first time the customer pays
 * (not on every page load) and the modal runs over the payment page. The browser only ever learns the public
 * key id and the order id; the result it reports back is verified server-side before anything is confirmed.
 *
 * @see https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/
 */

const CHECKOUT_SRC = "https://checkout.razorpay.com/v1/checkout.js";

export interface CheckoutHandoff {
  provider: string;
  orderId: string;
  keyId: string;
  amountPaise: number;
}

export interface CheckoutPrefill {
  name?: string | undefined;
  email?: string | undefined;
  phone?: string | undefined;
}

export type CheckoutResult =
  | { status: "paid"; paymentId: string; signature: string }
  | { status: "dismissed" }
  | { status: "failed"; reason: string };

interface RazorpayResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

interface RazorpayInstance {
  open(): void;
  on(event: "payment.failed", handler: (payload: { error?: { description?: string } }) => void): void;
}

type RazorpayConstructor = new (options: Record<string, unknown>) => RazorpayInstance;

declare global {
  interface Window {
    Razorpay?: RazorpayConstructor;
  }
}

/** Loads checkout.js once per page; concurrent calls share the same promise. */
function loadCheckoutScript(): Promise<RazorpayConstructor> {
  if (window.Razorpay) return Promise.resolve(window.Razorpay);
  const existing = document.querySelector<HTMLScriptElement>(`script[src="${CHECKOUT_SRC}"]`);
  const el = existing ?? Object.assign(document.createElement("script"), { src: CHECKOUT_SRC, async: true });
  const ready = new Promise<RazorpayConstructor>((resolve, reject) => {
    el.addEventListener("load", () => {
      if (window.Razorpay) resolve(window.Razorpay);
      else reject(new Error("Razorpay Checkout loaded without its global"));
    });
    el.addEventListener("error", () => reject(new Error("Razorpay Checkout could not be loaded")));
  });
  if (!existing) document.body.appendChild(el);
  return ready;
}

export function useRazorpayCheckout() {
  // Guards against a second modal while one is open (double click, retry mid-payment).
  const busy = useRef(false);

  return useCallback(
    async (handoff: CheckoutHandoff, prefill: CheckoutPrefill, bookingCode: string): Promise<CheckoutResult> => {
      if (busy.current) return { status: "dismissed" };
      busy.current = true;
      try {
        const Razorpay = await loadCheckoutScript();
        return await new Promise<CheckoutResult>((resolve) => {
          // Razorpay calls exactly one of these; `settle` keeps the first answer and ignores the rest.
          let done = false;
          const settle = (result: CheckoutResult) => {
            if (done) return;
            done = true;
            resolve(result);
          };
          const checkout = new Razorpay({
            key: handoff.keyId,
            order_id: handoff.orderId,
            amount: handoff.amountPaise,
            currency: "INR",
            name: "ShowBuzz",
            description: `Booking ${bookingCode}`,
            prefill: {
              ...(prefill.name ? { name: prefill.name } : {}),
              ...(prefill.email ? { email: prefill.email } : {}),
              // Razorpay expects the plain 10-digit number or +91 form; either works.
              ...(prefill.phone ? { contact: prefill.phone } : {}),
            },
            theme: { color: "#FF385C" },
            handler: (response: RazorpayResponse) =>
              settle({
                status: "paid",
                paymentId: response.razorpay_payment_id,
                signature: response.razorpay_signature,
              }),
            modal: { ondismiss: () => settle({ status: "dismissed" }) },
          });
          checkout.on("payment.failed", (payload) =>
            settle({ status: "failed", reason: payload.error?.description ?? "The payment was declined." }),
          );
          checkout.open();
        });
      } catch {
        return { status: "failed", reason: "The payment window could not be opened. Please try again." };
      } finally {
        busy.current = false;
      }
    },
    [],
  );
}
