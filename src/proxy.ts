import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "./i18n/routing";
import { gateEnabled, siteGate } from "./lib/site-gate";

const withLocale = createMiddleware(routing);

export default function proxy(request: NextRequest) {
  // Runs first: an unauthenticated visitor should not reach a route at all
  // while the pre-launch gate is on.
  const challenge = siteGate(request);
  if (challenge) return challenge;

  // API routes and the staff panel are not localized — handing them to
  // next-intl would rewrite them under a locale prefix and 404. The panel is a
  // Greek-only internal tool; its access control is its own (`lib/staff/`).
  const { pathname } = request.nextUrl;
  const response =
    pathname.startsWith("/api") || pathname.startsWith("/admin")
      ? NextResponse.next()
      : withLocale(request);

  // Certificate transparency publishes every hostname we get a certificate
  // for, so the domain is discoverable the moment it is added to Vercel. The
  // password keeps people out; this keeps the site out of search results.
  if (gateEnabled()) {
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
  }

  return response;
}

export const config = {
  // Match every path except Next internals and static files.
  //
  // API routes are included on purpose: the gate has to cover /api/bookings and
  // /api/availability too, or a stranger could still consume capacity with
  // PENDING bookings. The two payment response URLs are exempted inside
  // `siteGate`, not here, so the exemption sits next to the reason for it.
  //
  // Static files are excluded by known extension rather than by "contains a
  // dot": booking references look like CAPL.XXXXXXXXXX and appear in payment
  // URLs, and a blanket dot rule made those paths skip the locale rewrite and
  // 404.
  matcher: [
    "/((?!_next|_vercel|.*\\.(?:ico|png|jpg|jpeg|gif|svg|webp|avif|css|js|mjs|map|txt|xml|json|pdf|woff|woff2|ttf|otf|eot|mp4|webm)$).*)",
  ],
};
