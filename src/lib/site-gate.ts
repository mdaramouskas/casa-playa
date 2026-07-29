import { NextResponse, type NextRequest } from "next/server";

// Pre-launch lock. While we run the mandatory Euronet test transactions
// (Redirection Manual §7) the app already sits on the real domain, because the
// success/failure URLs are registered per PosId and we do not want to re-declare
// them when going live. That means a stranger who finds the site could make what
// looks like a real booking against a test acquirer — hence this gate.
//
// HTTP Basic Auth, deliberately not a session cookie: the gateway returns the
// customer to our success URL with a *cross-site* POST, and a SameSite=Lax
// cookie is not sent on those. A cookie gate would therefore intercept the bank
// response, swallow its body, and leave a charged booking stuck as PENDING.
// Browsers replay the `Authorization` header on every request to the origin,
// cross-site navigations included, so Basic Auth survives the round trip.
//
// The gate is inert unless SITE_GATE_PASSWORD is set: going public is removing
// one environment variable, not a code change.

/**
 * Paths that must stay reachable by callers who cannot authenticate. Only the
 * gateway response qualifies: it arrives from paycenter.piraeusbank.gr and is
 * independently authenticated by its HashKey, which cannot be forged without
 * the TranTicket that never leaves our database.
 *
 * These are the Success and Failure URLs registered with Euronet — keep them in
 * step with `registeredUrls()` in `lib/paycenter/config.ts`.
 */
const UNGATED_PATHS = ["/api/payment/success", "/api/payment/failure"];

const REALM = "Casa Playa (pre-launch)";

export function gateEnabled(): boolean {
  return Boolean(process.env.SITE_GATE_PASSWORD);
}

/** Compares without an early exit, so a wrong guess reveals nothing by timing. */
function safeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** `Authorization: Basic <base64(user:password)>` → the pair, UTF-8 decoded. */
function decodeBasic(header: string | null): [string, string] | null {
  if (!header?.startsWith("Basic ")) return null;
  let decoded: string;
  try {
    const binary = atob(header.slice("Basic ".length).trim());
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    decoded = new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
  // Only the first colon separates the pair; passwords may contain more.
  const split = decoded.indexOf(":");
  if (split < 0) return null;
  return [decoded.slice(0, split), decoded.slice(split + 1)];
}

/**
 * Returns a 401 challenge when the request should be blocked, or `null` to let
 * it through.
 */
export function siteGate(request: NextRequest): NextResponse | null {
  const password = process.env.SITE_GATE_PASSWORD;
  if (!password) return null;

  const { pathname } = request.nextUrl;
  if (
    UNGATED_PATHS.some(
      (path) => pathname === path || pathname.startsWith(`${path}/`),
    )
  ) {
    return null;
  }

  const user = process.env.SITE_GATE_USER || "casaplaya";
  const credentials = decodeBasic(request.headers.get("authorization"));
  if (
    credentials &&
    safeEquals(credentials[0], user) &&
    safeEquals(credentials[1], password)
  ) {
    return null;
  }

  return new NextResponse("Authentication required.\n", {
    status: 401,
    headers: {
      "WWW-Authenticate": `Basic realm="${REALM}", charset="UTF-8"`,
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
