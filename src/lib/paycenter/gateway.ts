import { randomBytes } from "crypto";
import { appBaseUrl, getPaycenterConfig, hasLiveCredentials } from "./config";

// Step 2 of the Paycenter Redirection flow: the backend asks the bank for a
// ticket (SOAP `IssueNewTicket`), then the customer is sent to the hosted
// payment page with that ticket. Card data never reaches our server.
//
// While `PAYCENTER_MODE=mock` we issue our own ticket and send the customer to
// a local page that imitates the bank's. Everything downstream (the signed
// callback, HMAC verification, idempotency) is identical, so switching to the
// real gateway is a config change plus the SOAP call below.

export interface IssuedTicket {
  ticket: string;
  /** Where to send the customer next. */
  payUrl: string;
}

export function localePrefix(locale: string): string {
  return locale === "en" ? "/en" : "";
}

/**
 * Key used to sign/verify callbacks. In mock mode the bank's HashKey does not
 * exist yet, so a local development key is used — the verification path itself
 * stays exactly the same.
 */
export function signingKey(): string {
  const cfg = getPaycenterConfig();
  if (cfg.hashKey) return cfg.hashKey;
  if (cfg.mode === "mock") return "casa-playa-mock-hash-key";
  throw new Error("PAYCENTER_HASH_KEY is not set.");
}

export async function issueTicket(params: {
  reference: string;
  amountCents: number;
  currency: string;
  locale: string;
}): Promise<IssuedTicket> {
  const cfg = getPaycenterConfig();

  if (cfg.mode === "mock" || !hasLiveCredentials(cfg)) {
    const ticket = `MOCK-${randomBytes(12).toString("hex").toUpperCase()}`;
    return {
      ticket,
      payUrl: `${appBaseUrl()}${localePrefix(params.locale)}/pay/mock/${ticket}`,
    };
  }

  // TODO: real SOAP call to cfg.issueTicketUrl (IssueNewTicket) once the bank
  // provides the WSDL, MerchantId/PosId and HashKey; then POST the customer to
  // cfg.payPageUrl with the returned ticket.
  throw new Error(
    `Paycenter mode "${cfg.mode}" is not wired yet — no bank credentials/WSDL.`,
  );
}
