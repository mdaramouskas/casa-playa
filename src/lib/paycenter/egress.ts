// Egress for the one call that has to come from a known IP address.
//
// Euronet accepts ticketing requests only from an IP declared in advance
// (Redirection manual §3, §4), and Vercel's functions have no fixed egress
// address. So this single SOAP call is tunnelled through our own proxy —
// a Hetzner machine on 46.224.113.245, the address written on the application
// form — and that is what the bank sees.
//
// Nothing else in the app goes through it: the customer's browser reaches
// pay.aspx directly, and the bank's response arrives at our public routes.

import { fetch as undiciFetch, ProxyAgent } from "undici";
import type { RequestInit, Response } from "undici";

/**
 * The proxy speaks TLS with a self-signed certificate that is pinned here.
 * There is no CA and no DNS name involved — the proxy is reached by IP and this
 * PEM is the entire trust decision, so impersonating it needs its private key
 * rather than one mis-issued certificate from any of the ~150 public roots.
 * As a side effect there is nothing to renew and nothing that can expire in a
 * way that stops payments.
 *
 * The value may be the PEM itself or base64 of it: multi-line environment
 * variables behave differently in the Vercel dashboard and in `vercel env add`.
 */
function decodeCa(raw: string): string {
  const value = raw.trim();
  return value.startsWith("-----BEGIN")
    ? value
    : Buffer.from(value, "base64").toString("utf8");
}

let agent: ProxyAgent | undefined;

/** Built once per instance — an agent per request would leak sockets. */
function proxyAgent(uri: string): ProxyAgent {
  if (agent) return agent;

  const ca = process.env.PAYCENTER_PROXY_CA;
  if (!ca) {
    throw new Error(
      "PAYCENTER_PROXY_CA is missing. The proxy's certificate is self-signed " +
        "and pinned; without it the connection cannot be verified.",
    );
  }

  const user = process.env.PAYCENTER_PROXY_USER ?? "";
  const password = process.env.PAYCENTER_PROXY_PASSWORD ?? "";

  agent = new ProxyAgent({
    uri,
    // The proxy authenticates with a shared secret rather than by source IP,
    // because Vercel's egress addresses are exactly what we do not have.
    token: `Basic ${Buffer.from(`${user}:${password}`).toString("base64")}`,
    // `proxyTls` is the hop to the proxy — the pinned one. The tunnel inside it
    // to paycenter.piraeusbank.gr keeps the public roots and needs no help.
    proxyTls: { ca: decodeCa(ca) },
  });
  return agent;
}

/**
 * `fetch` for the ticketing web service.
 *
 * Deliberately undici's own `fetch` and not the global one: Node bundles its
 * own private copy of undici, and a dispatcher from this package handed to the
 * global `fetch` fails at runtime with `invalid onRequestStart method`. One
 * library, one interface.
 */
export async function paycenterFetch(
  url: string,
  init: RequestInit,
): Promise<Response> {
  const uri = process.env.PAYCENTER_PROXY_URL;

  if (!uri) {
    // Reached only with real credentials in hand (see `issueTicket`). Failing
    // here is far kinder than letting the request leave from an undeclared
    // address, where Euronet rejects it with an error that says nothing about
    // the actual cause.
    if (process.env.PAYCENTER_ALLOW_DIRECT_EGRESS !== "1") {
      throw new Error(
        "PAYCENTER_PROXY_URL is not set. The ticketing web service only " +
          "accepts calls from the IP declared to Euronet, so the request " +
          "would be refused. Set PAYCENTER_ALLOW_DIRECT_EGRESS=1 only when " +
          "this host itself has that IP.",
      );
    }
    return undiciFetch(url, init);
  }

  return undiciFetch(url, { ...init, dispatcher: proxyAgent(uri) });
}
