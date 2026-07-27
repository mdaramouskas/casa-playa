import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// The client is created lazily so that importing this module never requires
// DATABASE_URL — `next build` loads route modules without a database.

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

function createClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("Missing DATABASE_URL environment variable.");
  }

  const sslMode = process.env.PGSSLMODE;
  const ssl =
    sslMode === "require" ||
    sslMode === "verify-ca" ||
    sslMode === "verify-full" ||
    sslMode === "no-verify"
      ? { rejectUnauthorized: sslMode !== "no-verify" }
      : undefined;

  // Serverless/build-friendly pool cap (Supabase pooler is small).
  const poolMax = process.env.DATABASE_POOL_MAX
    ? parseInt(process.env.DATABASE_POOL_MAX, 10)
    : process.env.NODE_ENV === "production"
      ? 1
      : 5;

  return new PrismaClient({
    adapter: new PrismaPg({ connectionString, ssl, max: poolMax }),
  });
}

export function getPrisma(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createClient();
  }
  return globalForPrisma.prisma;
}

/** Proxy so `prisma.booking.create(...)` connects on first use, not on import. */
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    return Reflect.get(getPrisma(), prop);
  },
});
