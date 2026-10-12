import { z } from "zod";

export const idSchema = z.string().trim().min(1).max(64).regex(/^[a-z0-9-]+$/);
export const slugSchema = z.string().trim().min(1).max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
export const paiseSchema = z.int().nonnegative();
export const imageUrlSchema = z.url({ protocol: /^https$/ });
export const isoDateTimeSchema = z.iso.datetime({ offset: true });
export const isoDateSchema = z.iso.date();
/** "HH:mm", 24-hour wall-clock time in IST. */
export const wallClockTimeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

export const indianPhoneSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s-]/g, ""))
  .pipe(z.string().regex(/^(\+91)?[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number"));

export const personNameSchema = z.string().trim().min(2, "Name is too short").max(80);
