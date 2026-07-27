import { createHmac, timingSafeEqual } from "crypto";

// HMAC-SHA256 verification for Paycenter callbacks. Per the brief, EVERY
// callback MUST be verified before a booking is marked paid — an unverified
// callback could falsely claim a successful payment.
//
// The exact field order / concatenation used to build the signed string is
// defined by the bank's Paycenter documentation and will be confirmed with the
// technical consultant. `buildSignedString` centralizes that so there is one
// place to adjust once the spec is in hand.

/** Build the canonical string that the HashKey signs, from callback params. */
export function buildSignedString(params: Record<string, string>): string {
  // Placeholder canonicalization: sorted key=value joined by '&'. REPLACE with
  // the bank-specified concatenation once documented.
  return Object.keys(params)
    .filter((k) => k.toLowerCase() !== "hashkey" && k.toLowerCase() !== "hash")
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
}

export function computeHmac(signedString: string, hashKey: string): string {
  return createHmac("sha256", hashKey)
    .update(signedString, "utf8")
    .digest("hex")
    .toUpperCase();
}

/** Constant-time comparison of the received vs. computed signature. */
export function verifyHmac(
  received: string,
  computed: string,
): boolean {
  if (!received || !computed) return false;
  const a = Buffer.from(received.toUpperCase());
  const b = Buffer.from(computed.toUpperCase());
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function verifyCallback(
  params: Record<string, string>,
  receivedHash: string,
  hashKey: string,
): boolean {
  const signed = buildSignedString(params);
  const computed = computeHmac(signed, hashKey);
  return verifyHmac(receivedHash, computed);
}
