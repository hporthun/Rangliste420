/**
 * Prisma 7 Konfiguration.
 *
 * Konsolidiert datasource.url + seed-Hook, die in Prisma 7 nicht mehr
 * im schema.prisma bzw. package.json stehen dürfen.
 *
 * Welches Schema aktiv ist, steuert das `--schema=`-Flag der CLI:
 *   - Lokal:  `prisma migrate dev`  → prisma/schema.prisma (SQLite)
 *   - Vercel: `prisma migrate deploy --schema=prisma/prod/schema.prisma`
 *             → prisma/prod/schema.prisma (PostgreSQL)
 *
 * Die DATABASE_URL kommt aus .env / Vercel-Env-Variablen — `migrate`
 * (CLI) liest sie aus dieser Config; `PrismaClient` (Runtime) liest
 * sie über den Driver-Adapter in lib/db/client.ts.
 */
import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  datasource: {
    url: env("DATABASE_URL"),
  },
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
});
