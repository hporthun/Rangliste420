import Link from "next/link";
import { db } from "@/lib/db/client";
import { Trash2, ScissorsLineDashed, ShieldCheck, HardDrive, Mail, ArrowRight } from "lucide-react";
import { DeleteAllSection, PruneSection, CleanupSection } from "./maintenance-client";
import { AuditLogSection } from "./audit-log";
import { PageTour } from "@/components/tour/page-tour";
import type { TourStep } from "@/components/tour/tour-context";
import { requireRole } from "@/lib/auth-guard";

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
  // Admin-only — Editors werden auf /admin umgeleitet, bevor irgendwelche
  // sensitiven Wartungs-Daten geladen werden.
  await requireRole("ADMIN");

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

  const userIds = [...new Set(auditLogs.map((l) => l.userId).filter(Boolean))] as string[];
  const users = userIds.length
    ? await db.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, username: true, email: true },
      })
    : [];
  const userMap = Object.fromEntries(users.map((u) => [u.id, u]));

  const regattaYears = [...new Set(allRegattas.map((r) => r.startDate.getFullYear()))].sort();

  return (
    <div className="max-w-2xl space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Wartung</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Datenreduktion, Bereinigung und Datenlöschung.
          </p>
        </div>
        <PageTour steps={WARTUNG_TOUR} />
      </div>

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

      {/* Section: Datensicherung (link out) */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <HardDrive className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-base font-semibold">Datensicherung</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Automatische und manuelle Backups, Rücksicherung aus Backup-Dateien.
        </p>
        <Link
          href="/admin/backup"
          className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline"
        >
          Datensicherung öffnen <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </section>

      <hr />

      {/* Section: Prune old data + orphan cleanup */}
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

      {/* Section: Delete all */}
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

      {/* Section: Audit log */}
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
