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
    version: "2026.04.18",
    date: "2026-04-29",
    title: "Bugfix IDJM s-Berechnung",
    changes: [
      {
        kind: "korrigiert",
        items: [
          <>
            <strong>IDJM-Quali R_A-Verzerrung behoben</strong>: Vorher hat
            das IDJM-Modul die Regatta-Ergebnisse nach Altersklasse
            ge-pre-filtert, bevor <code className="font-mono text-xs">s</code>{" "}
            (Gesamtteilnehmerzahl) berechnet wurde. Dadurch wurden R_A-Werte
            für IDJM systematisch überschätzt, weil ausgeschlossene Boote
            nicht mehr in s zählten. Jetzt wird der Altersfilter über ein
            Flag in der DSV-Engine angewendet, ohne s zu reduzieren — die
            tatsächliche Anzahl gestarteter Boote zählt, auch bei
            Auslandsregatten und auch wenn nur wenige Boote IDJM-berechtigt
            sind.
          </>,
        ],
      },
    ],
  },
  {
    version: "2026.04.17",
    date: "2026-04-29",
    title: "JWM/JEM-Schottenwechsel-Regel",
    changes: [
      {
        kind: "geändert",
        items: [
          <>
            <strong>JWM/JEM-Quali wertet Helm + Crew als Team</strong>: pro
            Helm ist nur <em>ein einziger</em> genehmigter Schottenwechsel
            erlaubt — der Helm bleibt dann mit beiden Crews dasselbe Team.
            Ungenehmigte oder weitere Wechsel starten ein neues Team (eigene
            Zeile mit „neues Team"-Markierung). Erste Crew vor dem Stichtag
            wird als Original-Team gewertet.
          </>,
          <>
            UI zeigt jetzt Crew-Name(n) pro Team in der JWM/JEM-Tabelle, sowohl
            im Admin-Bereich als auch in der öffentlichen Ranglisten-Ansicht.
          </>,
          <>
            6 neue Unit-Tests decken alle Kombinationen ab (stabile Crew,
            ungenehmigter / genehmigter / zweiter Wechsel, Rückkehr zur
            Original-Crew).
          </>,
        ],
      },
    ],
  },
  {
    version: "2026.04.16",
    date: "2026-04-29",
    title: "Schottenwechsel-Toggle",
    changes: [
      {
        kind: "neu",
        items: [
          <>
            <strong>Schottenwechsel pro Crew-Eintrag markieren</strong>{" "}
            (Issue #11): In der Regatta-Detail-Tabelle erscheint neben
            jedem Crew-Eintrag ein ↻-Icon. Klick öffnet ein Popover mit
            „Genehmigt"-Checkbox und optionalem Notizfeld. Hinweis im
            Popover: relevant ist das Feld nur für die JWM/JEM-Quali,
            DSV-/Aktuelle-/IDJM-Ranglisten ignorieren es.
          </>,
        ],
      },
    ],
  },
  {
    version: "2026.04.15",
    date: "2026-04-29",
    title: "Bugfix OAuth-Buttons",
    changes: [
      {
        kind: "korrigiert",
        items: [
          <>
            <strong>OAuth-Buttons fehlten auf Vercel</strong> (Issue #33):
            Next.js prerendete die Login-Seite zur Build-Zeit, sodass nachträglich
            im Dashboard gesetzte Provider-Env-Vars nie gelesen wurden. Mit{" "}
            <code className="font-mono text-xs">dynamic = &quot;force-dynamic&quot;</code>{" "}
            rendert die Seite jetzt pro Request — Änderungen an Env-Vars
            wirken sofort. Zusätzlich wurde{" "}
            <code className="font-mono text-xs">auth-providers.ts</code>{" "}
            refaktoriert, sodass Provider und UI-Metadaten in einem Schritt
            aufgebaut werden statt die ID zur Laufzeit zu extrahieren —
            robust gegen verschiedene Rückgabe-Typen der NextAuth-Provider.
          </>,
        ],
      },
    ],
  },
  {
    version: "2026.04.14",
    date: "2026-04-29",
    title: "E-Mail-Konfiguration im Web-UI",
    changes: [
      {
        kind: "neu",
        items: [
          <>
            <strong>SMTP-Konfiguration via Admin-Oberfläche</strong> (Issue #32):
            neue Seite{" "}
            <code className="font-mono text-xs">/admin/mail</code> mit
            Formular für Host, Port, Login, Passwort und Absender. Die Werte
            werden in der Datenbank gespeichert und überschreiben die{" "}
            <code className="font-mono text-xs">SMTP_*</code>-Env-Variablen —
            kein Re-Deploy mehr nötig, um SMTP-Zugänge zu ändern.
          </>,
          <>
            <strong>Test-Mail-Button</strong>: sendet sofort eine Test-Mail
            mit den im Formular stehenden Werten, auch ohne vorher zu
            speichern. So lassen sich Host und Login verifizieren, bevor
            commitet wird.
          </>,
          <>
            <strong>Status-Anzeige</strong> auf der Seite: zeigt deutlich, ob
            DB-Konfig oder Env-Fallback aktiv ist (oder gar nichts).
          </>,
        ],
      },
    ],
  },
  {
    version: "2026.04.13",
    date: "2026-04-29",
    title: "Crew-Namen in Ranglisten",
    changes: [
      {
        kind: "neu",
        items: [
          <>
            <strong>Crew-Namen in jeder Rangliste</strong> (Issue #31): unter
            jedem Steuermann steht jetzt, mit welcher Crew er in dieser Saison
            gesegelt ist — eine Crew = Vollname, zwei Crews = beide,
            ab drei Crews die häufigste + „+N weitere".
            Hover blendet alle vollständig ein. Wirkt in öffentlicher
            Rangliste, Admin-Vorschau, Speichern-Dialog und JWM/JEM-Tabellen.
          </>,
        ],
      },
    ],
  },
  {
    version: "2026.04.12",
    date: "2026-04-29",
    title: "Reset-Mail + PWA-Logo",
    changes: [
      {
        kind: "korrigiert",
        items: [
          <>
            <strong>Passwort-Reset per E-Mail funktioniert jetzt</strong>{" "}
            (Issue #29): Vorher wurde der Reset-Link direkt im Browser
            angezeigt — Sicherheitslücke, da jeder Links für fremde Accounts
            erzeugen konnte. Jetzt geht der Link ausschließlich per E-Mail
            an die im Account hinterlegte Adresse. SMTP-Konfiguration über{" "}
            <code className="font-mono text-xs">SMTP_HOST</code>,{" "}
            <code className="font-mono text-xs">SMTP_USER</code>,{" "}
            <code className="font-mono text-xs">SMTP_PASS</code>,{" "}
            <code className="font-mono text-xs">MAIL_FROM</code>.
          </>,
        ],
      },
      {
        kind: "neu",
        items: [
          <>
            <strong>Web-App-Logo</strong> (Issue #30): das tatsächliche
            420er-Klassenlogo erscheint jetzt als Icon, wenn die App über
            „Zum Home-Bildschirm hinzufügen" auf iOS oder Android installiert
            wird. Manifest mit maritime-blauem Theme.
          </>,
        ],
      },
    ],
  },
  {
    version: "2026.04.11",
    date: "2026-04-28",
    title: "Ranglisten bearbeitbar + IDJM speicherbar",
    changes: [
      {
        kind: "neu",
        items: [
          <>
            <strong>Saison-Dropdown</strong> in der Ranglisten-Vorschau
            (Issue #27): Wählst du eine Saison, werden Von/Bis automatisch
            gesetzt (01.01.–30.11. für Jahresrangliste & IDJM, 01.01.–heute
            für Aktuelle Rangliste). Datumsfelder bleiben für Sonderfälle
            override-bar.
          </>,
          <>
            <strong>Rangliste bearbeiten</strong> (Issue #26): Tabellen-Icon ⚙
            neben Umbenennen/Löschen. Klick öffnet die Vorschau mit den
            Originalparametern — Änderungen werden in den bestehenden
            Datensatz übernommen, der Veröffentlichungs-Status bleibt.
          </>,
          <>
            <strong>IDJM-Quali speicherbar</strong> (Issue #28): IDJM-Quali
            wird wie die Jahresrangliste persistiert und veröffentlicht.
            Aktuelle Rangliste bleibt live-only.
          </>,
        ],
      },
    ],
  },
  {
    version: "2026.04.10",
    date: "2026-04-28",
    title: "Auto-420 + OAuth-Login",
    changes: [
      {
        kind: "neu",
        items: [
          <>
            <strong>Anmeldung via Google, Microsoft, Apple, Meta</strong>{" "}
            (Issue #25): Auf der Login-Seite erscheinen Buttons für jeden Provider,
            dessen Credentials als Env-Variablen gesetzt sind. Login funktioniert
            ausschließlich, wenn die vom Provider gelieferte E-Mail einer
            existierenden Admin-E-Mail entspricht — kein Self-Sign-up. Audit-Log
            unterscheidet erfolgreichen und abgelehnten OAuth-Login.
          </>,
        ],
      },
      {
        kind: "geändert",
        items: [
          <>
            <strong>M2S-Klassenauswahl</strong> (Issue #24): Wenn genau eine
            Klasse den String „420" enthält („420", „420er", „420 er" …), wird
            sie automatisch ausgewählt und die Ergebnisse werden direkt geladen.
            Im Dropdown erscheint ein ⚓-Marker neben passenden Klassen.
          </>,
        ],
      },
    ],
  },
  {
    version: "2026.04.9",
    date: "2026-04-28",
    title: "Passkeys + Stammdaten-Import",
    changes: [
      {
        kind: "korrigiert",
        items: [
          <>
            <strong>Passkey-Erstellung auf Vercel</strong> (Issue #22): RP-ID
            war hardcoded auf <code className="font-mono text-xs">localhost</code>,
            weshalb <code className="font-mono text-xs">navigator.credentials.create</code>{" "}
            unter dem Vercel-Hostnamen mit „The RP ID 'localhost' is invalid"
            abbrach. RP-ID und Origin werden jetzt pro Request aus den
            Host-Headern abgeleitet — funktioniert auf Localhost,
            Vercel-Previews und Production ohne Konfiguration.
          </>,
        ],
      },
      {
        kind: "geändert",
        items: [
          <>
            <strong>Segler-Stammdaten-Import unterstützt PostgreSQL-COPY-Format</strong>{" "}
            (Issue #23): Werte in Anführungszeichen und{" "}
            <code className="font-mono text-xs">\N</code> als NULL-Marker werden
            jetzt akzeptiert, neben dem klassischen unquotierten Format. 10 neue
            Unit-Tests decken beide Varianten ab.
          </>,
        ],
      },
    ],
  },
  {
    version: "2026.04.8",
    date: "2026-04-28",
    title: "Vercel-Cron-Hinweis + responsive Admin",
    changes: [
      {
        kind: "geändert",
        items: [
          <>
            <strong>Backup-Uhrzeit im Serverless-Modus</strong> (Issue #13): Auf
            Vercel ist die Uhrzeit-Auswahl jetzt nicht mehr editierbar. Stattdessen
            wird „02:00&nbsp;Uhr" fest angezeigt, zusammen mit dem Hinweis dass der
            Hobby-Cron einmal täglich um 01:00&nbsp;UTC läuft. Wochentag-Auswahl
            bleibt aktiv. Lokal weiter frei wählbar.
          </>,
          <>
            <strong>Admin-Header mit Mobile-Menü</strong> (Issue #21): unter
            768&nbsp;px klappt die Navigation in ein Hamburger-Menü, das vom
            Header-Rand einfährt.
          </>,
        ],
      },
      {
        kind: "korrigiert",
        items: [
          <>
            <strong>Alle Admin-Tabellen scrollen horizontal</strong> auf
            Smartphones (Segler-Liste, Regatten, Ranglisten, Wartung,
            Audit-Log) statt auszubrechen.
          </>,
          <>
            <strong>Formulare</strong> (Sailor + Regatta): Felder stapeln auf
            engen Viewports zu einer Spalte statt sich zu quetschen.
          </>,
          <>
            <strong>Admin-Dashboard-Hero</strong>: stapelt vertikal auf
            Mobilgeräten, Buttons brechen sauber um.
          </>,
        ],
      },
    ],
  },
  {
    version: "2026.04.7",
    date: "2026-04-28",
    title: "Bugfix Vercel-Build",
    changes: [
      {
        kind: "korrigiert",
        items: [
          <>
            <strong>Vercel-Build scheiterte am pdfjs-Worker-Typ</strong>:
            pdfjs-dist liefert kein{" "}
            <code className="font-mono text-xs">.d.ts</code> für den Worker mit,
            weshalb der dynamische Import im strikten TypeScript-Modus auf
            Vercel mit <em>Could not find a declaration file</em> abbrach. Neues
            Stub-File{" "}
            <code className="font-mono text-xs">types/pdfjs-dist.d.ts</code>{" "}
            deklariert das Modul mit{" "}
            <code className="font-mono text-xs">WorkerMessageHandler: unknown</code>{" "}
            (Issue #20).
          </>,
        ],
      },
    ],
  },
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
