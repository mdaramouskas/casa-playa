import { defineRouting } from "next-intl/routing";

// The seven languages the legacy booking engine offers. Zakynthos takes its
// summer from the UK, Italy, Germany and France, so these are the languages
// people actually arrive in — not a guess.
export const routing = defineRouting({
  locales: ["el", "en", "de", "ru", "it", "fr", "es"],
  defaultLocale: "el",
  localePrefix: "as-needed", // Greek (default) has no prefix; the rest are /en, /de, …
});

export type Locale = (typeof routing.locales)[number];

/**
 * Each language named in itself — a German speaker looks for "Deutsch", not
 * for "German". Used by the switcher's labels and its accessible names.
 */
export const localeNames: Record<Locale, string> = {
  el: "Ελληνικά",
  en: "English",
  de: "Deutsch",
  ru: "Русский",
  it: "Italiano",
  fr: "Français",
  es: "Español",
};

/**
 * BCP-47 tags for `Intl` formatting and for anything that wants a region.
 * English is en-GB: the customers are European and the day comes before the
 * month on every other page of the site.
 */
export const localeTags: Record<Locale, string> = {
  el: "el-GR",
  en: "en-GB",
  de: "de-DE",
  ru: "ru-RU",
  it: "it-IT",
  fr: "fr-FR",
  es: "es-ES",
};
