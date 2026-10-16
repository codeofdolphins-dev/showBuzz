import "server-only";
import { appdootEnv } from "@showbuzz/runtime/appdoot-env";
import { log } from "@showbuzz/runtime/log";
import { AppError } from "../http/app-error";
import type { OtpMessage, OtpSendResult, OtpSender } from "./otp-delivery";

/**
 * Appdoot transactional SMS (https://appdoot.com/v1/send-transactional).
 *
 * One DLT-registered template carries the code as its only variable, so every purpose (sign-in, contact
 * change, deletion, re-authentication) uses the same message. The challenge id is the idempotency key: a
 * retried request for the same challenge can never send a second SMS, while a new code always does.
 *
 * The code is never logged and never returned to the caller: with a real provider the customer reads it
 * from the SMS.
 */

const SEND_TIMEOUT_MS = 8_000;

/** Shown to the customer when the provider is unreachable or rejects the send. */
const SEND_FAILED = "We couldn't send the code right now. Please try again in a moment.";

export class AppdootOtpSender implements OtpSender {
  async send({ challengeId, to, code }: OtpMessage): Promise<OtpSendResult> {
    const { APPDOOT_APP_ID, APPDOOT_SECRET_KEY, APPDOOT_OTP_TEMPLATE_ID, APPDOOT_BASE_URL } = appdootEnv();

    let response: Response;
    try {
      response = await fetch(`${APPDOOT_BASE_URL}/send-transactional`, {
        method: "POST",
        headers: {
          "X-App-Id": APPDOOT_APP_ID,
          "X-Secret-Key": APPDOOT_SECRET_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          recipient_phone: to,
          template_id: APPDOOT_OTP_TEMPLATE_ID,
          variables: { 1: code },
          idempotency_key: `otp-${challengeId}`,
        }),
        signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
        cache: "no-store",
      });
    } catch (err) {
      // Network error or timeout: the message may or may not have gone out, so the challenge is discarded.
      log.error("otp.appdoot_unreachable", { challengeId, err });
      throw new AppError("OTP_SEND_FAILED", SEND_FAILED, 502);
    }

    if (!response.ok) {
      // Appdoot's own message can name the template or the number; it is logged, never shown.
      log.error("otp.appdoot_rejected", {
        challengeId,
        status: response.status,
        detail: (await response.text().catch(() => ""))?.slice(0, 500),
      });
      throw new AppError("OTP_SEND_FAILED", SEND_FAILED, 502);
    }

    return {};
  }
}
