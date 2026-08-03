import Link from "next/link";
import dayjs from "dayjs";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/money";
import { requireStaff } from "@/lib/staff/dal";
import { AdminHeader } from "./admin-header";
import { StatusBadge } from "./status-badge";

// The daily working view: who is coming, and on which day.
//
// Defaults to one day rather than a long list, because that is the question
// actually asked at the bar every morning. A search box cuts across dates for
// when a customer phones up with a reference.

export const dynamic = "force-dynamic";

/** DD/MM/YYYY of a DATE column, read in UTC so the stored day is the shown day. */
function formatDay(date: Date): string {
  return date.toISOString().slice(0, 10).split("-").reverse().join("/");
}

function dayBounds(date: string) {
  // bookingDate is a DATE column written as UTC midnight; comparing in UTC
  // keeps the stored day and the displayed day the same day.
  return {
    gte: new Date(`${date}T00:00:00.000Z`),
    lte: new Date(`${date}T00:00:00.000Z`),
  };
}

export default async function AdminBookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; q?: string; status?: string }>;
}) {
  const session = await requireStaff();
  const { date, q, status } = await searchParams;

  const query = q?.trim() ?? "";
  const selectedDate =
    date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : dayjs().format("YYYY-MM-DD");

  const bookings = await prisma.booking.findMany({
    where: {
      ...(status && status !== "ALL"
        ? { status: status as "PENDING" | "PAID" | "FAILED" | "CANCELLED" }
        : {}),
      // A search is a hunt for one booking, so it ignores the date entirely.
      ...(query
        ? {
            OR: [
              { reference: { contains: query, mode: "insensitive" as const } },
              { lastName: { contains: query, mode: "insensitive" as const } },
              { firstName: { contains: query, mode: "insensitive" as const } },
              { email: { contains: query, mode: "insensitive" as const } },
              { phone: { contains: query } },
            ],
          }
        : { bookingDate: dayBounds(selectedDate) }),
    },
    include: { product: true },
    orderBy: query
      ? [{ bookingDate: "desc" }]
      : [{ timeSlot: "asc" }, { createdAt: "asc" }],
    take: 200,
  });

  const paid = bookings.filter((b) => b.status === "PAID");
  const people = paid.reduce((sum, b) => sum + b.persons, 0);
  const money = paid.reduce((sum, b) => sum + b.totalCents, 0);

  return (
    <>
      <AdminHeader session={session} />

      <main className="mx-auto w-full max-w-6xl px-6 py-8">
        {/* Filters are a plain GET form: every view is a shareable URL, and it
            works with JavaScript disabled on a phone at the beach. */}
        <form className="flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-neutral-600">
              Ημερομηνία
            </span>
            <input
              type="date"
              name="date"
              defaultValue={selectedDate}
              className="rounded-lg border border-neutral-300 bg-white px-3 py-2"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-neutral-600">
              Κατάσταση
            </span>
            <select
              name="status"
              defaultValue={status ?? "ALL"}
              className="rounded-lg border border-neutral-300 bg-white px-3 py-2"
            >
              <option value="ALL">Όλες</option>
              <option value="PAID">Πληρωμένες</option>
              <option value="PENDING">Σε εκκρεμότητα</option>
              <option value="FAILED">Απέτυχαν</option>
              <option value="CANCELLED">Ακυρωμένες</option>
            </select>
          </label>

          <label className="block flex-1 min-w-56">
            <span className="mb-1 block text-xs font-medium text-neutral-600">
              Αναζήτηση σε όλες τις ημερομηνίες
            </span>
            <input
              type="search"
              name="q"
              defaultValue={query}
              placeholder="κωδικός, επώνυμο, email, τηλέφωνο"
              className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2"
            />
          </label>

          <button
            type="submit"
            className="rounded-lg bg-sky-900 px-4 py-2.5 font-medium text-white transition hover:bg-sky-800"
          >
            Εμφάνιση
          </button>
        </form>

        <div className="mt-3 flex gap-3 text-sm">
          <Link className="text-sky-800 hover:underline" href="/admin">
            Σήμερα
          </Link>
          <Link
            className="text-sky-800 hover:underline"
            href={`/admin?date=${dayjs().add(1, "day").format("YYYY-MM-DD")}`}
          >
            Αύριο
          </Link>
        </div>

        <p className="mt-6 text-sm text-neutral-600">
          {query ? (
            <>
              {bookings.length} αποτελέσματα για «{query}»
            </>
          ) : (
            <>
              {dayjs(selectedDate).format("DD/MM/YYYY")} — {paid.length}{" "}
              πληρωμένες κρατήσεις, {people} άτομα, {formatPrice(money)}
            </>
          )}
        </p>

        <div className="mt-3 overflow-x-auto rounded-2xl border border-neutral-200 bg-white">
          <table className="w-full min-w-[52rem] text-sm">
            <thead className="border-b border-neutral-200 text-left text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-4 py-3">Ώρα</th>
                <th className="px-4 py-3">Προϊόν</th>
                <th className="px-4 py-3">Πελάτης</th>
                <th className="px-4 py-3 text-right">Άτομα</th>
                <th className="px-4 py-3 text-right">Ποσό</th>
                <th className="px-4 py-3">Κατάσταση</th>
                <th className="px-4 py-3">Κωδικός</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {bookings.map((booking) => (
                <tr key={booking.id} className="hover:bg-neutral-50">
                  <td className="whitespace-nowrap px-4 py-3">
                    {booking.timeSlot ?? "—"}
                    {/* A search spans dates, so each row has to say which day
                        it is; the single-day view already says so above. */}
                    {query && (
                      <span className="ml-2 text-xs text-neutral-500">
                        {formatDay(booking.bookingDate)}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {booking.product.name}
                    {booking.variantName && (
                      <span className="text-neutral-500">
                        {" "}
                        · {booking.variantName}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {booking.lastName} {booking.firstName}
                    <span className="block text-xs text-neutral-500">
                      {booking.phone}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">{booking.persons}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    {booking.totalCents > 0
                      ? formatPrice(booking.totalCents)
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={booking.status} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <Link
                      href={`/admin/bookings/${booking.reference}`}
                      className="font-medium text-sky-800 hover:underline"
                    >
                      {booking.reference}
                    </Link>
                  </td>
                </tr>
              ))}

              {bookings.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-10 text-center text-neutral-500"
                  >
                    Καμία κράτηση.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </>
  );
}
