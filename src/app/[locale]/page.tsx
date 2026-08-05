import type { Metadata } from "next";
import Image from "next/image";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { localeMetadata } from "@/i18n/alternates";
import { PANEL } from "@/components/panel";
import { listProducts, fromPriceCents } from "@/lib/catalog";
import { formatPrice } from "@/lib/money";

export const dynamic = "force-dynamic";

// Title and description come from the layout; this adds only the hreflang set.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return localeMetadata("/", locale);
}

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const c = await getTranslations("catalog");
  const common = await getTranslations("common");

  const products = await listProducts(locale);

  return (
    <main className="flex-1">
      {/* No hero copy: the footage says where you are, and the list below says
          what there is to book. The space is what lets the video be seen. */}
      {/* One card per product rather than one slab with hairlines through it.
          As a single panel the list ran from the top of the page to the footer
          edge to edge, so below the first screen the only video left to see was
          the 24px gutters — the footage was playing behind an unbroken sheet of
          white. Separate cards put a full-width band of it between every
          product, the whole way down. */}
      <section className="mx-auto max-w-5xl px-6 pb-24 pt-16 sm:pt-28">
        <ul className="space-y-5">
          {products.map((product) => (
            <li
              key={product.slug}
              className={`${PANEL} flex flex-col gap-5 p-6 sm:flex-row sm:items-start`}
            >
              {product.imageUrl ? (
                <Image
                  src={product.imageUrl}
                  alt={product.name}
                  width={384}
                  height={256}
                  className="h-32 w-full shrink-0 rounded-xl object-cover sm:w-48"
                />
              ) : (
                <div className="h-32 w-full shrink-0 rounded-xl bg-neutral-100 sm:w-48" />
              )}

              <div className="flex-1">
                <h3 className="text-xl font-semibold text-sky-800">
                  {product.title}
                </h3>

                {product.includes.length > 0 && (
                  <>
                    <p className="mt-3 font-medium underline underline-offset-4">
                      {c("includedInPrice")}
                    </p>
                    <p className="mt-1 text-sm text-neutral-700">
                      {product.includes.join(", ")}
                    </p>
                  </>
                )}

                <p className="mt-3 text-sm text-neutral-600">{c("vatNote")}</p>
                {product.note && (
                  <p className="mt-1 text-sm text-neutral-600">{product.note}</p>
                )}
              </div>

              <div className="flex shrink-0 flex-col items-start gap-3 sm:items-end">
                <p className="text-xl font-semibold text-amber-600">
                  {fromPriceCents(product) > 0 ? (
                    <>
                      {product.pricingUnit === "PER_PERSON" && (
                        <span className="mr-1 text-sm font-normal text-neutral-600">
                          {c("from")}
                        </span>
                      )}
                      {formatPrice(fromPriceCents(product))}
                      {product.pricingUnit === "PER_PERSON" && (
                        <span className="ml-1 text-sm font-normal text-neutral-600">
                          / {common("perPerson")}
                        </span>
                      )}
                    </>
                  ) : (
                    c("noPrepayment")
                  )}
                </p>
                <Link
                  href={`/book/${product.slug}`}
                  className="rounded-lg bg-amber-500 px-6 py-2 font-medium text-white transition hover:bg-amber-600"
                >
                  {common("book")}
                </Link>
              </div>
            </li>
          ))}
        </ul>
      </section>

    </main>
  );
}
