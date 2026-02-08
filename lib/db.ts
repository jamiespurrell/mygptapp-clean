import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  pgPool?: Pool;
};

const connectionString = process.env.DATABASE_URL;

// Create (or reuse) a single pg Pool in dev
const pool =
  globalForPrisma.pgPool ??
  new Pool({
    connectionString,
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.pgPool = pool;

// Create (or reuse) Prisma adapter
const adapter = new PrismaPg(pool);

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
