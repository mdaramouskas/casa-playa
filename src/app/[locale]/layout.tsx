import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Manrope } from "next/font/google";
import { routing } from "@/i18n/routing";
import { appBaseUrl } from "@/lib/paycenter/config";
import { SiteBackground } from "@/components/site-background";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import "../globals.css";

// Exposed as --font-manrope, not --font-sans: globals.css declares --font-sans
// as a Tailwind theme token, and having both write the same custom property on
// :root left the winner up to source order.
const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin", "greek"],
  display: "swap",
});

// Per locale, not fixed: the tab title and the search-result snippet are the
// first thing a visitor reads, and a Greek title over a German page undoes the
// translation before they have seen any of it.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });

  return {
    // Every page's hreflang and canonical are written as relative paths and
    // resolved against this. One place to get the origin right — and it has to
    // be right: `APP_BASE_URL` is also what builds the Referrer URL registered
    // with Euronet, so a wrong value here means a wrong one there.
    metadataBase: new URL(appBaseUrl()),
    title: t("title"),
    description: t("description"),
  };
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);

  return (
    <html
      lang={locale}
      className={`${manrope.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <NextIntlClientProvider>
          {/* Fixed behind every page, not only the home page: the booking flow
              is one place, and the beach should not disappear the moment a
              customer picks a product. Each page floats its content on a panel
              from `components/panel.ts` so it stays readable over the video. */}
          <SiteBackground />
          <SiteHeader />
          {children}
          {/* Every page: the scheme rules want the merchant identity and the
              terms reachable from wherever the customer is. */}
          <SiteFooter />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
