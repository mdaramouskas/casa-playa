import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { appBaseUrl, getPaycenterConfig } from "@/lib/paycenter/config";
import { localeFromParameters, localePrefix } from "@/lib/paycenter/gateway";
import { verifyHashKey } from "@/lib/paycenter/hashkey";

// Transaction response from the gateway (Redirection Manual §5). This one URL
// is registered with Euronet as BOTH the success and the failure URL — the
// outcome is decided from ResultCode/StatusFlag, never from which URL was hit.
// The bank delivers it as a browser POST (or GET, if the account is set up that
// way), so the handler ends by redirecting the customer to a readable page.
//
// A booking is marked PAID only here, and only after the HashKey verifies.

export const dynamic = "force-dynamic";

function resultUrl(kind: "success" | "failure", locale: string, ref: string) {
  return `${appBaseUrl()}${localePrefix(locale)}/payment/${kind}?ref=${encodeURIComponent(ref)}`;
}

/** Response parameter names are not case-stable across POST/GET; normalise. */
function reader(params: Record<string, string>) {
  const lower = new Map(
    Object.entries(params).map(([k, v]) => [k.toLowerCase(), v]),
  );
  return (name: string) => lower.get(name.toLowerCase()) ?? "";
}

async function readParams(request: Request): Promise<Record<string, string>> {
  const params: Record<string, string> = {};
  if (request.method === "GET") {
    for (const [k, v] of new URL(request.url).searchParams.entries()) {
      params[k] = v;
    }
    return params;
  }
  const form = await request.formData();
  for (const [k, v] of form.entries()) params[k] = String(v);
  return params;
}

async function handle(request: Request) {
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

  // Already applied — the bank may deliver the same response twice.
  if (payment.processedAt) {
    return NextResponse.redirect(
      resultUrl(payment.status === "PAID" ? "success" : "failure", locale, reference),
      303,
    );
  }

  // §5: ResultCode 0 means the transaction ran; StatusFlag says whether the
  // issuer approved it. Both must hold.
  const approved = get("ResultCode") === "0" && get("StatusFlag") === "Success";

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

export const POST = handle;
export const GET = handle;
