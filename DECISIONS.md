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
- **No-show / cancellation**: non-refundable; 100% charge on cancel/no-show/late
  arrival (after 12:00). System only records status; no auto resale logic.
- **Payment states**: `PENDING → PAID` (only after verified HMAC-SHA256 callback)
  `→ FAILED`. Callbacks must be idempotent. Card data never touches our server.
- **Out of scope**: NO fiscal documents (receipts/invoices) — the store handles
  invoicing on its own independent POS/accounting system.

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

See the shared list — exact item catalog + prices + daily availability, restaurant
time-slot ranges & per-slot capacity, business identity (ΑΦΜ/name/address),
exact cancellation-policy wording, coupon usage at launch, domain/hosting,
Paycenter credentials + bank technical contact.

## Getting started

```bash
cp .env.example .env       # fill DATABASE_URL etc.
npm run db:push            # create schema in the database
npm run dev
```
