import { createPrismaClient } from "../lib/db/client";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const db = createPrismaClient();

async function main() {
  const email = "hajo@porthun.de";

  const existing = await db.user.findFirst({
    where: { OR: [{ email }, { username: "admin" }] },
  });
  if (existing) {
    // Migrate: set username if missing
    if (!existing.username) {
      await db.user.update({ where: { id: existing.id }, data: { username: "admin" } });
      console.log("Benutzername 'admin' für bestehenden Account gesetzt.");
    } else {
      console.log(`Admin user bereits vorhanden – kein Seed nötig.`);
    }
    return;
  }

  const password = crypto.randomBytes(12).toString("base64url");
  const passwordHash = await bcrypt.hash(password, 12);

  await db.user.create({
    data: { username: "admin", email, passwordHash, role: "ADMIN" },
  });

  console.log("─────────────────────────────────────────");
  console.log("Admin-Account erstellt:");
  console.log(`  Benutzername: admin`);
  console.log(`  E-Mail:       ${email}`);
  console.log(`  Passwort:     ${password}`);
  console.log("Bitte das Passwort sicher aufbewahren.");
  console.log("─────────────────────────────────────────");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
