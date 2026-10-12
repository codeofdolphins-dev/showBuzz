"use server";

import { personNameSchema } from "@/schemas/common";
import type { ContactLeadInput, CorporateLeadInput, ShowSubmissionInput } from "@/schemas/lead";
import type { CreateMovieReviewInput } from "@/schemas/movie";
import { runAction } from "@/server/http/action-result";
import { submitContactLead, submitCorporateLead, submitShowSubmission } from "@/server/services/lead.service";
import { addMovieReview } from "@/server/services/review.service";

export async function submitReviewAction(input: CreateMovieReviewInput, authorName?: string) {
  // Until customer sessions exist the display name comes from the client and is only validated.
  const author = personNameSchema.safeParse(authorName).data ?? "Guest Reviewer";
  return runAction(() => addMovieReview(input, author, new Date()));
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
