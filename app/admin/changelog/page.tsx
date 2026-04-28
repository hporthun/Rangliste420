/**
 * Changelog page — keeps the user-facing release notes in sync with the
 * top-level CHANGELOG.md. Hand-curated as JSX so we don't need a Markdown
 * parser in the bundle. When you add a new entry to CHANGELOG.md, also
 * append it here.
 */
/* eslint-disable react/no-unescaped-entities */
import Link from "next/link";
import { APP_VERSION } from "@/lib/version";

type ChangeKind = "neu" | "geändert" | "korrigiert" | "entfernt";

type Entry = {
  version: string;
  date: string; // YYYY-MM-DD
  title?: string;
  changes: { kind: ChangeKind; items: React.ReactNode[] }[];
};

const ENTRIES: Entry[] = [
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

const KIND_LABELS: Record<ChangeKind, string> = {
  neu: "Neu",
  geändert: "Geändert",
  korrigiert: "Korrigiert",
  entfernt: "Entfernt",
};

const KIND_CLASSES: Record<ChangeKind, string> = {
  neu: "bg-emerald-50 text-emerald-700 border-emerald-200",
  geändert: "bg-blue-50 text-blue-700 border-blue-200",
  korrigiert: "bg-amber-50 text-amber-800 border-amber-200",
  entfernt: "bg-red-50 text-red-700 border-red-200",
};

export default function ChangelogPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <Link
          href="/admin"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Admin
        </Link>
        <h1 className="text-2xl font-bold mt-1">Änderungsverlauf</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Aktuelle Version: <span className="font-mono font-medium text-foreground">v{APP_VERSION}</span>
        </p>
      </div>

      <div className="space-y-8">
        {ENTRIES.map((entry) => (
          <article
            key={entry.version}
            className="rounded-lg border bg-card p-5 space-y-3"
          >
            <header className="flex items-baseline justify-between gap-3 pb-2 border-b">
              <h2 className="text-lg font-semibold">
                v{entry.version}
                {entry.title && (
                  <span className="ml-2 font-normal text-base text-muted-foreground">
                    — {entry.title}
                  </span>
                )}
              </h2>
              <time
                dateTime={entry.date}
                className="text-xs font-mono text-muted-foreground tabular-nums shrink-0"
              >
                {new Date(entry.date).toLocaleDateString("de-DE", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                })}
              </time>
            </header>

            {entry.changes.map((change, ci) => (
              <section key={ci} className="space-y-2">
                <span
                  className={`inline-block px-2 py-0.5 text-xs font-semibold rounded border ${KIND_CLASSES[change.kind]}`}
                >
                  {KIND_LABELS[change.kind]}
                </span>
                <ul className="ml-1 space-y-1.5 text-sm">
                  {change.items.map((item, ii) => (
                    <li key={ii} className="flex gap-2">
                      <span className="text-muted-foreground shrink-0">•</span>
                      <span className="leading-relaxed">{item}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </article>
        ))}
      </div>

      <p className="text-xs text-muted-foreground text-center pt-4">
        Ab 2026.04.1:{" "}
        <a
          href="https://calver.org/"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-foreground"
        >
          Calendar Versioning
        </a>{" "}
        (JJJJ.MM.N). Ältere Versionen folgen SemVer.{" "}
        Quelltext und vollständige Commit-Historie:{" "}
        <a
          href="https://git.pt-systemhaus.de/HPorthun/Rangliste420"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-foreground"
        >
          Gitea-Repo
        </a>
        .
      </p>
    </div>
  );
}
