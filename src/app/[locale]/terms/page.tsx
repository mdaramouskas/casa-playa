import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { localeMetadata } from "@/i18n/alternates";
import { LegalPage } from "@/components/legal-page";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "terms" });
  return {
    title: `${t("title")} — Casa Playa`,
    ...localeMetadata("/terms", locale),
  };
}

export default async function TermsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <LegalPage namespace="terms" />;
}
