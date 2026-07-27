// Casa Playa — bookable catalog, transcribed 1:1 from the existing
// (Travelotopos) booking engine: titles, prices, inclusions and time slots.
//
// This file is the source of truth for seeding (`prisma/seed.ts`). Once the
// database is provisioned the app reads the catalog from Postgres; re-running
// the seed upserts any change made here.
//
// TODO (client input, see open questions):
//   - dailyCapacity per product (how many beds/cabanas per row are sellable)
//   - slotCapacity for the restaurant (persons per half-hour slot)
//   - whether the restaurant table is prepaid (old site shows no price)
//   - product photos (imageUrl) — exported from the old site

/** Half-hour slots from `from` to `to`, inclusive. `("09:00", "12:00")` → 7 slots. */
export function halfHourSlots(from: string, to: string): string[] {
  const toMinutes = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };
  const slots: string[] = [];
  for (let m = toMinutes(from); m <= toMinutes(to); m += 30) {
    const h = Math.floor(m / 60);
    slots.push(`${String(h).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`);
  }
  return slots;
}

export type CatalogVariant = {
  /** Header above the slot grid, e.g. "Cabana Beach Bed", "Seafood Menu". */
  name: string;
  nameEn: string;
  slots: string[];
  /** Persons/units per slot; null = no per-slot limit (uses dailyCapacity). */
  slotCapacity: number | null;
};

export type CatalogProduct = {
  slug: string;
  type: "LOUNGER" | "CABANA" | "TABLE";
  subtype: string | null;
  /** Exact title shown on the old site's list and product page. */
  title: string;
  titleEn: string;
  name: string;
  nameEn: string;
  /** VAT-inclusive unit price in cents. 0 = no price shown / no prepayment. */
  priceCents: number;
  pricingUnit: "PER_SET" | "PER_PERSON";
  includes: string[];
  includesEn: string[];
  note: string | null;
  noteEn: string | null;
  imageUrl: string | null;
  dailyCapacity: number | null;
  minQty: number;
  maxQty: number | null;
  requiresSlot: boolean;
  /** ARRIVAL = all-day booking, slot is just the arrival time. */
  slotKind: "ARRIVAL" | "RESERVATION";
  sortOrder: number;
  variants: CatalogVariant[];
};

/** Beds: arrival times 09:00–12:00 every half hour. */
const BED_SLOTS = halfHourSlots("09:00", "12:00");
/** Restaurant: reservation times 11:00–18:00 every half hour. */
const RESTAURANT_SLOTS = halfHourSlots("11:00", "18:00");

const WIFI_TOWEL_EL = ["Wi-Fi", "ατομική πετσέτα", "αποδυτήριο & ντους"];
const WIFI_TOWEL_EN = ["Wi-Fi", "personal towel", "changing room & shower"];
const WIFI_ONLY_EL = ["Wi-Fi", "αποδυτήριο & ντους"];
const WIFI_ONLY_EN = ["Wi-Fi", "changing room & shower"];

const ALL_DAY_NOTE_EL =
  "Η κράτηση ισχύει για όλη την ημέρα (χωρίς χρονικό διάστημα).";
const ALL_DAY_NOTE_EN =
  "The booking is valid for the whole day (no time limit).";

export const catalog: CatalogProduct[] = [
  {
    slug: "cabana-beach-bed-1st-row",
    type: "CABANA",
    subtype: "1st Row",
    title: "Book a Cabana Beach Bed 1st Row",
    titleEn: "Book a Cabana Beach Bed 1st Row",
    name: "Cabana Beach Bed 1st Row",
    nameEn: "Cabana Beach Bed 1st Row",
    priceCents: 7000,
    pricingUnit: "PER_SET",
    includes: WIFI_TOWEL_EL,
    includesEn: WIFI_TOWEL_EN,
    note: ALL_DAY_NOTE_EL,
    noteEn: ALL_DAY_NOTE_EN,
    imageUrl: null,
    dailyCapacity: null,
    minQty: 1,
    maxQty: null,
    requiresSlot: true,
    slotKind: "ARRIVAL",
    sortOrder: 1,
    variants: [
      {
        name: "Cabana Beach Bed",
        nameEn: "Cabana Beach Bed",
        slots: BED_SLOTS,
        slotCapacity: null,
      },
    ],
  },
  {
    slug: "seaside-sun-bed-1st-row",
    type: "LOUNGER",
    subtype: "1st Row",
    title: "Book a Seaside Sun Bed 1st Row",
    titleEn: "Book a Seaside Sun Bed 1st Row",
    name: "Seaside Sun Bed 1st Row",
    nameEn: "Seaside Sun Bed 1st Row",
    priceCents: 5000,
    pricingUnit: "PER_SET",
    includes: WIFI_TOWEL_EL,
    includesEn: WIFI_TOWEL_EN,
    note: ALL_DAY_NOTE_EL,
    noteEn: ALL_DAY_NOTE_EN,
    imageUrl: null,
    dailyCapacity: null,
    minQty: 1,
    maxQty: null,
    requiresSlot: true,
    slotKind: "ARRIVAL",
    sortOrder: 2,
    variants: [
      {
        name: "Seaside Sun Bed",
        nameEn: "Seaside Sun Bed",
        slots: BED_SLOTS,
        slotCapacity: null,
      },
    ],
  },
  {
    slug: "seaside-sun-bed-2nd-row",
    type: "LOUNGER",
    subtype: "2nd Row",
    title: "Book a Seaside Sun Bed 2nd Row",
    titleEn: "Book a Seaside Sun Bed 2nd Row",
    name: "Seaside Sun Bed 2nd Row",
    nameEn: "Seaside Sun Bed 2nd Row",
    priceCents: 3500,
    pricingUnit: "PER_SET",
    includes: WIFI_ONLY_EL,
    includesEn: WIFI_ONLY_EN,
    note: ALL_DAY_NOTE_EL,
    noteEn: ALL_DAY_NOTE_EN,
    imageUrl: null,
    dailyCapacity: null,
    minQty: 1,
    maxQty: null,
    requiresSlot: true,
    slotKind: "ARRIVAL",
    sortOrder: 3,
    variants: [
      {
        name: "Seaside Sun Bed",
        nameEn: "Seaside Sun Bed",
        slots: BED_SLOTS,
        slotCapacity: null,
      },
    ],
  },
  {
    slug: "seaside-sun-bed-3rd-row",
    type: "LOUNGER",
    subtype: "3rd Row",
    title: "Book a Seaside Sun Bed 3rd Row",
    titleEn: "Book a Seaside Sun Bed 3rd Row",
    name: "Seaside Sun Bed 3rd Row",
    nameEn: "Seaside Sun Bed 3rd Row",
    priceCents: 3500,
    pricingUnit: "PER_SET",
    includes: WIFI_ONLY_EL,
    includesEn: WIFI_ONLY_EN,
    note: ALL_DAY_NOTE_EL,
    noteEn: ALL_DAY_NOTE_EN,
    imageUrl: null,
    dailyCapacity: null,
    minQty: 1,
    maxQty: null,
    requiresSlot: true,
    slotKind: "ARRIVAL",
    sortOrder: 4,
    variants: [
      {
        name: "Seaside Sun Bed",
        nameEn: "Seaside Sun Bed",
        slots: BED_SLOTS,
        slotCapacity: null,
      },
    ],
  },
  {
    slug: "private-restaurant-area",
    type: "TABLE",
    subtype: null,
    title: "Book a table Private Restaurant Area",
    titleEn: "Book a table Private Restaurant Area",
    name: "Private Restaurant Area",
    nameEn: "Private Restaurant Area",
    // The old site shows no price on the restaurant slots — the table is
    // reserved without prepayment. Confirm with the client.
    priceCents: 0,
    pricingUnit: "PER_PERSON",
    includes: [],
    includesEn: [],
    note: null,
    noteEn: null,
    imageUrl: null,
    dailyCapacity: null,
    minQty: 1,
    maxQty: null,
    requiresSlot: true,
    slotKind: "RESERVATION",
    sortOrder: 5,
    variants: [
      {
        name: "Seafood Menu",
        nameEn: "Seafood Menu",
        slots: RESTAURANT_SLOTS,
        slotCapacity: null,
      },
      {
        name: "Meat Menu",
        nameEn: "Meat Menu",
        slots: RESTAURANT_SLOTS,
        slotCapacity: null,
      },
    ],
  },
];

export function findProduct(slug: string): CatalogProduct | undefined {
  return catalog.find((p) => p.slug === slug);
}

/** Pick the English or Greek copy of a product for the given locale. */
export function localizeProduct(product: CatalogProduct, locale: string) {
  const en = locale === "en";
  return {
    ...product,
    title: en ? product.titleEn : product.title,
    name: en ? product.nameEn : product.name,
    includes: en ? product.includesEn : product.includes,
    note: en ? product.noteEn : product.note,
    variants: product.variants.map((variant) => ({
      ...variant,
      name: en ? variant.nameEn : variant.name,
    })),
  };
}
