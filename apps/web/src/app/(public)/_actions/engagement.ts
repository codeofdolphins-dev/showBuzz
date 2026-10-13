"use server";

import { updateTag } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { objectIdSchema } from "@showbuzz/schemas/common";
import type { ContactLeadInput, CorporateLeadInput, ShowSubmissionInput } from "@showbuzz/schemas/lead";
import type { CreateMovieReviewInput } from "@showbuzz/schemas/movie";
import { requireCustomer } from "@showbuzz/core/auth/current-customer";
import { runAction } from "@showbuzz/core/http/action-result";
import { getClientIp } from "@showbuzz/core/http/request";
import { CATALOG_TAGS } from "@showbuzz/core/services/catalog.service";
import { submitContactLead, submitCorporateLead, submitShowSubmission } from "@showbuzz/core/services/lead.service";
import { addMovieReview } from "@showbuzz/core/services/review.service";
import {
  MAX_WISHLIST_ITEMS,
  listWishlistIds,
  mergeWishlist,
  setWishlistItem,
} from "@showbuzz/core/services/wishlist.service";

/** Signed-in customers only; the author is the account name, never a name sent by the client. */
export async function submitReviewAction(input: CreateMovieReviewInput) {
  return runAction(async () => {
    const customer = await requireCustomer();
    const result = await addMovieReview(input, { userId: customer.id, name: customer.name });
    // The movie's rating totals changed: cards and the movie page show the new average straight away.
    updateTag(CATALOG_TAGS.movies);
    return result;
  });
}

async function leadContext() {
  return { ip: getClientIp(await headers()), now: new Date() };
}

export async function submitContactLeadAction(input: ContactLeadInput) {
  return runAction(async () => submitContactLead(input, await leadContext()));
}

export async function submitCorporateLeadAction(input: CorporateLeadInput) {
  return runAction(async () => submitCorporateLead(input, await leadContext()));
}

export async function submitShowSubmissionAction(input: ShowSubmissionInput) {
  return runAction(async () => submitShowSubmission(input, await leadContext()));
}

const wishlistItemSchema = z.object({ itemId: objectIdSchema, saved: z.boolean() });
const wishlistMergeSchema = z.array(z.string().max(64)).max(MAX_WISHLIST_ITEMS);

export async function getWishlistAction() {
  return runAction(async () => listWishlistIds((await requireCustomer()).id));
}

export async function setWishlistItemAction(input: z.input<typeof wishlistItemSchema>) {
  return runAction(async () => {
    const customer = await requireCustomer();
    const { itemId, saved } = wishlistItemSchema.parse(input);
    await setWishlistItem(customer.id, itemId, saved);
  });
}

/** Merges this device's signed-out wishlist into the account; returns the account's list. */
export async function mergeWishlistAction(ids: string[]) {
  return runAction(async () => mergeWishlist((await requireCustomer()).id, wishlistMergeSchema.parse(ids)));
}
