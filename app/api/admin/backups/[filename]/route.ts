import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getBackupBytes } from "@/lib/backup/writer";

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

  const bytes = await getBackupBytes(filename);
  if (!bytes) {
    return NextResponse.json({ error: "Datei nicht gefunden." }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
