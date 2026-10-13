import "server-only";
import { randomInt } from "node:crypto";
import {
  contactLeadSchema,
  corporateLeadSchema,
  showSubmissionSchema,
  type ContactLeadInput,
  type CorporateLeadInput,
  type ShowSubmissionInput,
} from "@showbuzz/schemas/lead";

/**
 * Inbound enquiries (contact, corporate, list-your-show). Held in memory until the `leads`
 * and `showSubmissions` collections exist; the admin console will read them from there.
 */

type LeadKind = "contact" | "corporate" | "show-submission";

interface StoredLead {
  reference: string;
  kind: LeadKind;
  payload: unknown;
  createdAt: string;
}

const globalStore = globalThis as unknown as { __showbuzzLeads?: StoredLead[] };
const leads = (globalStore.__showbuzzLeads ??= []);

const PREFIX: Record<LeadKind, string> = { contact: "TKT", corporate: "CORP", "show-submission": "LYS" };

function store(kind: LeadKind, payload: unknown, now: Date) {
  const reference = `${PREFIX[kind]}-${randomInt(1000, 10_000)}`;
  leads.push({ reference, kind, payload, createdAt: now.toISOString() });
  return { reference };
}

export async function submitContactLead(input: ContactLeadInput, now: Date) {
  return store("contact", contactLeadSchema.parse(input), now);
}

export async function submitCorporateLead(input: CorporateLeadInput, now: Date) {
  return store("corporate", corporateLeadSchema.parse(input), now);
}

export async function submitShowSubmission(input: ShowSubmissionInput, now: Date) {
  return store("show-submission", showSubmissionSchema.parse(input), now);
}
