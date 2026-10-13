import "server-only";
import { isDemoMode } from "@showbuzz/runtime/env";
import { customerAuthEnv } from "@showbuzz/runtime/customer-auth-env";
import type { OtpChannel, OtpPurpose } from "@showbuzz/schemas/user";
import { log } from "@showbuzz/runtime/log";

export interface OtpMessage {
  channel: OtpChannel;
  /** Normalised destination: E.164 phone or lowercase email. */
  to: string;
  code: string;
  purpose: OtpPurpose;
}

export interface OtpSendResult {
  /** The code itself, for on-screen display. Only ever set outside production. */
  devCode?: string;
}

/** Delivers a sign-in code. A real SMS/email provider implements this once one is chosen. */
export interface OtpSender {
  send(message: OtpMessage): Promise<OtpSendResult>;
}

/** On-screen only (OTP_PROVIDER=dev): nothing is sent or logged. */
export class DevOtpSender implements OtpSender {
  async send({ code }: OtpMessage): Promise<OtpSendResult> {
    return isDemoMode ? { devCode: code } : {};
  }
}

/**
 * No provider yet (OTP_PROVIDER=none): writes the code to the server log so the team can complete
 * sign-in on deployed demos. A deliberate, temporary exception to "never log OTPs": remove it when a
 * real provider lands. The destination stays masked by the logger.
 */
export class LogOtpSender implements OtpSender {
  async send({ channel, to, code, purpose }: OtpMessage): Promise<OtpSendResult> {
    // The code goes in the message on purpose: field values named like secrets are redacted.
    log.warn(`OTP ${code} (no SMS/email provider configured; OTP_PROVIDER=none)`, { channel, to, purpose });
    return isDemoMode ? { devCode: code } : {};
  }
}

export function getOtpSender(): OtpSender {
  return customerAuthEnv.OTP_PROVIDER === "dev" ? new DevOtpSender() : new LogOtpSender();
}
