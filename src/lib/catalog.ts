import { prisma } from "./prisma";
import { catalog as staticCatalog, localizeProduct } from "@/data/catalog";

// Reading the catalog for display. The database is authoritative (staff will
// edit it from the admin panel); `src/data/catalog.ts` is the seed and doubles
// as a fallback so the site still renders if the database is unreachable.

export interface DisplayVariant {
  id: string | null; // null when served from the static fallback
  name: string;
  /** Per-person price; null = use the product price. */
  priceCents: number | null;
  slots: string[];
}

export interface DisplayProduct {
  slug: string;
  title: string;
  name: string;
  includes: string[];
  note: string | null;
  imageUrl: string | null;
  priceCents: number;
  pricingUnit: "PER_SET" | "PER_PERSON";
  extraPersonPriceCents: number | null;
  allowExtraPerson: boolean;
  personsPerUnit: number;
  maxPersons: number | null;
  allowMixedVariants: boolean;
  occupancyMinutes: number | null;
  minQty: number;
  requiresSlot: boolean;
  variants: DisplayVariant[];
}

function fromStatic(locale: string): DisplayProduct[] {
  return [...staticCatalog]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((product) => {
      const l = localizeProduct(product, locale);
      return {
        slug: l.slug,
        title: l.title,
        name: l.name,
        includes: l.includes,
        note: l.note,
        imageUrl: l.imageUrl,
        priceCents: l.priceCents,
        pricingUnit: l.pricingUnit,
        extraPersonPriceCents: l.extraPersonPriceCents,
        allowExtraPerson: l.allowExtraPerson,
        personsPerUnit: l.personsPerUnit,
        maxPersons: l.maxPersons,
        allowMixedVariants: l.allowMixedVariants,
        occupancyMinutes: l.occupancyMinutes,
        minQty: 1,
        requiresSlot: l.requiresSlot,
        variants: l.variants.map((v) => ({
          id: null,
          name: v.name,
          priceCents: v.priceCents,
          slots: v.slots,
        })),
      };
    });
}

export async function listProducts(locale: string): Promise<DisplayProduct[]> {
  // Greek for Greek, English for every other language — same two-language
  // catalog and the same reasoning as `localizeProduct`.
  const en = locale !== "el";
  try {
    const rows = await prisma.product.findMany({
      where: { active: true },
      orderBy: { sortOrder: "asc" },
      include: {
        variants: {
          where: { active: true },
          orderBy: { sortOrder: "asc" },
          include: {
            timeSlots: {
              where: { active: true },
              orderBy: { sortOrder: "asc" },
            },
          },
        },
      },
    });
    if (rows.length === 0) return fromStatic(locale);

    return rows.map((p) => ({
      slug: p.slug,
      title: (en && p.titleEn) || p.title,
      name: (en && p.nameEn) || p.name,
      includes: en ? p.includesEn : p.includes,
      note: (en ? p.noteEn : p.note) ?? null,
      imageUrl: p.imageUrl,
      priceCents: p.priceCents,
      pricingUnit: p.pricingUnit,
      extraPersonPriceCents: p.extraPersonPriceCents,
      allowExtraPerson: p.allowExtraPerson,
      personsPerUnit: p.personsPerUnit,
      maxPersons: p.maxPersons,
      allowMixedVariants: p.allowMixedVariants,
      occupancyMinutes: p.occupancyMinutes,
      minQty: p.minQty,
      requiresSlot: p.requiresSlot,
      variants: p.variants.map((v) => ({
        id: v.id,
        name: (en && v.nameEn) || v.name,
        priceCents: v.priceCents,
        slots: v.timeSlots.map((s) => s.time),
      })),
    }));
  } catch (error) {
    console.error("[catalog] database unavailable, using static catalog", error);
    return fromStatic(locale);
  }
}

export async function getProduct(
  slug: string,
  locale: string,
): Promise<DisplayProduct | undefined> {
  const products = await listProducts(locale);
  return products.find((p) => p.slug === slug);
}

/** Lowest per-person price across a product's variants, for the listing page. */
export function fromPriceCents(product: DisplayProduct): number {
  const variantPrices = product.variants
    .map((v) => v.priceCents)
    .filter((p): p is number => p !== null && p > 0);
  if (variantPrices.length > 0) return Math.min(...variantPrices);
  return product.priceCents;
}
