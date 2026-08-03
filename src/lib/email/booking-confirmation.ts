import { localeTags, type Locale } from "@/i18n/routing";
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

// One entry per site language. The email is the only thing the customer can
// show on arrival, and the one message they get after paying — sending it in a
// language they did not choose is where a booking flow stops feeling
// translated, so the copy is carried in all seven rather than falling back.
const COPY: Record<Locale, Copy> = {
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
  de: {
    subject: (reference) => `Buchungsbestätigung ${reference} — Casa Playa`,
    greeting: (name) => `Hallo ${name},`,
    confirmed: "Ihre Buchung ist bestätigt und Ihre Zahlung ist eingegangen.",
    reference: "Buchungsnummer",
    what: "Buchung",
    date: "Datum",
    arrivalTime: "Ankunftszeit",
    reservationTime: "Reservierungszeit",
    allDayNote:
      "Die Buchung gilt für den ganzen Tag — die Uhrzeit ist nur Ihre geplante Ankunft.",
    persons: "Personen",
    total: "Gesamt",
    vatIncluded: "inkl. 24 % MwSt.",
    noPrepayment: "Keine Vorauszahlung",
    policyTitle: "Stornierung und Datumsänderung",
    policyBody:
      "Diese Buchung ist nicht erstattungsfähig. Bei Stornierung, Nichterscheinen oder Ankunft nach 12:00 Uhr wird der volle Betrag berechnet.",
    rescheduleBody: (cutoff, window) =>
      `Sie können bis zu ${cutoff} Tage vorher eine Datumsänderung beantragen, auf ein neues Datum höchstens ${window} Tage nach dem ursprünglichen. Der Preis bleibt gleich.`,
    statement: (name) =>
      `Auf Ihrer Kartenabrechnung erscheint diese Buchung als ${name}.`,
    questions:
      "Wenn etwas unklar ist, antworten Sie einfach auf diese E-Mail oder rufen Sie uns an.",
    notAnInvoice:
      "Dies ist eine Buchungsbestätigung, kein Steuerbeleg. Der Beleg wird vor Ort ausgestellt.",
  },
  ru: {
    subject: (reference) => `Подтверждение брони ${reference} — Casa Playa`,
    greeting: (name) => `Здравствуйте, ${name}!`,
    confirmed: "Ваша бронь подтверждена, платёж прошёл.",
    reference: "Номер брони",
    what: "Бронь",
    date: "Дата",
    arrivalTime: "Время прибытия",
    reservationTime: "Время брони",
    allDayNote:
      "Бронь действует на весь день — указанное время это лишь время вашего прибытия.",
    persons: "Гостей",
    total: "Итого",
    vatIncluded: "включая НДС 24 %",
    noPrepayment: "Без предоплаты",
    policyTitle: "Отмена и перенос даты",
    policyBody:
      "Эта бронь не подлежит возврату. При отмене, неявке или прибытии после 12:00 удерживается полная сумма.",
    rescheduleBody: (cutoff, window) =>
      `Вы можете попросить перенести дату не позднее чем за ${cutoff} дн. до неё, на новую дату не более чем через ${window} дн. после первоначальной. Цена остаётся прежней.`,
    statement: (name) =>
      `В выписке по карте это списание отображается как ${name}.`,
    questions:
      "Если что-то неясно, ответьте на это письмо или позвоните нам.",
    notAnInvoice:
      "Это подтверждение брони, а не налоговый документ. Чек выдаётся на месте.",
  },
  it: {
    subject: (reference) => `Conferma di prenotazione ${reference} — Casa Playa`,
    greeting: (name) => `Ciao ${name},`,
    confirmed: "La tua prenotazione è confermata e il pagamento è andato a buon fine.",
    reference: "Codice prenotazione",
    what: "Prenotazione",
    date: "Data",
    arrivalTime: "Orario di arrivo",
    reservationTime: "Orario della prenotazione",
    allDayNote:
      "La prenotazione vale per l'intera giornata — l'orario indica solo quando pensi di arrivare.",
    persons: "Persone",
    total: "Totale",
    vatIncluded: "IVA 24% inclusa",
    noPrepayment: "Senza prepagamento",
    policyTitle: "Cancellazione e cambio data",
    policyBody:
      "Questa prenotazione non è rimborsabile. Cancellazione, mancata presentazione o arrivo dopo le 12:00 comportano l'addebito dell'intero importo.",
    rescheduleBody: (cutoff, window) =>
      `Puoi chiedere di spostare la data fino a ${cutoff} giorni prima, a una nuova data al massimo ${window} giorni dopo quella originaria. Il prezzo resta lo stesso.`,
    statement: (name) =>
      `Sull'estratto conto della carta l'addebito appare come ${name}.`,
    questions:
      "Se qualcosa non è chiaro, rispondi a questa email o chiamaci.",
    notAnInvoice:
      "Questa è una conferma di prenotazione, non un documento fiscale. La ricevuta viene emessa sul posto.",
  },
  fr: {
    subject: (reference) => `Confirmation de réservation ${reference} — Casa Playa`,
    greeting: (name) => `Bonjour ${name},`,
    confirmed: "Votre réservation est confirmée et votre paiement a été accepté.",
    reference: "Numéro de réservation",
    what: "Réservation",
    date: "Date",
    arrivalTime: "Heure d'arrivée",
    reservationTime: "Heure de la réservation",
    allDayNote:
      "La réservation couvre la journée entière — l'heure indique seulement quand vous comptez arriver.",
    persons: "Personnes",
    total: "Total",
    vatIncluded: "TVA 24 % incluse",
    noPrepayment: "Sans prépaiement",
    policyTitle: "Annulation et changement de date",
    policyBody:
      "Cette réservation n'est pas remboursable. En cas d'annulation, d'absence ou d'arrivée après 12h00, la totalité du montant est facturée.",
    rescheduleBody: (cutoff, window) =>
      `Vous pouvez demander à décaler la date jusqu'à ${cutoff} jours à l'avance, vers une nouvelle date au plus ${window} jours après la date initiale. Le prix reste inchangé.`,
    statement: (name) =>
      `Sur votre relevé de carte, ce débit apparaît sous le nom ${name}.`,
    questions:
      "Si quelque chose n'est pas clair, répondez à cet e-mail ou appelez-nous.",
    notAnInvoice:
      "Ceci est une confirmation de réservation, pas un document fiscal. Le reçu est délivré sur place.",
  },
  es: {
    subject: (reference) => `Confirmación de reserva ${reference} — Casa Playa`,
    greeting: (name) => `Hola ${name}:`,
    confirmed: "Tu reserva está confirmada y el pago se ha realizado.",
    reference: "Código de reserva",
    what: "Reserva",
    date: "Fecha",
    arrivalTime: "Hora de llegada",
    reservationTime: "Hora de la reserva",
    allDayNote:
      "La reserva cubre el día completo — la hora indica solo cuándo piensas llegar.",
    persons: "Personas",
    total: "Total",
    vatIncluded: "IVA 24 % incluido",
    noPrepayment: "Sin pago por adelantado",
    policyTitle: "Cancelación y cambio de fecha",
    policyBody:
      "Esta reserva no es reembolsable. La cancelación, la no presentación o la llegada después de las 12:00 se cobran íntegramente.",
    rescheduleBody: (cutoff, window) =>
      `Puedes pedir cambiar la fecha hasta ${cutoff} días antes, a una nueva fecha como máximo ${window} días posterior a la original. El precio no varía.`,
    statement: (name) =>
      `En el extracto de tu tarjeta este cargo aparece como ${name}.`,
    questions:
      "Si algo no queda claro, responde a este correo o llámanos.",
    notAnInvoice:
      "Esto es una confirmación de reserva, no un documento fiscal. El recibo se emite en el local.",
  },
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDate(date: Date, locale: Locale): string {
  return new Intl.DateTimeFormat(localeTags[locale], {
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
  locale: Locale,
) {
  const copy = COPY[locale];
  // The product name has only the two catalog columns behind it, so everyone
  // outside Greek reads the English one — same fallback as the site's catalog.
  const english = locale !== "el";
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
  locale: Locale,
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
