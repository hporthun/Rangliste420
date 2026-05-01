import Link from "next/link";
import { Download, Upload, Clock, Info } from "lucide-react";
import { RestoreSection } from "@/app/admin/wartung/maintenance-client";
import { ScheduleConfig, StoredBackupList } from "@/app/admin/wartung/backup-schedule-client";
import { readSchedule, IS_SERVERLESS, HAS_BLOB_STORAGE } from "@/lib/backup/config";
import { listBackups } from "@/lib/backup/writer";
import { PageTour } from "@/components/tour/page-tour";
import type { TourStep } from "@/components/tour/tour-context";

const BACKUP_TOUR: TourStep[] = [
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
];

export default async function BackupPage() {
  const [schedule, storedBackups] = await Promise.all([
    readSchedule(),
    listBackups(),
  ]);

  const exportDate = new Date().toISOString().slice(0, 10);

  return (
    <div className="max-w-2xl space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/admin/wartung" className="text-sm text-muted-foreground hover:text-foreground">
            ← Wartung
          </Link>
          <h1 className="text-xl font-semibold mt-1">Datensicherung</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Automatische und manuelle Backups sowie Rücksicherung.
          </p>
        </div>
        <PageTour steps={BACKUP_TOUR} />
      </div>

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
    </div>
  );
}
