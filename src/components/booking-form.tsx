"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import dayjs from "dayjs";
import { localeTags, type Locale } from "@/i18n/routing";
import type { DisplayProduct } from "@/lib/catalog";
import type { Availability } from "@/lib/availability";
import { business } from "@/lib/business";
import { formatPrice } from "@/lib/money";
import { quoteBooking } from "@/lib/pricing";

// Date → time → people → details, then off to the gateway. Prices and unit
// counts shown here are informational; the API recomputes them server-side.

const MONTHS_AHEAD = 12;
/** Booking lead time in days — 1 = from tomorrow on, today is not bookable. */
const MIN_DAYS_AHEAD = 1;
const MAX_PERSONS_FALLBACK = 12;

function monthGrid(month: dayjs.Dayjs) {
  const first = month.startOf("month");
  // Sunday-first, like the legacy calendar.
  const days: (dayjs.Dayjs | null)[] = Array(first.day()).fill(null);
  for (let d = 0; d < month.daysInMonth(); d++) days.push(first.add(d, "day"));
  while (days.length % 7 !== 0) days.push(null);
  return days;
}

export function BookingForm({
  product,
  locale,
}: {
  product: DisplayProduct;
  locale: Locale;
}) {
  const t = useTranslations("booking");
  const c = useTranslations("catalog");
  const common = useTranslations("common");
  const policy = useTranslations("policy");
  const payments = useTranslations("payments");

  const firstBookable = useMemo(
    () => dayjs().startOf("day").add(MIN_DAYS_AHEAD, "day"),
    [],
  );
  const [month, setMonth] = useState(firstBookable.startOf("month"));
  const [date, setDate] = useState<string | null>(null);
  const [timeSlot, setTimeSlot] = useState<string | null>(null);
  const [personsByVariant, setPersonsByVariant] = useState<
    Record<string, number>
  >(() => ({ [product.variants[0]?.name ?? ""]: product.minQty || 1 }));
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const maxMonth = firstBookable.add(MONTHS_AHEAD, "month").startOf("month");

  // Asked of `Intl` rather than written out seven times: the calendar has to
  // read in every language the site offers, and the platform already knows the
  // abbreviations. Trimmed to two letters because these are grid headings —
  // "short" gives "Δευ" and "dim.", and the columns are narrow.
  const weekdays = useMemo(() => {
    const format = new Intl.DateTimeFormat(localeTags[locale], {
      weekday: "short",
      timeZone: "UTC",
    });
    // 1 Jan 2023 was a Sunday, and the grid is Sunday-first.
    return Array.from({ length: 7 }, (_, day) =>
      format.format(new Date(Date.UTC(2023, 0, 1 + day))).slice(0, 2),
    );
  }, [locale]);

  // Variants share one slot grid — for the restaurant the tables are the same
  // tables whichever menu you pick.
  const slots = product.variants[0]?.slots ?? [];
  const maxPersons =
    product.maxPersons ?? product.personsPerUnit * MAX_PERSONS_FALLBACK;

  const quote = quoteBooking(
    {
      name: product.name,
      priceCents: product.priceCents,
      pricingUnit: product.pricingUnit,
      extraPersonPriceCents: product.extraPersonPriceCents,
      allowExtraPerson: product.allowExtraPerson,
      personsPerUnit: product.personsPerUnit,
    },
    product.variants.map((v) => ({
      variantId: v.id,
      name: v.name,
      priceCents: v.priceCents,
      persons: personsByVariant[v.name] ?? 0,
    })),
  );

  useEffect(() => {
    if (!date) return;
    let cancelled = false;
    fetch(`/api/availability?slug=${product.slug}&date=${date}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled) setAvailability(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [date, product.slug]);

  function remainingAt(time: string): number | null {
    const slot = availability?.slots.find((s) => s.time === time);
    return slot ? slot.remaining : null;
  }

  const selectedRemaining = timeSlot ? remainingAt(timeSlot) : null;
  const overCapacity =
    selectedRemaining !== null && quote.units > selectedRemaining;
  const ready =
    Boolean(date) &&
    (!product.requiresSlot || Boolean(timeSlot)) &&
    quote.persons > 0 &&
    !overCapacity;

  function setPersons(variantName: string, value: number) {
    setPersonsByVariant((current) => {
      const next = { ...current, [variantName]: Math.max(0, value) };
      const total = Object.values(next).reduce((sum, n) => sum + n, 0);
      return total > maxPersons ? current : next;
    });
  }

  function lineLabel(line: (typeof quote.lines)[number]) {
    if (line.kind === "SET") return t("sets");
    if (line.kind === "EXTRA_PERSON") return t("extraLounger");
    return line.label;
  }

  function errorMessage(code: unknown): string {
    switch (code) {
      case "sold_out":
        return t("errors.soldOut");
      case "invalid_date":
        return t("errors.invalidDate");
      case "invalid_coupon":
        return t("errors.invalidCoupon");
      case "too_many_persons":
        return t("errors.tooManyPersons", { max: maxPersons });
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
          personsByVariant,
          date,
          timeSlot: timeSlot ?? undefined,
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
              {month
                .toDate()
                .toLocaleDateString(localeTags[locale], {
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
            {monthGrid(month).map((day, i) => {
              if (!day) return <span key={`x${i}`} />;
              const value = day.format("YYYY-MM-DD");
              const past = day.isBefore(firstBookable);
              const selected = value === date;
              return (
                <button
                  key={value}
                  type="button"
                  disabled={past}
                  onClick={() => {
                    setDate(value);
                    setTimeSlot(null);
                    setAvailability(null);
                  }}
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

        {date && availability?.dailyRemaining !== null &&
          availability?.dailyRemaining !== undefined && (
            <p className="mt-3 text-sm text-neutral-600">
              {t("setsLeft", { count: availability.dailyRemaining })}
            </p>
          )}
      </section>

      {/* ── Time slots ── */}
      {product.requiresSlot && (
        <section>
          <h2 className="rounded-t-xl bg-amber-500 px-6 py-3 text-center text-lg font-medium text-white">
            {product.allowMixedVariants
              ? t("timeSlot")
              : (product.variants[0]?.name ?? t("timeSlot"))}
          </h2>
          <div className="grid grid-cols-2 gap-3 rounded-b-xl border border-t-0 border-neutral-200 bg-white p-4 sm:grid-cols-4">
            {slots.map((time) => {
              const remaining = remainingAt(time);
              const soldOut = date !== null && remaining === 0;
              const active = timeSlot === time;
              return (
                <button
                  key={time}
                  type="button"
                  disabled={soldOut}
                  onClick={() => setTimeSlot(time)}
                  className={`rounded-lg border px-4 py-3 text-center transition ${
                    active
                      ? "border-sky-900 bg-sky-900 text-white"
                      : soldOut
                        ? "border-neutral-200 bg-neutral-100 text-neutral-400"
                        : "border-neutral-200 hover:border-sky-400"
                  }`}
                >
                  <span className="block">{time}</span>
                  {soldOut ? (
                    <span className="mt-1 block text-sm">{t("soldOut")}</span>
                  ) : (
                    <span className="mt-1 block text-sm">
                      {remaining !== null
                        ? t("left", { count: remaining })
                        : common("book")}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          {product.occupancyMinutes && (
            <p className="mt-2 text-sm text-neutral-600">
              {t("tableHeldFor", { hours: product.occupancyMinutes / 60 })}
            </p>
          )}
        </section>
      )}

      {/* ── People ── */}
      <section className="space-y-4">
        <h2 className="font-semibold">{t("persons")}</h2>
        <div className="flex flex-wrap gap-6">
          {product.variants.map((variant) =>
            product.allowMixedVariants || product.variants.length > 1 ? (
              <label key={variant.name} className="block">
                <span className="mb-1 block text-sm font-medium">
                  {variant.name}
                  {variant.priceCents ? (
                    <span className="ml-2 font-normal text-neutral-600">
                      {formatPrice(variant.priceCents)} / {common("perPerson")}
                    </span>
                  ) : null}
                </span>
                <input
                  type="number"
                  min={0}
                  max={maxPersons}
                  value={personsByVariant[variant.name] ?? 0}
                  onChange={(e) => setPersons(variant.name, Number(e.target.value))}
                  className="w-28 rounded-lg border border-neutral-300 px-3 py-2"
                />
              </label>
            ) : (
              // One variant, so there is nothing to tell apart and the section
              // heading above is already the label — printing "Persons" twice,
              // one under the other, just read as a stutter. The name stays on
              // the field for anyone using a screen reader.
              <input
                key={variant.name}
                type="number"
                aria-label={t("persons")}
                min={1}
                max={maxPersons}
                value={personsByVariant[variant.name] ?? 1}
                onChange={(e) => setPersons(variant.name, Number(e.target.value))}
                className="w-28 rounded-lg border border-neutral-300 px-3 py-2"
              />
            ),
          )}
        </div>

        {/* Breakdown */}
        {quote.persons > 0 && (
          <div className="rounded-xl border border-neutral-200 bg-white p-4">
            <ul className="space-y-1 text-sm">
              {quote.lines.map((line, i) => (
                <li key={i} className="flex justify-between gap-4">
                  <span>
                    {line.quantity} × {lineLabel(line)}
                  </span>
                  <span>
                    {line.unitPriceCents > 0
                      ? formatPrice(line.totalCents)
                      : c("noPrepayment")}
                  </span>
                </li>
              ))}
            </ul>
            {quote.subtotalCents > 0 && (
              <p className="mt-3 flex justify-between border-t border-neutral-200 pt-3 text-lg font-semibold">
                <span>{common("total")}</span>
                <span className="text-amber-600">
                  {formatPrice(quote.subtotalCents)}{" "}
                  <span className="text-sm font-normal text-neutral-600">
                    ({common("vatIncluded")})
                  </span>
                </span>
              </p>
            )}
          </div>
        )}

        {overCapacity && (
          <p className="text-sm text-red-700">{t("errors.soldOut")}</p>
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

        {/* The registered trade name, which is what Euronet prints on the
            statement — and it is not the name on this page. Saying so here,
            where the customer is about to pay, is the cheapest chargeback
            prevention there is. */}
        {quote.subtotalCents > 0 && (
          <p className="mt-4 border-t border-neutral-200 pt-3 text-sm text-neutral-600">
            {payments("statementDescriptor", { name: business.tradeName })}
          </p>
        )}
      </section>

      {error && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      )}

      <button
        type="submit"
        disabled={!ready || submitting}
        className="w-full rounded-lg bg-amber-500 px-6 py-3 text-lg font-medium text-white transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
      >
        {submitting
          ? common("loading")
          : quote.subtotalCents > 0
            ? t("proceedToPayment")
            : t("confirmBooking")}
      </button>
      {!ready && !overCapacity && (
        <p className="text-sm text-neutral-500">{t("selectDateAndTimeFirst")}</p>
      )}
    </form>
  );
}
