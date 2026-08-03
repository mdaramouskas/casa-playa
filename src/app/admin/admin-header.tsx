import Link from "next/link";
import type { StaffSession } from "@/lib/staff/session";
import { logout } from "./actions";

export function AdminHeader({ session }: { session: StaffSession }) {
  return (
    <header className="border-b border-neutral-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-6 py-4">
        <Link href="/admin" className="font-semibold">
          Casa Playa · Κρατήσεις
        </Link>
        <span className="ml-auto text-sm text-neutral-600">
          {session.name ?? session.email}
          {session.role === "ADMIN" && (
            <span className="ml-2 rounded bg-neutral-100 px-1.5 py-0.5 text-xs">
              διαχειριστής
            </span>
          )}
        </span>
        <form action={logout}>
          <button
            type="submit"
            className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm transition hover:bg-neutral-50"
          >
            Αποσύνδεση
          </button>
        </form>
      </div>
    </header>
  );
}
