import { randomBytes } from "crypto";
import {
  appBaseUrl,
  getPaycenterConfig,
  hasLiveCredentials,
  languageCode,
  passwordHash,
  requestType,
  type PaycenterConfig,
} from "./config";
import { paycenterFetch } from "./egress";

// Step 1 of the Redirection flow (Manual §4): before the customer can pay, the
// transaction is declared to the gateway over SOAP and we get back a
// `TranTicket`. The ticket is the key that later proves the response is
// genuine, so it stays server-side — it is never put in a URL or a form field.
//
// Step 2 (§5): the customer's browser POSTs an HTML form to the hosted payment
// page. Card data never reaches our server.
//
// While `PAYCENTER_MODE=mock` we mint our own ticket and send the customer to a
// local stand-in page. Everything downstream — the HashKey, its verification,
// idempotency — is identical, so going live is credentials plus a mode switch.

/** Ticket lifetime per §4; the payment session itself is 15 minutes. */
export const TICKET_TTL_MINUTES = 30;

export interface IssuedTicket {
  /** `TranTicket` — secret, HMAC key for the response. Store, never expose. */
  ticket: string;
  /** Where to send the customer next. */
  payUrl: string;
  /** Echoed back by the gateway and part of the HashKey. */
  parameters: string;
}

export function localePrefix(locale: string): string {
  return locale === "en" ? "/en" : "";
}

/**
 * `Parameters` (§4) is an opaque ≤512-char string the gateway hands back
 * untouched. We use it to carry the customer's language, because the GET form
 * of the response does not include `LanguageCode`.
 */
export function encodeParameters(locale: string): string {
  return `locale=${locale === "en" ? "en" : "el"}`;
}

export function localeFromParameters(parameters: string | null): "el" | "en" {
  return parameters?.includes("locale=en") ? "en" : "el";
}

/**
 * Cookie carrying the reference of the booking being paid. The handoff URL is
 * registered with Euronet as the Referrer URL, and the manual does not say
 * whether that registration is matched exactly or by prefix — so the URL is
 * kept completely static and the reference travels out of band. As a bonus the
 * reference stays out of browser history and out of the bank's Referer logs.
 */
export const PAY_REF_COOKIE = "cp_pay_ref";

/** Ticket lifetime is the natural bound: after that the handoff is useless. */
export const PAY_REF_COOKIE_MAX_AGE = TICKET_TTL_MINUTES * 60;

/**
 * Handoff page that POSTs the customer to the bank — one fixed URL for every
 * transaction and every language. Deliberately unprefixed: with
 * `localePrefix: "as-needed"` the default locale has no prefix, so this is the
 * single value registered as the Referrer URL. The payment page's own language
 * comes from `LanguageCode`, not from this path.
 */
export function handoffUrl(): string {
  return `${appBaseUrl()}/pay/handoff`;
}

/**
 * The hidden fields of the redirect form (§5, Appendix 1). Note this list does
 * NOT contain the ticket, the amount or the transaction type — all of that was
 * already declared through the ticketing WS.
 */
export function payFormFields(params: {
  reference: string;
  locale: string;
  paramBackLink?: string;
}): Record<string, string> {
  const cfg = getPaycenterConfig();
  const fields: Record<string, string> = {
    AcquirerId: cfg.acquirerId,
    MerchantId: cfg.merchantId,
    PosId: cfg.posId,
    User: cfg.username,
    LanguageCode: languageCode(params.locale),
    MerchantReference: params.reference,
  };
  if (params.paramBackLink) fields.ParamBackLink = params.paramBackLink;
  return fields;
}

export function payFormAction(): string {
  return getPaycenterConfig().payPageUrl;
}

// ── Ticketing (SOAP) ──────────────────────────────────────────────────

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** §4 allows only Latin letters in `CardholderName`; drop anything else. */
function latinCardholderName(name: string): string | null {
  const cleaned = name
    .normalize("NFKD")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/["';<>]/g, "")
    .trim();
  return cleaned.length >= 2 && cleaned.length <= 45 ? cleaned : null;
}

function buildTicketRequestFields(
  cfg: PaycenterConfig,
  params: TicketParams,
): Record<string, string> {
  const fields: Record<string, string> = {
    AcquirerId: cfg.acquirerId,
    MerchantId: cfg.merchantId,
    PosId: cfg.posId,
    Username: cfg.username,
    Password: passwordHash(cfg),
    RequestType: requestType(cfg),
    CurrencyCode: String(cfg.currencyCode),
    MerchantReference: params.reference,
    Amount: (params.amountCents / 100).toFixed(2),
    Installments: "0",
    // §4: must be 0 for a purchase, 2–30 for a preauth.
    ExpirePreauth:
      cfg.transactionType === "PREAUTH" ? String(cfg.expirePreauthDays) : "0",
    // §4: reserved for future use, always 0.
    Bnpl: "0",
    Parameters: params.parameters,
  };

  // Optional 3D Secure hints — more data here means fewer challenges (§4).
  if (params.email) fields.Email = params.email;
  const cardholder = params.cardholderName
    ? latinCardholderName(params.cardholderName)
    : null;
  if (cardholder) fields.CardholderName = cardholder;

  return fields;
}

// Element order and cardinality of the `TicketRequest` type, read from
// https://paycenter.piraeusbank.gr/services/tickets/issuer.asmx?WSDL on
// 2026-07-28. It is an xsd:sequence, so the order below is part of the
// contract, not a preference — the manual says as much in passing ("συνίσταται
// η αποστολή των παραμέτρων με τη σειρά που αυτές εμφανίζονται στο WSDL").
const TICKET_REQUEST_ORDER = [
  "Username", "Password", "MerchantId", "PosId", "AcquirerId",
  "MerchantReference", "RequestType", "ExpirePreauth", "Amount",
  "CurrencyCode", "Installments", "Bnpl", "Parameters",
  "BillAddrCity", "BillAddrCountry", "BillAddrLine1", "BillAddrLine2",
  "BillAddrLine3", "BillAddrPostCode", "BillAddrState",
  "ShipAddrCity", "ShipAddrCountry", "ShipAddrLine1", "ShipAddrLine2",
  "ShipAddrLine3", "ShipAddrPostCode", "ShipAddrState",
  "CardholderName", "Email", "HomePhone", "MobilePhone", "WorkPhone",
  "RecurringInd", "RecurPurchaseDate", "RecurFreq", "RecurEnd",
  "AddressMatch", "DeliveryTimeframe", "DeliveryEmailAddress",
  "ReorderItemsInd", "PreOrderPurchaseInd", "AuthMethod", "AccountAgeInd",
  "AccountDate", "AccountChangeInd", "AccountChange", "AccountPwdChangeInd",
  "AccountPwdChange", "ShipAddressUsageInd", "SuspiciousAccActivity",
  "PassengerData", "AccountVerification", "FundsTransfer",
] as const;

/**
 * Declared `minOccurs="1" nillable="true"`: the element has to be in the
 * sequence even when we have no value, carrying xsi:nil. These are the 3D
 * Secure risk hints we do not supply. Everything else we skip is minOccurs="0"
 * and may simply be left out.
 */
const REQUIRED_NILLABLE = new Set<string>([
  "RecurringInd",
  "RecurFreq",
  "AddressMatch",
  "DeliveryTimeframe",
  "ReorderItemsInd",
  "PreOrderPurchaseInd",
  "AuthMethod",
  "AccountAgeInd",
  "AccountChangeInd",
  "AccountPwdChangeInd",
  "ShipAddressUsageInd",
  "SuspiciousAccActivity",
]);

function buildSoapEnvelope(
  cfg: PaycenterConfig,
  fields: Record<string, string>,
): string {
  const body = TICKET_REQUEST_ORDER.map((name) => {
    const value = fields[name];
    if (value !== undefined) return `<${name}>${xmlEscape(value)}</${name}>`;
    if (REQUIRED_NILLABLE.has(name)) return `<${name} xsi:nil="true" />`;
    return "";
  }).join("");
  return (
    '<?xml version="1.0" encoding="utf-8"?>' +
    '<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"' +
    ' xmlns:xsd="http://www.w3.org/2001/XMLSchema"' +
    ' xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">' +
    "<soap:Body>" +
    `<${cfg.soapMethod} xmlns="${cfg.soapNamespace}">` +
    `<Request>${body}</Request>` +
    `</${cfg.soapMethod}>` +
    "</soap:Body>" +
    "</soap:Envelope>"
  );
}

function readTag(xml: string, tag: string): string | null {
  const match = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i").exec(xml);
  return match ? match[1].trim() : null;
}

interface TicketParams {
  reference: string;
  amountCents: number;
  locale: string;
  parameters: string;
  email?: string;
  cardholderName?: string;
}

export async function issueTicket(params: {
  reference: string;
  amountCents: number;
  locale: string;
  email?: string;
  cardholderName?: string;
}): Promise<IssuedTicket> {
  const cfg = getPaycenterConfig();
  const parameters = encodeParameters(params.locale);

  if (cfg.mode === "mock" || !hasLiveCredentials(cfg)) {
    return {
      ticket: randomBytes(16).toString("hex"),
      payUrl: `${appBaseUrl()}${localePrefix(params.locale)}/pay/mock/${encodeURIComponent(params.reference)}`,
      parameters,
    };
  }

  const fields = buildTicketRequestFields(cfg, { ...params, parameters });
  const envelope = buildSoapEnvelope(cfg, fields);

  // Through our fixed-IP proxy — see `egress.ts`. This is the only outbound
  // call in the app that Euronet checks the source address of.
  const response = await paycenterFetch(cfg.issueTicketUrl, {
    method: "POST",
    headers: {
      "Content-Type": "text/xml; charset=utf-8",
      SOAPAction: `${cfg.soapNamespace.replace(/\/$/, "")}/${cfg.soapMethod}`,
    },
    body: envelope,
  });

  const xml = await response.text();
  if (!response.ok) {
    throw new Error(
      `Paycenter ticketing HTTP ${response.status}: ${xml.slice(0, 500)}`,
    );
  }

  // Response shape: IssueNewTicketResponse > IssueNewTicketResult >
  // { ResultCode, ResultDescription, TranTicket, Timestamp, MinutesToExpiration }.
  const resultCode = readTag(xml, "ResultCode");
  const ticket = readTag(xml, "TranTicket");

  // §4: ResultCode 0 is the only success, and only then is TranTicket present.
  if (resultCode !== "0" || !ticket) {
    const description = readTag(xml, "ResultDescription") ?? "unknown error";
    throw new Error(
      `Paycenter ticketing failed (ResultCode=${resultCode}): ${description}`,
    );
  }

  return { ticket, payUrl: handoffUrl(), parameters };
}
