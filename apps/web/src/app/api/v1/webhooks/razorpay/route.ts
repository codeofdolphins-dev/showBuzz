import { z } from "zod";
import { apiHandler } from "@showbuzz/core/http/api-handler";
import { AppError } from "@showbuzz/core/http/app-error";
import { ok } from "@showbuzz/core/http/responses";
import { RazorpayGateway, toPaymentMethod } from "@showbuzz/core/payments/razorpay";
import { settlePaymentFromWebhook } from "@showbuzz/core/services/booking.service";
import { log } from "@showbuzz/runtime/log";

/**
 * Razorpay webhook. The browser handshake is the normal path; this is the backstop for when the customer
 * closes the tab after paying, so the booking still confirms instead of lapsing with the money taken.
 *
 * The signature is HMAC-SHA256 of the **raw** body, so the body is read as text and parsed only afterwards.
 * No body schema is given to `apiHandler` for the same reason (it would consume the stream first).
 *
 * Always answers 200 once the signature checks out: Razorpay retries on any other status, and a replay of an
 * already-confirmed booking is a no-op anyway (confirmPayment is idempotent).
 */

const entitySchema = z.object({
  id: z.string(),
  order_id: z.string().nullish(),
  /** "upi" | "card" | "netbanking" | "wallet" | anything else Razorpay supports; narrowed below. */
  method: z.unknown(),
  error_description: z.string().nullish(),
});

const eventSchema = z.object({
  event: z.string(),
  payload: z.object({ payment: z.object({ entity: entitySchema }) }),
});

export const POST = apiHandler({}, async ({ request }) => {
  const signature = request.headers.get("x-razorpay-signature");
  const raw = await request.text();

  if (!signature || !RazorpayGateway.verifyWebhook(raw, signature)) {
    // Never say which half failed, and never log the body: it is unauthenticated input.
    log.warn("payment.webhook_rejected", { provider: "razorpay", signed: Boolean(signature) });
    throw new AppError("UNAUTHENTICATED", "Invalid webhook signature.", 401);
  }

  const parsed = eventSchema.safeParse(JSON.parse(raw));
  if (!parsed.success) return ok({ received: true, handled: false });

  const { event, payload } = parsed.data;
  const entity = payload.payment.entity;
  if (!entity.order_id) return ok({ received: true, handled: false });

  const method = toPaymentMethod(entity.method);
  const settlement =
    event === "payment.captured"
      ? ({ kind: "captured", paymentId: entity.id, ...(method && { method }) } as const)
      : event === "payment.failed"
        ? ({ kind: "failed", reason: entity.error_description ?? "The payment was declined." } as const)
        : undefined;
  if (!settlement) return ok({ received: true, handled: false });

  const result = await settlePaymentFromWebhook(entity.order_id, settlement, new Date());
  log.info("payment.webhook", { provider: "razorpay", event, orderRef: entity.order_id, status: result?.status });
  return ok({ received: true, handled: Boolean(result) });
});
