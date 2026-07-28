// Turns "how many people" into units, priced lines and a total.
//
// Sunbeds: a set seats 2. A third person gets an extra lounger at half the set
// price and does NOT consume one of the row's sets — those loungers come from
// the spare umbrellas. So 3 people = 1 set + 1 extra, 4 = 2 sets, 5 = 2 sets +
// 1 extra. Cabanas take no extra person.
//
// Restaurant: people are priced per menu (Seafood 75€, Meat 70€) and one table
// seats up to 10, so a booking may mix menus on the same table.

export type LineKind = "SET" | "EXTRA_PERSON" | "PERSON" | "TABLE";

export interface PricingProduct {
  name: string;
  priceCents: number;
  pricingUnit: "PER_SET" | "PER_PERSON";
  extraPersonPriceCents: number | null;
  allowExtraPerson: boolean;
  personsPerUnit: number;
}

export interface VariantSelection {
  variantId?: string | null;
  name: string;
  /** Per-person price of the variant; null = fall back to the product price. */
  priceCents: number | null;
  persons: number;
}

export interface QuoteLine {
  kind: LineKind;
  label: string;
  variantId: string | null;
  quantity: number;
  unitPriceCents: number;
  totalCents: number;
}

export interface Quote {
  persons: number;
  /** Units held against capacity: bed sets or tables. */
  units: number;
  /** Extra loungers (0 or 1) — priced, but not counted against capacity. */
  extraPersons: number;
  lines: QuoteLine[];
  subtotalCents: number;
}

/** Sets consumed by `persons`, and whether an extra lounger is needed. */
export function splitPersons(
  persons: number,
  product: Pick<PricingProduct, "allowExtraPerson" | "personsPerUnit">,
): { units: number; extraPersons: number } {
  if (persons < 1) return { units: 0, extraPersons: 0 };

  if (product.allowExtraPerson) {
    const units = Math.max(1, Math.floor(persons / 2));
    return { units, extraPersons: Math.max(0, persons - units * 2) };
  }
  return {
    units: Math.ceil(persons / product.personsPerUnit),
    extraPersons: 0,
  };
}

export function quoteBooking(
  product: PricingProduct,
  selections: VariantSelection[],
): Quote {
  const chosen = selections.filter((s) => s.persons > 0);
  const persons = chosen.reduce((sum, s) => sum + s.persons, 0);
  const { units, extraPersons } = splitPersons(persons, product);
  const lines: QuoteLine[] = [];

  if (product.pricingUnit === "PER_SET") {
    const variant = chosen[0] ?? selections[0];
    lines.push({
      kind: "SET",
      label: product.name,
      variantId: variant?.variantId ?? null,
      quantity: units,
      unitPriceCents: product.priceCents,
      totalCents: units * product.priceCents,
    });
    if (extraPersons > 0 && product.extraPersonPriceCents !== null) {
      lines.push({
        kind: "EXTRA_PERSON",
        label: "extraPerson",
        variantId: variant?.variantId ?? null,
        quantity: extraPersons,
        unitPriceCents: product.extraPersonPriceCents,
        totalCents: extraPersons * product.extraPersonPriceCents,
      });
    }
  } else {
    for (const selection of chosen) {
      const unitPrice = selection.priceCents ?? product.priceCents;
      lines.push({
        kind: unitPrice > 0 ? "PERSON" : "TABLE",
        label: selection.name,
        variantId: selection.variantId ?? null,
        quantity: selection.persons,
        unitPriceCents: unitPrice,
        totalCents: selection.persons * unitPrice,
      });
    }
  }

  return {
    persons,
    units,
    extraPersons,
    lines,
    subtotalCents: lines.reduce((sum, line) => sum + line.totalCents, 0),
  };
}
