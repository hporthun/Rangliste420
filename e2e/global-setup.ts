import { PrismaClient } from "../generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import bcrypt from "bcryptjs";
import * as fs from "fs";
import * as path from "path";
import { TEST_DB_URL } from "./constants";

export default async function globalSetup() {
  // Ensure .auth dir exists for storage state
  const authDir = path.join(__dirname, ".auth");
  if (!fs.existsSync(authDir)) fs.mkdirSync(authDir, { recursive: true });

  // By now the webServer has run `npx prisma migrate deploy` so tables exist.
  // GlobalSetup only seeds the data.
  // Prisma 7: Adapter trägt die URL (datasourceUrl-Option entfällt).
  const db = new PrismaClient({
    adapter: new PrismaBetterSqlite3({ url: TEST_DB_URL }),
  });

  try {
    // Clean slate — FK-safe delete order
    await db.rankingRegatta.deleteMany();
    await db.ranking.deleteMany();
    await db.result.deleteMany();
    await db.teamEntry.deleteMany();
    await db.importSession.deleteMany();
    await db.regatta.deleteMany();
    await db.sailor.deleteMany();
    await db.user.deleteMany();

    // Admin user (password: testpassword123)
    const hash = await bcrypt.hash("testpassword123", 10);
    await db.user.create({
      data: { email: "hajo@porthun.de", passwordHash: hash, role: "ADMIN" },
    });

    // ── Ranking test data ────────────────────────────────────────────────────
    // Max Mustermann in 3 regattas × m=3 (3 races) → exactly 9 R_A values
    // s=1, x=1, f=1.0 → R_A=100 each → R=100.00
    const helm = await db.sailor.create({
      data: { firstName: "Max", lastName: "Mustermann", nationality: "GER" },
    });

    for (let i = 0; i < 3; i++) {
      const date = new Date(2025, i * 3, 15); // Jan/Apr/Jul 2025
      const regatta = await db.regatta.create({
        data: {
          name: `Testregatta ${i + 1}`,
          startDate: date,
          endDate: date,
          country: "GER",
          isRanglistenRegatta: true,
          completedRaces: 3,
          ranglistenFaktor: 1.0,
          sourceType: "MANUAL",
        },
      });
      const entry = await db.teamEntry.create({
        data: { regattaId: regatta.id, helmId: helm.id },
      });
      await db.result.create({
        data: { regattaId: regatta.id, teamEntryId: entry.id, finalRank: 1, inStartArea: false },
      });
    }

    // ── Import test regatta (matches wapo2026-paste.txt: 5 races) ────────────
    await db.regatta.create({
      data: {
        name: "Wannseepokal 2026",
        startDate: new Date("2026-04-10"),
        endDate: new Date("2026-04-12"),
        location: "Berlin-Wannsee",
        country: "GER",
        isRanglistenRegatta: true,
        completedRaces: 5,
        ranglistenFaktor: 1.0,
        sourceType: "MANAGE2SAIL_PASTE",
      },
    });

    console.log("✓ Test database seeded");
  } finally {
    await db.$disconnect();
  }
}
