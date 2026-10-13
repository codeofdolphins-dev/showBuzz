"use server";

import type { ContactLeadInput, CorporateLeadInput, ShowSubmissionInput } from "@showbuzz/schemas/lead";
import type { CreateMovieReviewInput } from "@showbuzz/schemas/movie";
import { requireCustomer } from "@showbuzz/core/auth/current-customer";
import { runAction } from "@showbuzz/core/http/action-result";
import { submitContactLead, submitCorporateLead, submitShowSubmission } from "@showbuzz/core/services/lead.service";
import { addMovieReview } from "@showbuzz/core/services/review.service";

/** Signed-in customers only; the author is the account name, never a name sent by the client. */
export async function submitReviewAction(input: CreateMovieReviewInput) {
  return runAction(async () => {
    const customer = await requireCustomer();
    return addMovieReview(input, { userId: customer.id, name: customer.name }, new Date());
  });
}

export async function submitContactLeadAction(input: ContactLeadInput) {
  return runAction(() => submitContactLead(input, new Date()));
}

export async function submitCorporateLeadAction(input: CorporateLeadInput) {
  return runAction(() => submitCorporateLead(input, new Date()));
}

export async function submitShowSubmissionAction(input: ShowSubmissionInput) {
  return runAction(() => submitShowSubmission(input, new Date()));
}
