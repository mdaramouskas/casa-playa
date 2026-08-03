// Creates or updates a staff account for the panel at /admin.
//
//   npm run staff -- <email> <password> [name] [ADMIN|STAFF]
//
// There is no sign-up page on purpose: the panel has a handful of users and
// every one of them is created deliberately, from here.
//
// Idempotent — running it again for the same email resets that account's
// password, which is also how a forgotten password gets fixed.
//
// Runs on Node's native TypeScript support (type stripping) — no ts-node.

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const [email, password, name, role = "STAFF"] = process.argv.slice(2);

if (!email || !password) {
  console.error(
    "Usage: npm run staff -- <email> <password> [name] [ADMIN|STAFF]",
  );
  process.exit(2);
}
if (role !== "ADMIN" && role !== "STAFF") {
  console.error(`Role must be ADMIN or STAFF, got "${role}".`);
  process.exit(2);
}
if (password.length < 10) {
  // The panel is reachable from the internet; a short password is the whole
  // attack surface.
  console.error("Choose a password of at least 10 characters.");
  process.exit(2);
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("Missing DATABASE_URL — copy .env.example to .env first.");
}

const sslMode = process.env.PGSSLMODE;
const ssl =
  sslMode === "require" ||
  sslMode === "verify-ca" ||
  sslMode === "verify-full" ||
  sslMode === "no-verify"
    ? { rejectUnauthorized: sslMode !== "no-verify" }
    : undefined;

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString, ssl, max: 1 }),
});

const passwordHash = await bcrypt.hash(password, 12);
const normalised = email.trim().toLowerCase();

const user = await prisma.staffUser.upsert({
  where: { email: normalised },
  create: { email: normalised, passwordHash, name: name ?? null, role },
  update: { passwordHash, name: name ?? undefined, role, active: true },
});

console.log(`✓ ${user.email} (${user.role})${user.name ? ` — ${user.name}` : ""}`);
await prisma.$disconnect();
