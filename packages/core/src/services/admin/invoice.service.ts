import "server-only";
import { connect } from "@showbuzz/db/connect";
import { Plan } from "@showbuzz/db/models/Plan";
import { SubscriptionInvoice, type SubscriptionInvoiceAttrs } from "@showbuzz/db/models/SubscriptionInvoice";
import { Vendor } from "@showbuzz/db/models/Vendor";
import type { LeanDoc } from "@showbuzz/db/models/transforms";
import { Types } from "@showbuzz/db/mongoose";
import { log } from "@showbuzz/runtime/log";
import { billingMonthSchema, paymentReferenceSchema, voidReasonSchema } from "@showbuzz/schemas/admin-marketplace";
import type { GenerateInvoicesResult, InvoiceRow } from "@showbuzz/schemas/types/admin-marketplace";
import { addDaysToKey, formatDateShort, istDateKey, istDateTime } from "@showbuzz/utils/dates";
import { formatINR } from "@showbuzz/utils/money";
import { AppError } from "../../http/app-error";
import { notify } from "../notification.service";
import {
  type AdminListQuery,
  idOr404,
  isDuplicateKey,
  nextMonthlyCode,
  optionalId,
  sortSpec,
  vendorNames,
  withCodeRetry,
} from "./shared";

/**
 * Monthly subscription invoices (agreed 2026-10-13: marked paid by hand, no online payment until a gateway is
 * chosen). One invoice per vendor and month (unique index), so generating a month again only fills the gaps.
 * The amount is the plan's monthly fee at generation time (no GST line and no proration yet); due 7 days after it
 * is generated. Unpaid past the due date = overdue (derived, no job).
 */

export const INVOICE_DUE_DAYS = 7;
export const INVOICE_SORT_FIELDS = ["month", "dueAt", "amountPaise", "createdAt"] as const;

export interface InvoiceListQuery extends AdminListQuery {
  month?: string;
  vendorId?: string;
  status?: "issued" | "paid" | "void";
  overdue?: boolean;
}

type LeanInvoice = LeanDoc<SubscriptionInvoiceAttrs>;

export function toInvoiceRow(doc: LeanInvoice, names: Map<string, string>, now: Date): InvoiceRow {
  return {
    id: doc._id.toString(),
    code: doc.code,
    vendorId: doc.vendorId.toString(),
    vendorName: names.get(doc.vendorId.toString()) ?? "Removed vendor",
    month: doc.month,
    planName: doc.planName,
    amountPaise: doc.amountPaise,
    status: doc.status,
    overdue: doc.status === "issued" && doc.dueAt < now,
    dueAt: doc.dueAt.toISOString(),
    ...(doc.paidAt ? { paidAt: doc.paidAt.toISOString() } : {}),
    ...(doc.reference ? { reference: doc.reference } : {}),
    createdAt: doc.createdAt.toISOString(),
  };
}

export async function listInvoices(
  query: InvoiceListQuery,
  now: Date,
): Promise<{ rows: InvoiceRow[]; total: number; overdueTotalPaise: number }> {
  const filter: Record<string, unknown> = {};
  if (query.month && billingMonthSchema.safeParse(query.month).success) filter.month = query.month;
  const vendorId = optionalId(query.vendorId);
  if (vendorId) filter.vendorId = vendorId;
  if (query.overdue) Object.assign(filter, { status: "issued", dueAt: { $lt: now } });
  else if (query.status) filter.status = query.status;
  if (query.q.trim())
    filter.code = new RegExp(
      `^${query.q
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9-]/g, "")}`,
    );
  await connect();
  const [docs, total, overdue] = await Promise.all([
    SubscriptionInvoice.find(filter)
      .sort(sortSpec(query, INVOICE_SORT_FIELDS, "month"))
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .lean(),
    SubscriptionInvoice.countDocuments(filter),
    SubscriptionInvoice.aggregate<{ total: number }>([
      { $match: { status: "issued", dueAt: { $lt: now } } },
      { $group: { _id: null, total: { $sum: "$amountPaise" } } },
    ]),
  ]);
  const names = await vendorNames(docs.map((d) => d.vendorId));
  return { rows: docs.map((d) => toInvoiceRow(d, names, now)), total, overdueTotalPaise: overdue[0]?.total ?? 0 };
}

/**
 * Issues the month's invoice to every active, onboarded subscription vendor that has a plan and no invoice for that
 * month yet. Safe to run again (the unique `{ vendorId, month }` index skips vendors already invoiced).
 */
export async function generateInvoices(
  monthInput: unknown,
  staffId: string,
  now: Date,
): Promise<GenerateInvoicesResult> {
  const month = billingMonthSchema.parse(monthInput);
  await connect();
  const vendors = await Vendor.find(
    { billingModel: "subscription", status: "active", onboardingStatus: "complete" },
    { businessName: 1, planId: 1 },
  ).lean();
  const planIds = vendors.flatMap((v) => (v.planId ? [v.planId] : []));
  const plans = new Map((await Plan.find({ _id: { $in: planIds } }).lean()).map((p) => [p._id.toString(), p]));
  const existing = new Set(
    (
      await SubscriptionInvoice.find({ month, vendorId: { $in: vendors.map((v) => v._id) } }, { vendorId: 1 }).lean()
    ).map((i) => i.vendorId.toString()),
  );
  const dueAt = istDateTime(addDaysToKey(istDateKey(now), INVOICE_DUE_DAYS + 1), "00:00");
  const result: GenerateInvoicesResult = { month, created: 0, alreadyIssued: 0, withoutPlan: [] };

  for (const vendor of vendors) {
    if (existing.has(vendor._id.toString())) {
      result.alreadyIssued++;
      continue;
    }
    const plan = vendor.planId ? plans.get(vendor.planId.toString()) : undefined;
    if (!plan) {
      result.withoutPlan.push(vendor.businessName);
      continue;
    }
    try {
      const invoice = await withCodeRetry(async () =>
        SubscriptionInvoice.create({
          vendorId: vendor._id,
          planId: plan._id,
          code: await nextMonthlyCode(SubscriptionInvoice, "INV", month),
          month,
          planName: plan.name,
          amountPaise: plan.monthlyFeePaise,
          status: "issued",
          dueAt,
          issuedBy: new Types.ObjectId(staffId),
        }),
      );
      result.created++;
      await notify({
        audience: "vendor",
        vendorId: vendor._id.toString(),
        type: "invoice_issued",
        title: `Invoice ${invoice.code} for ${month}: ${formatINR(invoice.amountPaise, { exact: true })}`,
        body: `${plan.name} subscription. Due by ${formatDateShort(dueAt)}.`,
        link: "/earnings",
      });
    } catch (err) {
      // Someone generated the same month at the same time: that vendor is invoiced already.
      if (!isDuplicateKey(err)) throw err;
      result.alreadyIssued++;
    }
  }
  log.info("Subscription invoices generated", { event: "invoices.generated", month, created: result.created });
  return result;
}

export async function markInvoicePaid(
  invoiceId: string,
  input: unknown,
  staffId: string,
  now: Date,
): Promise<{ code: string; vendorId: string }> {
  const _id = idOr404(invoiceId, "Invoice");
  const { reference } = paymentReferenceSchema.parse(input);
  await connect();
  const doc = await SubscriptionInvoice.findOneAndUpdate(
    { _id, status: "issued" },
    { $set: { status: "paid", paidAt: now, reference, paidBy: new Types.ObjectId(staffId) } },
    { projection: { code: 1, vendorId: 1 } },
  ).lean();
  if (!doc) throw await invoiceConflict(_id);
  return { code: doc.code, vendorId: doc.vendorId.toString() };
}

/** Cancels an issued invoice (raised in error). Paid invoices can't be voided. */
export async function voidInvoice(invoiceId: string, input: unknown): Promise<{ code: string; vendorId: string }> {
  const _id = idOr404(invoiceId, "Invoice");
  const { reason } = voidReasonSchema.parse(input);
  await connect();
  const doc = await SubscriptionInvoice.findOneAndUpdate(
    { _id, status: "issued" },
    { $set: { status: "void", voidReason: reason } },
    { projection: { code: 1, vendorId: 1 } },
  ).lean();
  if (!doc) throw await invoiceConflict(_id);
  return { code: doc.code, vendorId: doc.vendorId.toString() };
}

async function invoiceConflict(_id: Types.ObjectId): Promise<AppError> {
  const doc = await SubscriptionInvoice.findById(_id, { status: 1 }).lean();
  return doc
    ? new AppError("CONFLICT", `This invoice is already ${doc.status}. Reload the page.`, 409)
    : new AppError("NOT_FOUND", "Invoice not found.", 404);
}
