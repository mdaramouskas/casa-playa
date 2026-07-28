import { prisma } from "./prisma";

// How much of a product is still bookable on a given date.
//
// Sunbeds/cabanas are all-day, so the limit is a daily number of sets.
//
// Restaurant tables are held for a fixed stretch (2.5h), so a table taken at
// 13:00 is free again at 15:30. A slot is bookable only if no moment it would
// cover is already full: with 5 tables, one booking at 13:00 and four at 14:00,
// nothing is available until 15:30, when the first table frees up, and the rest
// follow at 16:30.

/** Unpaid bookings stop holding capacity after this long. */
export const PENDING_HOLD_MINUTES = 30;

export interface SlotAvailability {
  time: string;
  /** Units still bookable at this time; null = no limit configured. */
  remaining: number | null;
}

export interface Availability {
  date: string;
  /** Units still bookable on the day; null = no daily limit. */
  dailyRemaining: number | null;
  slots: SlotAvailability[];
}

type CapacityProduct = {
  id: string;
  dailyCapacity: number | null;
  slotCapacity: number | null;
  occupancyMinutes: number | null;
  variants: { timeSlots: { time: string }[] }[];
};

function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/** Distinct, sorted slot times of a product (variants share the same grid). */
export function slotTimes(product: CapacityProduct): string[] {
  const times = new Set<string>();
  for (const variant of product.variants) {
    for (const slot of variant.timeSlots) times.add(slot.time);
  }
  return [...times].sort((a, b) => toMinutes(a) - toMinutes(b));
}

async function heldUnits(productId: string, date: Date) {
  const holdSince = new Date(Date.now() - PENDING_HOLD_MINUTES * 60_000);
  return prisma.booking.findMany({
    where: {
      productId,
      bookingDate: date,
      OR: [
        { status: "PAID" },
        { status: "PENDING", createdAt: { gte: holdSince } },
      ],
    },
    select: { timeSlot: true, units: true },
  });
}

/** @param dateISO plain `YYYY-MM-DD` */
export async function getAvailability(
  product: CapacityProduct,
  dateISO: string,
): Promise<Availability> {
  const date = new Date(`${dateISO}T00:00:00.000Z`);
  const times = slotTimes(product);

  const override = await prisma.availabilityOverride.findUnique({
    where: { productId_date: { productId: product.id, date } },
  });
  const bookings = await heldUnits(product.id, date);
  const taken = bookings.reduce((sum, b) => sum + b.units, 0);

  // ── All-day products (sunbeds, cabanas) ──────────────────────────────
  if (product.slotCapacity === null || product.occupancyMinutes === null) {
    const capacity = override?.capacity ?? product.dailyCapacity;
    const dailyRemaining =
      capacity === null || capacity === undefined
        ? null
        : Math.max(0, capacity - taken);
    return {
      date: dateISO,
      dailyRemaining,
      slots: times.map((time) => ({ time, remaining: dailyRemaining })),
    };
  }

  // ── Timed tables ─────────────────────────────────────────────────────
  const capacity = override?.capacity ?? product.slotCapacity;
  const occupancy = product.occupancyMinutes;

  // Units occupying a table at each slot time: bookings that started within the
  // preceding `occupancy` minutes and have not yet released their table.
  const occupiedAt = new Map<string, number>();
  for (const time of times) {
    const end = toMinutes(time);
    const start = end - occupancy;
    let units = 0;
    for (const booking of bookings) {
      if (!booking.timeSlot) continue;
      const at = toMinutes(booking.timeSlot);
      if (at > start && at <= end) units += booking.units;
    }
    occupiedAt.set(time, units);
  }

  // Booking at T would hold a table across [T, T + occupancy), so every slot
  // time in that window must have room.
  const slots = times.map((time) => {
    const from = toMinutes(time);
    let peak = 0;
    for (const other of times) {
      const at = toMinutes(other);
      if (at >= from && at < from + occupancy) {
        peak = Math.max(peak, occupiedAt.get(other) ?? 0);
      }
    }
    return { time, remaining: Math.max(0, capacity - peak) };
  });

  return { date: dateISO, dailyRemaining: null, slots };
}
