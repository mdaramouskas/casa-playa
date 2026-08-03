import { prisma } from "@/lib/prisma";
import { addressLine, business } from "@/lib/business";
import { formatPrice } from "@/lib/money";
import { RESCHEDULE_CUTOFF_DAYS, RESCHEDULE_MAX_FORWARD_DAYS } from "@/lib/reschedule";
import { sendMail } from "./mailjet";

// The confirmation the customer gets once a booking is paid. It is the only
// thing they can show on arrival, so it leads with the reference and says what
// the chosen time actually means — which differs by product.
//
// The copy lives here rather than in `messages/*.json` on purpose: this is a
// different medium from the site, the strings are interleaved with HTML, and
// nothing else renders them. next-intl also expects a request context, which a
// payment callback outside `[locale]` does not have.

type Copy = {
  subject: (reference: string) => string;
  greeting: (name: string) => string;
  confirmed: string;
  reference: string;
  what: string;
  date: string;
  /** Beds: the booking is all day and the time is only an arrival time. */
  arrivalTime: string;
  /** Restaurant: the time is the reservation itself. */
  reservationTime: string;
  allDayNote: string;
  persons: string;
  total: string;
  vatIncluded: string;
  noPrepayment: string;
  policyTitle: string;
  policyBody: string;
  rescheduleBody: (cutoff: number, window: number) => string;
  statement: (name: string) => string;
  questions: string;
  notAnInvoice: string;
};

const COPY: Record<"el" | "en", Copy> = {
  el: {
    subject: (reference) => `Επιβεβαίωση κράτησης ${reference} — Casa Playa`,
    greeting: (name) => `Γεια σας ${name},`,
    confirmed: "Η κράτησή σας επιβεβαιώθηκε και η πληρωμή ολοκληρώθηκε.",
    reference: "Κωδικός κράτησης",
    what: "Κράτηση",
    date: "Ημερομηνία",
    arrivalTime: "Ώρα άφιξης",
    reservationTime: "Ώρα κράτησης",
    allDayNote: "Η κράτηση ισχύει για όλη την ημέρα — η ώρα είναι μόνο η ώρα άφιξής σας.",
    persons: "Άτομα",
    total: "Σύνολο",
    vatIncluded: "με ΦΠΑ 24%",
    noPrepayment: "Χωρίς προπληρωμή",
    policyTitle: "Ακύρωση και αλλαγή ημερομηνίας",
    policyBody:
      "Η κράτηση δεν είναι επιστρέψιμη. Σε ακύρωση, μη εμφάνιση ή άφιξη μετά τις 12:00 ισχύει χρέωση 100%.",
    rescheduleBody: (cutoff, window) =>
      `Μπορείτε να ζητήσετε αλλαγή ημερομηνίας έως ${cutoff} ημέρες πριν, με νέα ημερομηνία έως ${window} ημέρες μετά την αρχική. Η τιμή παραμένει η ίδια.`,
    statement: (name) =>
      `Στο αντίγραφο κίνησης της κάρτας σας η χρέωση εμφανίζεται ως ${name}.`,
    questions: "Για οποιαδήποτε απορία, απαντήστε σε αυτό το email ή τηλεφωνήστε μας.",
    notAnInvoice:
      "Το παρόν αποτελεί επιβεβαίωση κράτησης, όχι φορολογικό παραστατικό. Η απόδειξη εκδίδεται επιτόπου.",
  },
  en: {
    subject: (reference) => `Booking confirmation ${reference} — Casa Playa`,
    greeting: (name) => `Hello ${name},`,
    confirmed: "Your booking is confirmed and your payment went through.",
    reference: "Booking reference",
    what: "Booking",
    date: "Date",
    arrivalTime: "Arrival time",
    reservationTime: "Reservation time",
    allDayNote:
      "The booking covers the whole day — the time is only when you plan to arrive.",
    persons: "People",
    total: "Total",
    vatIncluded: "incl. 24% VAT",
    noPrepayment: "No prepayment",
    policyTitle: "Cancellation and date changes",
    policyBody:
      "This booking is non-refundable. Cancellation, no-show or arrival after 12:00 is charged in full.",
    rescheduleBody: (cutoff, window) =>
      `You can ask to move the date up to ${cutoff} days beforehand, to a new date at most ${window} days after the original one. The price stays the same.`,
    statement: (name) => `On your card statement this charge appears as ${name}.`,
    questions: "If anything is unclear, reply to this email or give us a call.",
    notAnInvoice:
      "This is a booking confirmation, not a tax document. The receipt is issued on site.",
  },
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDate(date: Date, locale: "el" | "en"): string {
  return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "el-GR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC", // stored as UTC midnight; anything else shifts the day
  }).format(date);
}

interface Row {
  label: string;
  value: string;
}

function render(rows: Row[], copy: Copy, extras: {
  reference: string;
  greeting: string;
  allDay: boolean;
  paid: boolean;
}) {
  const contact = `${business.phones.join(" · ")} · ${business.email}`;
  const identity = `${business.legalName} · ΑΦΜ ${business.vatNumber} · ${addressLine()}`;

  const text = [
    extras.greeting,
    "",
    copy.confirmed,
    "",
    `${copy.reference}: ${extras.reference}`,
    "",
    ...rows.map((row) => `${row.label}: ${row.value}`),
    ...(extras.allDay ? ["", copy.allDayNote] : []),
    "",
    `— ${copy.policyTitle} —`,
    copy.policyBody,
    copy.rescheduleBody(RESCHEDULE_CUTOFF_DAYS, RESCHEDULE_MAX_FORWARD_DAYS),
    ...(extras.paid ? ["", copy.statement(business.tradeName)] : []),
    "",
    copy.questions,
    contact,
    "",
    copy.notAnInvoice,
    identity,
  ].join("\n");

  const html = `<!doctype html>
<html><body style="margin:0;padding:24px;background:#f5f5f4;font-family:Helvetica,Arial,sans-serif;color:#1c1917">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px">
    <tr><td style="padding:32px">
      <p style="margin:0 0 16px">${escapeHtml(extras.greeting)}</p>
      <p style="margin:0 0 24px">${escapeHtml(copy.confirmed)}</p>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f4;border-radius:8px">
        <tr><td style="padding:16px 20px">
          <div style="font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:#57534e">${escapeHtml(copy.reference)}</div>
          <div style="font-size:22px;font-weight:700;letter-spacing:.02em">${escapeHtml(extras.reference)}</div>
        </td></tr>
      </table>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px;font-size:14px">
        ${rows
          .map(
            (row) => `<tr>
          <td style="padding:6px 0;color:#57534e">${escapeHtml(row.label)}</td>
          <td style="padding:6px 0;text-align:right;font-weight:600">${escapeHtml(row.value)}</td>
        </tr>`,
          )
          .join("")}
      </table>

      ${extras.allDay ? `<p style="margin:16px 0 0;font-size:13px;color:#57534e">${escapeHtml(copy.allDayNote)}</p>` : ""}

      <h2 style="margin:28px 0 8px;font-size:15px">${escapeHtml(copy.policyTitle)}</h2>
      <p style="margin:0 0 8px;font-size:13px;color:#57534e">${escapeHtml(copy.policyBody)}</p>
      <p style="margin:0;font-size:13px;color:#57534e">${escapeHtml(copy.rescheduleBody(RESCHEDULE_CUTOFF_DAYS, RESCHEDULE_MAX_FORWARD_DAYS))}</p>

      ${extras.paid ? `<p style="margin:20px 0 0;font-size:13px;color:#57534e">${escapeHtml(copy.statement(business.tradeName))}</p>` : ""}

      <p style="margin:28px 0 4px;font-size:13px">${escapeHtml(copy.questions)}</p>
      <p style="margin:0;font-size:13px;color:#57534e">${escapeHtml(contact)}</p>
    </td></tr>
  </table>

  <p style="max-width:560px;margin:16px auto 0;font-size:11px;line-height:1.6;color:#78716c">
    ${escapeHtml(copy.notAnInvoice)}<br>${escapeHtml(identity)}
  </p>
</body></html>`;

  return { text, html };
}

/** Everything the message needs — a `Booking` with its product joined. */
export interface ConfirmableBooking {
  reference: string;
  bookingDate: Date;
  timeSlot: string | null;
  persons: number;
  totalCents: number;
  variantName: string | null;
  firstName: string;
  lastName: string;
  email: string;
  product: { name: string; nameEn: string | null; slotKind: string };
}

/**
 * Builds the message. Separate from sending so it can be rendered and read
 * without a mail provider, a database or a paid booking.
 */
export function buildBookingConfirmation(
  booking: ConfirmableBooking,
  locale: "el" | "en",
) {
  const copy = COPY[locale];
  const english = locale === "en";
  const productName =
    (english ? booking.product.nameEn : booking.product.name) ??
    booking.product.name;

  const allDay = booking.product.slotKind === "ARRIVAL";

  const rows: Row[] = [
    {
      label: copy.what,
      value: [productName, booking.variantName].filter(Boolean).join(" — "),
    },
    { label: copy.date, value: formatDate(booking.bookingDate, locale) },
  ];
  if (booking.timeSlot) {
    rows.push({
      label: allDay ? copy.arrivalTime : copy.reservationTime,
      value: booking.timeSlot,
    });
  }
  rows.push({ label: copy.persons, value: String(booking.persons) });
  rows.push({
    label: copy.total,
    value:
      booking.totalCents > 0
        ? `${formatPrice(booking.totalCents)} (${copy.vatIncluded})`
        : copy.noPrepayment,
  });

  const { text, html } = render(rows, copy, {
    reference: booking.reference,
    greeting: copy.greeting(booking.firstName),
    allDay,
    paid: booking.totalCents > 0,
  });

  return { subject: copy.subject(booking.reference), text, html };
}

/**
 * Sends the confirmation for a booking that has just become PAID.
 *
 * `locale` is passed in rather than read from the booking: the customer's
 * language is not a column — it travels in the gateway's `Parameters` for a
 * paid booking, and is simply known at the call site for a free one.
 *
 * Returns whether the mail went out. Callers must not fail on `false` — see
 * `sendMail`.
 */
export async function sendBookingConfirmation(
  bookingId: string,
  locale: "el" | "en",
): Promise<boolean> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { product: true },
  });
  if (!booking) return false;

  const { subject, text, html } = buildBookingConfirmation(booking, locale);

  return sendMail({
    to: booking.email,
    toName: `${booking.firstName} ${booking.lastName}`,
    subject,
    text,
    html,
    customId: booking.reference,
  });
}
