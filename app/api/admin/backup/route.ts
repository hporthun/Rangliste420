import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }

  const [sailors, regattas, rankings, teamEntries, results, rankingRegattas, importSessions] =
    await Promise.all([
      db.sailor.findMany({ orderBy: { id: "asc" } }),
      db.regatta.findMany({ orderBy: { id: "asc" } }),
      db.ranking.findMany({ orderBy: { id: "asc" } }),
      db.teamEntry.findMany({ orderBy: { id: "asc" } }),
      db.result.findMany({ orderBy: { id: "asc" } }),
      db.rankingRegatta.findMany({ orderBy: [{ rankingId: "asc" }, { regattaId: "asc" }] }),
      db.importSession.findMany({ orderBy: { id: "asc" } }),
    ]);

  const backup = {
    version: 1,
    exportedAt: new Date().toISOString(),
    counts: {
      sailors: sailors.length,
      regattas: regattas.length,
      rankings: rankings.length,
      teamEntries: teamEntries.length,
      results: results.length,
      rankingRegattas: rankingRegattas.length,
      importSessions: importSessions.length,
    },
    data: {
      sailors,
      regattas,
      rankings,
      teamEntries,
      results,
      rankingRegattas,
      importSessions,
    },
  };

  const json = JSON.stringify(backup, null, 2);
  const date = new Date().toISOString().slice(0, 10);
  const filename = `420ranking-backup-${date}.json`;

  return new NextResponse(json, {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
