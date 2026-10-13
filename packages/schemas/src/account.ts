import { z } from "zod";
import { contactIdentifierSchema, otpVerifySchema } from "./auth";
import { otpChannelSchema } from "./user";
import { personNameSchema } from "./common";

/** The editable profile fields. The prototype profile has only name, email and phone; email/phone change
 * through a verified flow (startContactChange/confirmContactChange), so only the name is edited directly. */
export const updateProfileSchema = z.object({ name: personNameSchema });

/** New phone or email to verify; parsed like the sign-in identifier (E.164 / lowercase). */
export const startContactChangeSchema = z.object({ identifier: contactIdentifierSchema });

/** The code sent for a contact change or account deletion. */
export const confirmCodeSchema = otpVerifySchema;

export const removeContactSchema = z.object({ channel: otpChannelSchema });

export const revokeSessionSchema = z.object({ sid: z.uuid() });

export type UpdateProfileInput = z.input<typeof updateProfileSchema>;
export type StartContactChangeInput = z.input<typeof startContactChangeSchema>;
export type ConfirmCodeInput = z.input<typeof confirmCodeSchema>;
export type RemoveContactInput = z.input<typeof removeContactSchema>;
export type RevokeSessionInput = z.input<typeof revokeSessionSchema>;
