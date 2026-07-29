import { notFound, redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { EpayPage } from "@/components/epay-page";
import { prisma } from "@/lib/prisma";
import { getPaycenterConfig } from "@/lib/paycenter/config";
import { localePrefix } from "@/lib/paycenter/gateway";
import { computeHashKey } from "@/lib/paycenter/hashkey";
import {
  EPAY_LOGO,
  IRIS_LOGO,
  cardBrands,
  secureBrands,
} from "@/lib/payment-brands";

// Stand-in for the bank's hosted payment page (pay.aspx) while
// PAYCENTER_MODE=mock. `EpayPage` reproduces the layout of Redirection Manual
// pages 6–10 so the test flow looks like the live one; this file supplies the
// data and, crucially, the real §5 response parameters with a real HashKey
// computed from the stored ticket, so the verification path exercised here is
// the production one.
//
// Keyed on the booking reference, not the ticket: the ticket is the HMAC key
// and must never appear in a URL (§9).

export const dynamic = "force-dynamic";

/** The payment page's own money format, e.g. `€1,00`. */
function epayAmount(cents: number): string {
  return `€${(cents / 100).toFixed(2).replace(".", ",")}`;
}

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

  return (
    <main className="flex-1 bg-white">
      {/* Not part of the replica: this page must never be mistaken for the
          bank's, so the banner and the decline control sit outside it. */}
      <div className="border-b border-amber-200 bg-amber-100 px-5 py-3">
        <div className="mx-auto flex max-w-[560px] flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-amber-900">{t("banner")}</p>
            <p className="mt-0.5 font-mono text-xs text-amber-800">
              {t("mode", {
                mode: cfg.mode,
                type: cfg.transactionType,
                reference,
              })}
            </p>
          </div>
          <form
            action="/api/payment/failure"
            method="post"
            className="shrink-0"
          >
            {Object.entries(responseFields(false)).map(([name, value]) => (
              <input key={name} type="hidden" name={name} value={value} />
            ))}
            <button
              type="submit"
              className="rounded-lg border border-amber-400 px-3 py-1.5 text-xs font-medium text-amber-900 transition hover:bg-amber-200"
            >
              {t("simulateDecline")}
            </button>
          </form>
        </div>
      </div>

      <EpayPage
        merchantName={common("brand")}
        amount={epayAmount(payment.amountCents)}
        cancelUrl={`${localePrefix(locale)}/payment/failure?ref=${encodeURIComponent(reference)}`}
        callbackUrl="/api/payment/success"
        successFields={responseFields(true)}
        cardBrands={cardBrands()}
        secureBrands={secureBrands()}
        epayLogo={EPAY_LOGO}
        irisLogo={IRIS_LOGO}
      />

      <p className="mx-auto max-w-[560px] px-5 pb-12 text-xs text-neutral-500">
        {t("footnote")}
      </p>
    </main>
  );
}
