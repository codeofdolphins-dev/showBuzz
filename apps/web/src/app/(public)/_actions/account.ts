"use server";

import { cookies, headers } from "next/headers";
import type {
  ConfirmCodeInput,
  RemoveContactInput,
  RevokeSessionInput,
  StartContactChangeInput,
  UpdateProfileInput,
} from "@showbuzz/schemas/account";
import { authContextFrom } from "@showbuzz/core/auth/context";
import { clearSessionCookies } from "@showbuzz/core/auth/cookies";
import { requireCustomerSession } from "@showbuzz/core/auth/current-customer";
import { runAction } from "@showbuzz/core/http/action-result";
import {
  confirmAccountDeletion,
  confirmContactChange,
  confirmReauthentication,
  removeContact,
  revokeOwnSession,
  signOutOtherDevices,
  startAccountDeletion,
  startContactChange,
  startReauthentication,
  updateProfile,
} from "@showbuzz/core/services/account.service";

/*
 * Profile page mutations. Each one first checks the session is live in the database
 * (requireCustomerSession), so a revoked session can't change anything even with an unexpired token.
 */

export async function updateProfileAction(input: UpdateProfileInput) {
  return runAction(async () => {
    const { user } = await requireCustomerSession();
    return updateProfile(user.id, input);
  });
}

export async function startContactChangeAction(input: StartContactChangeInput) {
  return runAction(async () => {
    const { user, sid } = await requireCustomerSession();
    return startContactChange(user.id, sid, input, authContextFrom(await headers()));
  });
}

export async function confirmContactChangeAction(input: ConfirmCodeInput) {
  return runAction(async () => {
    const { user } = await requireCustomerSession();
    return confirmContactChange(user.id, input, authContextFrom(await headers()));
  });
}

export async function removeContactAction(input: RemoveContactInput) {
  return runAction(async () => {
    const { user, sid } = await requireCustomerSession();
    return removeContact(user.id, sid, input, new Date());
  });
}

/** "Confirm it's you": a code to the customer's own phone/email, required before changing sign-in details. */
export async function startReauthAction() {
  return runAction(async () => {
    const { user } = await requireCustomerSession();
    return startReauthentication(user.id, authContextFrom(await headers()));
  });
}

export async function confirmReauthAction(input: ConfirmCodeInput) {
  return runAction(async () => {
    const { user, sid } = await requireCustomerSession();
    return confirmReauthentication(user.id, sid, input, authContextFrom(await headers()));
  });
}

/** Revoking this device's own session is a sign-out, so its cookies are cleared too. */
export async function revokeSessionAction(input: RevokeSessionInput) {
  return runAction(async () => {
    const { user, sid } = await requireCustomerSession();
    const result = await revokeOwnSession(user.id, sid, input);
    if (result.signedOutHere) clearSessionCookies(await cookies());
    return result;
  });
}

export async function signOutOtherDevicesAction() {
  return runAction(async () => {
    const { user, sid } = await requireCustomerSession();
    await signOutOtherDevices(user.id, sid);
    return { signedOutOthers: true };
  });
}

export async function startAccountDeletionAction() {
  return runAction(async () => {
    const { user } = await requireCustomerSession();
    return startAccountDeletion(user.id, authContextFrom(await headers()));
  });
}

export async function confirmAccountDeletionAction(input: ConfirmCodeInput) {
  return runAction(async () => {
    const { user } = await requireCustomerSession();
    await confirmAccountDeletion(user.id, input, authContextFrom(await headers()));
    clearSessionCookies(await cookies());
    return { deleted: true };
  });
}
