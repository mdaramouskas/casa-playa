import { notFound, redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { formatPrice, vatBreakdown } from "@/lib/money";
import { getPaycenterConfig } from "@/lib/paycenter/config";
import { localePrefix } from "@/lib/paycenter/gateway";
import { computeHashKey } from "@/lib/paycenter/hashkey";

// Stand-in for the bank's hosted payment page (pay.aspx) while
// PAYCENTER_MODE=mock. It deliberately does NOT imitate the bank's branding and
// takes no card details — it only drives the two outcomes the real gateway
// produces, using the real response parameter names and a real HashKey computed
// from the stored ticket, so the verification path exercised here is the
// production one.
//
// Keyed on the booking reference, not the ticket: the ticket is the HMAC key
// and must never appear in a URL.

export const dynamic = "force-dynamic";

export default async function MockPaymentPage({
  params,
}: {
  params: Promise<{ locale: string; reference: string }>;
}) {
  const { locale, reference } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("mockPay");
  const common = await getTranslations("common");

  const booking = await prisma.booking.findUnique({
    where: { reference },
    include: { product: true, payment: true },
  });
  const payment = booking?.payment;
  if (!booking || !payment || !payment.ticket) notFound();

  if (payment.processedAt) {
    const done = payment.status === "PAID" ? "success" : "failure";
    redirect(`${localePrefix(locale)}/payment/${done}?ref=${reference}`);
  }

  const cfg = getPaycenterConfig();
  const { netCents, vatCents } = vatBreakdown(payment.amountCents);
  const ticket = payment.ticket;
  const parameters = payment.parameters ?? "";
  // SupportReferenceID is an integer at the bank. Derived from the payment id
  // so it is stable across re-renders and identical in both outcome forms.
  const supportReferenceId = String(
    parseInt(payment.id.slice(-8), 36) % 1_000_000,
  ).padStart(6, "0");

  /** Mirrors the POST response of §5, including the signed HashKey. */
  function responseFields(approved: boolean): Record<string, string> {
    const fields: Record<string, string> = {
      SupportReferenceID: supportReferenceId,
      ResultCode: "0",
      ResultDescription: "",
      StatusFlag: approved ? "Success" : "Failure",
      ResponseCode: approved ? "00" : "05",
      ResponseDescription: approved ? "Approved" : "Do not honor",
      LanguageCode: locale === "en" ? "en-US" : "el-GR",
      MerchantReference: reference,
      TransactionId: `MOCK${supportReferenceId}`,
      ApprovalCode: approved ? "123456" : "",
      RetrievalRef: approved ? `MOCK${supportReferenceId}` : "",
      AuthStatus: approved ? "01" : "03",
      PackageNo: approved ? "1" : "",
      CardType: "1",
      PaymentMethod: "Card",
      TraceID: `MOCKTRACE${supportReferenceId}`,
      Parameters: parameters,
    };
    // §5: the HashKey is only sent for a successful transaction.
    fields.HashKey = approved
      ? computeHashKey({
          tranTicket: ticket,
          posId: cfg.posId,
          acquirerId: cfg.acquirerId,
          merchantReference: reference,
          approvalCode: fields.ApprovalCode,
          parameters,
          responseCode: fields.ResponseCode,
          supportReferenceId,
          authStatus: fields.AuthStatus,
          packageNo: fields.PackageNo,
          statusFlag: fields.StatusFlag,
        })
      : "";
    return fields;
  }

  const outcomes = [
    {
      key: "pay",
      label: t("payButton"),
      className: "bg-emerald-600 hover:bg-emerald-700",
      fields: responseFields(true),
    },
    {
      key: "fail",
      label: t("failButton"),
      className: "bg-neutral-600 hover:bg-neutral-700",
      fields: responseFields(false),
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
            <dd className="font-mono">{reference}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-neutral-600">{t("description")}</dt>
            <dd className="text-right">
              {booking.product.name}
              {booking.timeSlot ? ` · ${booking.timeSlot}` : ""}
              {` · ${booking.persons} ${common("persons", { count: booking.persons })}`}
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
