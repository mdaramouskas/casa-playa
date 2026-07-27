import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getProduct } from "@/lib/catalog";
import { BookingForm } from "@/components/booking-form";

export const dynamic = "force-dynamic";

export default async function BookProductPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const product = await getProduct(slug, locale);
  if (!product) notFound();

  const c = await getTranslations("catalog");
  const nav = await getTranslations("nav");
  const common = await getTranslations("common");

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
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

      <div className="mt-10">
        <BookingForm product={product} locale={locale} />
      </div>
    </main>
  );
}
