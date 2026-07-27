import { randomInt } from "crypto";

// Booking reference format: CAPL.XXXXXXXXXX (10 uppercase base32-ish chars).
// Excludes ambiguous characters (0/O, 1/I) for readability over the phone.
const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const PREFIX = "CAPL";
const LENGTH = 10;

export function generateBookingReference(): string {
  let code = "";
  for (let i = 0; i < LENGTH; i++) {
    code += ALPHABET[randomInt(ALPHABET.length)];
  }
  return `${PREFIX}.${code}`;
}
