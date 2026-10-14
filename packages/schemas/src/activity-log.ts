import { z } from "zod";
import { objectIdSchema } from "./common";

/**
 * Audit trail of back-office changes (admin staff and vendors). Entries record who did what to which record and the
 * names of the fields that changed, never their values (KYC, bank details and prices stay out of the log).
 */

export const activityActorTypeSchema = z.enum(["staff", "vendor"]);

/** "create", "update", "status_change", "onboarding_submit", ... (snake_case verbs). */
export const activityActionSchema = z.string().regex(/^[a-z][a-z0-9_]{1,47}$/, "Use a snake_case action name");

/** The collection-style resource name: "vendor", "venue", "show", "booking", ... */
export const activityResourceSchema = z.string().regex(/^[a-z][a-z0-9_-]{1,47}$/, "Use a lowercase resource name");

export const activityEntrySchema = z.object({
  action: activityActionSchema,
  resource: activityResourceSchema,
  resourceId: z.string().trim().min(1).max(64).optional(),
  summary: z.string().trim().min(1).max(300),
  changedFields: z.array(z.string().trim().min(1).max(64)).max(50).default([]),
});

export const activityActorSchema = z.object({
  type: activityActorTypeSchema,
  id: objectIdSchema,
  /** The vendor the actor acted for (always set for vendor actors; set for staff acting on a vendor's record). */
  vendorId: objectIdSchema.optional(),
});

export type ActivityActorType = z.infer<typeof activityActorTypeSchema>;
export type ActivityEntryInput = z.input<typeof activityEntrySchema>;
export type ActivityActor = z.infer<typeof activityActorSchema>;
