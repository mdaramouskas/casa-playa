"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAvailability } from "@/lib/availability";
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
