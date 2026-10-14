import "server-only";
import { cache } from "react";
import { connect } from "@showbuzz/db/connect";
import { Vendor } from "@showbuzz/db/models/Vendor";
import { Types } from "@showbuzz/db/mongoose";
import { objectIdSchema } from "@showbuzz/schemas/common";
import type { BillingModel, CancellationPolicy } from "@showbuzz/schemas/vendor";
import { AppError } from "../http/app-error";

/**
 * The selling vendor's money rules and policy. Read fresh from the database (once per request, never from the
 * catalogue cache) because they price orders: a rate change applies to the next quote.
 */
export interface SellerTerms {
  vendorId: Types.ObjectId;
  businessName: string;
  billingModel: BillingModel;
  commissionBps: number;
  convenienceFeeBps: number;
  gstBps: number;
  cancellation: CancellationPolicy;
}

const NOT_SELLING = "This show isn't available for booking right now.";

/**
 * Terms of the vendor selling a show. Only an active vendor that finished onboarding (KYC) can sell; anything
 * else answers 410 so the customer is told the show can't be booked, never which vendor state caused it.
 */
export const getSellerTerms = cache(async (vendorId: string | undefined): Promise<SellerTerms> => {
  if (!vendorId || !objectIdSchema.safeParse(vendorId).success) throw new AppError("NOT_FOUND", NOT_SELLING, 410);
  await connect();
  const vendor = await Vendor.findById(vendorId).lean();
  if (!vendor || vendor.status !== "active" || vendor.onboardingStatus !== "complete") {
    throw new AppError("NOT_FOUND", NOT_SELLING, 410);
  }
  return {
    vendorId: new Types.ObjectId(vendorId),
    businessName: vendor.businessName,
    billingModel: vendor.billingModel,
    commissionBps: vendor.billingModel === "commission" ? vendor.commissionBps : 0,
    convenienceFeeBps: vendor.convenienceFeeBps,
    gstBps: vendor.gstBps,
    cancellation: {
      allowed: vendor.cancellation.allowed,
      cutoffMinutes: vendor.cancellation.cutoffMinutes,
      feePaise: vendor.cancellation.feePaise,
    },
  };
});
