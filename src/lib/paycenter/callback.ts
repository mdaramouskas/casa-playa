import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { appBaseUrl, getPaycenterConfig } from "@/lib/paycenter/config";
import { localeFromParameters, localePrefix } from "@/lib/paycenter/gateway";
import { verifyHashKey } from "@/lib/paycenter/hashkey";
import { sendBookingConfirmation } from "@/lib/email/booking-confirmation";

// Transaction response from the gateway (Redirection Manual §5).
//
// §3 asks for a Success URL and a Failure URL as two separate registrations, so
// we register two — /api/payment/success and /api/payment/failure — and both
// land here. Which URL was hit is NOT what decides the outcome: that comes from
// ResultCode/StatusFlag and, for an approval, a verified HashKey. Hitting the
// success URL with a failing body still fails, and vice versa. The `expected`
// argument is only used to log a disagreement, which would mean the account is
// misconfigured at Euronet.
//
// The bank delivers this as a browser POST (or GET, if the account is set up
// that way), so the handler ends by redirecting the customer to a readable
// page. A booking is marked PAID only here.

export type ResponseUrlKind = "success" | "failure";

function resultUrl(kind: ResponseUrlKind, locale: string, ref: string) {
  return `${appBaseUrl()}${localePrefix(locale)}/payment/${kind}?ref=${encodeURIComponent(ref)}`;
}

/** Response parameter names are not case-stable across POST/GET; normalise. */
function reader(params: Record<string, string>) {
  const lower = new Map(
    Object.entries(params).map(([k, v]) => [k.toLowerCase(), v]),
  );
  return (name: string) => lower.get(name.toLowerCase()) ?? "";
}

/**
 * The response fields, whichever way the account is configured to deliver them
 * (§5). The query string is always read: it costs nothing and covers a POST
 * that carries some of the fields in the URL. A body is read on top of it, so
 * form fields win over query fields of the same name.
 *
 * A body that cannot be parsed is treated as no body rather than as a crash.
 * The bank never sends one, but this endpoint is reachable without
 * authentication — it is the one URL the gate has to leave open — so a stray
 * request must produce a clean 400, not a 500.
 */
async function readParams(request: Request): Promise<Record<string, string>> {
  const params: Record<string, string> = {};
  for (const [k, v] of new URL(request.url).searchParams.entries()) {
    params[k] = v;
  }
  if (request.method === "GET") return params;

  try {
    const form = await request.formData();
    for (const [k, v] of form.entries()) params[k] = String(v);
  } catch {
    console.warn("[paycenter] response body could not be parsed", {
      method: request.method,
      contentType: request.headers.get("content-type"),
    });
  }
  return params;
}

export async function handlePaymentResponse(
  request: Request,
  expected: ResponseUrlKind,
) {
  const params = await readParams(request);
  const get = reader(params);
  const cfg = getPaycenterConfig();

  const reference = get("MerchantReference");
  if (!reference) {
    return NextResponse.json({ error: "missing_reference" }, { status: 400 });
  }

  const booking = await prisma.booking.findUnique({
    where: { reference },
    include: { payment: true },
  });
  const payment = booking?.payment;
  if (!booking || !payment || !payment.ticket) {
    return NextResponse.json({ error: "unknown_reference" }, { status: 404 });
  }

  const locale = localeFromParameters(
    get("Parameters") || payment.parameters || null,
  );

  // Already applied. Two different things land here: the bank re-delivering the
  // same response, and a genuine second attempt to charge a reference that is
  // already settled — test case 3 of §7, which asks the merchant application to
  // record the attempt. Either way nothing is written; the original outcome
  // stands and the customer is sent to it.
  if (payment.processedAt) {
    const resultCode = get("ResultCode");
    // 1048 is the gateway telling us the reference was already used. A repeat
    // of the original response carries the original code instead.
    if (resultCode && resultCode !== "0") {
      console.warn("[paycenter] recharge attempt on a settled payment", {
        reference,
        resultCode,
        supportReferenceId: get("SupportReferenceID"),
        settledAs: payment.status,
      });
    }
    return NextResponse.redirect(
      resultUrl(
        payment.status === "PAID" ? "success" : "failure",
        locale,
        reference,
      ),
      303,
    );
  }

  // §5: ResultCode 0 means the transaction ran; StatusFlag says whether the
  // issuer approved it. Both must hold.
  const approved = get("ResultCode") === "0" && get("StatusFlag") === "Success";

  if (approved !== (expected === "success")) {
    console.warn("[paycenter] response arrived at the other URL", {
      reference,
      url: expected,
      resultCode: get("ResultCode"),
      statusFlag: get("StatusFlag"),
    });
  }

  // §5: the HashKey is only populated for a successful transaction, so it is
  // exactly the case where money is involved that we can — and must — verify.
  // An unverifiable *failure* can at worst mark this booking FAILED, which the
  // customer can retry with the same MerchantReference (§4).
  if (approved) {
    const ok = verifyHashKey(
      {
        tranTicket: payment.ticket,
        posId: cfg.posId,
        acquirerId: cfg.acquirerId,
        merchantReference: reference,
        approvalCode: get("ApprovalCode"),
        parameters: get("Parameters"),
        responseCode: get("ResponseCode"),
        supportReferenceId: get("SupportReferenceID"),
        authStatus: get("AuthStatus"),
        packageNo: get("PackageNo"),
        statusFlag: get("StatusFlag"),
      },
      get("HashKey"),
    );
    if (!ok) {
      console.error("[paycenter] response rejected: HashKey mismatch", {
        reference,
        supportReferenceId: get("SupportReferenceID"),
      });
      return NextResponse.json({ error: "invalid_signature" }, { status: 400 });
    }
  }

  // The amount is not echoed back — it was fixed when the ticket was issued and
  // the payment page could not change it, so there is nothing to re-check here.
  await prisma.$transaction([
    prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: approved ? "PAID" : "FAILED",
        supportReferenceId: get("SupportReferenceID") || null,
        transactionId: get("TransactionId") || null,
        approvalCode: get("ApprovalCode") || null,
        paymentRef: get("RetrievalRef") || null,
        responseCode: get("ResponseCode") || null,
        responseDescription: get("ResponseDescription") || null,
        authStatus: get("AuthStatus") || null,
        packageNo: get("PackageNo") || null,
        cardType: get("CardType") || null,
        paymentMethod: get("PaymentMethod") || null,
        traceId: get("TraceID") || null,
        hmacVerified: approved,
        rawCallback: params,
        processedAt: new Date(),
      },
    }),
    prisma.booking.update({
      where: { id: booking.id },
      data: { status: approved ? "PAID" : "FAILED" },
    }),
  ]);

  // The customer's proof of booking. Deliberately after the transaction and
  // deliberately unable to fail the request: the money has moved, and a bad
  // minute at the email provider must not leave a paid booking looking failed.
  if (approved) {
    await sendBookingConfirmation(booking.id, locale);
  }

  if (!approved) {
    // §9: never show ResultDescription/ResponseDescription to the customer.
    console.warn("[paycenter] transaction not approved", {
      reference,
      supportReferenceId: get("SupportReferenceID"),
      resultCode: get("ResultCode"),
      responseCode: get("ResponseCode"),
    });
  }

  return NextResponse.redirect(
    resultUrl(approved ? "success" : "failure", locale, reference),
    303,
  );
}
