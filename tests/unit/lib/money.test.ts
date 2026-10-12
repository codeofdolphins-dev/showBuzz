import { describe, expect, it } from "vitest";
import { formatINR, formatPriceRange, rupeesToPaise } from "@/lib/money";

describe("formatINR", () => {
  it("shows whole rupees without paise", () => {
    expect(formatINR(108_000)).toBe("₹1,080");
    expect(formatINR(0)).toBe("₹0");
  });

  it("shows paise when the amount has them", () => {
    expect(formatINR(118_195)).toBe("₹1,181.95");
  });

  it("always shows paise when exact is set", () => {
    expect(formatINR(108_000, { exact: true })).toBe("₹1,080.00");
  });

  it("groups digits the Indian way (lakhs)", () => {
    expect(formatINR(10_000_000)).toBe("₹1,00,000");
  });
});

describe("rupeesToPaise", () => {
  it("converts to integer paise without floating-point drift", () => {
    expect(rupeesToPaise(1181.95)).toBe(118_195);
    expect(rupeesToPaise(0.1 + 0.2)).toBe(30);
  });
});

describe("formatPriceRange", () => {
  it("shows a range when min and max differ", () => {
    expect(formatPriceRange(99_900, 499_900)).toBe("₹999 - ₹4,999");
  });

  it("shows a single price when min and max match", () => {
    expect(formatPriceRange(50_000, 50_000)).toBe("₹500");
  });
});
