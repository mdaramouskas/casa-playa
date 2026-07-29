// Card-scheme and 3-D Secure artwork required by the Redirection Manual §8
// ("Χρήση Εικονιδίων"). Every file under /public/payment is the untouched
// original from the Icons.zip that ships with the manual — the schemes require
// their own artwork, so nothing here may be redrawn or recoloured.
//
// §8 is not advisory. Visa/Mastercard/Maestro marks and the Visa Secure +
// Mastercard Identity Check marks "πρέπει να εμφανίζονται στην αρχική σελίδα
// του site", and the 3-D Secure marks additionally on a security page if one
// exists. Euronet checks this before approving a live account.

export interface Brand {
  src: string;
  /** Alt text is the scheme's own name — never translated. */
  alt: string;
  width: number;
  height: number;
}

/** Always accepted through Paycenter Redirection (§8). */
const BASE_CARD_BRANDS: Brand[] = [
  { src: "/payment/visa.png", alt: "Visa", width: 1000, height: 324 },
  { src: "/payment/mastercard.svg", alt: "Mastercard", width: 152, height: 108 },
  { src: "/payment/maestro.svg", alt: "Maestro", width: 408, height: 110 },
];

/**
 * §8/§2: Diners, Discover and American Express only work once Euronet has
 * enabled them on the merchant agreement, and their marks must not be shown
 * before that. Flip them on with PAYCENTER_EXTRA_SCHEMES once it is signed —
 * e.g. `PAYCENTER_EXTRA_SCHEMES=amex,diners,discover`.
 */
const EXTRA_CARD_BRANDS: Record<string, Brand> = {
  amex: {
    src: "/payment/amex.png",
    alt: "American Express",
    width: 1600,
    height: 1600,
  },
  diners: { src: "/payment/diners.jpg", alt: "Diners Club", width: 40, height: 25 },
  discover: { src: "/payment/discover.jpg", alt: "Discover", width: 40, height: 25 },
};

const VISA_SECURE: Brand = {
  src: "/payment/visa-secure.jpg",
  alt: "Visa Secure",
  width: 396,
  height: 396,
};

const IDENTITY_CHECK: Brand = {
  src: "/payment/mastercard-identity-check.svg",
  alt: "Mastercard Identity Check",
  width: 479,
  height: 172,
};

/** §8: only shown when American Express is actually accepted. */
const SAFEKEY: Brand = {
  src: "/payment/safekey.svg",
  alt: "American Express SafeKey",
  width: 316,
  height: 108,
};

export const EPAY_LOGO: Brand = {
  src: "/payment/epay.png",
  alt: "epay",
  width: 1251,
  height: 311,
};

export const IRIS_LOGO: Brand = {
  src: "/payment/iris.png",
  alt: "IRIS",
  width: 2000,
  height: 820,
};

function enabledExtras(): string[] {
  return (process.env.PAYCENTER_EXTRA_SCHEMES ?? "")
    .split(",")
    .map((scheme) => scheme.trim().toLowerCase())
    .filter((scheme) => scheme in EXTRA_CARD_BRANDS);
}

export function acceptsAmex(): boolean {
  return enabledExtras().includes("amex");
}

/** The card marks to display, in the order §8 lists them. */
export function cardBrands(): Brand[] {
  return [
    ...BASE_CARD_BRANDS,
    ...enabledExtras().map((scheme) => EXTRA_CARD_BRANDS[scheme]),
  ];
}

/** The strong-authentication marks to display (§8). */
export function secureBrands(): Brand[] {
  return acceptsAmex()
    ? [VISA_SECURE, IDENTITY_CHECK, SAFEKEY]
    : [VISA_SECURE, IDENTITY_CHECK];
}
