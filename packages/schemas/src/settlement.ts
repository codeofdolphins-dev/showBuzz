import type { BookingSettlement } from "./types/vendor";
import type { BillingModel } from "./vendor";

/**
 * The money split of a vendor's booking (pure, so pricing and the seed's backfill use the same rule):
 * vendor sales = tickets + food; commission = commissionBps × (sales − discount) for commission vendors and 0 for
 * subscription vendors; vendor share = sales − discount − commission. The convenience fee and its GST are the
 * platform's. Paying with a gift card is only a payment method, so it doesn't change the split.
 */
export function computeSettlement(input: {
  billingModel: BillingModel;
  commissionBps: number;
  convenienceFeeBps: number;
  gstBps: number;
  ticketsPaise: number;
  foodPaise: number;
  discountPaise: number;
  convenienceFeePaise: number;
  gstPaise: number;
  totalPaise: number;
}): BookingSettlement {
  const subtotalPaise = input.ticketsPaise + input.foodPaise;
  const discountPaise = Math.min(input.discountPaise, subtotalPaise);
  const commissionBps = input.billingModel === "commission" ? input.commissionBps : 0;
  const netSalesPaise = subtotalPaise - discountPaise;
  const commissionPaise = Math.round((netSalesPaise * commissionBps) / 10_000);
  return {
    billingModel: input.billingModel,
    commissionBps,
    convenienceFeeBps: input.convenienceFeeBps,
    gstBps: input.gstBps,
    subtotalPaise,
    discountPaise,
    convenienceFeePaise: input.convenienceFeePaise,
    gstPaise: input.gstPaise,
    totalPaise: input.totalPaise,
    commissionPaise,
    vendorSharePaise: netSalesPaise - commissionPaise,
  };
}
