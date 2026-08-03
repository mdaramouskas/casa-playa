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

  return new NextResponse(challengePage(), {
    status: 401,
    headers: {
      "WWW-Authenticate": `Basic realm="${REALM}", charset="UTF-8"`,
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}

/**
 * The body behind the 401.
 *
 * A normal browser never shows this: it sees `WWW-Authenticate`, puts up its
 * own password dialog, and the body is discarded. The in-app browsers of
 * Messenger, Instagram and Facebook do not present that dialog at all — they
 * render the body instead, so the visitor is left staring at a dead end with no
 * way to type anything.
 *
 * That is not a hypothetical: the link goes out by email to Euronet for the
 * live-account review, and a reviewer tapping it on a phone can easily land
 * here. Telling them to open it in a real browser is the difference between a
 * five-second fix and a reply saying the site is broken.
 */
function challengePage(): string {
  return `<!doctype html>
<html lang="el"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Casa Playa — απαιτείται κωδικός</title>
</head>
<body style="margin:0;padding:2.5rem 1.5rem;background:#F0EAE2;color:#1c1917;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;line-height:1.6">
  <main style="max-width:26rem;margin:0 auto">
    <h1 style="margin:0 0 1rem;font-size:1.25rem">Ο ιστότοπος είναι προσωρινά κλειδωμένος</h1>
    <p style="margin:0 0 1rem">Οι κρατήσεις ανοίγουν σύντομα. Μέχρι τότε χρειάζεται όνομα χρήστη και κωδικός.</p>
    <p style="margin:0 0 1.5rem"><strong>Δεν σας ζητήθηκε κωδικός;</strong> Ανοίγετε τον σύνδεσμο μέσα από εφαρμογή (Messenger, Instagram, Facebook), και ο ενσωματωμένος browser της δεν εμφανίζει το σχετικό παράθυρο. Ανοίξτε τον σύνδεσμο στο Safari ή στο Chrome — από το μενού <strong>…</strong> επιλέξτε «Άνοιγμα στο Safari» ή αντιγράψτε τη διεύθυνση.</p>
    <hr style="border:0;border-top:1px solid #d6cec2;margin:1.5rem 0">
    <p style="margin:0;font-size:.875rem;color:#57534e" lang="en"><strong>Not asked for a password?</strong> You are opening this inside an app's built-in browser, which never shows the login dialog. Open the link in Safari or Chrome instead.</p>
  </main>
</body></html>
`;
}
