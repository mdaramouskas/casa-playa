import dayjs from "dayjs";

// Reschedule policy (brief §3):
//  - Allowed only until X−2 (cutoff = 2 days before the original use date).
//  - New date may be at most X+2 (2 days after original), and not in the past.
//  - Price stays locked to the original paid amount (no charge/refund).
//  - After cutoff, reschedule is fully disabled for that booking.

export const RESCHEDULE_CUTOFF_DAYS = 2; // X−2
export const RESCHEDULE_MAX_FORWARD_DAYS = 2; // X+2

/** Can this booking still be rescheduled today? */
export function canReschedule(
  originalDate: Date | string,
  now: Date = new Date(),
): boolean {
  const cutoff = dayjs(originalDate)
    .startOf("day")
    .subtract(RESCHEDULE_CUTOFF_DAYS, "day");
  return dayjs(now).startOf("day").isBefore(cutoff.add(1, "day"));
  // i.e. today <= cutoff day
}

/** Is `newDate` an allowed target given the original use date? */
export function isValidNewDate(
  originalDate: Date | string,
  newDate: Date | string,
  now: Date = new Date(),
): { ok: boolean; reason?: string } {
  const orig = dayjs(originalDate).startOf("day");
  const target = dayjs(newDate).startOf("day");
  const today = dayjs(now).startOf("day");

  if (!canReschedule(originalDate, now)) {
    return { ok: false, reason: "cutoff_passed" };
  }
  if (target.isBefore(today)) {
    return { ok: false, reason: "past_date" };
  }
  const maxDate = orig.add(RESCHEDULE_MAX_FORWARD_DAYS, "day");
  if (target.isAfter(maxDate)) {
    return { ok: false, reason: "beyond_max_forward" };
  }
  return { ok: true };
}
