import { db } from "@/lib/db/client";
import { Download, Upload, Trash2, ScissorsLineDashed, Clock, ShieldCheck } from "lucide-react";
import { RestoreSection, DeleteAllSection, PruneSection, CleanupSection } from "./maintenance-client";
import { ScheduleConfig, StoredBackupList } from "./backup-schedule-client";
import { readSchedule } from "@/lib/backup/config";
import { listBackups } from "@/lib/backup/writer";
import { AuditLogSection } from "./audit-log";

export default async function WartungPage() {
  const [sailorCount, regattaCount, teamEntryCount, resultCount, rankingCount, allRegattas, auditLogs] =
    await Promise.all([
      db.sailor.count(),
      db.regatta.count(),
      db.teamEntry.count(),
      db.result.count(),
      db.ranking.count(),
      db.regatta.findMany({ select: { startDate: true }, orderBy: { startDate: "asc" } }),
      db.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
    ]);

  // Build a lookup map for user display names
  const userIds = [...new Set(auditLogs.map((l) => l.userId).filter(Boolean))] as string[];
  const users = userIds.length
    ? await db.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, username: true, email: true },
      })
    : [];
  const userMap = Object.fromEntries(users.map((u) => [u.id, u]));

  const regattaYears = [...new Set(allRegattas.map((r) => r.startDate.getFullYear()))].sort();

  // Backup schedule + stored files (read server-side)
  const schedule = readSchedule();
  const storedBackups = listBackups();

  const exportDate = new Date().toISOString().slice(0, 10);

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-xl font-semibold">Wartung</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Datensicherung, Wiederherstellung und Datenlöschung.
        </p>
      </div>

      {/* Current counts */}
      <div className="rounded-md border bg-muted/30 px-4 py-3 text-sm">
        <p className="font-medium mb-2">Aktueller Datenbestand</p>
        <div className="grid grid-cols-2 gap-x-6 gap-y-0.5 text-muted-foreground">
          <span>Segler</span><span className="font-medium text-foreground">{sailorCount}</span>
          <span>Regatten</span><span className="font-medium text-foreground">{regattaCount}</span>
          <span>Einträge (TeamEntry)</span><span className="font-medium text-foreground">{teamEntryCount}</span>
          <span>Ergebnisse</span><span className="font-medium text-foreground">{resultCount}</span>
          <span>Ranglisten</span><span className="font-medium text-foreground">{rankingCount}</span>
        </div>
      </div>

      {/* Section 1: Automatic backups */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-base font-semibold">Automatische Datensicherung</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Backups werden automatisch auf dem Server gespeichert. Die letzten 30 Dateien werden
          behalten, ältere werden automatisch gelöscht.
        </p>

        <ScheduleConfig initial={schedule} />

        <div className="pt-2">
          <p className="text-sm font-medium mb-3">Gespeicherte Backups ({storedBackups.length})</p>
          <StoredBackupList initial={storedBackups} />
        </div>
      </section>

      <hr />

      {/* Section 2: Manual one-off backup */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Download className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-base font-semibold">Einmalige Datensicherung</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Exportiert alle Daten sofort als JSON-Datei zum Herunterladen.
          Admin-Accounts sind nicht enthalten.
        </p>
        <a
          href="/api/admin/backup"
          download={`420ranking-backup-${exportDate}.json`}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 font-medium"
        >
          <Download className="h-4 w-4" />
          Backup herunterladen
        </a>
      </section>

      <hr />

      {/* Section 2: Restore */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Upload className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-base font-semibold">Rücksicherung</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Stellt Daten aus einer zuvor erstellten Backup-Datei wieder her. Alle vorhandenen Daten
          werden dabei gelöscht und durch die Backup-Daten ersetzt.
        </p>
        <RestoreSection />
      </section>

      <hr />

      {/* Section 3: Prune old data + orphan cleanup */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <ScissorsLineDashed className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-base font-semibold">Datenreduktion</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Löscht Regatten (incl. Ergebnisse) vor einem bestimmten Jahr und anschließend alle
          Segler, die dann keine Einträge mehr haben.
        </p>
        <PruneSection regattaYears={regattaYears} />

        <hr className="my-2" />

        <p className="text-sm text-muted-foreground">
          Bereinigt verwaiste Datensätze ohne zugehörige Einträge.
        </p>
        <CleanupSection />
      </section>

      <hr />

      {/* Section 4: Delete all */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Trash2 className="h-5 w-5 text-red-500" />
          <h2 className="text-base font-semibold text-red-700">Alle Daten löschen</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Löscht alle Segler, Regatten, Ergebnisse und Ranglisten unwiderruflich.
          Admin-Accounts bleiben erhalten. Vor dem Löschen unbedingt eine Datensicherung erstellen.
        </p>
        <DeleteAllSection />
      </section>

      <hr />

      {/* Section 5: Audit log */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-base font-semibold">Sicherheitsprotokoll</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Die letzten 100 sicherheitsrelevanten Ereignisse (Anmeldungen, Passwortänderungen, Backups u.a.).
        </p>
        <AuditLogSection logs={auditLogs} userMap={userMap} />
      </section>
    </div>
  );
}
