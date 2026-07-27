"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import dayjs from "dayjs";
import type { DisplayProduct } from "@/lib/catalog";
import { formatPrice } from "@/lib/money";

// Date → time slot → quantity → customer details, then off to the gateway.
// Prices shown here are informational; the API recomputes them server-side.

const MONTHS_AHEAD = 12;
/** Booking lead time in days — 1 = from tomorrow on, today is not bookable. */
const MIN_DAYS_AHEAD = 1;

function monthGrid(month: dayjs.Dayjs) {
  const first = month.startOf("month");
  // Sunday-first, like the legacy calendar.
  const leading = first.day();
  const days: (dayjs.Dayjs | null)[] = Array(leading).fill(null);
  for (let d = 0; d < month.daysInMonth(); d++) {
    days.push(first.add(d, "day"));
  }
  while (days.length % 7 !== 0) days.push(null);
  return days;
}

export function BookingForm({
  product,
  locale,
}: {
  product: DisplayProduct;
  locale: string;
}) {
  const t = useTranslations("booking");
  const c = useTranslations("catalog");
  const common = useTranslations("common");
  const policy = useTranslations("policy");

  // No same-day bookings: the earliest bookable day is tomorrow.
  const firstBookable = useMemo(
    () => dayjs().startOf("day").add(MIN_DAYS_AHEAD, "day"),
    [],
  );
  const [month, setMonth] = useState(firstBookable.startOf("month"));
  const [date, setDate] = useState<string | null>(null);
  const [variantName, setVariantName] = useState(
    product.variants[0]?.name ?? "",
  );
  const [timeSlot, setTimeSlot] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(product.minQty || 1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const maxMonth = firstBookable.add(MONTHS_AHEAD, "month").startOf("month");
  const days = monthGrid(month);
  const weekdays =
    locale === "en"
      ? ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]
      : ["Κυ", "Δε", "Τρ", "Τε", "Πε", "Πα", "Σα"];

  const subtotal = product.priceCents * quantity;
  const ready = Boolean(date && (!product.requiresSlot || timeSlot));

  function errorMessage(code: unknown): string {
    switch (code) {
      case "sold_out":
        return t("errors.soldOut");
      case "invalid_date":
        return t("errors.invalidDate");
      case "invalid_coupon":
        return t("errors.invalidCoupon");
      default:
        return t("errors.generic");
    }
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const data = new FormData(event.currentTarget);
    setSubmitting(true);
    try {
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          productSlug: product.slug,
          variantName: variantName || undefined,
          date,
          timeSlot: timeSlot ?? undefined,
          quantity,
          firstName: String(data.get("firstName") ?? ""),
          lastName: String(data.get("lastName") ?? ""),
          email: String(data.get("email") ?? ""),
          phone: String(data.get("phone") ?? ""),
          comments: String(data.get("comments") ?? "") || undefined,
          cancellationAccepted: data.get("cancellationAccepted") === "on",
          locale,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(errorMessage(payload?.error));
        setSubmitting(false);
        return;
      }
      window.location.href = payload.redirectUrl;
    } catch {
      setError(t("errors.generic"));
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-10">
      {/* ── Calendar ── */}
      <section>
        <h2 className="mb-3 font-semibold">{t("selectDate")}</h2>
        <div className="inline-block rounded-xl border border-neutral-200 bg-white p-4">
          <div className="mb-2 flex items-center justify-between gap-6">
            <button
              type="button"
              onClick={() => setMonth(month.subtract(1, "month"))}
              disabled={month.isSame(firstBookable, "month")}
              className="px-2 text-lg text-neutral-500 disabled:opacity-30"
              aria-label="←"
            >
              «
            </button>
            <span className="font-medium">
              {month.toDate().toLocaleDateString(locale === "en" ? "en-GB" : "el-GR", {
                month: "long",
                year: "numeric",
              })}
            </span>
            <button
              type="button"
              onClick={() => setMonth(month.add(1, "month"))}
              disabled={!month.isBefore(maxMonth)}
              className="px-2 text-lg text-neutral-500 disabled:opacity-30"
              aria-label="→"
            >
              »
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-sm">
            {weekdays.map((w) => (
              <span key={w} className="py-1 font-medium text-neutral-500">
                {w}
              </span>
            ))}
            {days.map((day, i) => {
              if (!day) return <span key={`x${i}`} />;
              const value = day.format("YYYY-MM-DD");
              const past = day.isBefore(firstBookable);
              const selected = value === date;
              return (
                <button
                  key={value}
                  type="button"
                  disabled={past}
                  onClick={() => setDate(value)}
                  className={`rounded-md px-2 py-1.5 transition ${
                    selected
                      ? "bg-sky-900 font-semibold text-white"
                      : past
                        ? "text-neutral-300"
                        : "bg-emerald-100 text-neutral-800 hover:bg-emerald-200"
                  }`}
                >
                  {day.date()}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Variants + slots ── */}
      {product.requiresSlot && (
        <section className="space-y-6">
          {product.variants.map((v) => (
            <div key={v.name}>
              <h2 className="rounded-t-xl bg-amber-500 px-6 py-3 text-center text-lg font-medium text-white">
                {v.name}
              </h2>
              <div className="grid grid-cols-2 gap-3 rounded-b-xl border border-t-0 border-neutral-200 bg-white p-4 sm:grid-cols-4">
                {v.slots.map((time) => {
                  const active = variantName === v.name && timeSlot === time;
                  return (
                    <button
                      key={time}
                      type="button"
                      onClick={() => {
                        setVariantName(v.name);
                        setTimeSlot(time);
                      }}
                      className={`rounded-lg border px-4 py-3 text-center transition ${
                        active
                          ? "border-sky-900 bg-sky-900 text-white"
                          : "border-neutral-200 hover:border-sky-400"
                      }`}
                    >
                      <span className="block">{time}</span>
                      {product.priceCents > 0 && (
                        <span className="mt-1 block text-sm">
                          {c("from")} {formatPrice(product.priceCents)}
                        </span>
                      )}
                      <span className="mt-1 block text-sm font-semibold">
                        {common("book")}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </section>
      )}

      {/* ── Quantity + total ── */}
      <section className="flex flex-wrap items-end gap-6">
        <label className="block">
          <span className="mb-1 block font-semibold">
            {product.pricingUnit === "PER_PERSON" ? t("persons") : t("quantity")}
          </span>
          <input
            type="number"
            min={product.minQty}
            max={product.maxQty ?? 20}
            value={quantity}
            onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
            className="w-28 rounded-lg border border-neutral-300 px-3 py-2"
          />
        </label>
        {product.priceCents > 0 && (
          <p className="text-lg">
            {common("total")}:{" "}
            <span className="font-semibold text-amber-600">
              {formatPrice(subtotal)}
            </span>{" "}
            <span className="text-sm text-neutral-600">
              ({common("vatIncluded")})
            </span>
          </p>
        )}
      </section>

      {/* ── Customer ── */}
      <section className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-sm font-medium">{t("firstName")}</span>
          <input name="firstName" required className="w-full rounded-lg border border-neutral-300 px-3 py-2" />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">{t("lastName")}</span>
          <input name="lastName" required className="w-full rounded-lg border border-neutral-300 px-3 py-2" />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">{t("email")}</span>
          <input name="email" type="email" required className="w-full rounded-lg border border-neutral-300 px-3 py-2" />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">{t("phone")}</span>
          <input name="phone" required className="w-full rounded-lg border border-neutral-300 px-3 py-2" />
        </label>
        <label className="block sm:col-span-2">
          <span className="mb-1 block text-sm font-medium">{t("comments")}</span>
          <textarea name="comments" rows={3} className="w-full rounded-lg border border-neutral-300 px-3 py-2" />
        </label>
      </section>

      {/* ── Policy ── */}
      <section className="rounded-xl bg-neutral-100 p-4">
        <h3 className="font-semibold">{policy("cancellationTitle")}</h3>
        <p className="mt-1 text-sm text-neutral-700">{policy("nonRefundable")}</p>
        <label className="mt-3 flex items-start gap-2 text-sm">
          <input type="checkbox" name="cancellationAccepted" required className="mt-1" />
          <span>{t("acceptCancellation")}</span>
        </label>
      </section>

      {error && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      )}

      <button
        type="submit"
        disabled={!ready || submitting}
        className="w-full rounded-lg bg-amber-500 px-6 py-3 text-lg font-medium text-white transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
      >
        {submitting ? common("loading") : t("proceedToPayment")}
      </button>
      {!ready && (
        <p className="text-sm text-neutral-500">{t("selectDateAndTimeFirst")}</p>
      )}
    </form>
  );
}
