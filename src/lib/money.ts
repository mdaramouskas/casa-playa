// Money & VAT helpers. All amounts are integer cents, VAT-INCLUSIVE (24%).

export const VAT_RATE = 0.24;
export const CURRENCY = "EUR";

/** Split a VAT-inclusive amount into net + VAT parts (for display/compliance). */
export function vatBreakdown(grossCents: number) {
  const netCents = Math.round(grossCents / (1 + VAT_RATE));
  const vatCents = grossCents - netCents;
  return { grossCents, netCents, vatCents };
}

/** Format cents as a localized EUR string. */
export function formatMoney(cents: number, locale: string = "el-GR") {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: CURRENCY,
  }).format(cents / 100);
}

/** Price as displayed on the site: `70.00€` (same format as the legacy engine). */
export function formatPrice(cents: number) {
  return `${(cents / 100).toFixed(2)}€`;
}

/** Apply a discount (percent and/or fixed cents) to a VAT-inclusive subtotal. */
export function applyDiscount(
  subtotalCents: number,
  opts: { percentOff?: number | null; amountOffCents?: number | null },
): { discountCents: number; totalCents: number } {
  let discount = 0;
  if (opts.percentOff) {
    discount += Math.round((subtotalCents * opts.percentOff) / 100);
  }
  if (opts.amountOffCents) {
    discount += opts.amountOffCents;
  }
  discount = Math.min(discount, subtotalCents);
  return { discountCents: discount, totalCents: subtotalCents - discount };
}
