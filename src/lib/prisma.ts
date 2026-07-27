import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

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

const adapter = new PrismaPg({ connectionString, ssl, max: poolMax });

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
