# Casa Playa — Decisions & Project Notes

Online booking system for **Casa Playa** (beach bar & restaurant, Zakynthos):
sunbeds (ξαπλώστρες), cabanas (Standard/VIP), and restaurant tables (Seafood /
Meat menu, per-person, half-hour slots), with online card payment.

Source spec: `CasaPlaya_Dev_Brief.pdf` (Greek). Built from scratch — conceptually
based on the existing Travelotopos booking engine, not reusing its code.

## Confirmed decisions (2026-07-27)

| Topic | Decision |
| --- | --- |
| Stack | Next.js 16 (App Router, `src/`), React 19, TypeScript, Tailwind 4 |
| Database | Postgres / Supabase via Prisma 7 (`@prisma/adapter-pg`) |
| i18n | `next-intl` — **Greek default** (no prefix), English at `/en` |
| Payments | **Paycenter Redirection v2.9** (Piraeus / Euronet, aka "epay eCommerce"). Built now with env config + **mock** gateway; real sandbox/prod when bank issues credentials |
| Auth | Custom staff/admin auth (jose JWT + bcryptjs), simple STAFF/ADMIN roles |
| Money | Integer cents, **VAT-inclusive (24%)** everywhere |

## Business rules (from the brief)

- **Booking reference**: `CAPL.XXXXXXXXXX` (see `src/lib/reference.ts`).
- **Prices**: always shown incl. 24% VAT (`src/lib/money.ts`).
- **Reschedule** (`src/lib/reschedule.ts`): allowed until **X−2**; new date at most
  **X+2**; price locked to original amount (no charge/refund); UI disables after
  cutoff; reschedule is only a date update — no money movement.
- **Lead time**: no same-day bookings — the earliest bookable date is tomorrow
  (`MIN_DAYS_AHEAD`, enforced in both the calendar and `POST /api/bookings`).
- **No-show / cancellation**: non-refundable; 100% charge on cancel/no-show/late
  arrival (after 12:00). System only records status; no auto resale logic.
- **Payment states**: `PENDING → PAID` (only after verified HMAC-SHA256 callback)
  `→ FAILED`. Callbacks must be idempotent. Card data never touches our server.
- **Out of scope**: NO fiscal documents (receipts/invoices) — the store handles
  invoicing on its own independent POS/accounting system.

## Catalog (transcribed from the legacy site)

Source of truth: **`src/data/catalog.ts`** → seeded into Postgres with
`npm run db:seed` (idempotent upsert; re-run after every edit).

| Product | Price (incl. VAT) | Capacity | Slots |
| --- | --- | --- | --- |
| Book a Cabana Beach Bed 1st Row | 70.00€ / set | 8 sets/day | 09:00–12:00 / 30′ |
| Book a Seaside Sun Bed 1st Row | 50.00€ / set (+25.00€ extra) | 25 sets/day | 09:00–12:00 / 30′ |
| Book a Seaside Sun Bed 2nd Row | 35.00€ / set (+17.50€ extra) | 25 sets/day | 09:00–12:00 / 30′ |
| Book a Seaside Sun Bed 3rd Row | 35.00€ / set (+17.50€ extra) | 25 sets/day | 09:00–12:00 / 30′ |
| Book a table Private Restaurant Area | Seafood 75.00€, Meat 70.00€ / person | 5 tables × 10 people | 13:00–18:00 / 30′ |
| Book a table Restaurant Area | free reservation | 20 tables × 4 people | 13:00–18:00 / 30′ |

- Inclusions: cabana & 1st-row sunbed → Wi-Fi, personal towel, changing room &
  shower; 2nd/3rd row → Wi-Fi, changing room & shower.
- Beds are **all-day** bookings — the slot is only an arrival time
  (`Product.slotKind = ARRIVAL`). Restaurant slots are real reservation times.
- **A set seats 2.** On sunbeds (all three rows) a 3rd person gets an extra
  lounger at half the set price and does **not** consume one of the 25 sets —
  those loungers come from the spare umbrellas. So 3 people = 1 set + 1 extra,
  4 = 2 sets, 5 = 2 sets + 1 extra (`src/lib/pricing.ts`). Cabanas take no
  extra person.
- **Restaurant tables are held for 2.5 hours** (`occupancyMinutes = 150`), so a
  table taken at 13:00 frees at 15:30. A slot is bookable only if every moment
  it would cover has room (`src/lib/availability.ts`). Seafood and Meat share
  the same 5 tables, and one booking may mix menus (4 seafood + 6 meat on one
  table) — hence `BookingItem` rows per menu.
- Unpaid bookings stop holding capacity after 30 minutes
  (`PENDING_HOLD_MINUTES`).
- **Still missing**: product photos.

## Database

Supabase project **`casa-playa`** (`swtvotectgdgzhfksyto`, eu-central-1). The app
connects through the **pooler in transaction mode (port 6543)** with a dedicated
`casa_playa_app` role — not the project's `postgres` superuser. Every table has
RLS enabled with no policies, so the public PostgREST API cannot read them; the
app role has `BYPASSRLS` and reaches Postgres directly.

Schema was applied from `prisma migrate diff` output; `npm run db:push` /
`npm run db:seed` are the ongoing path (seed is idempotent).

## Booking & payment flow

1. `/[locale]/book/[slug]` — date, variant + time slot, quantity, customer
   details, cancellation-policy checkbox (`src/components/booking-form.tsx`).
2. `POST /api/bookings` — recomputes the price server-side (never trusts the
   client), checks capacity/overrides, creates the booking as `PENDING`, asks
   the gateway for a ticket and returns the redirect URL.
3. Gateway. With `PAYCENTER_MODE=mock` the customer lands on
   `/[locale]/pay/mock/[ticket]` — our own page, deliberately not styled like a
   bank, taking no card details, with "successful payment" / "failure" buttons
   that post the same HMAC-signed callback the real gateway would.
4. `POST /api/payment/callback` — verifies HMAC-SHA256, checks the amount, then
   flips `Payment` + `Booking` to PAID/FAILED inside one transaction and marks
   `processedAt`. Replays are ignored; a bad signature returns 400.
5. `/[locale]/payment/success|failure?ref=CAPL.…`.

Products priced at 0 (the restaurant table, as on the legacy site) skip the
gateway entirely and are confirmed on the spot — **needs client confirmation**.

## Payment integration notes

- This is **Paycenter Redirection**, NOT the `epayworldwide.com` gift-card portal.
- Flow: form → backend calls SOAP `IssueNewTicket` → get ticket → auto HTML form
  POST redirect to `pay.aspx` → customer pays → bank callback (verify HMAC) →
  redirect to success/failure page.
- `src/lib/paycenter/config.ts` reads all credentials from env (`PAYCENTER_*`);
  `PAYCENTER_MODE=mock|sandbox|production`. HMAC in `src/lib/paycenter/hmac.ts`
  — the exact signed-string canonicalization is a **placeholder** pending the
  bank's documentation.
- Confirm with bank: SALE vs PREAUTH (brief leans SALE), IRIS enablement.

## Open questions (need client input)

Catalog, prices and slot ranges are now known (see above). Still open: daily
availability per product & per-slot capacity, business identity (ΑΦΜ/name/address),
exact cancellation-policy wording, coupon usage at launch, domain/hosting,
Paycenter credentials + bank technical contact.

## Getting started

```bash
cp .env.example .env       # fill DATABASE_URL etc.
npm run db:push            # create schema in the database
npm run db:seed            # load the catalog from src/data/catalog.ts
npm run dev
```
