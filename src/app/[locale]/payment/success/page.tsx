import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function PaymentSuccessPage({
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
  const common = await getTranslations("common");

  const booking = ref
    ? await prisma.booking.findUnique({
        where: { reference: ref },
        include: { product: true, items: true },
      })
    : null;

  return (
    <main className="mx-auto w-full max-w-lg flex-1 px-6 py-16 text-center">
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-8">
        <h1 className="text-2xl font-semibold text-emerald-800">
          {t("successTitle")}
        </h1>
        <p className="mt-2 text-emerald-900">{t("successBody")}</p>
        {ref && <p className="mt-2 font-mono text-lg font-semibold">{ref}</p>}
      </div>

      {booking && (
        <dl className="mt-8 space-y-2 rounded-2xl border border-neutral-200 bg-white p-6 text-left text-sm">
          <div className="flex justify-between">
            <dt className="text-neutral-600">{booking.product.name}</dt>
            <dd>
              {booking.persons} {common("persons")}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-neutral-600">{b("selectDate")}</dt>
            <dd>
              {booking.bookingDate.toISOString().slice(0, 10)}
              {booking.timeSlot ? ` · ${booking.timeSlot}` : ""}
            </dd>
          </div>
          {booking.items.map((item) => (
            <div key={item.id} className="flex justify-between">
              <dt className="text-neutral-600">
                {item.quantity} ×{" "}
                {item.kind === "SET"
                  ? b("sets")
                  : item.kind === "EXTRA_PERSON"
                    ? b("extraLounger")
                    : item.label}
              </dt>
              <dd>{formatPrice(item.totalCents)}</dd>
            </div>
          ))}
          <div className="flex justify-between border-t border-neutral-200 pt-2 text-base font-semibold">
            <dt>{common("total")}</dt>
            <dd>{formatPrice(booking.totalCents)}</dd>
          </div>
        </dl>
      )}

      <Link
        href="/"
        className="mt-8 inline-block rounded-lg bg-amber-500 px-6 py-3 font-medium text-white hover:bg-amber-600"
      >
        {nav("home")}
      </Link>
    </main>
  );
}
