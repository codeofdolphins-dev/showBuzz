import "server-only";
import { isProduction } from "@/config/env";

/**
 * Minimal structured logger: one JSON object per line, which Vercel's log drains parse as-is.
 * Every field passes through `redact`, so secrets and contact details never reach the logs even
 * when a caller passes a whole request body or error.
 */

type Level = "debug" | "info" | "warn" | "error";
type Fields = Record<string, unknown>;

const REDACTED = "[REDACTED]";
const MAX_DEPTH = 6;

/** Key words that always hide the value (matched per word, so "footprint" doesn't match "otp"). */
const SECRET_WORDS = new Set(["password", "passwd", "pwd", "otp", "token", "secret", "authorization", "cookie"]);
const SECRET_COMPOUNDS = ["apikey", "privatekey", "setcookie"];
const CONTACT_WORDS = new Set(["email", "phone", "mobile", "identifier"]);

const EMAIL_PATTERN = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const PHONE_PATTERN = /(?:\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}\b/g;

function keyWords(key: string): string[] {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

function isSecretKey(key: string): boolean {
  const words = keyWords(key);
  const joined = words.join("");
  return words.some((w) => SECRET_WORDS.has(w)) || SECRET_COMPOUNDS.some((c) => joined.includes(c));
}

function isContactKey(key: string): boolean {
  return keyWords(key).some((w) => CONTACT_WORDS.has(w));
}

export function maskEmail(email: string): string {
  const at = email.indexOf("@");
  if (at < 1) return "***";
  return `${email[0]}***${email.slice(at)}`;
}

export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.length <= 4 ? "****" : `${"*".repeat(digits.length - 4)}${digits.slice(-4)}`;
}

/** Masks email addresses and Indian mobile numbers inside free text (messages, stacks). */
export function maskText(text: string): string {
  return text.replace(EMAIL_PATTERN, maskEmail).replace(PHONE_PATTERN, maskPhone);
}

function maskContact(value: unknown): unknown {
  if (typeof value !== "string") return value;
  return value.includes("@") ? maskEmail(value) : maskPhone(value);
}

/**
 * Returns a log-safe copy. A `code` key is hidden only when it holds digits (an OTP); error codes
 * such as "RATE_LIMITED" or Mongo's 11000 stay readable.
 */
export function redact(value: unknown, depth = 0, seen = new WeakSet<object>()): unknown {
  if (typeof value === "string") return maskText(value);
  if (value === null || typeof value !== "object") return value;
  if (value instanceof Date) return value.toISOString();
  if (seen.has(value)) return "[Circular]";
  if (depth >= MAX_DEPTH) return "[Truncated]";
  seen.add(value);

  if (Array.isArray(value)) return value.map((item) => redact(item, depth + 1, seen));

  const source: Record<string, unknown> =
    value instanceof Error
      ? {
          name: value.name,
          message: value.message,
          ...Object.fromEntries(Object.entries(value)),
          stack: value.stack,
          ...(value.cause === undefined ? {} : { cause: value.cause }),
        }
      : Object.fromEntries(Object.entries(value));

  const out: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(source)) {
    if (isSecretKey(key)) out[key] = REDACTED;
    else if (key.toLowerCase() === "code" && typeof child === "string" && /^\d+$/.test(child)) out[key] = REDACTED;
    else if (isContactKey(key)) out[key] = maskContact(child);
    else out[key] = redact(child, depth + 1, seen);
  }
  return out;
}

function write(level: Level, msg: string, fields: Fields = {}) {
  if (level === "debug" && isProduction) return;
  // Fixed keys go last so a caller's field can't overwrite them.
  const entry = { ...(redact(fields) as Fields), ts: new Date().toISOString(), level, msg: maskText(msg) };
  const line = JSON.stringify(entry);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const log = {
  debug: (msg: string, fields?: Fields) => write("debug", msg, fields),
  info: (msg: string, fields?: Fields) => write("info", msg, fields),
  warn: (msg: string, fields?: Fields) => write("warn", msg, fields),
  error: (msg: string, fields?: Fields) => write("error", msg, fields),
};
