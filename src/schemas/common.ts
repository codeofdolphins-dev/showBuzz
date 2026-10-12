import { z } from "zod";

export const idSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9-]+$/);
export const slugSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
export const paiseSchema = z.int().nonnegative();
/** 24-hex MongoDB ObjectId string. */
export const objectIdSchema = z.string().regex(/^[0-9a-f]{24}$/, "Invalid id");
export const imageUrlSchema = z.url({ protocol: /^https$/ });
export const isoDateTimeSchema = z.iso.datetime({ offset: true });
export const isoDateSchema = z.iso.date();
/** "HH:mm", 24-hour wall-clock time in IST. */
export const wallClockTimeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

/** E.164 for an Indian mobile number: "+91" followed by 10 digits starting 6-9. */
export const E164_INDIAN_PHONE = /^\+91[6-9]\d{9}$/;

/**
 * Normalises an Indian mobile number to E.164, or returns null. Accepts 10 digits with an optional
 * +91 / 91 / 0091 country code and/or a trunk 0 ("+91 0 98765 43210"), ignoring spaces, dashes,
 * dots and brackets. Mobile numbers start with 6-9, so a leading 91 can't be confused with them.
 */
export function toE164IndianPhone(raw: string): string | null {
  const compact = raw.trim().replace(/[\s\-.()]/g, "");
  const match = /^(?:\+91|0091|91)?0?([6-9]\d{9})$/.exec(compact);
  return match ? `+91${match[1]}` : null;
}

/** Phone field schema with a field-specific error message; outputs E.164. */
export function makeIndianPhoneSchema(message: string) {
  return z.string().transform((value, ctx) => {
    const phone = toE164IndianPhone(value);
    if (phone) return phone;
    ctx.addIssue({ code: "custom", message });
    return z.NEVER;
  });
}

export const indianPhoneSchema = makeIndianPhoneSchema("Enter a valid 10-digit Indian mobile number");

/** Email field schema: trimmed and lowercased so the same address always matches one account. */
export function makeEmailSchema(message: string) {
  return z.string().trim().toLowerCase().pipe(z.email(message));
}

export const personNameSchema = z.string().trim().min(2, "Name is too short").max(80);
