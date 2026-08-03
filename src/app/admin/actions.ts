"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAvailability } from "@/lib/availability";
import { getPaycenterConfig } from "@/lib/paycenter/config";
import {
  issueTicket,
  payFormAction,
  payFormFields,
} from "@/lib/paycenter/gateway";
import { isValidNewDate } from "@/lib/reschedule";
import { requireStaff } from "@/lib/staff/dal";
import {
  createSession,
  destroySession,
  type StaffRole,
} from "@/lib/staff/session";

export interface ActionState {
  error?: string;
  ok?: string;
}

// ── Sign in ───────────────────────────────────────────────────────────

const loginSchema = z.object({
  email: z.email().max(160),
  password: z.string().min(1).max(200),
});

export async function login(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = loginSchema.safeParse({
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
    password: String(formData.get("password") ?? ""),
  });
  // One message for every failure below. Telling the difference between "no
  // such user" and "wrong password" only helps someone who is guessing.
  const rejected: ActionState = { error: "Λάθος email ή κωδικός." };
  if (!parsed.success) return rejected;

  const user = await prisma.staffUser.findUnique({
    where: { email: parsed.data.email },
  });

  // Hash a throwaway value when the user does not exist, so a missing account
  // does not answer noticeably faster than a wrong password.
  const hash =
    user?.passwordHash ?? "$2b$10$invalidinvalidinvalidinvalidinvalidinvalidinv";
  const matches = await bcrypt.compare(parsed.data.password, hash);

  if (!user || !user.active || !matches) return rejected;

  await createSession({
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role as StaffRole,
  });
  await prisma.staffUser.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  redirect("/admin");
}

export async function logout(): Promise<void> {
  await destroySession();
  redirect("/admin/login");
}

// ── Test case 3: RECHARGE ATTEMPT (§7) ────────────────────────────────

export interface RechargeState {
  error?: string;
  /** The form that POSTs the customer to the bank, ready to be rendered. */
  submit?: { action: string; fields: Record<string, string> };
}

/**
 * Deliberately re-declares a `MerchantReference` that already belongs to an
 * approved transaction — the double-charge attempt Euronet requires us to
 * demonstrate before granting a live account.
 *
 * The application refuses to do this through the normal flow, and that refusal
 * is correct: `/pay/handoff` redirects instead of re-submitting once a payment
 * is settled, and every booking gets a fresh reference. So the scenario needs a
 * door that is deliberately outside that flow — this one, which only staff can
 * open and only while `PAYCENTER_MODE=test`.
 *
 * The ticket that comes back is thrown away on purpose. It is never written to
 * the `Payment` row, because that row still holds the ticket that authenticated
 * the ORIGINAL response and overwriting it would destroy the only evidence that
 * the real transaction was genuine. Nothing needs it anyway: the redirect form
 * does not carry the ticket (Appendix 1), and the `1048` answer is handled by
 * `callback.ts` without a HashKey, which is only present on success.
 */
export async function startRechargeAttempt(
  _previous: RechargeState,
  formData: FormData,
): Promise<RechargeState> {
  await requireStaff();

  const cfg = getPaycenterConfig();
  if (cfg.mode === "live") {
    // This produces a real second charge attempt against a real card.
    return { error: "Απαγορεύεται σε λειτουργία live. Είναι εργαλείο δοκιμών." };
  }
  if (cfg.mode !== "test") {
    return {
      error:
        "Χρειάζεται PAYCENTER_MODE=test και τα credentials της Euronet. " +
        `Τώρα η λειτουργία είναι «${cfg.mode}».`,
    };
  }

  const reference = String(formData.get("reference") ?? "").trim();
  if (!reference) return { error: "Δώσε κωδικό κράτησης." };

  const booking = await prisma.booking.findUnique({
    where: { reference },
    include: { payment: true },
  });
  if (!booking) return { error: "Η κράτηση δεν βρέθηκε." };

  // The scenario is defined as a reference already used by an APPROVED
  // transaction, so anything else would not be the test case at all.
  if (booking.status !== "PAID" || booking.payment?.status !== "PAID") {
    return {
      error:
        "Το test case απαιτεί κωδικό που ανήκει ήδη σε εγκεκριμένη συναλλαγή. " +
        "Τρέξε πρώτα το test case 1 (λήξη 01) και χρησιμοποίησε εκείνον τον κωδικό.",
    };
  }

  try {
    await issueTicket({
      reference: booking.reference,
      amountCents: booking.totalCents,
      locale: "el",
      email: booking.email,
      cardholderName: `${booking.firstName} ${booking.lastName}`,
    });
  } catch (error) {
    // A rejection here is itself a valid finding: it would mean the duplicate
    // is caught at ticketing rather than at transaction time. Report it as-is.
    return {
      error:
        "Το ticketing WS απέρριψε το επαναλαμβανόμενο reference: " +
        (error instanceof Error ? error.message : String(error)),
    };
  }

  return {
    submit: {
      action: payFormAction(),
      fields: payFormFields({ reference: booking.reference, locale: "el" }),
    },
  };
}

// ── Change a booking's date ───────────────────────────────────────────

const rescheduleSchema = z.object({
  reference: z.string().min(1).max(40),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

/**
 * Moves a booking to another date, within the X−2 / X+2 policy.
 *
 * Money never moves: the amount was locked when the customer paid, and a
 * reschedule is a date change, not a new sale. The capacity of the target date
 * is checked so a move cannot overbook a day the way a booking cannot.
 */
export async function reschedule(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireStaff();

  const parsed = rescheduleSchema.safeParse({
    reference: String(formData.get("reference") ?? ""),
    date: String(formData.get("date") ?? ""),
  });
  if (!parsed.success) return { error: "Μη έγκυρη ημερομηνία." };

  const booking = await prisma.booking.findUnique({
    where: { reference: parsed.data.reference },
    include: {
      product: {
        include: { variants: { include: { timeSlots: true } } },
      },
    },
  });
  if (!booking) return { error: "Η κράτηση δεν βρέθηκε." };

  if (booking.status !== "PAID") {
    return { error: "Αλλαγή ημερομηνίας επιτρέπεται μόνο σε πληρωμένη κράτηση." };
  }

  // The cutoff is measured from the FIRST date, not from the current one —
  // otherwise each move would buy another two days and the rule would never bite.
  const original = booking.originalBookingDate ?? booking.bookingDate;
  const check = isValidNewDate(original, parsed.data.date);
  if (!check.ok) {
    return {
      error:
        check.reason === "cutoff_passed"
          ? "Έχει περάσει το όριο των 2 ημερών πριν την κράτηση."
          : check.reason === "past_date"
            ? "Η νέα ημερομηνία είναι στο παρελθόν."
            : "Η νέα ημερομηνία απέχει πάνω από 2 ημέρες από την αρχική.",
    };
  }

  const target = new Date(`${parsed.data.date}T00:00:00.000Z`);
  if (target.getTime() === booking.bookingDate.getTime()) {
    return { error: "Η κράτηση είναι ήδη σε αυτή την ημερομηνία." };
  }

  // Capacity on the new day, counting everything except this booking itself.
  const availability = await getAvailability(booking.product, parsed.data.date);
  const remaining = booking.timeSlot
    ? (availability.slots.find((s) => s.time === booking.timeSlot)?.remaining ??
      availability.dailyRemaining)
    : availability.dailyRemaining;
  if (remaining !== null && booking.units > remaining) {
    return { error: "Δεν υπάρχει διαθεσιμότητα τη νέα ημερομηνία." };
  }

  await prisma.booking.update({
    where: { id: booking.id },
    data: {
      bookingDate: target,
      originalBookingDate: booking.originalBookingDate ?? booking.bookingDate,
      rescheduleCount: { increment: 1 },
    },
  });

  revalidatePath("/admin");
  revalidatePath(`/admin/bookings/${booking.reference}`);
  return { ok: "Η ημερομηνία άλλαξε." };
}
