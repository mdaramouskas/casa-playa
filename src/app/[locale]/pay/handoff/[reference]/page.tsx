import { notFound, redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import {
  localeFromParameters,
  localePrefix,
  payFormAction,
  payFormFields,
} from "@/lib/paycenter/gateway";
import { AutoSubmitForm } from "../auto-submit-form";

// Hands the customer over to the bank's hosted payment page (Redirection §5).
// This URL is what gets registered with Euronet as the Referrer URL, so it is
// intentionally not locale-prefixed — the payment page's own language comes
// from `LanguageCode`, taken from the language stored with the payment.

export const dynamic = "force-dynamic";

export default async function PaymentHandoffPage({
  params,
}: {
  params: Promise<{ locale: string; reference: string }>;
}) {
  const { locale, reference } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("payHandoff");

  const booking = await prisma.booking.findUnique({
    where: { reference },
    include: { payment: true },
  });
  const payment = booking?.payment;
  if (!booking || !payment) notFound();

  // Already settled — nothing left to pay.
  if (payment.processedAt) {
    const done = payment.status === "PAID" ? "success" : "failure";
    redirect(`${localePrefix(locale)}/payment/${done}?ref=${reference}`);
  }

  const customerLocale = localeFromParameters(payment.parameters);

  return (
    <main className="mx-auto w-full max-w-sm flex-1 px-6 py-20 text-center">
      <h1 className="text-lg font-semibold">{t("title")}</h1>
      <p className="mt-2 text-sm text-neutral-600">{t("body")}</p>
      <div className="mt-8">
        <AutoSubmitForm
          action={payFormAction()}
          fields={payFormFields({
            reference,
            locale: customerLocale,
            // Lands the "Cancel" button back on our failure page with context.
            paramBackLink: `ref=${encodeURIComponent(reference)}`,
          })}
          label={t("continue")}
        />
      </div>
    </main>
  );
}
