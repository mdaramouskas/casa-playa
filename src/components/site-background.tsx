"use client";

import { useSyncExternalStore } from "react";

// The beach playing behind every page of the site, not just a band at the top
// of the home page. Rendered once from the locale layout; the content floats
// over it on the translucent panels in `panel.ts`, so the video reads through
// the gutters and, faintly, through the panels themselves.
//
// The one page that covers it deliberately is the mock payment page, which is a
// replica of the bank's own and must never be mistaken for ours.
//
// Most bookings will come from a phone, so the phone is not the afterthought.
// The same shot is cut twice — a landscape crop for wide screens and a 4:5 crop
// for narrow ones. Serving only the landscape cut would have thrown away about
// 40% of each side on a portrait screen. Both recipes are in `docs/media.md`.
//
// The still frames are plain CSS backgrounds, so the page is filled on the
// server with no JavaScript at all. The video is picked after hydration and
// layered over them, so exactly one file is ever downloaded — never both.

type Cut = "portrait" | "landscape";

const WIDE = "(min-width: 768px)";

function subscribe(onChange: () => void) {
  const query = window.matchMedia(WIDE);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function readCut(): Cut | null {
  // Someone who asked their system for less motion gets the still, full stop.
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return null;

  // Data Saver too: a background flourish is not worth someone's megabytes
  // when they have told the browser they are counting them.
  const connection = (
    navigator as Navigator & { connection?: { saveData?: boolean } }
  ).connection;
  if (connection?.saveData) return null;

  return window.matchMedia(WIDE).matches ? "landscape" : "portrait";
}

/** No video until the client has told us which cut and whether at all. */
const readCutOnServer = (): Cut | null => null;

export function SiteBackground() {
  const cut = useSyncExternalStore(subscribe, readCut, readCutOnServer);
  const file = cut === "landscape" ? "hero" : "hero-portrait";

  return (
    <div aria-hidden="true" className="fixed inset-0 -z-10 overflow-hidden">
      {/* Server-rendered stills: visible instantly, and the entire background
          when there is no video — reduced motion, Data Saver, or no JS. */}
      <div
        className="absolute inset-0 bg-cover bg-center md:hidden"
        style={{ backgroundImage: "url('/video/hero-poster-portrait.jpg')" }}
      />
      <div
        className="absolute inset-0 hidden bg-cover bg-center md:block"
        style={{ backgroundImage: "url('/video/hero-poster.jpg')" }}
      />

      {cut && (
        <video
          // muted and playsInline are what make autoplay legal on iOS and
          // Chrome; without both the browser silently refuses.
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          // H.264 only. A VP9/WebM cut of this footage came out consistently
          // LARGER than the MP4, and since the browser takes the first source
          // it can play, offering it first meant Chrome and Firefox downloading
          // the heavier file for nothing. MP4 plays everywhere.
          src={`/video/${file}.mp4`}
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}

      {/* Was 45%, for white hero headings sitting straight on bright midday
          footage. Those headings are gone, and nothing white sits on the video
          any more — header and footer are solid bands, everything else is on
          a panel. So the scrim now only has to give the panels an edge, and at
          25% the footage actually reads through them instead of arriving as
          grey. Lighter here also means darker text on the panels is easier to
          read, not harder: the backdrop it competes with is brighter. */}
      <div className="absolute inset-0 bg-black/25" />
    </div>
  );
}
