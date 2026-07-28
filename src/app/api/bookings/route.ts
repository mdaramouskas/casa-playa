import { NextResponse } from "next/server";
import { z } from "zod";
import dayjs from "dayjs";
import { prisma } from "@/lib/prisma";
import { generateBookingReference } from "@/lib/reference";
import { applyDiscount } from "@/lib/money";
import { quoteBooking, type VariantSelection } from "@/lib/pricing";
import { getAvailability } from "@/lib/availability";
import { issueTicket, localePrefix } from "@/lib/paycenter/gateway";
import { getPaycenterConfig } from "@/lib/paycenter/config";

// Creates a PENDING booking, then hands the customer to the payment gateway.
// Prices, unit counts and availability are always recomputed here — nothing
// coming from the client is trusted.

const MAX_DAYS_AHEAD = 365;
/** Booking lead time: 1 = from tomorrow on, no same-day bookings. */
const MIN_DAYS_AHEAD = 1;

const bodySchema = z.object({
  productSlug: z.string().min(1),
  /** People per variant, e.g. `{ "Seafood Menu": 4, "Meat Menu": 6 }`. */
  personsByVariant: z.record(z.string(), z.number().int().min(0)),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  timeSlot: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  email: z.email().max(160),
  phone: z.string().trim().min(5).max(40),
  phoneCountry: z.string().trim().max(8).optional(),
  comments: z.string().trim().max(1000).optional(),
  couponCode: z.string().trim().max(40).optional(),
  cancellationAccepted: z.literal(true),
  locale: z.enum(["el", "en"]).default("el"),
});

function fail(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("invalid_request");
  const input = parsed.data;

  const product = await prisma.product.findUnique({
    where: { slug: input.productSlug },
    include: {
      variants: {
        where: { active: true },
        orderBy: { sortOrder: "asc" },
        include: { timeSlots: { where: { active: true } } },
      },
    },
  });
  if (!product || !product.active) return fail("unknown_product", 404);

  // ── Date ────────────────────────────────────────────────────────────
  // Compared as plain YYYY-MM-DD strings so no timezone can shift the day.
  const firstDay = dayjs().add(MIN_DAYS_AHEAD, "day").format("YYYY-MM-DD");
  const lastDay = dayjs().add(MAX_DAYS_AHEAD, "day").format("YYYY-MM-DD");
  if (input.date < firstDay || input.date > lastDay) return fail("invalid_date");
  // A DATE column: store UTC midnight so the stored day is exactly input.date.
  const bookingDate = new Date(`${input.date}T00:00:00.000Z`);

  // ── Variants ────────────────────────────────────────────────────────
  const selections: VariantSelection[] = [];
  for (const [name, persons] of Object.entries(input.personsByVariant)) {
    if (persons === 0) continue;
    const variant = product.variants.find((v) => v.name === name);
    if (!variant) return fail("invalid_variant");
    selections.push({
      variantId: variant.id,
      name: variant.name,
      priceCents: variant.priceCents,
      persons,
    });
  }
  if (selections.length === 0) return fail("invalid_quantity");
  if (selections.length > 1 && !product.allowMixedVariants) {
    return fail("invalid_variant");
  }

  const persons = selections.reduce((sum, s) => sum + s.persons, 0);
  if (persons < product.minQty) return fail("invalid_quantity");
  if (product.maxPersons && persons > product.maxPersons) {
    return fail("too_many_persons");
  }

  // ── Time slot ───────────────────────────────────────────────────────
  if (product.requiresSlot) {
    if (!input.timeSlot) return fail("slot_required");
    const slotExists = product.variants.some((v) =>
      v.timeSlots.some((s) => s.time === input.timeSlot),
    );
    if (!slotExists) return fail("invalid_slot");
  }

  // ── Price (server-side, VAT-inclusive) ──────────────────────────────
  const quote = quoteBooking(product, selections);

  // ── Availability ────────────────────────────────────────────────────
  const availability = await getAvailability(product, input.date);
  if (
    availability.dailyRemaining !== null &&
    quote.units > availability.dailyRemaining
  ) {
    return fail("sold_out", 409);
  }
  if (input.timeSlot) {
    const slot = availability.slots.find((s) => s.time === input.timeSlot);
    if (slot && slot.remaining !== null && quote.units > slot.remaining) {
      return fail("sold_out", 409);
    }
  }

  // ── Coupon ──────────────────────────────────────────────────────────
  let discountCents = 0;
  let couponCode: string | null = null;
  if (input.couponCode) {
    const coupon = await prisma.coupon.findUnique({
      where: { code: input.couponCode.toUpperCase() },
    });
    const usable =
      coupon &&
      coupon.active &&
      (!coupon.expiresAt || coupon.expiresAt > new Date()) &&
      (!coupon.maxRedemptions || coupon.timesRedeemed < coupon.maxRedemptions);
    if (!usable) return fail("invalid_coupon");
    ({ discountCents } = applyDiscount(quote.subtotalCents, coupon));
    couponCode = coupon.code;
  }
  const totalCents = quote.subtotalCents - discountCents;

  // ── Persist ─────────────────────────────────────────────────────────
  const reference = generateBookingReference();
  const cfg = getPaycenterConfig();
  // Products with no price (the Restaurant Area) are reserved without payment.
  const needsPayment = totalCents > 0;
  const singleVariant = selections.length === 1 ? selections[0] : null;

  const booking = await prisma.booking.create({
    data: {
      reference,
      productId: product.id,
      variantId: singleVariant?.variantId ?? null,
      variantName: singleVariant?.name ?? null,
      bookingDate,
      timeSlot: input.timeSlot ?? null,
      persons: quote.persons,
      units: quote.units,
      extraPersons: quote.extraPersons,
      unitPriceCents: product.priceCents,
      subtotalCents: quote.subtotalCents,
      discountCents,
      totalCents,
      couponCode,
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email.toLowerCase(),
      phone: input.phone,
      phoneCountry: input.phoneCountry ?? null,
      comments: input.comments ?? null,
      cancellationAccepted: true,
      status: needsPayment ? "PENDING" : "PAID",
      items: {
        create: quote.lines.map((line) => ({
          variantId: line.variantId,
          kind: line.kind,
          label: line.label,
          quantity: line.quantity,
          unitPriceCents: line.unitPriceCents,
          totalCents: line.totalCents,
        })),
      },
    },
  });

  if (!needsPayment) {
    return NextResponse.json({
      reference,
      redirectUrl: `${localePrefix(input.locale)}/payment/success?ref=${reference}`,
    });
  }

  // The ticketing WS must run before the customer is sent anywhere (§4).
  const issued = await issueTicket({
    reference,
    amountCents: totalCents,
    locale: input.locale,
    email: input.email.toLowerCase(),
    cardholderName: `${input.firstName} ${input.lastName}`,
  });

  await prisma.payment.create({
    data: {
      bookingId: booking.id,
      transactionType: cfg.transactionType,
      amountCents: totalCents,
      currency: cfg.currency,
      ticket: issued.ticket,
      parameters: issued.parameters,
    },
  });

  return NextResponse.json({ reference, redirectUrl: issued.payUrl });
}
