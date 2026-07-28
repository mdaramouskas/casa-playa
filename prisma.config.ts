import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: {
    // CLI only — the app builds its own pool from DATABASE_URL in
    // src/lib/prisma.ts and never reads this file.
    //
    // db push / migrate / studio need a session connection: they issue DDL and
    // rely on prepared statements, which Supabase's transaction pooler (6543)
    // does not support, so they just hang there. DIRECT_URL is the same
    // database over the session pooler (5432). Prisma 7 has no `directUrl`
    // datasource field, so the switch happens here.
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
    shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL,
  },
});
