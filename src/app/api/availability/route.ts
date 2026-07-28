import { NextResponse } from "next/server";
import dayjs from "dayjs";
import { prisma } from "@/lib/prisma";
import { getAvailability } from "@/lib/availability";

// What is still bookable for a product on one date. Used by the booking form to
// grey out full time slots and show how many sets are left.

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const slug = url.searchParams.get("slug");
  const date = url.searchParams.get("date");

  if (!slug || !date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  if (date < dayjs().format("YYYY-MM-DD")) {
    return NextResponse.json({ error: "invalid_date" }, { status: 400 });
  }

  const product = await prisma.product.findUnique({
    where: { slug },
    select: {
      id: true,
      dailyCapacity: true,
      slotCapacity: true,
      occupancyMinutes: true,
      variants: {
        where: { active: true },
        select: { timeSlots: { where: { active: true }, select: { time: true } } },
      },
    },
  });
  if (!product) {
    return NextResponse.json({ error: "unknown_product" }, { status: 404 });
  }

  return NextResponse.json(await getAvailability(product, date));
}
