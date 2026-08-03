import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { localeMetadata } from "@/i18n/alternates";
import { getProduct } from "@/lib/catalog";
import { BookingForm } from "@/components/booking-form";
import { PANEL } from "@/components/panel";

export const dynamic = "force-dynamic";

// The product's own name in the tab, plus the hreflang set. A booking page per
// product per language is exactly what a search for "Zakynthos cabana buchen"
// should be able to land on.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) return {};

  const product = await getProduct(slug, locale);
  if (!product) return {};

  return {
    title: `${product.title} — Casa Playa`,
    ...localeMetadata(`/book/${slug}`, locale),
  };
}

export default async function BookProductPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  // The layout has already rejected an unknown locale; repeating the check here
  // is what narrows `string` to `Locale` for the form, which formats dates.
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const product = await getProduct(slug, locale);
  if (!product) notFound();

  const c = await getTranslations("catalog");
  const common = await getTranslations("common");

  // No "← Home" link: the logo in the header already goes there, and a
  // breadcrumb above the title only pushes the calendar further down on the
  // phone screen where most of these bookings are made.
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
      <div className={`${PANEL} p-6 sm:p-8`}>
        <h1 className="text-3xl font-semibold text-amber-600">
          {common("brand")} | {product.title}
        </h1>

        <div className="mt-8">
          <BookingForm product={product} locale={locale} />
        </div>
      </div>

      {/* What is included, the VAT line and the product note sit below the
          form, not above it. The customer arrives here having just read all
          three on the home page, so leading with them again only delays the
          one thing this page exists for — picking a date. */}
      <section className={`${PANEL} mt-8 p-6 sm:p-8`}>
        {product.includes.length > 0 && (
          <>
            <p className="font-medium underline underline-offset-4">
              {c("includedInPrice")}
            </p>
            <p className="mt-1 text-neutral-700">{product.includes.join(", ")}</p>
          </>
        )}

        <p className="mt-4 text-sm text-neutral-600">{c("vatNote")}</p>
        {product.note && (
          <p className="mt-1 text-sm text-neutral-600">{product.note}</p>
        )}
      </section>
    </main>
  );
}
