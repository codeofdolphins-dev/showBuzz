import "server-only";
import { randomBytes } from "node:crypto";
import { env } from "@showbuzz/runtime/env";
import type { PaymentMethod } from "@showbuzz/schemas/booking";
import { RazorpayGateway } from "./razorpay";

/**
 * Payment gateway boundary. Booking code only talks to this interface (createPayment = gateway order,
 * confirmPayment = verified signature + authoritative status read, refund = refund API).
 * Payment success is decided here, on the server, never taken from the client.
 */

export type PaymentProvider = "simulated" | "razorpay";

/** What the tester picked on the demo payment page. Only the simulated gateway reads it. */
export type SimulatedOutcome = "success" | "failure";

/**
 * What Razorpay Checkout hands back in the browser after a successful payment. It is only a claim until the
 * server checks the signature against the key secret, so it is never trusted on its own.
 */
export interface PaymentHandshake {
  paymentId: string;
  signature: string;
}

export interface CreatePaymentInput {
  bookingCode: string;
  amountPaise: number;
}

export interface ConfirmPaymentInput {
  /** The order reference from createPayment (Razorpay: `order_…`). */
  providerRef: string;
  amountPaise: number;
  /** Simulated gateway only. */
  simulate?: SimulatedOutcome;
  /** Real gateways only: the signed result the browser reported. */
  handshake?: PaymentHandshake;
}

export type PaymentOutcome =
  | {
      status: "succeeded";
      /** The gateway's own payment id, stored so a later refund can target it. */
      paymentRef?: string;
      /** What the customer actually paid with, as the gateway reports it. Absent when it doesn't say. */
      method?: PaymentMethod;
    }
  | { status: "failed"; reason: string };

export interface RefundInput {
  /** The gateway's payment id (Payment.gatewayPaymentRef), not the order reference. */
  paymentRef: string;
  amountPaise: number;
}

/** What the browser needs to open the gateway's checkout. Absent for the simulated gateway. */
export interface CheckoutHandoff {
  provider: PaymentProvider;
  orderId: string;
  keyId: string;
  amountPaise: number;
}

export interface PaymentGateway {
  readonly provider: PaymentProvider;
  createPayment(input: CreatePaymentInput): Promise<{ providerRef: string }>;
  confirmPayment(input: ConfirmPaymentInput): Promise<PaymentOutcome>;
  refund(input: RefundInput): Promise<{ providerRef: string; status: "processed" | "processing" }>;
  /** The public details the payment page needs to start checkout, or undefined when it pays server-side. */
  checkoutHandoff?(orderRef: string, amountPaise: number): CheckoutHandoff;
}

const ref = (prefix: string) => `${prefix}_${randomBytes(12).toString("base64url")}`;

/** Demo gateway: no money moves. Succeeds or fails as asked; refunds are processed at once. */
class SimulatedGateway implements PaymentGateway {
  readonly provider = "simulated" as const;

  async createPayment(): Promise<{ providerRef: string }> {
    return { providerRef: ref("sim_pay") };
  }

  async confirmPayment({ simulate = "success" }: ConfirmPaymentInput): Promise<PaymentOutcome> {
    return simulate === "success"
      ? { status: "succeeded" }
      : { status: "failed", reason: "The payment was declined (simulated failure)." };
  }

  async refund(): Promise<{ providerRef: string; status: "processed" }> {
    return { providerRef: ref("sim_rfnd"), status: "processed" };
  }
}

const simulated = new SimulatedGateway();
let razorpay: RazorpayGateway | undefined;

export function getPaymentGateway(): PaymentGateway {
  if (env.PAYMENT_PROVIDER === "simulated") return simulated;
  // Built on first use: constructing it validates the credentials, which simulated deployments don't have.
  razorpay ??= new RazorpayGateway();
  return razorpay;
}

/** True while payments are simulated; the payment page then shows the "Demo payment" controls. */
export const isSimulatedPayment = env.PAYMENT_PROVIDER === "simulated";
