/** All money is stored as integer paise (₹1 = 100). These helpers only format at the edge. */

const wholeRupees = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const withPaise = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** ₹1,080 for whole rupees, ₹1,181.95 when there are paise. Pass `exact` to always show paise. */
export function formatINR(paise: number, options: { exact?: boolean } = {}): string {
  const showPaise = options.exact || paise % 100 !== 0;
  return (showPaise ? withPaise : wholeRupees).format(paise / 100);
}

export function rupeesToPaise(rupees: number): number {
  return Math.round(rupees * 100);
}

/** "₹999 - ₹4,999", or a single price when min and max match. */
export function formatPriceRange(minPaise: number, maxPaise: number): string {
  if (minPaise === maxPaise) return formatINR(minPaise);
  return `${formatINR(minPaise)} - ${formatINR(maxPaise)}`;
}
