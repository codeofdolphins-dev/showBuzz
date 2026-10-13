import "server-only";
import { randomInt } from "node:crypto";
import { connect } from "@showbuzz/db/connect";
import { Lead, type LeadAttrs, type LeadType } from "@showbuzz/db/models/Lead";
import {
  contactLeadSchema,
  corporateLeadSchema,
  showSubmissionSchema,
  type ContactLeadInput,
  type CorporateLeadInput,
  type ShowSubmissionInput,
} from "@showbuzz/schemas/lead";
import { AppError } from "../http/app-error";
import { ipPrefix } from "../http/request";
import { consumeRateLimit } from "../security/rate-limit";

/**
 * Inbound enquiries (contact, corporate, list-your-show) in the `leads` collection. Spam protection:
 * a per-IP rate limit and a hidden "website" honeypot field that people never fill in; a filled honeypot
 * gets a normal-looking answer and nothing is stored. The admin app reads them through `listLeads`.
 */

const PREFIX: Record<LeadType, string> = { contact: "TKT", corporate: "CORP", show_submission: "LYS" };
const LIMIT_PER_IP = { limit: 5, windowSec: 60 * 60 };
const MAX_REFERENCE_ATTEMPTS = 5;

export interface LeadContext {
  ip: string;
  now: Date;
}

const newReference = (type: LeadType) => `${PREFIX[type]}-${randomInt(10_000, 100_000)}`;

function isFilledHoneypot(input: unknown): boolean {
  const website = (input as { website?: unknown } | null)?.website;
  return typeof website === "string" && website.trim() !== "";
}

async function storeLead(
  type: LeadType,
  contact: { name: string; email: string; phone?: string },
  fields: Record<string, unknown>,
  ctx: LeadContext,
): Promise<{ reference: string }> {
  const limit = await consumeRateLimit(`lead:${ipPrefix(ctx.ip) ?? ctx.ip}`, { ...LIMIT_PER_IP, now: ctx.now });
  if (!limit.allowed) {
    throw new AppError("RATE_LIMITED", "Too many requests from your network. Please try again later.", 429, {
      retryAfterSec: limit.retryAfterSec,
    });
  }

  await connect();
  for (let attempt = 0; attempt < MAX_REFERENCE_ATTEMPTS; attempt++) {
    const reference = newReference(type);
    try {
      await Lead.create({
        type,
        reference,
        name: contact.name,
        email: contact.email,
        ...(contact.phone ? { phone: contact.phone } : {}),
        fields,
        status: "new",
        ipPrefix: ipPrefix(ctx.ip),
      });
      return { reference };
    } catch (err) {
      if ((err as { code?: number }).code !== 11000) throw err;
    }
  }
  throw new AppError("INTERNAL", "We couldn't save your request. Please try again.", 500);
}

/** Without the honeypot field (it is never stored). */
function formFields(data: { website?: string }): Record<string, unknown> {
  const fields: Record<string, unknown> = { ...data };
  delete fields.website;
  return fields;
}

export async function submitContactLead(input: ContactLeadInput, ctx: LeadContext) {
  if (isFilledHoneypot(input)) return { reference: newReference("contact") };
  const data = contactLeadSchema.parse(input);
  return storeLead("contact", { name: data.name, email: data.email, phone: data.phone }, formFields(data), ctx);
}

export async function submitCorporateLead(input: CorporateLeadInput, ctx: LeadContext) {
  if (isFilledHoneypot(input)) return { reference: newReference("corporate") };
  const data = corporateLeadSchema.parse(input);
  return storeLead(
    "corporate",
    { name: data.contactName, email: data.email, phone: data.phone },
    formFields(data),
    ctx,
  );
}

export async function submitShowSubmission(input: ShowSubmissionInput, ctx: LeadContext) {
  if (isFilledHoneypot(input)) return { reference: newReference("show_submission") };
  const data = showSubmissionSchema.parse(input);
  return storeLead("show_submission", { name: data.name, email: data.email, phone: data.phone }, formFields(data), ctx);
}

export interface LeadListItem {
  id: string;
  type: LeadType;
  reference: string;
  name: string;
  email: string;
  phone?: string;
  fields: Record<string, unknown>;
  status: LeadAttrs["status"];
  createdAt: string;
}

/** Leads for the admin console, newest first. Callers check the `leads:read` permission. */
export async function listLeads(
  query: { type?: LeadType; status?: LeadAttrs["status"]; page?: number; limit?: number } = {},
): Promise<{ items: LeadListItem[]; total: number; page: number; limit: number }> {
  const page = Math.max(1, Math.floor(query.page ?? 1));
  const limit = Math.min(100, Math.max(1, Math.floor(query.limit ?? 20)));
  const filter = { ...(query.type ? { type: query.type } : {}), ...(query.status ? { status: query.status } : {}) };
  await connect();
  const [docs, total] = await Promise.all([
    Lead.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Lead.countDocuments(filter),
  ]);
  return {
    items: docs.map((d) => ({
      id: d._id.toString(),
      type: d.type,
      reference: d.reference,
      name: d.name,
      email: d.email,
      ...(d.phone ? { phone: d.phone } : {}),
      fields: d.fields,
      status: d.status,
      createdAt: d.createdAt.toISOString(),
    })),
    total,
    page,
    limit,
  };
}
