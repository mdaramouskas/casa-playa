// Paycenter Redirection configuration — Piraeus Bank Paycenter, operated by
// Euronet Merchant Services and sold commercially as "epay eCommerce".
// Implements "Redirection Manual Ver 3.1 EL" (01/07/2026).
//
// NOTE: this is the "Paycenter Redirection" product, NOT the epayworldwide.com
// gift-card developer portal.
//
// Two things about this gateway are easy to get wrong, so they are spelled out
// here:
//   1. There is no separate sandbox host. A test account and a live account use
//      the SAME endpoints and differ only in the five credentials below.
//   2. The success/failure/backlink URLs are registered with Euronet per PosId.
//      They are never sent in a request — see `registeredUrls()` for the exact
//      list to hand over.

import { createHash } from "crypto";

export type PaycenterMode = "mock" | "test" | "live";

/** Manual §4, `RequestType`. */
export const REQUEST_TYPE = {
  PREAUTH: "00",
  SALE: "02",
  /** Digital-wallet top-up — not used by us. */
  WALLET_TOPUP: "09",
} as const;

export interface PaycenterConfig {
  mode: PaycenterMode;
  /** All five are issued by Euronet, once for test and again for live. */
  acquirerId: string;
  merchantId: string;
  posId: string;
  username: string;
  /** Plaintext; the ticketing WS wants it MD5-hashed — see `passwordHash()`. */
  password: string;

  /** SOAP ticketing WS (§4). */
  issueTicketUrl: string;
  /** Hosted payment page the customer's browser is POSTed to (§5). */
  payPageUrl: string;
  /** Confirm against the WSDL at `${issueTicketUrl}?WSDL`. */
  soapMethod: string;
  soapNamespace: string;

  transactionType: "SALE" | "PREAUTH";
  /** ISO-4217 alphabetic code, for our own records. */
  currency: string;
  /** ISO-4217 numeric code the gateway wants — 978 for EUR (§4, Appendix 5). */
  currencyCode: number;
  /** Preauth completion window in days. Exactly 30 while testing, 2–30 live. */
  expirePreauthDays: number;
}

export function appBaseUrl(): string {
  const configured =
    process.env.APP_BASE_URL ?? process.env.NEXT_PUBLIC_APP_BASE_URL;
  if (configured) return configured.replace(/\/$/, "");

  // On Vercel, fall back to the deployment's own URL so redirects are correct
  // even before a custom domain is configured.
  const vercel =
    process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;
  if (vercel) return `https://${vercel.replace(/\/$/, "")}`;

  return "http://localhost:3000";
}

export function getPaycenterConfig(): PaycenterConfig {
  const mode = (process.env.PAYCENTER_MODE as PaycenterMode) ?? "mock";
  return {
    mode,
    acquirerId: process.env.PAYCENTER_ACQUIRER_ID ?? "",
    merchantId: process.env.PAYCENTER_MERCHANT_ID ?? "",
    posId: process.env.PAYCENTER_POS_ID ?? "",
    username: process.env.PAYCENTER_USERNAME ?? "",
    password: process.env.PAYCENTER_PASSWORD ?? "",

    issueTicketUrl:
      process.env.PAYCENTER_ISSUE_TICKET_URL ??
      "https://paycenter.piraeusbank.gr/services/tickets/issuer.asmx",
    payPageUrl:
      process.env.PAYCENTER_PAY_PAGE_URL ??
      "https://paycenter.piraeusbank.gr/redirection/pay.aspx",
    soapMethod: process.env.PAYCENTER_SOAP_METHOD ?? "IssueNewTicket",
    soapNamespace:
      process.env.PAYCENTER_SOAP_NAMESPACE ??
      "http://piraeusbank.gr/paycenter/redirection",

    transactionType:
      (process.env.PAYCENTER_TRANSACTION_TYPE as "SALE" | "PREAUTH") ?? "SALE",
    currency: process.env.PAYCENTER_CURRENCY ?? "EUR",
    currencyCode: Number(process.env.PAYCENTER_CURRENCY_CODE ?? 978),
    expirePreauthDays: Number(process.env.PAYCENTER_EXPIRE_PREAUTH_DAYS ?? 30),
  };
}

export function requestType(cfg: PaycenterConfig): string {
  return REQUEST_TYPE[cfg.transactionType];
}

/** The ticketing WS expects `Password` MD5-hashed (§4, §9). */
export function passwordHash(cfg: PaycenterConfig): string {
  return createHash("md5").update(cfg.password, "utf8").digest("hex");
}

/** Payment-page language (§5, `LanguageCode`). Only el/en are used here. */
export function languageCode(locale: string): string {
  return locale === "en" ? "en-US" : "el-GR";
}

/** Whether real bank credentials are present (false => must stay in mock). */
export function hasLiveCredentials(cfg: PaycenterConfig): boolean {
  return Boolean(
    cfg.acquirerId &&
      cfg.merchantId &&
      cfg.posId &&
      cfg.username &&
      cfg.password,
  );
}

/**
 * The URLs Euronet registers against our PosId (§3, §10). Nothing here is sent
 * at runtime — this exists so the values we hand over always match the app.
 *
 * Success and failure point at the same handler on purpose: the outcome is
 * decided from `ResultCode`/`StatusFlag`, never from which URL was hit.
 */
export function registeredUrls(): Record<string, string> {
  const app = appBaseUrl();
  return {
    website: app,
    // The page that POSTs the customer to pay.aspx — deliberately not
    // locale-prefixed so one value covers both languages.
    referrer: `${app}/pay/handoff`,
    success: `${app}/api/payment/callback`,
    failure: `${app}/api/payment/callback`,
    // "Cancel" lands here; `ParamBackLink` adds `?ref=…` at runtime.
    backlink: `${app}/payment/failure`,
  };
}
