import { NextResponse } from "next/server";
import { z } from "zod";
import dayjs from "dayjs";
import { prisma } from "@/lib/prisma";
import { generateBookingReference } from "@/lib/reference";
import { applyDiscount } from "@/lib/money";
import { issueTicket, localePrefix } from "@/lib/paycenter/gateway";
import { getPaycenterConfig } from "@/lib/paycenter/config";

// Creates a PENDING booking, then hands the customer to the payment gateway.
// The price is always recomputed here — never trusted from the client.

const MAX_DAYS_AHEAD = 365;

const bodySchema = z.object({
  productSlug: z.string().min(1),
  variantName: z.string().min(1).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  timeSlot: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  quantity: z.number().int().min(1).max(50),
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
  if (!parsed.success) {
    return fail("invalid_request");
  }
  const input = parsed.data;

  const product = await prisma.product.findUnique({
    where: { slug: input.productSlug },
    include: {
      variants: {
        where: { active: true },
        include: { timeSlots: { where: { active: true } } },
      },
    },
  });
  if (!product || !product.active) return fail("unknown_product", 404);

  // ── Date ────────────────────────────────────────────────────────────
  // Compared as plain YYYY-MM-DD strings so no timezone can shift the day.
  const today = dayjs().format("YYYY-MM-DD");
  const lastDay = dayjs().add(MAX_DAYS_AHEAD, "day").format("YYYY-MM-DD");
  if (input.date < today || input.date > lastDay) return fail("invalid_date");
  // A DATE column: store UTC midnight so the stored day is exactly input.date.
  const bookingDate = new Date(`${input.date}T00:00:00.000Z`);
  if (Number.isNaN(bookingDate.getTime())) return fail("invalid_date");

  // ── Variant + slot ──────────────────────────────────────────────────
  let variant = null;
  if (input.variantName) {
    variant =
      product.variants.find((v) => v.name === input.variantName) ?? null;
    if (!variant) return fail("invalid_variant");
  } else if (product.variants.length === 1) {
    variant = product.variants[0];
  }

  if (product.requiresSlot) {
    if (!variant) return fail("invalid_variant");
    if (!input.timeSlot) return fail("slot_required");
    if (!variant.timeSlots.some((s) => s.time === input.timeSlot)) {
      return fail("invalid_slot");
    }
  }

  if (input.quantity < product.minQty) return fail("invalid_quantity");
  if (product.maxQty && input.quantity > product.maxQty) {
    return fail("invalid_quantity");
  }

  // ── Availability ────────────────────────────────────────────────────
  const override = await prisma.availabilityOverride.findUnique({
    where: { productId_date: { productId: product.id, date: bookingDate } },
  });
  const capacity = override?.capacity ?? product.dailyCapacity;

  if (capacity !== null && capacity !== undefined) {
    if (capacity === 0) return fail("sold_out", 409);
    const taken = await prisma.booking.aggregate({
      where: {
        productId: product.id,
        bookingDate,
        status: { in: ["PENDING", "PAID"] },
      },
      _sum: { quantity: true },
    });
    if ((taken._sum.quantity ?? 0) + input.quantity > capacity) {
      return fail("sold_out", 409);
    }
  }

  // ── Price (server-side, VAT-inclusive) ──────────────────────────────
  const unitPriceCents = product.priceCents;
  const subtotalCents = unitPriceCents * input.quantity;

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
    ({ discountCents } = applyDiscount(subtotalCents, coupon));
    couponCode = coupon.code;
  }
  const totalCents = subtotalCents - discountCents;

  // ── Persist ─────────────────────────────────────────────────────────
  const reference = generateBookingReference();
  const cfg = getPaycenterConfig();
  // Products with no price (the restaurant table on the legacy site) are
  // reserved without prepayment, so they skip the gateway entirely.
  const needsPayment = totalCents > 0;

  const booking = await prisma.booking.create({
    data: {
      reference,
      productId: product.id,
      variantId: variant?.id ?? null,
      variantName: variant?.name ?? null,
      bookingDate,
      timeSlot: input.timeSlot ?? null,
      quantity: input.quantity,
      unitPriceCents,
      subtotalCents,
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
    },
  });

  if (!needsPayment) {
    return NextResponse.json({
      reference,
      redirectUrl: `${localePrefix(input.locale)}/payment/success?ref=${reference}`,
    });
  }

  const issued = await issueTicket({
    reference,
    amountCents: totalCents,
    currency: cfg.currency,
    locale: input.locale,
  });

  await prisma.payment.create({
    data: {
      bookingId: booking.id,
      transactionType: cfg.transactionType,
      amountCents: totalCents,
      currency: cfg.currency,
      ticket: issued.ticket,
    },
  });

  return NextResponse.json({ reference, redirectUrl: issued.payUrl });
}
