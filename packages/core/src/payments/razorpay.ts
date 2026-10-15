import "server-only";
import Razorpay from "razorpay";
import { log } from "@showbuzz/runtime/log";
import { paymentEnv } from "@showbuzz/runtime/payment-env";
import type {
  CheckoutHandoff,
  ConfirmPaymentInput,
  CreatePaymentInput,
  PaymentGateway,
  PaymentOutcome,
  RefundInput,
} from "./gateway";

/**
 * Razorpay Standard Checkout.
 *
 * createPayment creates an order; the browser opens Razorpay's modal against it and reports back a signed
 * result; confirmPayment verifies that signature and then re-reads the payment from Razorpay, so the amount
 * and status come from the gateway rather than from the client. Refunds target the payment id captured at
 * confirmation, not the order id.
 *
 * Amounts need no conversion: Razorpay counts in paise, like the rest of ShowBuzz.
 */

/** A declined payment never tells the customer why in detail; the reason is logged instead. */
const DECLINED = "The payment was declined. No money has been taken. Please try again.";
const UNVERIFIED = "We couldn't verify this payment with the gateway. If money was taken it will be refunded.";

export class RazorpayGateway implements PaymentGateway {
  readonly provider = "razorpay" as const;
  private readonly client: Razorpay;
  private readonly keyId: string;
  private readonly keySecret: string;

  constructor() {
    const { PAYMENT_KEY_ID, PAYMENT_KEY_SECRET } = paymentEnv();
    this.keyId = PAYMENT_KEY_ID;
    this.keySecret = PAYMENT_KEY_SECRET;
    this.client = new Razorpay({ key_id: PAYMENT_KEY_ID, key_secret: PAYMENT_KEY_SECRET });
  }

  async createPayment({ bookingCode, amountPaise }: CreatePaymentInput): Promise<{ providerRef: string }> {
    // `receipt` is what shows up in the Razorpay dashboard beside the payment.
    const order = await this.client.orders.create({
      amount: amountPaise,
      currency: "INR",
      receipt: bookingCode,
      notes: { bookingCode },
    });
    return { providerRef: order.id };
  }

  checkoutHandoff(orderRef: string, amountPaise: number): CheckoutHandoff {
    return { provider: this.provider, orderId: orderRef, keyId: this.keyId, amountPaise };
  }

  async confirmPayment({ providerRef, amountPaise, handshake }: ConfirmPaymentInput): Promise<PaymentOutcome> {
    if (!handshake) return { status: "failed", reason: DECLINED };

    // The browser's claim is worth nothing until the signature over "<order id>|<payment id>" checks out.
    const signed = `${providerRef}|${handshake.paymentId}`;
    if (!Razorpay.validateWebhookSignature(signed, handshake.signature, this.keySecret)) {
      log.warn("payment.signature_mismatch", { provider: this.provider, orderRef: providerRef });
      return { status: "failed", reason: UNVERIFIED };
    }

    let payment;
    try {
      payment = await this.client.payments.fetch(handshake.paymentId);
    } catch (err) {
      log.error("payment.fetch_failed", { provider: this.provider, orderRef: providerRef, err });
      return { status: "failed", reason: UNVERIFIED };
    }

    // A valid signature for someone else's order, or for a different amount, must never confirm this booking.
    if (payment.order_id !== providerRef || Number(payment.amount) !== amountPaise) {
      log.warn("payment.mismatch", {
        provider: this.provider,
        orderRef: providerRef,
        expectedPaise: amountPaise,
        gotPaise: Number(payment.amount),
      });
      return { status: "failed", reason: UNVERIFIED };
    }

    if (payment.status === "captured") return { status: "succeeded", paymentRef: payment.id };

    // Authorised but not captured (manual-capture accounts): take the money now, or the hold lapses.
    if (payment.status === "authorized") {
      try {
        await this.client.payments.capture(payment.id, amountPaise, "INR");
        return { status: "succeeded", paymentRef: payment.id };
      } catch (err) {
        log.error("payment.capture_failed", { provider: this.provider, paymentId: payment.id, err });
        return { status: "failed", reason: UNVERIFIED };
      }
    }

    log.warn("payment.not_captured", { provider: this.provider, paymentId: payment.id, status: payment.status });
    return { status: "failed", reason: DECLINED };
  }

  async refund({
    paymentRef,
    amountPaise,
  }: RefundInput): Promise<{ providerRef: string; status: "processed" | "processing" }> {
    const refund = await this.client.payments.refund(paymentRef, { amount: amountPaise, speed: "normal" });
    // Razorpay settles most refunds asynchronously; "processed" only when it already went through.
    return { providerRef: refund.id, status: refund.status === "processed" ? "processed" : "processing" };
  }

  /** Verifies a webhook body against the webhook secret. False when no secret is configured. */
  static verifyWebhook(rawBody: string, signature: string): boolean {
    const secret = paymentEnv().PAYMENT_WEBHOOK_SECRET;
    if (!secret) return false;
    try {
      return Razorpay.validateWebhookSignature(rawBody, signature, secret);
    } catch {
      return false;
    }
  }
}
