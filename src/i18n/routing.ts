import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["el", "en"],
  defaultLocale: "el",
  localePrefix: "as-needed", // Greek (default) has no /el prefix; English is /en
});

export type Locale = (typeof routing.locales)[number];
