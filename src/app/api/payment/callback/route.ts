import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { appBaseUrl } from "@/lib/paycenter/config";
import { localePrefix, signingKey } from "@/lib/paycenter/gateway";
import { verifyCallback } from "@/lib/paycenter/hmac";

// Payment callback. A booking is marked PAID **only** here, and only after the
// HMAC-SHA256 signature checks out — an unverified callback could otherwise
// claim a payment that never happened. Callbacks are idempotent: the bank may
// deliver the same one more than once.

export const dynamic = "force-dynamic";

function resultUrl(kind: "success" | "failure", locale: string, ref: string) {
  return `${appBaseUrl()}${localePrefix(locale)}/payment/${kind}?ref=${encodeURIComponent(ref)}`;
}

async function handle(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  const params: Record<string, string> = {};

  if (request.method === "GET") {
    for (const [k, v] of new URL(request.url).searchParams.entries()) {
      params[k] = v;
    }
  } else if (contentType.includes("application/json")) {
    const json = await request.json().catch(() => ({}));
    for (const [k, v] of Object.entries(json as Record<string, unknown>)) {
      params[k] = String(v);
    }
  } else {
    const form = await request.formData();
    for (const [k, v] of form.entries()) {
      params[k] = String(v);
    }
  }

  const receivedHash = params.HashKey ?? params.Hash ?? "";
  const locale = params.Locale === "en" ? "en" : "el";

  if (!verifyCallback(params, receivedHash, signingKey())) {
    console.error("[paycenter] callback rejected: bad HMAC", {
      ticket: params.TicketNumber,
      reference: params.MerchantReference,
    });
    return NextResponse.json({ error: "invalid_signature" }, { status: 400 });
  }

  const ticket = params.TicketNumber;
  const payment = await prisma.payment.findFirst({
    where: { ticket },
    include: { booking: true },
  });
  if (!payment) {
    return NextResponse.json({ error: "unknown_ticket" }, { status: 404 });
  }

  const approved = params.ResultCode === "0";

  // Already applied — do not touch the booking again, just send the customer on.
  if (payment.processedAt) {
    return NextResponse.redirect(
      resultUrl(
        payment.status === "PAID" ? "success" : "failure",
        locale,
        payment.booking.reference,
      ),
      303,
    );
  }

  // The amount must match what we asked the gateway to charge.
  const expected = (payment.amountCents / 100).toFixed(2);
  if (params.Amount && params.Amount !== expected) {
    console.error("[paycenter] callback rejected: amount mismatch", {
      expected,
      received: params.Amount,
    });
    return NextResponse.json({ error: "amount_mismatch" }, { status: 400 });
  }

  await prisma.$transaction([
    prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: approved ? "PAID" : "FAILED",
        transactionId: params.TransactionId ?? null,
        paymentRef: params.PaymentRef ?? null,
        hmacVerified: true,
        rawCallback: params,
        processedAt: new Date(),
      },
    }),
    prisma.booking.update({
      where: { id: payment.bookingId },
      data: { status: approved ? "PAID" : "FAILED" },
    }),
  ]);

  return NextResponse.redirect(
    resultUrl(approved ? "success" : "failure", locale, payment.booking.reference),
    303,
  );
}

export const POST = handle;
export const GET = handle;
