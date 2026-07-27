# Casa Playa — Online Booking System

Booking system for Casa Playa (beach bar & restaurant, Zakynthos): sunbeds,
cabanas and restaurant tables, with online card payment via Piraeus Bank
Paycenter (epay eCommerce) Redirection.

See **[DECISIONS.md](./DECISIONS.md)** for architecture, business rules, payment
integration notes, and open questions.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind 4 · Prisma 7 (Postgres/
Supabase) · next-intl (Greek/English).

## Development

```bash
cp .env.example .env       # fill in DATABASE_URL and secrets
npm install
npm run db:push            # push Prisma schema to the database
npm run dev                # http://localhost:3000
```

Useful scripts: `npm run db:studio`, `npm run typecheck`, `npm run lint`.
