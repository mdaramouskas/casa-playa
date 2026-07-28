import { createHmac, timingSafeEqual } from "crypto";

// "HashKey" verification — Redirection Manual §5, "Επαλήθευση «Hash Key»".
//
// Every response must be verified before a booking is marked paid: an
// unverified response could otherwise claim a payment that never happened.
//
// The scheme is NOT a static merchant secret. The signed message is eleven
// fields joined by ";" in a fixed order, and the HMAC-SHA256 key is the
// transaction ticket itself — which is why the ticket must be stored
// server-side per booking and must never reach the browser.

/** The eleven fields, in the exact order the bank concatenates them. */
export interface HashKeyFields {
  /** `TranTicket` from the ticketing WS. Also the HMAC key. */
  tranTicket: string;
  posId: string;
  acquirerId: string;
  merchantReference: string;
  approvalCode: string;
  parameters: string;
  responseCode: string;
  supportReferenceId: string;
  authStatus: string;
  packageNo: string;
  statusFlag: string;
}

const DELIMITER = ";";

export function buildHashKeySource(fields: HashKeyFields): string {
  return [
    fields.tranTicket,
    fields.posId,
    fields.acquirerId,
    fields.merchantReference,
    fields.approvalCode,
    fields.parameters,
    fields.responseCode,
    fields.supportReferenceId,
    fields.authStatus,
    fields.packageNo,
    fields.statusFlag,
  ].join(DELIMITER);
}

/** HMAC-SHA256 keyed with the ticket, uppercase hex (§5). */
export function computeHashKey(fields: HashKeyFields): string {
  return createHmac("sha256", fields.tranTicket)
    .update(buildHashKeySource(fields), "utf8")
    .digest("hex")
    .toUpperCase();
}

/** Constant-time comparison of the received vs. computed HashKey. */
export function hashKeyMatches(received: string, computed: string): boolean {
  if (!received || !computed) return false;
  const a = Buffer.from(received.toUpperCase(), "utf8");
  const b = Buffer.from(computed.toUpperCase(), "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function verifyHashKey(
  fields: HashKeyFields,
  received: string,
): boolean {
  return hashKeyMatches(received, computeHashKey(fields));
}

/**
 * Worked example from Appendix 4 of the manual. Kept here as an executable
 * self-check of the concatenation order and the choice of HMAC key — if the
 * bank ever changes the scheme, this is what fails first.
 */
export const APPENDIX_4_VECTOR: {
  fields: HashKeyFields;
  expected: string;
} = {
  fields: {
    tranTicket: "4236ece6142b4639925eb6f80217122f",
    posId: "99999999",
    acquirerId: "14",
    merchantReference: "Test",
    approvalCode: "389700",
    parameters: "MyParam",
    responseCode: "00",
    supportReferenceId: "364629",
    authStatus: "02",
    packageNo: "1",
    statusFlag: "Success",
  },
  expected: "551F158E669965F30BCFA65E558FD4AABB191D394DE39BE2ADFAB416575102D7",
};

export function selfTest(): boolean {
  return computeHashKey(APPENDIX_4_VECTOR.fields) === APPENDIX_4_VECTOR.expected;
}
