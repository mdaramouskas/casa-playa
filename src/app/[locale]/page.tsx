import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("home");
  const nav = await getTranslations("nav");

  const types = [
    { href: "/loungers", label: nav("loungers"), desc: t("loungersDesc") },
    { href: "/cabanas", label: nav("cabanas"), desc: t("cabanasDesc") },
    { href: "/restaurant", label: nav("restaurant"), desc: t("restaurantDesc") },
  ];

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
        <div className="grid gap-6 sm:grid-cols-3">
          {types.map((tp) => (
            <Link
              key={tp.href}
              href={tp.href}
              className="group rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm transition hover:border-sky-300 hover:shadow-md"
            >
              <h3 className="text-lg font-semibold group-hover:text-sky-700">
                {tp.label}
              </h3>
              <p className="mt-2 text-sm text-neutral-600">{tp.desc}</p>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
