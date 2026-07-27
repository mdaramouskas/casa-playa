import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { catalog, findProduct, localizeProduct } from "@/data/catalog";
import { formatPrice } from "@/lib/money";

export function generateStaticParams() {
  return routing.locales.flatMap((locale) =>
    catalog.map((product) => ({ locale, slug: product.slug })),
  );
}

export default async function BookProductPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const found = findProduct(slug);
  if (!found) notFound();

  const product = localizeProduct(found, locale);
  const c = await getTranslations("catalog");
  const nav = await getTranslations("nav");
  const common = await getTranslations("common");

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-12">
      <Link href="/" className="text-sm text-sky-700 hover:underline">
        ← {nav("home")}
      </Link>

      <h1 className="mt-4 text-3xl font-semibold text-amber-600">
        {common("brand")} | {product.title}
      </h1>

      {product.includes.length > 0 && (
        <div className="mt-6">
          <p className="font-medium underline underline-offset-4">
            {c("includedInPrice")}
          </p>
          <p className="mt-1 text-neutral-700">{product.includes.join(", ")}</p>
        </div>
      )}

      <p className="mt-4 text-sm text-neutral-600">{c("vatNote")}</p>
      {product.note && (
        <p className="mt-1 text-sm text-neutral-600">{product.note}</p>
      )}

      <div className="mt-10 space-y-8">
        {product.variants.map((variant) => (
          <section key={variant.name}>
            <h2 className="rounded-t-xl bg-amber-500 px-6 py-4 text-center text-xl font-medium text-white">
              {variant.name}
            </h2>
            <div className="grid grid-cols-2 gap-4 rounded-b-xl border border-t-0 border-neutral-200 bg-white p-4 sm:grid-cols-4">
              {variant.slots.map((time) => (
                <div
                  key={time}
                  className="rounded-lg border border-neutral-200 px-4 py-3 text-center"
                >
                  <p className="text-neutral-800">{time}</p>
                  {product.priceCents > 0 && (
                    <p className="mt-1 text-sm text-neutral-600">
                      {c("from")}{" "}
                      <span className="font-semibold text-amber-600">
                        {formatPrice(product.priceCents)}
                      </span>
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      <p className="mt-10 rounded-xl bg-neutral-100 p-4 text-center text-sm text-neutral-600">
        {c("bookingSoon")}
      </p>
    </main>
  );
}
