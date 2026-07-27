import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export const dynamic = "force-dynamic";

export default async function PaymentFailurePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ ref?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { ref } = await searchParams;

  const t = await getTranslations("payment");
  const b = await getTranslations("booking");
  const nav = await getTranslations("nav");

  return (
    <main className="mx-auto w-full max-w-lg flex-1 px-6 py-16 text-center">
      <div className="rounded-2xl border border-red-200 bg-red-50 p-8">
        <h1 className="text-2xl font-semibold text-red-800">
          {t("failureTitle")}
        </h1>
        <p className="mt-2 text-red-900">{t("failureBody")}</p>
        {ref && (
          <p className="mt-3 text-sm text-red-900">
            {b("reference")}: <span className="font-mono">{ref}</span>
          </p>
        )}
      </div>

      <Link
        href="/"
        className="mt-8 inline-block rounded-lg bg-amber-500 px-6 py-3 font-medium text-white hover:bg-amber-600"
      >
        {nav("home")}
      </Link>
    </main>
  );
}
