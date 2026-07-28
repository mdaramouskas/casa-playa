import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  // Match all paths except API routes, Next internals, and static files.
  //
  // Static files are excluded by known extension rather than by "contains a
  // dot": booking references look like CAPL.XXXXXXXXXX and appear in payment
  // URLs, and a blanket dot rule made those paths skip the locale rewrite and
  // 404.
  matcher: [
    "/((?!api|_next|_vercel|.*\\.(?:ico|png|jpg|jpeg|gif|svg|webp|avif|css|js|mjs|map|txt|xml|json|pdf|woff|woff2|ttf|otf|eot|mp4|webm)$).*)",
  ],
};
