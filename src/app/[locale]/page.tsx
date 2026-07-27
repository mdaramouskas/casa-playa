import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { catalog, localizeProduct } from "@/data/catalog";
import { formatPrice } from "@/lib/money";

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("home");
  const c = await getTranslations("catalog");
  const common = await getTranslations("common");

  const products = [...catalog]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((product) => localizeProduct(product, locale));

  return (
    <main className="flex-1">
      <section className="mx-auto max-w-4xl px-6 py-20 text-center">
        <p className="text-sm uppercase tracking-widest text-sky-700">
          {t("heroSubtitle")}
        </p>
        <h1 className="mt-3 text-5xl font-bold tracking-tight">
          {t("heroTitle")}
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-lg text-neutral-600">
          {t("heroLead")}
        </p>
      </section>

      <section className="mx-auto max-w-5xl px-6 pb-24">
        <h2 className="mb-8 text-center text-xl font-semibold">
          {t("chooseType")}
        </h2>

        <ul className="divide-y divide-neutral-200 rounded-2xl border border-neutral-200 bg-white shadow-sm">
          {products.map((product) => (
            <li
              key={product.slug}
              className="flex flex-col gap-5 p-6 sm:flex-row sm:items-start"
            >
              <div className="h-32 w-full shrink-0 rounded-xl bg-neutral-100 sm:w-48" />

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
                  {product.priceCents > 0
                    ? formatPrice(product.priceCents)
                    : c("noPrepayment")}
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
