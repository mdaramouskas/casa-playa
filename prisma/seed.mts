// Seeds the catalog from `src/data/catalog.ts` into the database.
// Idempotent: re-run it after editing the catalog to push changes.
//
//   npm run db:seed
//
// Runs on Node's native TypeScript support (type stripping) — no ts-node.

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { catalog } from "../src/data/catalog.ts";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("Missing DATABASE_URL — copy .env.example to .env first.");
}

const sslMode = process.env.PGSSLMODE;
const ssl =
  sslMode === "require" ||
  sslMode === "verify-ca" ||
  sslMode === "verify-full" ||
  sslMode === "no-verify"
    ? { rejectUnauthorized: sslMode !== "no-verify" }
    : undefined;

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString, ssl, max: 1 }),
});

async function main() {
  for (const item of catalog) {
    const { variants, ...fields } = item;

    const product = await prisma.product.upsert({
      where: { slug: item.slug },
      create: fields,
      update: fields,
    });

    for (const [index, variant] of variants.entries()) {
      const saved = await prisma.productVariant.upsert({
        where: { productId_name: { productId: product.id, name: variant.name } },
        create: {
          productId: product.id,
          name: variant.name,
          nameEn: variant.nameEn,
          priceCents: variant.priceCents,
          sortOrder: index,
        },
        update: {
          nameEn: variant.nameEn,
          priceCents: variant.priceCents,
          sortOrder: index,
          active: true,
        },
      });

      for (const [slotIndex, time] of variant.slots.entries()) {
        await prisma.timeSlot.upsert({
          where: { variantId_time: { variantId: saved.id, time } },
          create: { variantId: saved.id, time, sortOrder: slotIndex },
          update: { sortOrder: slotIndex, active: true },
        });
      }

      // Drop slots that were removed from the catalog.
      await prisma.timeSlot.deleteMany({
        where: { variantId: saved.id, time: { notIn: variant.slots } },
      });
    }

    // Drop variants that were removed from the catalog.
    await prisma.productVariant.deleteMany({
      where: { productId: product.id, name: { notIn: variants.map((v) => v.name) } },
    });

    console.log(
      `✓ ${item.slug} — ${variants.length} variant(s), ` +
        `${variants.reduce((n, v) => n + v.slots.length, 0)} slot(s)`,
    );
  }

  console.log(`\nSeeded ${catalog.length} products.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
