"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { routing, localeNames, type Locale } from "@/i18n/routing";
import { flags } from "@/components/flags";

// The same control the legacy booking engine puts in its header: the current
// flag, and a list of the rest under it.
//
// Every entry is a real <Link> to the same page in another language, so it
// middle-clicks, opens in a new tab and lands on the page you were reading
// rather than the home page. A <select> with an onChange router.push would have
// been fewer lines and none of that.
//
// The list is only in the DOM while the panel is open, so it does not double as
// hreflang markup — search engines want `alternates.languages` per page, which
// is a separate job from this control.
//
// `usePathname` here is next-intl's, not Next's: it returns the path with the
// locale prefix already stripped, which is exactly what `<Link locale>` wants.

export function LanguageSwitcher() {
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);

  // Click-away and Escape. Without these the panel survives a click anywhere
  // else on the page, because navigating with <Link> never unmounts it.
  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const CurrentFlag = flags[locale];

  return (
    <div ref={container} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={localeNames[locale]}
        className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-neutral-700 transition hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-700"
      >
        <CurrentFlag />
        <svg
          viewBox="0 0 12 12"
          aria-hidden="true"
          className={`h-3 w-3 fill-current transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path d="M2 4.5 6 8.5l4-4z" />
        </svg>
      </button>

      {open && (
        <ul
          role="menu"
          className="absolute right-0 z-50 mt-2 min-w-[10rem] overflow-hidden rounded-lg border border-black/10 bg-white py-1 shadow-lg"
        >
          {routing.locales.map((option) => {
            const Flag = flags[option];
            const current = option === locale;
            return (
              <li key={option} role="none">
                <Link
                  href={pathname}
                  locale={option}
                  role="menuitem"
                  hrefLang={option}
                  aria-current={current ? "true" : undefined}
                  onClick={() => setOpen(false)}
                  className={`flex items-center gap-2.5 px-3 py-2 text-sm transition hover:bg-neutral-100 ${
                    current ? "font-semibold text-neutral-900" : "text-neutral-700"
                  }`}
                >
                  <Flag />
                  {localeNames[option]}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
