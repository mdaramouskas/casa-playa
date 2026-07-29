import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import {
  PAY_REF_COOKIE,
  localeFromParameters,
  localePrefix,
  payFormAction,
  payFormFields,
} from "@/lib/paycenter/gateway";
import { AutoSubmitForm } from "./auto-submit-form";

// Hands the customer over to the bank's hosted payment page (Redirection §5).
//
// This is the URL registered with Euronet as the Referrer URL, so its path is
// fixed: no reference in the path, no locale prefix, ideally no query string.
// The booking comes from the `cp_pay_ref` cookie set when the ticket was
// issued; `?ref=` is only a fallback for when the cookie did not survive (a
// blocked cookie should not dead-end a paid-for booking).
//
// next.config.ts relaxes Referrer-Policy for this path — without that the
// browser's default sends only the origin cross-origin, and Euronet would never
// see the URL that was registered.

export const dynamic = "force-dynamic";

export default async function PaymentHandoffPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ ref?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("payHandoff");

  const jar = await cookies();
  const reference = jar.get(PAY_REF_COOKIE)?.value ?? (await searchParams).ref;
  if (!reference) notFound();

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
