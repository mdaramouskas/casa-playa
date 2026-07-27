// Paycenter Redirection v2.9 configuration (Piraeus Bank / Euronet Merchant
// Services — commercially "epay eCommerce"). All secrets come from env; nothing
// is hardcoded. Until the bank issues real credentials we run in MOCK mode.
//
// NOTE: this is the "Paycenter Redirection" product, NOT the epayworldwide.com
// gift-card developer portal.

export type PaycenterMode = "mock" | "sandbox" | "production";

export interface PaycenterConfig {
  mode: PaycenterMode;
  merchantId: string;
  posId: string;
  hashKey: string; // HMAC-SHA256 key for callback verification + request signing
  // SOAP endpoint for IssueNewTicket (WSDL provided by the bank consultant).
  issueTicketUrl: string;
  // Hosted payment page the customer is POSTed to (pay.aspx).
  payPageUrl: string;
  transactionType: "SALE" | "PREAUTH";
  currency: string; // ISO code, EUR
  // Absolute URLs the bank redirects/callbacks to (filled from APP_BASE_URL).
  successUrl: string;
  failureUrl: string;
  callbackUrl: string;
}

export function appBaseUrl(): string {
  const configured =
    process.env.APP_BASE_URL ?? process.env.NEXT_PUBLIC_APP_BASE_URL;
  if (configured) return configured.replace(/\/$/, "");

  // On Vercel, fall back to the deployment's own URL so redirects and the
  // callback URL are correct even before a custom domain is configured.
  const vercel =
    process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;
  if (vercel) return `https://${vercel.replace(/\/$/, "")}`;

  return "http://localhost:3000";
}

export function getPaycenterConfig(): PaycenterConfig {
  const mode = (process.env.PAYCENTER_MODE as PaycenterMode) ?? "mock";
  const app = appBaseUrl();
  return {
    mode,
    merchantId: process.env.PAYCENTER_MERCHANT_ID ?? "",
    posId: process.env.PAYCENTER_POS_ID ?? "",
    hashKey: process.env.PAYCENTER_HASH_KEY ?? "",
    issueTicketUrl: process.env.PAYCENTER_ISSUE_TICKET_URL ?? "",
    payPageUrl: process.env.PAYCENTER_PAY_PAGE_URL ?? "",
    transactionType:
      (process.env.PAYCENTER_TRANSACTION_TYPE as "SALE" | "PREAUTH") ?? "SALE",
    currency: process.env.PAYCENTER_CURRENCY ?? "EUR",
    successUrl: `${app}/payment/success`,
    failureUrl: `${app}/payment/failure`,
    callbackUrl: `${app}/api/payment/callback`,
  };
}

/** Whether real bank credentials are present (false => must stay in mock). */
export function hasLiveCredentials(cfg: PaycenterConfig): boolean {
  return Boolean(
    cfg.merchantId && cfg.hashKey && cfg.issueTicketUrl && cfg.payPageUrl,
  );
}
