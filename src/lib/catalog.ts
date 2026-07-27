import { prisma } from "./prisma";
import { catalog as staticCatalog, localizeProduct } from "@/data/catalog";

// Reading the catalog for display. The database is authoritative (staff will
// edit it from the admin panel); `src/data/catalog.ts` is the seed and doubles
// as a fallback so the site still renders if the database is unreachable.

export interface DisplayVariant {
  id: string | null; // null when served from the static fallback
  name: string;
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
  minQty: number;
  maxQty: number | null;
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
        minQty: l.minQty,
        maxQty: l.maxQty,
        requiresSlot: l.requiresSlot,
        variants: l.variants.map((v) => ({
          id: null,
          name: v.name,
          slots: v.slots,
        })),
      };
    });
}

export async function listProducts(locale: string): Promise<DisplayProduct[]> {
  const en = locale === "en";
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
      minQty: p.minQty,
      maxQty: p.maxQty,
      requiresSlot: p.requiresSlot,
      variants: p.variants.map((v) => ({
        id: v.id,
        name: (en && v.nameEn) || v.name,
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
