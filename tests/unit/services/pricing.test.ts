import { describe, expect, it } from "vitest";
import type { Coupon } from "@/schemas/offer";
import { evaluateCoupon, percentOf, quoteOrder, type TicketPricing } from "@/server/services/pricing.service";

// Fixed clock so seed dates (events in Nov 2026, coupons valid to Dec 2026) never age out of the tests.
const NOW = new Date("2026-10-12T06:30:00Z");

function coupon(overrides: Partial<Coupon>): Coupon {
  return {
    id: "test-coupon",
    code: "TEST",
    title: "Test coupon",
    category: "Test",
    kind: "percent",
    minOrderPaise: 0,
    appliesTo: "tickets",
    validUntil: "2026-12-31T23:59:00+05:30",
    description: "Test coupon",
    icon: "tags",
    gradient: "",
    terms: [],
    ...overrides,
  };
}

function tickets(overrides: Partial<TicketPricing> = {}): TicketPricing {
  return {
    kind: "movie",
    title: "Test show",
    poster: "",
    venueName: "Test venue",
    scheduleLabel: "",
    ticketLabel: "Regular",
    seatLabels: ["A1", "A2"],
    ticketCount: 2,
    unitPrices: [54_000, 54_000],
    ticketsPaise: 108_000,
    feesApply: true,
    foodAllowed: true,
    ...overrides,
  };
}

describe("percentOf", () => {
  it("applies basis points and rounds to whole paise", () => {
    expect(percentOf(199_800, 850)).toBe(16_983);
    expect(percentOf(16_983, 1800)).toBe(3_057);
  });
});

describe("quoteOrder", () => {
  it("adds an 8.5% convenience fee and 18% GST on that fee to event tickets", async () => {
    const quote = await quoteOrder(
      { tickets: { kind: "event", eventId: "eve-1", tierId: "ga", quantity: 2 }, food: [] },
      NOW,
    );

    expect(quote.amounts).toEqual({
      ticketsPaise: 199_800,
      foodPaise: 0,
      convenienceFeePaise: 16_983,
      gstPaise: 3_057,
      discountPaise: 0,
      totalPaise: 219_840,
    });
  });

  it("caps SHOW50 at ₹150 off", async () => {
    const quote = await quoteOrder(
      { tickets: { kind: "event", eventId: "eve-1", tierId: "ga", quantity: 2 }, food: [], couponCode: "SHOW50" },
      NOW,
    );

    expect(quote.amounts.discountPaise).toBe(15_000);
    expect(quote.amounts.totalPaise).toBe(204_840);
    expect(quote.coupon?.code).toBe("SHOW50");
  });

  it("charges no fees on gift cards", async () => {
    const quote = await quoteOrder(
      {
        tickets: {
          kind: "gift-card",
          giftCard: {
            designId: "gc-rose",
            amountPaise: 100_000,
            recipientName: "Priya Roy",
            recipientContact: "priya@example.com",
          },
        },
        food: [],
      },
      NOW,
    );

    expect(quote.amounts.convenienceFeePaise).toBe(0);
    expect(quote.amounts.gstPaise).toBe(0);
    expect(quote.amounts.totalPaise).toBe(100_000);
  });
});

describe("evaluateCoupon", () => {
  const ctx = { tickets: tickets(), foodPaise: 0, now: NOW };

  it("caps a percentage discount at maxDiscount", () => {
    const show50 = coupon({ code: "SHOW50", percentBps: 5000, maxDiscountPaise: 15_000, minOrderPaise: 30_000 });
    expect(evaluateCoupon(show50, ctx)).toEqual({ discountPaise: 15_000 });
  });

  it("rejects an order below the minimum", () => {
    const show50 = coupon({ code: "SHOW50", percentBps: 5000, maxDiscountPaise: 15_000, minOrderPaise: 30_000 });
    const result = evaluateCoupon(show50, { ...ctx, tickets: tickets({ ticketsPaise: 25_000 }) });
    expect(result).toEqual({ error: "SHOW50 needs a minimum ticket value of ₹300." });
  });

  it("applies a flat discount", () => {
    expect(evaluateCoupon(coupon({ kind: "flat", flatPaise: 7_500 }), ctx)).toEqual({ discountPaise: 7_500 });
  });

  it("never discounts more than the base it applies to", () => {
    const result = evaluateCoupon(coupon({ kind: "flat", flatPaise: 18_000, appliesTo: "food" }), {
      ...ctx,
      foodPaise: 12_000,
    });
    expect(result).toEqual({ discountPaise: 12_000 });
  });

  it("rejects an expired coupon", () => {
    const expired = coupon({ code: "OLD", validUntil: "2026-10-01T00:00:00+05:30" });
    expect(evaluateCoupon(expired, ctx)).toEqual({ error: "OLD has expired." });
  });

  it("rejects coupons on gift cards", () => {
    const result = evaluateCoupon(coupon({}), { ...ctx, tickets: tickets({ kind: "gift-card" }) });
    expect(result).toEqual({ error: "Coupons cannot be applied to gift cards." });
  });
});
