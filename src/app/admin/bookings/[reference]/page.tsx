import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/money";
import {
  RESCHEDULE_CUTOFF_DAYS,
  RESCHEDULE_MAX_FORWARD_DAYS,
  canReschedule,
} from "@/lib/reschedule";
import { requireStaff } from "@/lib/staff/dal";
import { AdminHeader } from "../../admin-header";
import { StatusBadge } from "../../status-badge";
import { RescheduleForm } from "./reschedule-form";

export const dynamic = "force-dynamic";

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function formatDay(date: Date): string {
  return isoDay(date).split("-").reverse().join("/");
}

export default async function BookingDetailPage({
  params,
}: {
  params: Promise<{ reference: string }>;
}) {
  const session = await requireStaff();
  const { reference } = await params;

  const booking = await prisma.booking.findUnique({
    where: { reference: decodeURIComponent(reference) },
    include: { product: true, items: true, payment: true },
  });
  if (!booking) notFound();

  // The cutoff runs from the first date ever booked, so repeated moves cannot
  // walk the booking forward indefinitely.
  const original = booking.originalBookingDate ?? booking.bookingDate;
  const movable = booking.status === "PAID" && canReschedule(original);

  const details: [string, React.ReactNode][] = [
    ["Προϊόν", `${booking.product.name}${booking.variantName ? ` · ${booking.variantName}` : ""}`],
    ["Ημερομηνία", formatDay(booking.bookingDate)],
    [
      booking.product.slotKind === "ARRIVAL" ? "Ώρα άφιξης" : "Ώρα κράτησης",
      booking.timeSlot ?? "—",
    ],
    ["Άτομα", String(booking.persons)],
    ["Μονάδες (σετ/τραπέζια)", String(booking.units)],
    ["Πελάτης", `${booking.lastName} ${booking.firstName}`],
    ["Email", booking.email],
    ["Τηλέφωνο", booking.phone],
    ["Σχόλια", booking.comments || "—"],
    ["Δημιουργήθηκε", booking.createdAt.toLocaleString("el-GR")],
  ];

  if (booking.originalBookingDate) {
    details.splice(2, 0, [
      "Αρχική ημερομηνία",
      `${formatDay(booking.originalBookingDate)} (${booking.rescheduleCount} αλλαγές)`,
    ]);
  }

  const payment = booking.payment;

  return (
    <>
      <AdminHeader session={session} />

      <main className="mx-auto w-full max-w-3xl px-6 py-8">
        <Link href="/admin" className="text-sm text-sky-800 hover:underline">
          ← Πίσω στις κρατήσεις
        </Link>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">
            {booking.reference}
          </h1>
          <StatusBadge status={booking.status} />
        </div>

        <section className="mt-6 rounded-2xl border border-neutral-200 bg-white p-6">
          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-[12rem_1fr]">
            {details.map(([label, value]) => (
              <div key={label} className="contents">
                <dt className="text-sm text-neutral-600">{label}</dt>
                <dd className="text-sm font-medium">{value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="mt-6 rounded-2xl border border-neutral-200 bg-white p-6">
          <h2 className="font-semibold">Χρέωση</h2>
          <ul className="mt-3 space-y-1 text-sm">
            {booking.items.map((item) => (
              <li key={item.id} className="flex justify-between gap-4">
                <span>
                  {item.quantity} × {item.label}
                </span>
                <span>{formatPrice(item.totalCents)}</span>
              </li>
            ))}
          </ul>
          {booking.discountCents > 0 && (
            <p className="mt-2 flex justify-between text-sm">
              <span>Έκπτωση{booking.couponCode ? ` (${booking.couponCode})` : ""}</span>
              <span>−{formatPrice(booking.discountCents)}</span>
            </p>
          )}
          <p className="mt-3 flex justify-between border-t border-neutral-200 pt-3 font-semibold">
            <span>Σύνολο</span>
            <span>
              {booking.totalCents > 0
                ? `${formatPrice(booking.totalCents)} (με ΦΠΑ 24%)`
                : "Χωρίς προπληρωμή"}
            </span>
          </p>

          {payment && (
            <dl className="mt-5 grid gap-x-6 gap-y-2 border-t border-neutral-200 pt-4 text-sm sm:grid-cols-[12rem_1fr]">
              {/* SupportReferenceID is the value Euronet asks for when we
                  report a problem with a transaction — keep it visible. */}
              {[
                ["SupportReferenceID", payment.supportReferenceId],
                ["TransactionId", payment.transactionId],
                ["Κωδικός έγκρισης", payment.approvalCode],
                ["Τρόπος πληρωμής", payment.paymentMethod],
                ["Επαληθευμένο HashKey", payment.hmacVerified ? "ναι" : "όχι"],
              ]
                .filter(([, value]) => value)
                .map(([label, value]) => (
                  <div key={String(label)} className="contents">
                    <dt className="text-neutral-600">{label}</dt>
                    <dd className="font-mono text-xs">{value}</dd>
                  </div>
                ))}
            </dl>
          )}
        </section>

        <section className="mt-6 rounded-2xl border border-neutral-200 bg-white p-6">
          <h2 className="font-semibold">Αλλαγή ημερομηνίας</h2>
          <p className="mt-1 text-sm text-neutral-600">
            Επιτρέπεται έως {RESCHEDULE_CUTOFF_DAYS} ημέρες πριν την αρχική
            ημερομηνία, με νέα ημερομηνία έως {RESCHEDULE_MAX_FORWARD_DAYS}{" "}
            ημέρες μετά από αυτήν. Το ποσό δεν αλλάζει — δεν γίνεται ούτε
            χρέωση ούτε επιστροφή.
          </p>

          {movable ? (
            <RescheduleForm
              reference={booking.reference}
              current={isoDay(booking.bookingDate)}
              min={isoDay(original)}
              max={isoDay(
                new Date(
                  original.getTime() +
                    RESCHEDULE_MAX_FORWARD_DAYS * 24 * 60 * 60 * 1000,
                ),
              )}
            />
          ) : (
            <p className="mt-4 rounded-lg bg-neutral-100 px-4 py-3 text-sm text-neutral-700">
              {booking.status !== "PAID"
                ? "Η κράτηση δεν είναι πληρωμένη, οπότε δεν αλλάζει ημερομηνία."
                : "Έχει περάσει το όριο των 2 ημερών πριν την κράτηση."}
            </p>
          )}
        </section>
      </main>
    </>
  );
}
