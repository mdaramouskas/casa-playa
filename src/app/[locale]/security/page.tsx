import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { localeMetadata } from "@/i18n/alternates";
import { AcceptedCards, SecureBadges } from "@/components/payment-badges";
import { READING_PANEL } from "@/components/panel";

// Redirection Manual §8 calls out "η σελίδα που αναφέρεται σε θέματα ασφάλειας"
// as a second place the 3-D Secure marks have to appear. This is that page, so
// it must keep both mark rows even if the copy around them changes.

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "security" });
  return {
    title: `${t("title")} — Casa Playa`,
    ...localeMetadata("/security", locale),
  };
}

export default async function SecurityPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("security");

  const sections = [
    { title: t("threeDsTitle"), body: t("threeDsBody") },
    { title: t("dataTitle"), body: t("dataBody") },
    { title: t("confirmTitle"), body: t("confirmBody") },
  ];

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-16">
      <div className={`${READING_PANEL} p-6 sm:p-10`}>
        <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
        <p className="mt-4 text-neutral-600">{t("lead")}</p>

        <section className="mt-10">
          <h2 className="text-lg font-semibold">{t("cardsTitle")}</h2>
          <div className="mt-4">
            <AcceptedCards height={30} />
          </div>
        </section>

        {sections.map((section) => (
          <section key={section.title} className="mt-10">
            <h2 className="text-lg font-semibold">{section.title}</h2>
            <p className="mt-2 text-neutral-600">{section.body}</p>
            {section.title === t("threeDsTitle") && (
              <div className="mt-4">
                <SecureBadges height={40} />
              </div>
            )}
          </section>
        ))}
      </div>
    </main>
  );
}
