import { PrismaClient } from "@/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * Prisma 7 erfordert Driver-Adapter zur Connection. Wir wählen anhand
 * des `DATABASE_URL`-Schemas, ob better-sqlite3 (lokal/E2E) oder pg
 * (Vercel) den Adapter stellt.
 *
 * Prisma 7 generiert im Source-Tree (`generated/prisma`) — der Pfad ist
 * via `@/`-Alias erreichbar. Das Verzeichnis ist `.gitignore`d und wird
 * bei jedem Build neu erzeugt.
 *
 * Helper-Funktionen sind exportiert, damit Skripte (seed, e2e-setup)
 * den gleichen Adapter-Pfad teilen.
 */
export function createAdapter() {
  const url = process.env.DATABASE_URL ?? "";
  if (url.startsWith("file:")) {
    return new PrismaBetterSqlite3({ url });
  }
  // postgres:// und postgresql:// (sowie Neon-Varianten)
  return new PrismaPg({ connectionString: url });
}

export function createPrismaClient(): PrismaClient {
  return new PrismaClient({ adapter: createAdapter() });
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
