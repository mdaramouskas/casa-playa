// Casa Playa — bookable catalog. Titles, inclusions and bed slots come from the
// legacy (Travelotopos) booking engine; capacities, the extra-person rule, the
// restaurant menu prices and the Restaurant Area product come from the client
// (2026-07-28).
//
// This file is the source of truth for seeding (`prisma/seed.mts`). Once the
// database is provisioned the app reads the catalog from Postgres; re-running
// the seed upserts any change made here.
//
// TODO (still open): product photos, exported from the old site.

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
  /** Per-person price when the variant is priced; null = use the product price. */
  priceCents: number | null;
  slots: string[];
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
  /** VAT-inclusive price of one unit (set / person). 0 = no charge. */
  priceCents: number;
  pricingUnit: "PER_SET" | "PER_PERSON";
  /** Extra 3rd person on a sunbed set = one more lounger at half the set price. */
  extraPersonPriceCents: number | null;
  allowExtraPerson: boolean;
  /** People covered by one unit (bed set 2, private table 10, table 4). */
  personsPerUnit: number;
  maxPersons: number | null;
  /** May the people of one booking be split across variants (menus)? */
  allowMixedVariants: boolean;
  /** Units per day (all-day products) / per slot (tables). */
  dailyCapacity: number | null;
  slotCapacity: number | null;
  /** Minutes a booking holds a table (150 = 2.5h); null = the whole day. */
  occupancyMinutes: number | null;
  includes: string[];
  includesEn: string[];
  note: string | null;
  noteEn: string | null;
  imageUrl: string | null;
  requiresSlot: boolean;
  /** ARRIVAL = all-day booking, slot is just the arrival time. */
  slotKind: "ARRIVAL" | "RESERVATION";
  sortOrder: number;
  variants: CatalogVariant[];
};

/** Beds: arrival times 09:00–12:00 every half hour. */
const BED_SLOTS = halfHourSlots("09:00", "12:00");
/** Restaurant: reservation times 13:00–18:00 every half hour. */
const RESTAURANT_SLOTS = halfHourSlots("13:00", "18:00");
/** A restaurant booking holds its table for 2.5 hours. */
const TABLE_OCCUPANCY_MINUTES = 150;

const WIFI_TOWEL_EL = ["Wi-Fi", "ατομική πετσέτα", "αποδυτήριο & ντους"];
const WIFI_TOWEL_EN = ["Wi-Fi", "personal towel", "changing room & shower"];
const WIFI_ONLY_EL = ["Wi-Fi", "αποδυτήριο & ντους"];
const WIFI_ONLY_EN = ["Wi-Fi", "changing room & shower"];

const ALL_DAY_NOTE_EL =
  "Η κράτηση ισχύει για όλη την ημέρα (χωρίς χρονικό διάστημα).";
const ALL_DAY_NOTE_EN =
  "The booking is valid for the whole day (no time limit).";

/** Shared shape of the three sunbed rows — they differ only in price and count. */
function sunBedRow(options: {
  slug: string;
  row: string;
  priceCents: number;
  includes: string[];
  includesEn: string[];
  sortOrder: number;
}): CatalogProduct {
  return {
    slug: options.slug,
    type: "LOUNGER",
    subtype: options.row,
    title: `Book a Seaside Sun Bed ${options.row}`,
    titleEn: `Book a Seaside Sun Bed ${options.row}`,
    name: `Seaside Sun Bed ${options.row}`,
    nameEn: `Seaside Sun Bed ${options.row}`,
    priceCents: options.priceCents,
    pricingUnit: "PER_SET",
    // The 3rd person gets an extra lounger at half the set price and does not
    // consume one of the 25 sets — those loungers come from the spare umbrellas.
    extraPersonPriceCents: options.priceCents / 2,
    allowExtraPerson: true,
    personsPerUnit: 2,
    maxPersons: null,
    allowMixedVariants: false,
    dailyCapacity: 25,
    slotCapacity: null,
    occupancyMinutes: null,
    includes: options.includes,
    includesEn: options.includesEn,
    note: ALL_DAY_NOTE_EL,
    noteEn: ALL_DAY_NOTE_EN,
    imageUrl: `/products/${options.slug}.jpg`,
    requiresSlot: true,
    slotKind: "ARRIVAL",
    sortOrder: options.sortOrder,
    variants: [
      {
        name: "Seaside Sun Bed",
        nameEn: "Seaside Sun Bed",
        priceCents: null,
        slots: BED_SLOTS,
      },
    ],
  };
}

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
    extraPersonPriceCents: null, // no extra person on a cabana
    allowExtraPerson: false,
    personsPerUnit: 2,
    maxPersons: null,
    allowMixedVariants: false,
    dailyCapacity: 8,
    slotCapacity: null,
    occupancyMinutes: null,
    includes: WIFI_TOWEL_EL,
    includesEn: WIFI_TOWEL_EN,
    note: ALL_DAY_NOTE_EL,
    noteEn: ALL_DAY_NOTE_EN,
    imageUrl: "/products/cabana-beach-bed-1st-row.jpg",
    requiresSlot: true,
    slotKind: "ARRIVAL",
    sortOrder: 1,
    variants: [
      {
        name: "Cabana Beach Bed",
        nameEn: "Cabana Beach Bed",
        priceCents: null,
        slots: BED_SLOTS,
      },
    ],
  },
  sunBedRow({
    slug: "seaside-sun-bed-1st-row",
    row: "1st Row",
    priceCents: 5000,
    includes: WIFI_TOWEL_EL,
    includesEn: WIFI_TOWEL_EN,
    sortOrder: 2,
  }),
  sunBedRow({
    slug: "seaside-sun-bed-2nd-row",
    row: "2nd Row",
    priceCents: 3500,
    includes: WIFI_ONLY_EL,
    includesEn: WIFI_ONLY_EN,
    sortOrder: 3,
  }),
  sunBedRow({
    slug: "seaside-sun-bed-3rd-row",
    row: "3rd Row",
    priceCents: 3500,
    includes: WIFI_ONLY_EL,
    includesEn: WIFI_ONLY_EN,
    sortOrder: 4,
  }),
  {
    slug: "private-restaurant-area",
    type: "TABLE",
    subtype: null,
    title: "Book a table Private Restaurant Area",
    titleEn: "Book a table Private Restaurant Area",
    name: "Private Restaurant Area",
    nameEn: "Private Restaurant Area",
    priceCents: 0, // priced per menu, on the variants
    pricingUnit: "PER_PERSON",
    extraPersonPriceCents: null,
    allowExtraPerson: false,
    personsPerUnit: 10, // up to 10 people per table
    maxPersons: 10,
    allowMixedVariants: true, // e.g. 4 × Seafood + 6 × Meat on one table
    dailyCapacity: null,
    slotCapacity: 5, // 5 tables, shared between the two menus
    occupancyMinutes: TABLE_OCCUPANCY_MINUTES,
    includes: [],
    includesEn: [],
    note: "Κάθε κράτηση κρατά το τραπέζι για 2,5 ώρες. Έως 10 άτομα ανά τραπέζι.",
    noteEn:
      "Each booking holds the table for 2.5 hours. Up to 10 people per table.",
    imageUrl: "/products/private-restaurant-area.jpg",
    requiresSlot: true,
    slotKind: "RESERVATION",
    sortOrder: 5,
    variants: [
      {
        name: "Seafood Menu",
        nameEn: "Seafood Menu",
        priceCents: 7500,
        slots: RESTAURANT_SLOTS,
      },
      {
        name: "Meat Menu",
        nameEn: "Meat Menu",
        priceCents: 7000,
        slots: RESTAURANT_SLOTS,
      },
    ],
  },
  {
    slug: "restaurant-area",
    type: "TABLE",
    subtype: null,
    title: "Book a table Restaurant Area",
    titleEn: "Book a table Restaurant Area",
    name: "Restaurant Area",
    nameEn: "Restaurant Area",
    priceCents: 0, // plain reservation, nothing is charged
    pricingUnit: "PER_PERSON",
    extraPersonPriceCents: null,
    allowExtraPerson: false,
    personsPerUnit: 4,
    maxPersons: 4,
    allowMixedVariants: false,
    dailyCapacity: null,
    slotCapacity: 20, // 20 tables of 4
    occupancyMinutes: TABLE_OCCUPANCY_MINUTES,
    includes: [],
    includesEn: [],
    note: "Τραπέζια έως 4 ατόμων. Για μεγαλύτερες παρέες επικοινωνήστε μαζί μας.",
    noteEn: "Tables for up to 4. For larger parties please contact us.",
    imageUrl: "/products/restaurant-area.jpg",
    requiresSlot: true,
    slotKind: "RESERVATION",
    sortOrder: 6,
    variants: [
      {
        name: "Restaurant Area",
        nameEn: "Restaurant Area",
        priceCents: null,
        slots: RESTAURANT_SLOTS,
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
