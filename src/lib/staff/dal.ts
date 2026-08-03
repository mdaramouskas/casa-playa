import { cache } from "react";
import { redirect } from "next/navigation";
import { readSession, type StaffSession } from "./session";

// The one place the panel decides who is allowed in.
//
// Following the Next.js authentication guide: the check lives next to the data
// rather than only in the proxy, so a page or action that forgets to ask is the
// exception, not the rule. `cache` keeps it to a single verification per render
// pass even when several components ask.

export const getStaffSession = cache(
  async (): Promise<StaffSession | null> => readSession(),
);

/** For pages and actions that require a signed-in user. Redirects if not. */
export async function requireStaff(): Promise<StaffSession> {
  const session = await getStaffSession();
  if (!session) redirect("/admin/login");
  return session;
}

/** For the few things only an administrator may do. */
export async function requireAdmin(): Promise<StaffSession> {
  const session = await requireStaff();
  if (session.role !== "ADMIN") redirect("/admin");
  return session;
}
