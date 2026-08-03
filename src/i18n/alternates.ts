import type { Metadata } from "next";
import { routing } from "./routing";

// hreflang for the seven languages.
//
// Without it a search engine sees seven near-identical pages and has to guess:
// it may fold them into one result, and it may hand a German searcher the Greek
// page. These links say "same page, different language — pick by the reader".
//
// This cannot live in the layout, which is where the rest of the metadata sits.
// `generateMetadata` gets no pathname, so a layout can only ever emit one fixed
// set of links, and every page would inherit them — `/de/terms` would then
// claim its French twin is the home page, which is worse than saying nothing.
// So each indexable page passes its own path and this builds the set.
//
// Paths are relative on purpose: Next resolves them against the `metadataBase`
// set in the layout, so the origin is configured once and follows the
// deployment (localhost, a Vercel preview, casaplaya.gr).

/**
 * @param path Locale-less, leading slash, no trailing one — `/terms`, or `/`
 *             for the home page.
 */
export function localeAlternates(path: string): Metadata["alternates"] {
  const forLocale = (locale: string) => {
    // `localePrefix: "as-needed"` — Greek is the bare path, the rest prefixed.
    if (locale === routing.defaultLocale) return path;
    return path === "/" ? `/${locale}` : `/${locale}${path}`;
  };

  return {
    languages: {
      ...Object.fromEntries(
        routing.locales.map((locale) => [locale, forLocale(locale)]),
      ),
      // Where a reader goes whose language matches none of the seven. English,
      // not Greek: the people this catches are foreign visitors, and English is
      // the one they are likeliest to read. Note this is deliberately NOT the
      // default locale — the site still serves Greek at the unprefixed URL.
      "x-default": forLocale("en"),
    },
  };
}

/**
 * The same, plus the canonical URL for the locale being rendered — the page's
 * own address, so a `?ref=` or a stray query string does not read as a separate
 * page.
 */
export function localeMetadata(path: string, locale: string): Metadata {
  const alternates = localeAlternates(path);
  const languages = alternates?.languages as Record<string, string>;

  return {
    alternates: {
      ...alternates,
      canonical: languages[locale] ?? path,
    },
  };
}
