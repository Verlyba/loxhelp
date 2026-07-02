import { PrismaClient } from "@/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

// Prisma 7 uses driver adapters instead of a built-in engine. For SQLite we use
// libSQL, which ships prebuilt binaries (no C++ toolchain needed on Windows).
// To move to the school's server later, swap this adapter for the matching
// Postgres/MySQL one and change DATABASE_URL — nothing else changes.
const url = process.env.DATABASE_URL ?? "file:./dev.db";

function createClient() {
  return new PrismaClient({ adapter: new PrismaLibSql({ url }) });
}

// Reuse a single client across HMR reloads in dev to avoid exhausting handles.
const globalForDb = globalThis as unknown as { __db?: PrismaClient };
export const db = globalForDb.__db ?? createClient();
if (process.env.NODE_ENV !== "production") globalForDb.__db = db;
