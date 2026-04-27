import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { BACKUP_DIR } from "@/lib/backup/config";
import fs from "fs";
import path from "path";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }

  const { filename } = await params;

  // Security: only allow our own backup filenames
  if (!filename.match(/^420ranking-backup-[\d\-T]+\.json$/)) {
    return NextResponse.json({ error: "Ungültiger Dateiname." }, { status: 400 });
  }

  const filepath = path.join(BACKUP_DIR, filename);

  // Prevent path traversal (normalize + sep avoids prefix-collision on Windows,
  // e.g. C:\backup matching C:\backups)
  const safeDir = path.normalize(BACKUP_DIR) + path.sep;
  if (!path.normalize(filepath).startsWith(safeDir)) {
    return NextResponse.json({ error: "Ungültiger Pfad." }, { status: 400 });
  }

  if (!fs.existsSync(filepath)) {
    return NextResponse.json({ error: "Datei nicht gefunden." }, { status: 404 });
  }

  const content = fs.readFileSync(filepath);

  return new NextResponse(content, {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
