import "server-only";
import { connect } from "@showbuzz/db/connect";
import { Booking } from "@showbuzz/db/models/Booking";
import { City } from "@showbuzz/db/models/City";
import { ACTIVE_EVENT_FILTER, Event } from "@showbuzz/db/models/Event";
import { Lead } from "@showbuzz/db/models/Lead";
import { Movie } from "@showbuzz/db/models/Movie";
import { Plan } from "@showbuzz/db/models/Plan";
import { Settlement } from "@showbuzz/db/models/Settlement";
import { LIVE_SHOW_FILTER, Show } from "@showbuzz/db/models/Show";
import { SubscriptionInvoice } from "@showbuzz/db/models/SubscriptionInvoice";
import { Vendor, type VendorAttrs, toVendorKyc, toVendorSummary } from "@showbuzz/db/models/Vendor";
import { VendorUser } from "@showbuzz/db/models/VendorUser";
import { Venue } from "@showbuzz/db/models/Venue";
import type { LeanDoc } from "@showbuzz/db/models/transforms";
import { Types } from "@showbuzz/db/mongoose";
import { log } from "@showbuzz/runtime/log";
import {
  adminCreateVendorSchema,
  percentToBps,
  suspendVendorSchema,
  vendorTermsSchema,
} from "@showbuzz/schemas/admin-marketplace";
import type { AdminVendorDetail, AdminVendorRow, SalesSummary } from "@showbuzz/schemas/types/admin-marketplace";
import type { BillingModel, VendorOnboardingStatus, VendorStatus } from "@showbuzz/schemas/vendor";
import { formatINR } from "@showbuzz/utils/money";
import { generateTemporaryPassword, hashPassword } from "../../auth/password";
import { AppError } from "../../http/app-error";
import { availableSlug, newVendorTerms } from "../partner/vendor-defaults";
import { getSettings } from "../settings.service";
import { toInvoiceRow } from "./invoice.service";
import { toSettlementRow } from "./settlement.service";
import {
  type AdminListQuery,
  changedKeys,
  cityNames,
  idOr404,
  isDuplicateKey,
  searchPattern,
  sortSpec,
} from "./shared";

/**
 * The super-admin's Vendors screen: list, detail, create on the vendor's behalf, commercial terms, suspend /
 * reactivate and the owner login's password reset. KYC is edited through the same onboarding service the partner
 * portal uses (the admin passes the vendor id from the URL, after its permission check).
 */

export const VENDOR_SORT_FIELDS = ["businessName", "createdAt"] as const;

export interface VendorListQuery extends AdminListQuery {
  status?: VendorStatus;
  billingModel?: BillingModel;
  onboardingStatus?: VendorOnboardingStatus;
  cityId?: string;
}

const NOT_FOUND = "Vendor";

/** Vendor sales of a booking (tickets + food − discount), with fallbacks for bookings from before the snapshot. */
const SUBTOTAL = {
  $ifNull: ["$settlement.subtotalPaise", { $add: ["$amounts.ticketsPaise", { $ifNull: ["$amounts.foodPaise", 0] }] }],
};
const DISCOUNT = { $ifNull: ["$settlement.discountPaise", { $ifNull: ["$amounts.discountPaise", 0] }] };
const NET_SALES = { $subtract: [SUBTOTAL, DISCOUNT] };
const SHARE = { $ifNull: ["$settlement.vendorSharePaise", NET_SALES] };

function billingLabel(
  doc: Pick<VendorAttrs, "billingModel" | "commissionBps" | "planId">,
  plans: Map<string, { name: string; monthlyFeePaise: number }>,
): string {
  if (doc.billingModel === "commission") return `${doc.commissionBps / 100}% commission`;
  const plan = doc.planId ? plans.get(doc.planId.toString()) : undefined;
  return plan ? `${plan.name} · ${formatINR(plan.monthlyFeePaise)}/mo` : "Subscription · no plan";
}

async function planMap() {
  const plans = await Plan.find({}, { name: 1, monthlyFeePaise: 1 }).lean();
  return new Map(plans.map((p) => [p._id.toString(), { name: p.name, monthlyFeePaise: p.monthlyFeePaise }]));
}

export async function listVendorsAdmin(query: VendorListQuery): Promise<{ rows: AdminVendorRow[]; total: number }> {
  const filter: Record<string, unknown> = {};
  if (query.status) filter.status = query.status;
  if (query.billingModel) filter.billingModel = query.billingModel;
  if (query.onboardingStatus) filter.onboardingStatus = query.onboardingStatus;
  if (query.cityId) filter["address.cityId"] = query.cityId;
  if (query.q.trim()) {
    const pattern = searchPattern(query.q);
    filter.$or = [
      { businessName: pattern },
      { "contact.email": pattern },
      { "contact.name": pattern },
      { "kyc.gstin": pattern },
    ];
  }
  await connect();
  const [docs, total, plans, cities] = await Promise.all([
    Vendor.find(filter, { kyc: 0 })
      .sort(sortSpec(query, VENDOR_SORT_FIELDS, "businessName"))
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .lean(),
    Vendor.countDocuments(filter),
    planMap(),
    cityNames(),
  ]);
  const ids = docs.map((d) => d._id);
  const [venues, events, sales] = await Promise.all([
    Venue.aggregate<{ _id: Types.ObjectId; n: number }>([
      { $match: { vendorId: { $in: ids } } },
      { $group: { _id: "$vendorId", n: { $sum: 1 } } },
    ]),
    Event.aggregate<{ _id: Types.ObjectId; n: number }>([
      { $match: { vendorId: { $in: ids } } },
      { $group: { _id: "$vendorId", n: { $sum: 1 } } },
    ]),
    Booking.aggregate<{ _id: Types.ObjectId; gross: number }>([
      { $match: { vendorId: { $in: ids }, status: "confirmed" } },
      { $group: { _id: "$vendorId", gross: { $sum: NET_SALES } } },
    ]),
  ]);
  const count = (rows: { _id: Types.ObjectId; n: number }[]) => new Map(rows.map((r) => [r._id.toString(), r.n]));
  const venueCount = count(venues);
  const eventCount = count(events);
  const gross = new Map(sales.map((r) => [r._id.toString(), r.gross]));

  return {
    total,
    rows: docs.map((d) => {
      const id = d._id.toString();
      return {
        id,
        businessName: d.businessName,
        businessType: d.businessType,
        contactName: d.contact.name,
        contactPhone: d.contact.phone,
        contactEmail: d.contact.email,
        cityName: cities.get(d.address.cityId) ?? d.address.cityId,
        status: d.status,
        onboardingStatus: d.onboardingStatus,
        billingModel: d.billingModel,
        billingLabel: billingLabel(d, plans),
        venues: venueCount.get(id) ?? 0,
        events: eventCount.get(id) ?? 0,
        grossSalesPaise: gross.get(id) ?? 0,
        createdAt: d.createdAt.toISOString(),
      };
    }),
  };
}

const EMPTY_SALES: SalesSummary = {
  bookings: 0,
  tickets: 0,
  salesPaise: 0,
  commissionPaise: 0,
  vendorSharePaise: 0,
  refundsPaise: 0,
};

/** Sales, commission, share (bookings still confirmed) and refunds (cancelled ones) of a vendor since `from`. */
async function salesSummary(vendorId: Types.ObjectId, from?: Date): Promise<SalesSummary> {
  const confirmed = { $eq: ["$status", "confirmed"] };
  const [row] = await Booking.aggregate<SalesSummary & { _id: null }>([
    {
      $match: {
        vendorId,
        status: { $in: ["confirmed", "cancelled"] },
        ...(from ? { confirmedAt: { $gte: from } } : {}),
      },
    },
    {
      $group: {
        _id: null,
        bookings: { $sum: { $cond: [confirmed, 1, 0] } },
        tickets: { $sum: { $cond: [confirmed, "$ticketCount", 0] } },
        salesPaise: { $sum: { $cond: [confirmed, NET_SALES, 0] } },
        commissionPaise: { $sum: { $cond: [confirmed, { $ifNull: ["$settlement.commissionPaise", 0] }, 0] } },
        vendorSharePaise: { $sum: { $cond: [confirmed, SHARE, 0] } },
        refundsPaise: { $sum: { $cond: [confirmed, 0, { $ifNull: ["$refundPaise", 0] }] } },
      },
    },
  ]);
  if (!row) return EMPTY_SALES;
  return {
    bookings: row.bookings,
    tickets: row.tickets,
    salesPaise: row.salesPaise,
    commissionPaise: row.commissionPaise,
    vendorSharePaise: row.vendorSharePaise,
    refundsPaise: row.refundsPaise,
  };
}

export async function getVendorAdminDetail(vendorId: string, now: Date): Promise<AdminVendorDetail> {
  const _id = idOr404(vendorId, NOT_FOUND);
  await connect();
  const vendor = await Vendor.findById(_id).lean();
  if (!vendor) throw new AppError("NOT_FOUND", "Vendor not found.", 404);

  const [city, plan, login, venues, events, upcomingShows, moviesCreated, allTime, last30Days, payouts, invoices] =
    await Promise.all([
      City.findOne({ slug: vendor.address.cityId }, { name: 1 }).lean(),
      vendor.planId ? Plan.findById(vendor.planId).lean() : null,
      VendorUser.findOne({ vendorId: _id }, { name: 1, email: 1, status: 1, lastLoginAt: 1 }).lean(),
      Venue.countDocuments({ vendorId: _id }),
      Event.countDocuments({ vendorId: _id, ...ACTIVE_EVENT_FILTER }),
      Show.countDocuments({ vendorId: _id, startsAt: { $gt: now }, ...LIVE_SHOW_FILTER }),
      Movie.countDocuments({ createdByVendorId: _id }),
      salesSummary(_id),
      salesSummary(_id, new Date(now.getTime() - 30 * 86_400_000)),
      Settlement.find({ vendorId: _id }).sort({ createdAt: -1 }).limit(5).lean(),
      SubscriptionInvoice.find({ vendorId: _id }).sort({ month: -1 }).limit(6).lean(),
    ]);
  const names = new Map([[vendorId, vendor.businessName]]);

  return {
    vendor: toVendorSummary(vendor),
    kyc: toVendorKyc(vendor),
    cityName: city?.name ?? vendor.address.cityId,
    ...(vendor.suspendedAt ? { suspendedAt: vendor.suspendedAt.toISOString() } : {}),
    ...(vendor.suspendReason ? { suspendReason: vendor.suspendReason } : {}),
    ...(plan
      ? {
          plan: {
            id: plan._id.toString(),
            name: plan.name,
            monthlyFeePaise: plan.monthlyFeePaise,
            active: plan.active,
          },
        }
      : {}),
    ...(login
      ? {
          login: {
            name: login.name,
            email: login.email,
            status: login.status,
            ...(login.lastLoginAt ? { lastLoginAt: login.lastLoginAt.toISOString() } : {}),
          },
        }
      : {}),
    counts: { venues, events, upcomingShows, moviesCreated },
    sales: { allTime, last30Days },
    payouts: payouts.map((p) => toSettlementRow(p, names)),
    invoices: invoices.map((i) => toInvoiceRow(i, names, now)),
  };
}

/**
 * Creates a vendor on its behalf, with its owner login and a temporary password (returned once; the vendor changes
 * it from its profile). Onboarding starts incomplete: the KYC steps are filled by the super-admin or by the vendor
 * after signing in, exactly as after a self-service signup.
 */
export async function createVendorByStaff(
  input: unknown,
  now: Date,
): Promise<{ vendorId: string; email: string; temporaryPassword: string; leadId?: string }> {
  const form = adminCreateVendorSchema.parse(input);
  const mongoose = await connect();
  if (!(await City.exists({ slug: form.cityId }))) {
    throw new AppError("VALIDATION_FAILED", "Choose a city from the list.", 422, {
      fieldErrors: { cityId: ["Choose a city from the list."] },
    });
  }
  const leadId = form.leadId ? new Types.ObjectId(form.leadId) : undefined;
  if (leadId) {
    const lead = await Lead.findOne({ _id: leadId, type: "show_submission" }, { vendorId: 1 }).lean();
    if (!lead) throw new AppError("NOT_FOUND", "That list-your-show request doesn't exist.", 404);
    if (lead.vendorId) throw new AppError("CONFLICT", "A vendor was already created from this request.", 409);
  }
  if (await VendorUser.exists({ email: form.email })) {
    throw new AppError("CONFLICT", "A partner login with that email already exists.", 409, {
      fieldErrors: { email: ["A partner login with that email already exists."] },
    });
  }

  const settings = await getSettings();
  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await hashPassword(temporaryPassword);
  const vendorId = new Types.ObjectId();
  const slug = await availableSlug(form.businessName);

  try {
    await mongoose.connection.transaction(async (session) => {
      await Vendor.create(
        [
          {
            _id: vendorId,
            businessName: form.businessName,
            slug,
            businessType: form.businessType,
            contact: { name: form.contactName, email: form.email, phone: form.phone },
            address: { line: "", cityId: form.cityId, pincode: "" },
            kyc: { documents: [] },
            ...newVendorTerms(settings),
          },
        ],
        { session },
      );
      await VendorUser.create(
        [
          {
            vendorId,
            name: form.contactName,
            email: form.email,
            passwordHash,
            passwordChangedAt: now,
            role: "owner",
            status: "active",
          },
        ],
        { session },
      );
      if (leadId) {
        const linked = await Lead.updateOne(
          { _id: leadId, vendorId: { $exists: false } },
          { $set: { vendorId, status: "in_progress" } },
          { session },
        );
        if (linked.modifiedCount !== 1) {
          throw new AppError("CONFLICT", "A vendor was already created from this request.", 409);
        }
      }
    });
  } catch (err) {
    if (isDuplicateKey(err)) {
      throw new AppError("CONFLICT", "A partner login with that email already exists.", 409, {
        fieldErrors: { email: ["A partner login with that email already exists."] },
      });
    }
    throw err;
  }
  log.info("Vendor created by staff", { event: "vendor.created_by_staff", vendorId: vendorId.toString() });
  return {
    vendorId: vendorId.toString(),
    email: form.email,
    temporaryPassword,
    ...(leadId ? { leadId: leadId.toString() } : {}),
  };
}

/** Billing model, plan, rates and contact sharing. Booked orders keep their frozen split; new quotes use these. */
export async function updateVendorTerms(vendorId: string, input: unknown): Promise<{ changedFields: string[] }> {
  const _id = idOr404(vendorId, NOT_FOUND);
  const data = vendorTermsSchema.parse(input);
  await connect();
  const vendor = await Vendor.findById(_id).lean();
  if (!vendor) throw new AppError("NOT_FOUND", "Vendor not found.", 404);

  let planId: Types.ObjectId | undefined;
  if (data.billingModel === "subscription" && data.planId) {
    planId = new Types.ObjectId(data.planId);
    const plan = await Plan.findById(planId, { active: 1 }).lean();
    // An inactive plan stays valid for vendors already on it; it can't be newly assigned.
    if (!plan || (!plan.active && vendor.planId?.toString() !== data.planId)) {
      throw new AppError("VALIDATION_FAILED", "Choose an active plan.", 422, {
        fieldErrors: { planId: ["Choose an active plan."] },
      });
    }
  }
  const next = {
    billingModel: data.billingModel,
    planId: planId?.toString(),
    commissionBps: percentToBps(data.commissionPercent),
    convenienceFeeBps: percentToBps(data.convenienceFeePercent),
    gstBps: percentToBps(data.gstPercent),
    shareCustomerContact: data.shareCustomerContact,
  };
  const before = {
    billingModel: vendor.billingModel,
    planId: vendor.planId?.toString(),
    commissionBps: vendor.commissionBps,
    convenienceFeeBps: vendor.convenienceFeeBps,
    gstBps: vendor.gstBps,
    shareCustomerContact: vendor.shareCustomerContact,
  };
  await Vendor.updateOne(
    { _id },
    {
      $set: {
        billingModel: next.billingModel,
        commissionBps: next.commissionBps,
        convenienceFeeBps: next.convenienceFeeBps,
        gstBps: next.gstBps,
        shareCustomerContact: next.shareCustomerContact,
        ...(planId ? { planId } : {}),
      },
      ...(planId ? {} : { $unset: { planId: 1 } }),
    },
  );
  return { changedFields: changedKeys(before, next) };
}

/**
 * Suspends a vendor: its listings disappear from showbuzz.com (public reads skip suspended vendors), its shows can't
 * be quoted or booked, and its partner login can sign in but can't change listings. Sold tickets stay valid.
 */
export async function suspendVendor(vendorId: string, input: unknown, now: Date): Promise<{ businessName: string }> {
  const _id = idOr404(vendorId, NOT_FOUND);
  const { reason } = suspendVendorSchema.parse(input);
  await connect();
  const vendor = await Vendor.findOneAndUpdate(
    { _id, status: "active" },
    { $set: { status: "suspended", suspendedAt: now, suspendReason: reason } },
    { projection: { businessName: 1 } },
  ).lean();
  if (!vendor) throw await statusConflict(_id, "already suspended");
  return { businessName: vendor.businessName };
}

export async function reactivateVendor(vendorId: string): Promise<{ businessName: string }> {
  const _id = idOr404(vendorId, NOT_FOUND);
  await connect();
  const vendor = await Vendor.findOneAndUpdate(
    { _id, status: "suspended" },
    { $set: { status: "active" }, $unset: { suspendedAt: 1, suspendReason: 1 } },
    { projection: { businessName: 1 } },
  ).lean();
  if (!vendor) throw await statusConflict(_id, "already active");
  return { businessName: vendor.businessName };
}

async function statusConflict(_id: Types.ObjectId, state: string): Promise<AppError> {
  return (await Vendor.exists({ _id }))
    ? new AppError("CONFLICT", `This vendor is ${state}. Reload the page.`, 409)
    : new AppError("NOT_FOUND", "Vendor not found.", 404);
}

/**
 * Stand-in for "forgot password" on the partner portal (no email provider yet): sets a temporary password on the
 * vendor's owner login, signs it out everywhere and returns the password once (never stored in clear).
 */
export async function resetVendorPassword(
  vendorId: string,
  now: Date,
): Promise<{ email: string; temporaryPassword: string }> {
  const _id = idOr404(vendorId, NOT_FOUND);
  await connect();
  const user = await VendorUser.findOne({ vendorId: _id }, { _id: 1, email: 1 });
  if (!user) throw new AppError("NOT_FOUND", "This vendor has no partner login yet.", 404);
  const temporaryPassword = generateTemporaryPassword();
  await VendorUser.updateOne(
    { _id: user._id },
    // Clearing sessions[] signs the login out everywhere (what the partner session store's revokeAll does; the
    // store itself needs the partner token keys, which the admin app doesn't have).
    { $set: { passwordHash: await hashPassword(temporaryPassword), passwordChangedAt: now, sessions: [] } },
  );
  log.info("Vendor password reset by staff", { event: "vendor_user.password_reset", vendorId });
  return { email: user.email, temporaryPassword };
}

/** Business name of a vendor (for action messages and logs). */
export async function vendorName(vendorId: string): Promise<string> {
  const _id = idOr404(vendorId, NOT_FOUND);
  await connect();
  const vendor = await Vendor.findById(_id, { businessName: 1 }).lean<Pick<LeanDoc<VendorAttrs>, "businessName">>();
  if (!vendor) throw new AppError("NOT_FOUND", "Vendor not found.", 404);
  return vendor.businessName;
}
