import "server-only";
import { randomBytes } from "node:crypto";
import { env } from "@showbuzz/runtime/env";
import type { PaymentMethod } from "@showbuzz/schemas/booking";

/**
 * Payment gateway boundary. Booking code only talks to this interface; Razorpay/Cashfree will be another
 * implementation (createPayment = gateway order, confirmPayment = verified signature/webhook, refund = refund API).
 * Payment success is decided here, on the server, never taken from the client.
 */

export type PaymentProvider = "simulated";

/** What the tester picked on the demo payment page. Only the simulated gateway reads it. */
export type SimulatedOutcome = "success" | "failure";

export interface CreatePaymentInput {
  bookingCode: string;
  amountPaise: number;
  method: PaymentMethod;
}

export interface ConfirmPaymentInput {
  providerRef: string;
  amountPaise: number;
  simulate?: SimulatedOutcome;
}

export type PaymentOutcome = { status: "succeeded" } | { status: "failed"; reason: string };

export interface RefundInput {
  paymentRef: string;
  amountPaise: number;
}

export interface PaymentGateway {
  readonly provider: PaymentProvider;
  createPayment(input: CreatePaymentInput): Promise<{ providerRef: string }>;
  confirmPayment(input: ConfirmPaymentInput): Promise<PaymentOutcome>;
  refund(input: RefundInput): Promise<{ providerRef: string; status: "processed" | "processing" }>;
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

const gateways: Record<PaymentProvider, PaymentGateway> = { simulated: new SimulatedGateway() };

export function getPaymentGateway(): PaymentGateway {
  return gateways[env.PAYMENT_PROVIDER];
}

/** True while payments are simulated; the payment page then shows the "Demo payment" controls. */
export const isSimulatedPayment = env.PAYMENT_PROVIDER === "simulated";
