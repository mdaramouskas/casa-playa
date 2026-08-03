// Who the customer is actually paying.
//
// The card-scheme rules require the legal name, VAT number and address to be
// visible on a site that takes payments, and the Redirection manual (§8) makes
// it a condition for getting a live account. One source here so the footer, the
// legal pages and the confirmation email can never drift apart.
//
// Verified against the register on 2026-07-31 (VIES lookup on EL801773715,
// which mirrors the AADE register) — not from the client's memory. Written
// exactly as the register holds it, including "ΟΕ" without dots.

export const business = {
  /** Legal entity — goes on the contract, the footer and the legal pages. */
  legalName: "CASA PLAYA ΟΕ",

  /**
   * Registered trade name. This is the descriptor Euronet prints on the
   * cardholder's statement, so it has to be visible before the customer pays:
   * a charge from a name they do not recognise is a textbook chargeback.
   */
  tradeName: "BANANA BEACH CASA PLAYA",

  /** Short brand used in headings and the booking reference — not legal. */
  brand: "Casa Playa",

  vatNumber: "801773715",

  /** Βασιλικός is a village: the register holds no street or number. */
  address: {
    street: null,
    area: "Βασιλικός",
    postalCode: "29100",
    city: "Ζάκυνθος",
    country: "GR",
  },

  phones: ["+30 26950 35160", "+30 697 69 57 613"],
  email: "bananacasaplaya@gmail.com",
  /** Sender of the booking confirmations — see `lib/email/`. */
  bookingEmail: "kratiseis@casaplaya.gr",
} as const;

/** One line: "Βασιλικός, 29100 Ζάκυνθος". */
export function addressLine(): string {
  const { street, area, postalCode, city } = business.address;
  return [street, area, `${postalCode} ${city}`].filter(Boolean).join(", ");
}

/** "CASA PLAYA ΟΕ · ΑΦΜ 801773715 · Βασιλικός, 29100 Ζάκυνθος" */
export function identityLine(): string {
  return `${business.legalName} · ΑΦΜ ${business.vatNumber} · ${addressLine()}`;
}
