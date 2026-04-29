import Link from "next/link";
import { db } from "@/lib/db/client";
import { Download, Upload, Trash2, ScissorsLineDashed, Clock, ShieldCheck, Info, Mail, ArrowRight } from "lucide-react";
import { RestoreSection, DeleteAllSection, PruneSection, CleanupSection } from "./maintenance-client";
import { ScheduleConfig, StoredBackupList } from "./backup-schedule-client";
import { readSchedule, IS_SERVERLESS, HAS_BLOB_STORAGE } from "@/lib/backup/config";
import { listBackups } from "@/lib/backup/writer";
import { AuditLogSection } from "./audit-log";
import { PageTour } from "@/components/tour/page-tour";
import type { TourStep } from "@/components/tour/tour-context";

// ── Page-specific tour steps ──────────────────────────────────────────────────

const WARTUNG_TOUR: TourStep[] = [
  {
    id: "wartung-bestand",
    target: '[data-tour="wartung-bestand"]',
    title: "Aktueller Datenbestand",
    content:
      "Zeigt auf einen Blick, wie viele Datensätze aktuell gespeichert sind. " +
      "Nützlich zur Kontrolle vor und nach einem Import oder einer Datenreduktion.",
    placement: "bottom",
  },
  {
    id: "wartung-auto",
    target: '[data-tour="wartung-auto"]',
    title: "Automatische Datensicherung",
    content:
      "Plane regelmäßige Backups nach Wochentag und Uhrzeit. " +
      "Backups werden auf dem Server gespeichert und können direkt heruntergeladen " +
      "oder für eine Rücksicherung verwendet werden. " +
      "Optionale AES-256-Verschlüsselung schützt die Dateien bei Weitergabe.",
    placement: "bottom",
  },
  {
    id: "wartung-jetzt",
    target: '[data-tour="wartung-jetzt"]',
    title: "Sofortiges Backup",
    content:
      "Erstellt sofort einen vollständigen Datenexport als JSON-Datei zum Herunterladen — " +
      "ohne Zeitplan, ohne Server-Speicherung. " +
      "Ideal vor größeren Änderungen wie einem Import oder einer Datenreduktion.",
    placement: "bottom",
  },
  {
    id: "wartung-rueck",
    target: '[data-tour="wartung-rueck"]',
    title: "Rücksicherung",
    content:
      "Stellt einen früheren Datenstand aus einer Backup-Datei wieder her. " +
      "Achtung: Alle aktuellen Daten werden dabei unwiderruflich gelöscht " +
      "und durch den Backup-Stand ersetzt. " +
      "Verschlüsselte Backups benötigen das Passwort aus dem Zeitplan.",
    placement: "bottom",
  },
  {
    id: "wartung-reduktion",
    target: '[data-tour="wartung-reduktion"]',
    title: "Datenreduktion",
    content:
      "Entfernt Regatten (inkl. aller Ergebnisse) vor einem bestimmten Jahr " +
      "und anschließend alle Segler ohne verbleibende Einträge. " +
      "Sinnvoll um den Datenbestand nach mehreren Saisons übersichtlich zu halten. " +
      "Vorher unbedingt ein Backup erstellen!",
    placement: "bottom",
  },
  {
    id: "wartung-protokoll",
    target: '[data-tour="wartung-protokoll"]',
    title: "Sicherheitsprotokoll",
    content:
      "Protokolliert alle sicherheitsrelevanten Ereignisse: " +
      "Anmeldungen, Passwortänderungen, Backups, Rücksicherungen und Datenlöschungen — " +
      "mit Zeitstempel, Benutzer und IP-Adresse. " +
      "Die letzten 100 Einträge werden angezeigt.",
    placement: "bottom",
  },
];

// ── Page ──────────────────────────────────────────────────────────────────────

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
  const [schedule, storedBackups] = await Promise.all([
    readSchedule(),
    listBackups(),
  ]);

  const exportDate = new Date().toISOString().slice(0, 10);

  return (
    <div className="max-w-2xl space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Wartung</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Datensicherung, Wiederherstellung und Datenlöschung.
          </p>
        </div>
        <PageTour steps={WARTUNG_TOUR} />
      </div>

      {/* Serverless deployment info */}
      {IS_SERVERLESS && (
        <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 flex items-start gap-3">
          <Info className="h-5 w-5 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-medium">Serverless-Modus (Vercel)</p>
            <ul className="list-disc pl-5 text-xs leading-relaxed">
              <li>
                <strong>Storage:</strong>{" "}
                {HAS_BLOB_STORAGE ? (
                  <>Vercel Blob (persistent, Backups überleben Deploys und Cold-Starts).</>
                ) : (
                  <>
                    Vercel Blob ist noch nicht konfiguriert — manuelle Backups werden in
                    {" "}<code>/tmp</code> abgelegt und nicht zwischen Function-Aufrufen
                    erhalten. Im Vercel-Dashboard unter <em>Storage → Blob</em> einen Store
                    erstellen.
                  </>
                )}
              </li>
              <li>
                <strong>Automatischer Zeitplan:</strong> läuft via Vercel Cron einmal täglich
                gegen 02:00&nbsp;Uhr MEZ (01:00&nbsp;UTC). Die Wochentag-Auswahl wird beachtet,
                die Uhrzeit-Auswahl ist auf dem Hobby-Tarif rein informativ.
              </li>
            </ul>
          </div>
        </div>
      )}

      {/* Current counts */}
      <div
        data-tour="wartung-bestand"
        className="rounded-md border bg-muted/30 px-4 py-3 text-sm"
      >
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
      <section className="space-y-4" data-tour="wartung-auto">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-base font-semibold">Automatische Datensicherung</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Backups werden automatisch auf dem Server gespeichert. Die letzten 30 Dateien werden
          behalten, ältere werden automatisch gelöscht.
        </p>

        <ScheduleConfig initial={schedule} isServerless={IS_SERVERLESS} />

        <div className="pt-2">
          <p className="text-sm font-medium mb-3">Gespeicherte Backups ({storedBackups.length})</p>
          <StoredBackupList initial={storedBackups} />
        </div>
      </section>

      <hr />

      {/* Section 2: Manual one-off backup */}
      <section className="space-y-3" data-tour="wartung-jetzt">
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

      {/* Section 3: Restore */}
      <section className="space-y-3" data-tour="wartung-rueck">
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

      {/* Section 4: Prune old data + orphan cleanup */}
      <section className="space-y-4" data-tour="wartung-reduktion">
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

      {/* Section: Mail-Konfiguration (link out) */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Mail className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-base font-semibold">E-Mail-Versand</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          SMTP-Zugangsdaten für Passwort-Reset-Mails sind ausgelagert.
        </p>
        <Link
          href="/admin/mail"
          className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline"
        >
          E-Mail-Konfiguration öffnen <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </section>

      <hr />

      {/* Section 5: Delete all */}
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

      {/* Section 6: Audit log */}
      <section className="space-y-3" data-tour="wartung-protokoll">
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
