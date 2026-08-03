import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

// Staff sessions: a signed, stateless JWT in an httpOnly cookie.
//
// Stateless because there is nothing to revoke centrally — the panel has a
// handful of users and a short session. Signed with AUTH_SECRET, so a forged
// cookie cannot mint a role.
//
// Deliberately NOT the same mechanism as the customer-facing site gate: that
// one is HTTP Basic Auth precisely because the bank's response arrives as a
// cross-site POST, which a SameSite=Lax cookie would not survive. The panel
// receives no cross-site posts, so a cookie is the right tool here.

export type StaffRole = "ADMIN" | "STAFF";

export interface StaffSession {
  userId: string;
  email: string;
  name: string | null;
  role: StaffRole;
}

const COOKIE = "cp_staff";
/** A shift, roughly. Long enough not to nag, short enough to matter. */
const MAX_AGE_SECONDS = 12 * 60 * 60;

/**
 * Scoped to the panel: the cookie is never sent with a customer's request, so
 * it cannot leak through the public pages or the payment handoff.
 */
const COOKIE_PATH = "/admin";

function key(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret === "change-me-in-production") {
    throw new Error(
      "AUTH_SECRET is missing or still the placeholder. Generate one with " +
        "`openssl rand -hex 32` — staff sessions are signed with it.",
    );
  }
  return new TextEncoder().encode(secret);
}

export async function createSession(session: StaffSession): Promise<void> {
  const token = await new SignJWT({ ...session })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(key());

  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: COOKIE_PATH,
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function destroySession(): Promise<void> {
  (await cookies()).delete({ name: COOKIE, path: COOKIE_PATH });
}

/** The session, or null if there is none, it expired, or it was tampered with. */
export async function readSession(): Promise<StaffSession | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"] });
    const { userId, email, name, role } = payload as unknown as StaffSession;
    if (!userId || !email || (role !== "ADMIN" && role !== "STAFF")) return null;
    return { userId, email, name: name ?? null, role };
  } catch {
    return null;
  }
}
