import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { Manrope } from "next/font/google";
import { routing } from "@/i18n/routing";
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

export const metadata: Metadata = {
  title: "Casa Playa — Κρατήσεις",
  description:
    "Online κρατήσεις για ξαπλώστρες, cabanas και τραπέζια εστιατορίου στην Casa Playa, Ζάκυνθος.",
};

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
          {children}
          {/* Every page: the scheme rules want the merchant identity and the
              terms reachable from wherever the customer is. */}
          <SiteFooter />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
