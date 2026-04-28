/**
 * Single source of truth for the user-facing release notes.
 *
 * Used by:
 *   - app/admin/changelog/page.tsx (full list)
 *   - components/admin/changelog-popup.tsx (after-login popup with unread entries)
 *
 * When you add an entry:
 *   1. Bump the version in package.json
 *   2. Add a Markdown entry to top-level CHANGELOG.md
 *   3. Prepend a JSX entry below
 */
/* eslint-disable react/no-unescaped-entities */
import type { ReactNode } from "react";

export type ChangeKind = "neu" | "geändert" | "korrigiert" | "entfernt";

export type ChangelogEntry = {
  /** Display version, e.g. "2026.04.5". Compared numerically by parts. */
  version: string;
  /** ISO date YYYY-MM-DD */
  date: string;
  /** Optional short title for the release */
  title?: string;
  changes: { kind: ChangeKind; items: ReactNode[] }[];
};

export const KIND_LABELS: Record<ChangeKind, string> = {
  neu: "Neu",
  geändert: "Geändert",
  korrigiert: "Korrigiert",
  entfernt: "Entfernt",
};

export const KIND_CLASSES: Record<ChangeKind, string> = {
  neu: "bg-emerald-50 text-emerald-700 border-emerald-200",
  geändert: "bg-blue-50 text-blue-700 border-blue-200",
  korrigiert: "bg-amber-50 text-amber-800 border-amber-200",
  entfernt: "bg-red-50 text-red-700 border-red-200",
};

/**
 * Compare two version strings numerically by parts. Works for both old SemVer
 * ("1.1.1") and new CalVer ("2026.04.5") formats — leading zeros are
 * irrelevant since we parseInt each segment.
 *
 * Returns negative if a < b, 0 if equal, positive if a > b.
 */
export function compareVersions(a: string, b: string): number {
  const partsA = a.split(".").map((p) => parseInt(p, 10));
  const partsB = b.split(".").map((p) => parseInt(p, 10));
  const len = Math.max(partsA.length, partsB.length);
  for (let i = 0; i < len; i++) {
    const ai = partsA[i] ?? 0;
    const bi = partsB[i] ?? 0;
    if (Number.isNaN(ai) || Number.isNaN(bi)) return 0;
    if (ai !== bi) return ai - bi;
  }
  return 0;
}

/**
 * Returns entries that are newer than `lastRead`.
 *
 * For users that have never marked anything as read (`lastRead === null`),
 * we show only the most recent entry — enough to surface the popup once
 * without overwhelming a brand-new admin with the entire history.
 */
export function unreadEntries(lastRead: string | null): ChangelogEntry[] {
  if (!lastRead) {
    return ENTRIES.slice(0, 1);
  }
  return ENTRIES.filter(
    (e) => compareVersions(e.version, lastRead) > 0
  );
}

export const ENTRIES: ChangelogEntry[] = [
  {
    version: "2026.04.6",
    date: "2026-04-28",
    title: "Changelog-Popup + Mobile-Fixes",
    changes: [
      {
        kind: "neu",
        items: [
          <>
            <strong>Changelog-Popup nach Login</strong>: zeigt nach dem Anmelden
            die seit dem letzten „als gelesen markieren" hinzugekommenen
            Änderungen (Issue #17). Pro Benutzer wird die zuletzt bestätigte
            Version in der Datenbank gespeichert.
          </>,
        ],
      },
      {
        kind: "korrigiert",
        items: [
          <>
            <strong>Schreibfehler „Ranglistenregattaen"</strong> auf der
            Public-Startseite korrigiert — jetzt korrekt „Ranglistenregatten"
            (Issue #18).
          </>,
          <>
            <strong>Mobile-Layout der Public-Startseite</strong>: Statistik-Karten
            stapeln auf schmalen Bildschirmen statt zu überlaufen, kompakteres
            Hero, kleineres Logo und Fluid-Padding (Issue #19).
          </>,
        ],
      },
    ],
  },
  {
    version: "2026.04.5",
    date: "2026-04-28",
    title: "Bugfix PDF-Worker (final)",
    changes: [
      {
        kind: "korrigiert",
        items: [
          <>
            <strong>pdfjs-Worker per globalThis.pdfjsWorker vorinstallieren</strong>:
            Next.js Turbopack ersetzt{" "}
            <code className="font-mono text-xs">import.meta.url</code> externer
            Pakete durch eine synthetische{" "}
            <code className="font-mono text-xs">[project]/…</code>-URL, weshalb
            der pdfjs-dist-interne dynamische Import des Workers fehlschlug. Fix:
            pdfjs-dist überspringt den Import, wenn{" "}
            <code className="font-mono text-xs">globalThis.pdfjsWorker?.WorkerMessageHandler</code>{" "}
            schon gesetzt ist —{" "}
            <code className="font-mono text-xs">pdf-utils.ts</code> lädt den
            Worker jetzt einmalig statisch und legt den Handler global ab.
            Verifiziert: PDF-Import funktioniert sogar mit absichtlich kaputtem
            <code className="ml-1 font-mono text-xs">workerSrc</code>.
          </>,
        ],
      },
    ],
  },
  {
    version: "2026.04.4",
    date: "2026-04-28",
    title: 'Bugfix [project]-Pfad',
    changes: [
      {
        kind: "korrigiert",
        items: [
          <>
            <strong>workerSrc-Override entfernt</strong>: Der{" "}
            <code className="font-mono text-xs">createRequire(import.meta.url)</code>
            -Ansatz aus 2026.04.3 erzeugte im Next.js-Dev-Server einen Pfad mit dem
            synthetischen{" "}
            <code className="font-mono text-xs">[project]/…</code>-Präfix, den
            Node.js als Paketnamen interpretierte und nicht auflösen konnte.
            Da <code className="font-mono text-xs">outputFileTracingIncludes</code>{" "}
            bereits sicherstellt, dass{" "}
            <code className="font-mono text-xs">pdf.worker.mjs</code> im
            Vercel-Bundle vorhanden ist, reicht pdfjs-dists Standard-Relativpfad
            aus — der Override ist nicht nötig.
          </>,
        ],
      },
    ],
  },
  {
    version: "2026.04.3",
    date: "2026-04-28",
    title: "Bugfix PDF-Worker Vercel",
    changes: [
      {
        kind: "korrigiert",
        items: [
          <>
            <strong>Worker-Datei im Vercel-Bundle</strong>: pdfjs-dist importiert
            <code className="ml-1 mr-1 font-mono text-xs">pdf.worker.mjs</code>
            mit einem Webpack-Ignore-Hinweis, weshalb Vercels Datei-Tracer sie
            nicht ins Deployment aufnimmt. Beim ersten PDF-Import schlug die App
            mit <em>Cannot find module pdf.worker.mjs</em> fehl. Fix:
            <code className="ml-1 font-mono text-xs">outputFileTracingIncludes</code>
            {" "}in{" "}
            <code className="font-mono text-xs">next.config.ts</code>
            {" "}erzwingt die Aufnahme; zus. setzt
            <code className="ml-1 font-mono text-xs">pdf-utils.ts</code>
            {" "}den absoluten Worker-Pfad explizit.
          </>,
          <>
            <strong>DOMMatrix-Polyfill erweitert</strong>:{" "}
            <code className="font-mono text-xs">scaleSelf</code>,{" "}
            <code className="font-mono text-xs">translateSelf</code>{" "}
            und weitere Methoden ergänzt.
          </>,
        ],
      },
    ],
  },
  {
    version: "2026.04.2",
    date: "2026-04-28",
    title: "Bugfix PDF-Import",
    changes: [
      {
        kind: "korrigiert",
        items: [
          <>
            <strong>pdfjs-dist lädt jetzt in Node.js</strong>: Die Bibliothek
            referenziert <code className="font-mono text-xs">DOMMatrix</code> als
            Top-Level-Konstante beim Modul-Start — in Node.js nicht vorhanden,
            was zum Absturz{" "}
            <em>ReferenceError: DOMMatrix is not defined</em> beim ersten
            PDF-Upload führte. Ein minimaler Stub wird jetzt in{" "}
            <code className="font-mono text-xs">instrumentation.ts</code> beim
            Server-Start installiert (Issue #16).
          </>,
        ],
      },
    ],
  },
  {
    version: "2026.04.1",
    date: "2026-04-28",
    title: "Responsive + CalVer",
    changes: [
      {
        kind: "geändert",
        items: [
          <>
            <strong>Versionierungsformat auf CalVer umgestellt</strong>: ab sofort
            <code className="ml-1 mr-1 font-mono text-xs">JJJJ.MM.N</code>
            (z.B. <code className="font-mono text-xs">2026.04.1</code>). Die
            laufende Nummer zählt Releases innerhalb des Monats (Issue #14).
          </>,
        ],
      },
      {
        kind: "neu",
        items: [
          <>
            <strong>Responsive öffentliche Seiten</strong>: alle Tabellen sind auf
            Mobilgeräten horizontal scrollbar, nicht benötigte Spalten werden auf
            kleinen Bildschirmen ausgeblendet. Kompakterer Header-Abstand auf engen
            Viewports (Issue #15).
          </>,
        ],
      },
    ],
  },
  {
    version: "1.1.1",
    date: "2026-04-28",
    title: "Bugfix Import — Neu anlegen",
    changes: [
      {
        kind: "korrigiert",
        items: [
          <>
            Beim Klick auf <em>„Neu anlegen"</em> aus dem Vorschlag heraus wurde der
            Name des <strong>vorgeschlagenen</strong> Seglers ins Formular übernommen
            statt der gerade aus den Importdaten geparste Name. Aus dem „Ändern → Neu
            anlegen"-Pfad waren die Felder sogar leer. Jetzt wird in allen drei Pfaden
            konsistent der geparste Helm- bzw. Crew-Name vorgeschlagen (Issue #12).
          </>,
        ],
      },
    ],
  },
  {
    version: "1.1.0",
    date: "2026-04-28",
    title: "Segler-Merge",
    changes: [
      {
        kind: "neu",
        items: [
          <>
            <strong>Zwei Segler zusammenführen</strong>: über die neue Seite
            <code className="ml-1 mr-1 font-mono text-xs">/admin/segler/merge</code>
            oder den Button „Mit anderem zusammenführen…" auf der Segler-Detailseite
            lassen sich Duplikate auflösen. Alle Regatta-Einträge (Steuermann + Crew)
            wandern auf den primären Datensatz, der sekundäre wird gelöscht (Issue #7).
          </>,
          <>
            <strong>Vorschau vor dem Merge</strong> mit Anzahl betroffener Einträge,
            neuen alternativen Namen und ergänzten Stammdaten.
          </>,
          <>
            <strong>Konflikt-Erkennung</strong>: blockiert den Merge, wenn beide
            Segler in derselben Regatta als Steuermann eingetragen sind, und listet
            die betroffenen Regatten zur manuellen Bereinigung.
          </>,
          <>Jeder Merge wird im Sicherheitsprotokoll vermerkt.</>,
        ],
      },
    ],
  },
  {
    version: "1.0.1",
    date: "2026-04-28",
    title: "Bugfix Import-Matching",
    changes: [
      {
        kind: "korrigiert",
        items: [
          <>
            <strong>Alternative Treffer im Matching</strong>: bei einem mittleren
            Match (75–90 %) zeigt der Wizard jetzt alle ähnlichen Segler nebeneinander
            statt nur den ersten Vorschlag (Gitea-Issue #5).
          </>,
          <>
            <strong>Such-Feld statt Dropdown</strong> im „Ändern"-Modus —
            Typeahead-Suche in Vor- und Nachname sowie Segelnummer.
          </>,
        ],
      },
    ],
  },
  {
    version: "1.0.0",
    date: "2026-04-28",
    title: "Erste Produktionsversion auf Vercel + Neon",
    changes: [
      {
        kind: "neu",
        items: [
          <><strong>Vercel-Deployment</strong> mit Neon-PostgreSQL als Production-Datenbank.</>,
          <><strong>Vercel Blob</strong> als persistenter Backup-Storage.</>,
          <><strong>Vercel Cron</strong>: tägliche automatische Backups, Wochentag-Auswahl wird respektiert.</>,
          <><strong>Backup-Zeitplan in der Datenbank</strong> persistiert (überlebt Cold-Starts).</>,
          <>PDF-fähiges <strong>Benutzerhandbuch</strong> mit Inhaltsverzeichnis, Kapitelnummern und automatischen Seitenzahlen.</>,
          <>Animiertes <strong>Tutorial-GIF</strong> für den Regatta-Import-Workflow.</>,
          <>Sechs eingebundene <strong>Screenshots</strong> in der Hilfe (Dashboard, Segler, Regatten, Import, Ranglisten, Wartung).</>,
          <>Hilfe-Erweiterungen: Schottenwechsel-Abschnitt, JWM/JEM-Quali, Tour-Hinweis.</>,
        ],
      },
    ],
  },
  {
    version: "0.7.0",
    date: "2026-04-27",
    title: "Backup-Restore-Erweiterungen",
    changes: [
      {
        kind: "neu",
        items: [
          <><strong>Teilweise Rücksicherung</strong>: Auswahl zwischen „Alles", „Nur Segler" und „Nur Regatten & Ergebnisse".</>,
          <><strong>Sicherheits-Backup vor jeder Rücksicherung</strong> mit dem Kommentar „Backup vor Rücksicherung".</>,
          <><strong>Beschreibende Kommentare bei Auto-Backups</strong>: „Backup vor Datenlöschung" / „Backup vor Datenreduktion (Regatten vor JJJJ)".</>,
        ],
      },
    ],
  },
  {
    version: "0.6.0",
    date: "2026-04-27",
    title: "Sicherheitshärtung im Backup-Restore",
    changes: [
      {
        kind: "geändert",
        items: [
          <><strong>Atomare Rücksicherung</strong>: Phase 1 (Delete) und Phase 2 (Insert) jetzt in einer einzigen Transaktion.</>,
          <><strong>Upload-Größenlimit</strong>: 100 MB für Backup-Dateien.</>,
          <><strong>Path-Traversal-Schutz</strong> mit korrekter <code>path.normalize</code>-Behandlung auf Windows.</>,
        ],
      },
    ],
  },
  {
    version: "0.5.0",
    date: "2026-04-26",
    title: "Backup-Komfort und Tour-System",
    changes: [
      {
        kind: "neu",
        items: [
          <><strong>Backup-Kommentarfeld</strong> pro Backup, automatisch befüllt bei Auto-Backups.</>,
          <><strong>Tour-System</strong> auf Unterseiten: „Seite erkunden"-Button mit step-by-step Highlights.</>,
          <>JWM/JEM-Rangliste mit <strong>Jahresfilter und Suchfeld</strong>.</>,
        ],
      },
      {
        kind: "korrigiert",
        items: [
          <>Spotlight folgt beim Scrollen.</>,
          <>Tour-Tooltip bleibt im sichtbaren Bereich (Flip-Logik).</>,
        ],
      },
    ],
  },
];
