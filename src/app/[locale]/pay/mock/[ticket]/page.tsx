import { notFound, redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { formatPrice, vatBreakdown } from "@/lib/money";
import { getPaycenterConfig } from "@/lib/paycenter/config";
import { signingKey, localePrefix } from "@/lib/paycenter/gateway";
import { buildSignedString, computeHmac } from "@/lib/paycenter/hmac";

// Stand-in for the bank's hosted payment page (pay.aspx) while
// PAYCENTER_MODE=mock. It deliberately does NOT imitate the bank's branding and
// takes no card details — it only lets you drive the two outcomes the real
// gateway produces, and it posts back the same HMAC-signed callback.

export const dynamic = "force-dynamic";

export default async function MockPaymentPage({
  params,
}: {
  params: Promise<{ locale: string; ticket: string }>;
}) {
  const { locale, ticket } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("mockPay");
  const common = await getTranslations("common");

  const payment = await prisma.payment.findFirst({
    where: { ticket },
    include: { booking: { include: { product: true } } },
  });
  if (!payment) notFound();

  if (payment.processedAt) {
    const done = payment.status === "PAID" ? "success" : "failure";
    redirect(
      `${localePrefix(locale)}/payment/${done}?ref=${payment.booking.reference}`,
    );
  }

  const cfg = getPaycenterConfig();
  const { netCents, vatCents } = vatBreakdown(payment.amountCents);

  function signedFields(resultCode: string, description: string) {
    const fields: Record<string, string> = {
      MerchantReference: payment!.booking.reference,
      TicketNumber: ticket,
      TransactionId: `MOCKTX${payment!.id.slice(-10).toUpperCase()}`,
      ResultCode: resultCode,
      ResultDescription: description,
      Amount: (payment!.amountCents / 100).toFixed(2),
      Currency: payment!.currency,
      Locale: locale,
    };
    return {
      ...fields,
      HashKey: computeHmac(buildSignedString(fields), signingKey()),
    };
  }

  const outcomes = [
    {
      key: "pay",
      label: t("payButton"),
      className: "bg-emerald-600 hover:bg-emerald-700",
      fields: signedFields("0", "Approved"),
    },
    {
      key: "fail",
      label: t("failButton"),
      className: "bg-neutral-600 hover:bg-neutral-700",
      fields: signedFields("1", "Declined by issuer"),
    },
  ];

  return (
    <main className="mx-auto w-full max-w-lg flex-1 px-6 py-12">
      <p className="rounded-lg bg-amber-100 px-4 py-3 text-center text-sm font-medium text-amber-900">
        {t("banner")}
      </p>

      <div className="mt-6 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold">{t("title")}</h1>
        <p className="mt-1 text-sm text-neutral-600">
          {t("mode", { mode: cfg.mode, type: cfg.transactionType })}
        </p>

        <dl className="mt-6 space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-neutral-600">{t("merchant")}</dt>
            <dd className="font-medium">{common("brand")}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-neutral-600">{t("reference")}</dt>
            <dd className="font-mono">{payment.booking.reference}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-neutral-600">{t("description")}</dt>
            <dd className="text-right">
              {payment.booking.product.name}
              {payment.booking.timeSlot ? ` · ${payment.booking.timeSlot}` : ""}
              {` · ${payment.booking.persons} ${common("persons")}`}
            </dd>
          </div>
          <div className="flex justify-between border-t border-neutral-200 pt-2">
            <dt className="text-neutral-600">{t("net")}</dt>
            <dd>{formatPrice(netCents)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-neutral-600">{t("vat")}</dt>
            <dd>{formatPrice(vatCents)}</dd>
          </div>
          <div className="flex justify-between text-lg font-semibold">
            <dt>{common("total")}</dt>
            <dd>{formatPrice(payment.amountCents)}</dd>
          </div>
        </dl>

        <div className="mt-8 space-y-3">
          {outcomes.map((outcome) => (
            <form key={outcome.key} action="/api/payment/callback" method="post">
              {Object.entries(outcome.fields).map(([name, value]) => (
                <input key={name} type="hidden" name={name} value={value} />
              ))}
              <button
                type="submit"
                className={`w-full rounded-lg px-6 py-3 font-medium text-white transition ${outcome.className}`}
              >
                {outcome.label}
              </button>
            </form>
          ))}
        </div>

        <p className="mt-6 text-xs text-neutral-500">{t("footnote")}</p>
      </div>
    </main>
  );
}
