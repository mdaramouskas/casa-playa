// The background footage now runs behind every page, not just the home page, so
// every block of content needs a surface of its own — otherwise it is words on
// moving video and nothing is readable.
//
// The two looks live here rather than being retyped at each call site because
// the whole point of them is that they match: a customer moving from the list
// to a product to the terms should feel one site, not three.

/**
 * Cards, lists and forms. Deliberately short of opaque — the footage reading
 * through the panels is what keeps the beach present while you book.
 */
export const PANEL =
  "rounded-2xl border border-white/50 bg-white/70 shadow-xl backdrop-blur-xs";

/**
 * Pages that are mostly prose (terms, privacy, security). Same shape, but
 * denser: a paragraph you actually have to read beats the view behind it, and
 * these are the pages the card schemes expect to be legible.
 */
export const READING_PANEL =
  "rounded-2xl border border-white/50 bg-white/90 shadow-xl backdrop-blur-sm";
