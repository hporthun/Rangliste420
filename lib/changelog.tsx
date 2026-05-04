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
    version: "2026.05.40",
    date: "2026-05-04",
    title: "Glocke springt sofort an, sobald eine Push-Notification eingeht",
    changes: [
      {
        kind: "geändert",
        items: [
          <>
            Sobald eine Push-Notification beim Browser ankommt, schickt der
            Service Worker jetzt eine <code>postMessage</code>-Nachricht an
            alle offenen Tabs. Der <strong>Update-Indicator (Glocke)</strong>{" "}
            und der <strong>OS-AppBadge</strong> reagieren darauf und ziehen
            sofort den frischen Badge-State von <code>/api/badge</code> — ohne
            auf den 5-Minuten-Poll zu warten. So sieht man bei einem offenen
            Browser-Tab unmittelbar, dass es eine neue Rangliste oder ein
            App-Update gibt, auch wenn man die Notification gar nicht anklickt.
          </>,
        ],
      },
    ],
  },
  {
    version: "2026.05.39",
    date: "2026-05-04",
    title: "App-Update-Push nur an angemeldete Benutzer",
    changes: [
      {
        kind: "geändert",
        items: [
          <>
            <strong>App-Update-Notifications</strong> (Title{" "}
            <em>„App aktualisiert — Neue Version X ist aktiv"</em>) gehen
            ab sofort <em>nur noch</em> an Push-Subscriptions, die mit einer
            angemeldeten Sitzung verknüpft sind (Admins/Editors).
            Public-Visitors mit Push-Abo bekommen weiterhin{" "}
            <em>„Neue Rangliste verfügbar"</em>-Pushes — das ist Inhalt, der
            sie interessiert — aber kein Versions-Spam mehr, der sie auf den
            Admin-Changelog wirft.
          </>,
          <>
            Beim Aufruf der Einstellungs-Seite mit aktiver Sitzung wird die
            vorhandene Browser-Subscription nachträglich an den Benutzer
            gebunden, sodass auch <em>Bestands-Subscriptions</em> ohne
            erneutes Aktivieren wieder Update-Pushes erhalten.
          </>,
        ],
      },
      {
        kind: "neu",
        items: [
          <>
            Schema-Erweiterung: <code>PushSubscription.userId</code>{" "}
            (nullable, FK auf <code>User</code> mit{" "}
            <code>onDelete: SetNull</code>). Bestehende anonyme Subscriptions
            bleiben erhalten und werden korrekt als „nur Inhalt"-Empfänger
            behandelt. Dev-Migration{" "}
            <code>20260504200029_add_user_to_push_subscription</code>,
            Prod-Migration <code>10_push_subscription_user</code> (ALTER TABLE
            ADD COLUMN IF NOT EXISTS, kein Datenverlust).
          </>,
        ],
      },
    ],
  },
  {
    version: "2026.05.38",
    date: "2026-05-04",
    title: "Push-Banner aus dem Public-Bereich entfernt",
    changes: [
      {
        kind: "entfernt",
        items: [
          <>
            Der dezente <em>„Bei neuen Ranglisten benachrichtigt werden?
            [Aktivieren] [×]"</em>-Banner unter dem Header ist weg —
            Push-Aktivierung läuft jetzt vollständig über{" "}
            <strong>Einstellungen → Darstellung und Benachrichtigungen</strong>{" "}
            (das Zahnrad-Icon im Header). Das nimmt Druck aus der ersten
            Bildschirmzeile und macht den Aktivierungs-Schritt zu einer
            bewussten Aktion auf der Einstellungs-Seite, statt eines
            wegklickbaren Pop-ups.
          </>,
        ],
      },
    ],
  },
  {
    version: "2026.05.37",
    date: "2026-05-04",
    title: "Öffentliche Einstellungs-Seite mit Darstellung und Push",
    changes: [
      {
        kind: "neu",
        items: [
          <>
            Neue Seite <code>/einstellungen</code> im öffentlichen Bereich
            mit dem Abschnitt <strong>Darstellung und Benachrichtigungen</strong>:
            Theme-Picker (Hell / Dunkel / Auto) und ein dauerhafter{" "}
            <em>Aktivieren / Abbestellen</em>-Button für Push-Benachrichtigungen.
            So lässt sich Push auch nach Banner-Dismiss jederzeit wieder
            einschalten — und auf iPhone/iPad ohne PWA bekommst du einen klaren
            Hinweis, was zu tun ist.
          </>,
        ],
      },
      {
        kind: "geändert",
        items: [
          <>
            Im Public-Header wurde der dreistufige Theme-Cycle-Button durch
            ein dezentes <strong>Zahnrad-Icon</strong> ersetzt — Klick öffnet
            die Einstellungs-Seite, dort gibt es das volle Hell/Dunkel/Auto-
            Panel. Ein Klick weniger im Header, mehr Platz für den
            Update-Indicator.
          </>,
        ],
      },
    ],
  },
  {
    version: "2026.05.36",
    date: "2026-05-04",
    title: "Update-Indicator im Header + Push-Klick navigiert zum Ziel",
    changes: [
      {
        kind: "neu",
        items: [
          <>
            <strong>Update-Indicator im Header:</strong> Sobald es eine neue
            öffentliche Rangliste, eine neue Regatta oder ein App-Update gibt,
            erscheint im Kopf der App eine kleine{" "}
            <em>Glocke mit rotem Dot</em>. Klick führt direkt zum Ziel — bei
            einem einzigen unread-Eintrag öffnet sich sofort die Detailseite,
            bei mehreren ein kleines Popover mit Liste. Der „gesehen"-Status
            ist mit dem bestehenden App-Badge synchron.
          </>,
        ],
      },
      {
        kind: "geändert",
        items: [
          <>
            <strong>Push-Klick wiederverwendet bestehende Tabs:</strong> wer
            eine Push-Notification anklickt, während die App schon offen ist,
            landet jetzt im <em>vorhandenen</em> Tab auf der Ziel-Seite (neue
            Rangliste oder Changelog) — vorher öffnete sich ein zweiter Tab.
            Service-Worker-Handler probiert jetzt zuerst Focus + Navigate,
            fällt nur als letzter Schritt auf <code>openWindow</code> zurück.
          </>,
        ],
      },
    ],
  },
  {
    version: "2026.05.35",
    date: "2026-05-04",
    title: "Push-Aktivierung auf der Konto-Seite + Liste aktualisiert sich nach Duplizieren/Löschen",
    changes: [
      {
        kind: "neu",
        items: [
          <>
            Auf der <strong>Konto-Seite</strong> gibt es einen neuen Abschnitt{" "}
            <em>„Push-Benachrichtigungen"</em> — auch wer den Banner mit{" "}
            <em>„Nicht jetzt"</em> weggeklickt hat, kann von dort aus jederzeit
            wieder aktivieren oder abbestellen. Auf iPhone/iPad ohne installierte
            PWA erscheint statt der Schaltfläche eine Schritt-für-Schritt-
            Anleitung zum Hinzufügen zum Home-Bildschirm; bei blockierter
            Browser-Berechtigung ein Hinweis zum Zurücksetzen.
          </>,
        ],
      },
      {
        kind: "korrigiert",
        items: [
          <>
            <strong>Ranglisten-Liste aktualisiert sich nach Duplizieren oder
            Löschen sofort.</strong> Vorher behielt das Admin-Listing wegen
            cached Local-State den Stand vor der Änderung — man musste die Seite
            manuell neu laden. Jetzt synchronisiert die Sortable-Liste
            zuverlässig mit den Server-Daten nach jedem{" "}
            <code>router.refresh()</code>.
          </>,
        ],
      },
    ],
  },
  {
    version: "2026.05.34",
    date: "2026-05-04",
    title: "Logos auch offline verfügbar",
    changes: [
      {
        kind: "korrigiert",
        items: [
          <>
            Der Service-Worker-Cache hat das 420er-Logo bisher nicht erfasst,
            weil Next.js es über die Bild-Optimierungs-Pipeline (
            <code>/_next/image?url=…</code>) ausliefert und der SW-Filter nur
            Pfade mit den Endungen <code>.png</code>/<code>.svg</code>
            usw. erkannt hat. Im Offline-Modus wurde das Logo dadurch nicht
            angezeigt, obwohl die Seite selbst aus dem Cache kam. Jetzt
            erfasst der SW auch sämtliche <code>/_next/image</code>-Anfragen
            (Stale-While-Revalidate), sodass das Logo nach dem ersten Online-
            Aufruf einer beliebigen öffentlichen Seite dauerhaft offline
            verfügbar bleibt.
          </>,
        ],
      },
    ],
  },
  {
    version: "2026.05.33",
    date: "2026-05-04",
    title: "Rangliste duplizieren",
    changes: [
      {
        kind: "neu",
        items: [
          <>
            Im Admin-Listing der Ranglisten gibt es einen neuen{" "}
            <strong>Kopier-Button</strong> (zwischen Bearbeiten und Umbenennen).
            Klick erzeugt einen Klon der Rangliste mit Suffix{" "}
            <em>(Kopie)</em> direkt unter dem Original — alle Parameter (Typ,
            Saison, Altersklasse, Gender, Scoring-Unit) und die verknüpften
            Regatten werden 1:1 übernommen, der Klon ist immer ein{" "}
            <em>Entwurf</em> (nicht öffentlich). Praktisch, um z. B. die
            letztjährige Jahresrangliste als Vorlage für die neue Saison zu
            nutzen — danach nur noch Saison/Datum anpassen und neu berechnen.
          </>,
        ],
      },
    ],
  },
  {
    version: "2026.05.32",
    date: "2026-05-04",
    title: "Offline-Lesen für die öffentliche App",
    changes: [
      {
        kind: "neu",
        items: [
          <>
            <strong>Offline-Modus für Ranglisten und Regatten:</strong> Die
            öffentliche App funktioniert jetzt auch ohne Netz. Beim ersten
            Online-Besuch werden im Hintergrund alle veröffentlichten
            Ranglisten, Regatta-Detailseiten und alle Steuermann-
            Detailseiten aus diesen Ranglisten in den lokalen Cache
            geladen — danach sind sie auch ohne Verbindung erreichbar,
            ideal am Regatta-Ort mit schwachem LTE. Wer trotzdem auf
            eine bisher nicht erfasste Seite navigiert, sieht eine kurze
            Offline-Hinweisseite. Admin-Bereich, Auth und API werden
            bewusst <em>nicht</em> gecacht — dort braucht es stets Live-
            Daten und gültige Sessions.
          </>,
        ],
      },
    ],
  },
  {
    version: "2026.05.31",
    date: "2026-05-04",
    title: "Detail-Seite auch für Segler im 'Noch nicht in der Wertung'-Block",
    changes: [
      {
        kind: "neu",
        items: [
          <>
            Segler, die in der Hauptrangliste noch fehlen, weil sie unter der
            DSV-Mindestschwelle von 9 Wertungen liegen, sind jetzt auf der
            Ranglisten-Detailseite ebenfalls verlinkt. Klick auf den Namen
            (oder den <em>→</em>-Pfeil rechts in der Zeile) öffnet die gleiche
            Detail-Ansicht wie für gewertete Segler — mit allen bisherigen
            R_A-Werten, Crew-Historie und Regatta-Details. Statt Rang/R steht
            oben ein orangefarbenes Badge <em>„Noch nicht in der Wertung"</em>{" "}
            und im Kopf der Wertungs-Fortschritt (z. B. <code>5 / 9</code>),
            damit Trainer und Segler sehen, wie viele Wertungen noch fehlen.
          </>,
        ],
      },
    ],
  },
  {
    version: "2026.05.30",
    date: "2026-05-04",
    title: "Manuell vergebene Platzierungen werden nicht mehr überschrieben",
    changes: [
      {
        kind: "korrigiert",
        items: [
          <>
            Wenn der Admin auf der Regatta-Detailseite einen Eintrag <em>„Platzierung
            manuell"</em> setzt, blieb diese Platzierung bisher zwar beim Speichern
            erhalten — aber sobald ein <strong>anderer</strong> Eintrag derselben
            Regatta editiert wurde, lief das Auto-Reranking über alle Eintraege
            und überschrieb auch die manuell gesetzte Platzierung. Jetzt schützt ein
            neues Schema-Feld <code>Result.isRankManual</code> den Rang dauerhaft:
            beim Auto-Reranking werden manuell vergebene Slots übersprungen, die
            anderen Eintraege bekommen automatisch die freien Plätze.
          </>,
        ],
      },
      {
        kind: "geändert",
        items: [
          <>
            Im <em>„Eintrag bearbeiten"</em>-Dialog ist das Rang-Feld nur noch dann
            vorbelegt, wenn die Platzierung tatsächlich als <em>manuell</em> markiert
            ist. Bei automatisch berechneten Plaetzen bleibt das Feld leer
            (Placeholder „leer = automatisch") — so kippt ein einfaches Speichern
            ohne Aenderung den Rang nicht versehentlich auf <em>manuell</em>.
          </>,
        ],
      },
    ],
  },
  {
    version: "2026.05.29",
    date: "2026-05-04",
    title: "Saison-Anzeige korrigiert · iOS-Push-Hinweis im Handbuch",
    changes: [
      {
        kind: "korrigiert",
        items: [
          <>
            <strong>Saison-Anzeige im Detailheader:</strong> Bei JWM/JEM-Quali
            wurde fälschlich das Jahr der ersten ausgewählten Quali-Regatta als
            „Saison" angezeigt — bei einer Quali für 2026, deren erste Regatta
            im Dezember 2025 lag, stand also „Saison 2025" im Header. Jetzt wird
            das Jahr aus dem Stichtag (<code>seasonEnd</code>) abgeleitet, sodass
            die Quali für die Saison gezeigt wird, zu der sie fachlich gehört.
            Betrifft sowohl die DSV/IDJM-Detailseite als auch JWM/JEM-Quali.
          </>,
        ],
      },
      {
        kind: "geändert",
        items: [
          <>
            <strong>Handbuch um iOS-Push-Hinweis ergänzt:</strong> Im Kapitel{" "}
            <em>„Push-Benachrichtigungen"</em> stehen jetzt die iOS-spezifischen
            Voraussetzungen: Web-Push funktioniert auf iPhone/iPad nur, wenn
            die Webseite über <em>„Zum Home-Bildschirm hinzufügen"</em> als PWA
            installiert und aus diesem Icon heraus geöffnet wurde. Im normalen
            Safari-Tab ist <code>PushManager</code> nicht verfügbar — der
            Aktivierungs-Banner erscheint dann gar nicht erst. Schritt-für-Schritt-
            Anleitung im Handbuch.
          </>,
        ],
      },
    ],
  },
  {
    version: "2026.05.28",
    date: "2026-05-04",
    title: "Dark-Mode: Top-3-Platzierungen wieder lesbar",
    changes: [
      {
        kind: "korrigiert",
        items: [
          <>
            Im Dark-Mode war der hellgelbe / hellgraue / hellorange Reihen-
            Hintergrund der Top-3-Platzierungen mit weißer Schrift kaum
            lesbar — die Tailwind-Klassen <code>bg-yellow-50/60</code>{" "}
            <code>bg-slate-50/60</code> und <code>bg-orange-50/40</code>
            haben keinen automatischen Dark-Mode-Equivalent.
            Jetzt mit passenden <code>dark:</code>-Varianten
            (<code>yellow-900/30</code> / <code>slate-700/40</code> /{" "}
            <code>orange-900/25</code>), sodass die Zeilen auf dunklem Card-
            Hintergrund kontrastreich bleiben. Betrifft sowohl die
            DSV/IDJM-Tabelle als auch die JWM/JEM-Quali-Tabelle.
          </>,
        ],
      },
    ],
  },
  {
    version: "2026.05.27",
    date: "2026-05-04",
    title: "Handbuch aktualisiert · Entwurfs-Vorschau für Admin/Editor",
    changes: [
      {
        kind: "neu",
        items: [
          <>
            <strong>Entwurfs-Vorschau:</strong> Als angemeldeter Admin oder Editor kannst
            du Ranglisten-Entwürfe (nicht-öffentlich) jetzt direkt auf der öffentlichen
            Detailseite ansehen. Ein orangefarbenes Badge{" "}
            <em>„Entwurf — nicht öffentlich"</em> zeigt den Status. Anonyme Aufrufe
            bekommen die Seite weiterhin als 404 — der Entwurf bleibt also versteckt,
            bis er aktiv freigeschaltet wird. Auch in der Listenansicht{" "}
            <code>/rangliste</code> tauchen Entwürfe nur für angemeldete Benutzer auf.
          </>,
        ],
      },
      {
        kind: "geändert",
        items: [
          <>
            <strong>Handbuch generalüberholt:</strong> Altersklasse <code>U22</code> in
            allen Aufzählungen ergänzt, Gender-Bezeichnungen auf{" "}
            <em>Mädchen / Mix / Jungen</em> umgestellt, IDJM-Quali-Beschreibung
            korrigiert (Saisonstichtag statt Regatta-Startdatum als Alters-Referenz),
            Multiplikator-Tabelle um „6+ ohne Mehrtages-Ausschreibung" ergänzt,
            Tiebreak-Hinweis präzisiert, JWM/JEM-Algorithmus mit Re-Ranking,
            Gewichtungsformel und Schottenwechsel-Sonderregel ausführlich beschrieben,
            neues Kapitel <em>„Push-Benachrichtigungen"</em> mit allen ausgelieferten
            Ereignissen.
          </>,
        ],
      },
    ],
  },
  {
    version: "2026.05.26",
    date: "2026-05-04",
    title: "Rangliste: redundanten Gender-Filter-Eintrag entfernt",
    changes: [
      {
        kind: "geändert",
        items: [
          <>
            Im Gender-Filter der Ranglisten-Detailseiten wurde der
            Eintrag <em>„Alle Kategorien"</em> entfernt — fachlich
            identisch mit <strong>Open</strong> (die DSV-Filterregel
            für OPEN trifft auf jedes Boot zu). Das Dropdown zeigt jetzt
            nur noch die vier Kategorien <strong>Open / Mädchen / Mix /
            Jungen</strong>.
          </>,
        ],
      },
    ],
  },
  {
    version: "2026.05.25",
    date: "2026-05-04",
    title: "Rangliste: neue Reihenfolge im Gender-Filter",
    changes: [
      {
        kind: "geändert",
        items: [
          <>
            Im Gender-Filter der Ranglisten-Detailseiten ist die Reihenfolge
            jetzt <strong>Open / Mädchen / Mix / Jungen</strong> (vorher
            Open / Jungen / Mix / Mädchen). Werte und Filterlogik bleiben
            unverändert — nur die Anordnung im Dropdown ist neu.
          </>,
        ],
      },
    ],
  },
  {
    version: "2026.05.24",
    date: "2026-05-04",
    title: "Backups: chronologische Sortierung auf Vercel Blob",
    changes: [
      {
        kind: "korrigiert",
        items: [
          <>
            Die Liste der gespeicherten Backups war auf der Produktiv-Umgebung
            (Vercel Blob) nicht chronologisch sortiert, sondern alphabetisch
            nach Wochentag-Namen — Folge eines{" "}
            <code>Date.toString()</code>-Aufrufs, der „Sat May 04 …" liefert
            statt eines ISO-Strings. Lokal (Filesystem-Backend) war die
            Sortierung schon immer korrekt. Jetzt werden auch Blob-Backups
            wieder neueste-zuerst angezeigt.
          </>,
        ],
      },
    ],
  },
  {
    version: "2026.05.23",
    date: "2026-05-04",
    title: "Import: klare Fehlermeldung bei Bild-PDFs ohne Textebene",
    changes: [
      {
        kind: "geändert",
        items: [
          <>
            Beim PDF-Import wird jetzt erkannt, wenn die Datei keine Textebene
            hat (reine Bild-PDF, z. B. nach Scan oder Rasterisierung beim
            Druck). Statt der bisherigen generischen Meldung „Keine
            Ergebnisse im PDF gefunden" erscheint ein eindeutiger Hinweis:
            die PDF muss vorher per OCR (Adobe Acrobat:{" "}
            <em>„Scan & OCR" / „Texterkennung"</em>, oder Online-Tools wie{" "}
            <code>ilovepdf.com/ocr-pdf</code>) in eine durchsuchbare PDF
            umgewandelt und dann erneut importiert werden.
          </>,
        ],
      },
    ],
  },
  {
    version: "2026.05.22",
    date: "2026-05-03",
    title: "Rangliste: Excel-Export und Drucken/PDF für angemeldete Benutzer",
    changes: [
      {
        kind: "neu",
        items: [
          <>
            Auf der Ranglisten-Detailseite gibt es zwei neue Aktions-Buttons —
            sichtbar nur für <strong>angemeldete Benutzer</strong>.{" "}
            <strong>Excel-Export</strong> lädt eine <code>.xlsx</code> mit
            Hauptliste, „Noch nicht in der Wertung" und (bei JWM/JEM)
            Per-Regatta-Slots herunter; URL-Filter (Altersklasse, Gender)
            werden übernommen. <strong>Drucken / PDF</strong> öffnet den
            Browser-Druckdialog — das Print-CSS blendet Header-Banner,
            Filter, Suchfeld und Action-Buttons aus, sodass nur die Tabelle
            aufs Papier kommt.
          </>,
        ],
      },
    ],
  },
  {
    version: "2026.05.21",
    date: "2026-05-03",
    title: "Rangliste: „ohne Jahrgang“-Hinweis auch für Vorschoter",
    changes: [
      {
        kind: "neu",
        items: [
          <>
            Im Crew-Subtext der Ranglisten-Tabellen erscheint jetzt der gleiche{" "}
            <strong>„ohne Jahrgang"</strong>-Badge wie bei Steuerleuten, sobald
            das Geburtsjahr des Vorschoters in den Stammdaten fehlt. Das Flag
            wird auch für anonyme Aufrufe ausgeliefert (fachliche Info, kein PII).
          </>,
        ],
      },
    ],
  },
  {
    version: "2026.05.20",
    date: "2026-05-03",
    title: "Rangliste: Live-Suche über Steuermann, Crew und Verein",
    changes: [
      {
        kind: "neu",
        items: [
          <>
            Auf jeder Ranglisten-Detailseite (DSV, IDJM, JWM/JEM) gibt es ein{" "}
            <strong>Suchfeld</strong>, das beim Tippen Hauptliste, „Noch nicht
            in der Wertung" und JWM/JEM-Sektionen filtert. Match auf
            Helm-Name, Crew-Name(n) und Verein. Diakritika werden ignoriert
            (z. B. <code>muehlenberger</code> findet „Mühlenberger Segel-Club").
            Sektionen ohne Treffer werden komplett ausgeblendet.
          </>,
        ],
      },
    ],
  },
  {
    version: "2026.05.19",
    date: "2026-05-03",
    title: "Rangliste: Jahrgang auch für die Crews (Schotten)",
    changes: [
      {
        kind: "neu",
        items: [
          <>
            Die Jahrgangs-Anzeige für angemeldete Benutzer umfasst jetzt auch
            die <strong>Schotten/Vorschoter</strong> — im Crew-Subtext wird
            hinter jedem Namen <code>, Jg. 2008</code> ergänzt (sofern bekannt).
            Anonyme Aufrufe sehen die Jahrgänge weiterhin nicht.
          </>,
        ],
      },
    ],
  },
  {
    version: "2026.05.18",
    date: "2026-05-03",
    title: "Rangliste: Jahrgang neben dem Seglernamen für angemeldete Benutzer",
    changes: [
      {
        kind: "neu",
        items: [
          <>
            Auf den Ranglistenseiten (DSV-Haupttabelle, <em>„Noch nicht in der
            Wertung"</em>, JWM/JEM-Quali) erscheint hinter jedem Seglernamen
            jetzt der <strong>Jahrgang</strong> als kleiner Subtext (z. B.{" "}
            <code>Jg. 2009</code>) — allerdings nur für angemeldete Benutzer.
            Anonyme Aufrufe bekommen das Geburtsjahr nicht in den Stream.
          </>,
        ],
      },
    ],
  },
  {
    version: "2026.05.17",
    date: "2026-05-03",
    title: "Rangliste: Liste der Teams unter dem 9-Wertungs-Cutoff",
    changes: [
      {
        kind: "neu",
        items: [
          <>
            Auf jeder DSV-Ranglistenseite (Jahres, Aktuelle, IDJM-Quali) gibt es
            jetzt unter der Haupttabelle eine Sektion{" "}
            <strong>„Noch nicht in der Wertung"</strong>. Sie listet alle
            Steuerleute (bzw. Vorschoter im CREW-Modus), die bereits Wertungen
            gesammelt, aber noch keine 9 erreicht haben — mit Anzahl{" "}
            <code>X / 9</code>, Verein und Crew. Damit ist auf einen Blick zu
            sehen, wer noch eine Regatta bis zum Cutoff braucht.
          </>,
        ],
      },
    ],
  },
  {
    version: "2026.05.16",
    date: "2026-05-02",
    title: "Regattenliste-Import: URL bestehender Regatten wird nachgepflegt",
    changes: [
      {
        kind: "geändert",
        items: [
          <>
            Beim erneuten Einlesen der <strong>Manage2Sail-Regattenliste</strong>{" "}
            werden bereits vorhandene Regatten nicht mehr stumm übersprungen, wenn
            M2S inzwischen einen <strong>Ergebnis-Link</strong> liefert, der bei
            uns fehlt oder abweicht — die Link-URL wird dann am bestehenden
            Datensatz aktualisiert. Andere Felder (Faktor, Wettfahrten,
            Teilnehmerzahl, Ranglisten-Flag) bleiben unangetastet, weil sie
            manuell gepflegt sein könnten.
          </>,
          <>
            Die Erfolgsmeldung im Import-Wizard zeigt jetzt zusätzlich, wie viele
            URLs ergänzt/aktualisiert wurden.
          </>,
        ],
      },
    ],
  },
  {
    version: "2026.05.15",
    date: "2026-05-02",
    title: "IDJM-Rangliste: alle Jahrgänge zulässig (Issue #53)",
    changes: [
      {
        kind: "geändert",
        items: [
          <>
            Bei der <strong>IDJM-Quali-Rangliste</strong> sind jetzt alle
            Altersklassen wählbar — also auch <strong>OPEN</strong> und{" "}
            <strong>U22</strong>, nicht mehr nur U19/U17/U16/U15. Die übrigen
            IDJM-Eigenheiten (R ≥ 25, Saisonstichtag-Logik) bleiben unverändert.
          </>,
        ],
      },
      {
        kind: "korrigiert",
        items: [
          <>
            Auf der öffentlichen IDJM-Detailseite wurde der U22-Filter
            fälschlich versteckt, weil die Typ-Erkennung gegen den falschen
            Wert verglich. Filter funktioniert jetzt für alle Altersklassen.
          </>,
        ],
      },
    ],
  },
  {
    version: "2026.05.14",
    date: "2026-05-02",
    title: "Hinweis-Badge in Rang-/Quallisten für Segler ohne Geburtsjahr",
    changes: [
      {
        kind: "neu",
        items: [
          <>
            In allen Rang- und Qualifikationslisten erscheint neben dem
            Namen jetzt ein kleines <strong>„ohne Jahrgang"</strong>-Badge,
            sobald beim Segler kein Geburtsjahr in den Stammdaten gepflegt
            ist — als Hinweis, dass der Segler aus diesem Grund nicht in
            Altersklassen-Ranglisten erscheint.
          </>,
        ],
      },
    ],
  },
  {
    version: "2026.05.13",
    date: "2026-05-02",
    title: "Benutzerverwaltung mit Editor-Rolle (Issue #49)",
    changes: [
      {
        kind: "neu",
        items: [
          <>
            Unter <strong>Admin → Benutzer</strong> können Admins jetzt weitere
            Konten anlegen. Es gibt zwei Rollen: <strong>Admin</strong> (voller
            Zugriff inkl. Wartung und Benutzerverwaltung) und{" "}
            <strong>Editor</strong> (darf Segler, Regatten und Ranglisten
            pflegen, aber nicht Wartung oder Benutzerverwaltung sehen).
          </>,
          <>
            Pro Benutzer wird der letzte Login (Zeitpunkt + Methode:
            Passwort, Passkey, OAuth) aus dem bestehenden Sicherheitsprotokoll
            angezeigt — ein zusätzliches Feld am User wird dafür nicht benötigt.
          </>,
          <>
            Konten lassen sich <strong>sperren</strong> (manuell, dauerhaft —
            der Benutzer kann sich danach nicht mehr einloggen),{" "}
            <strong>rauswerfen</strong> (alle laufenden Sessions werden sofort
            beim nächsten Klick auf eine Admin-Seite ungültig) oder dauerhaft
            <strong> löschen</strong>. Selbstschutz: der eingeloggte Admin kann
            sich selbst nicht löschen, sperren oder zum Editor degradieren.
            Außerdem stellt das System sicher, dass mindestens ein aktiver Admin
            erhalten bleibt.
          </>,
          <>
            Der Admin kann zudem für jeden Benutzer ein neues Passwort setzen.
            Beim Reset werden alle laufenden Sessions des Benutzers
            invalidiert.
          </>,
        ],
      },
      {
        kind: "geändert",
        items: [
          <>
            Sicherheitsprotokoll-Aktionen <code>USER_CREATED</code>,{" "}
            <code>USER_UPDATED</code>, <code>USER_DELETED</code>,{" "}
            <code>USER_DISABLED</code>, <code>USER_ENABLED</code>,{" "}
            <code>USER_SESSIONS_REVOKED</code> und <code>USER_PASSWORD_RESET</code>{" "}
            werden für alle Benutzerverwaltungs-Aktionen geloggt.
          </>,
        ],
      },
    ],
  },
  {
    version: "2026.05.12",
    date: "2026-05-02",
    title: "Vorschoter-Rangliste: Detail-Ansicht zeigt jetzt den korrekten Eintrag",
    changes: [
      {
        kind: "korrigiert",
        items: [
          <>
            In <strong>Vorschoter-Ranglisten</strong> führte der Klick auf einen
            Vorschoter zur Fehlermeldung „Kein Ranglisten-Eintrag für diesen
            Segler". Ursache: die Detail-Seite kannte die Vorschoter-Wertung
            nicht und suchte stattdessen den Vorschoter in der Steuermann-Liste.
            Jetzt wird die Wertungs-Einheit (Steuermann/Vorschoter) korrekt aus
            dem Ranking übernommen.
          </>,
          <>
            In Vorschoter-Ranglisten heißt die Tabellen-Überschrift jetzt
            „Steuermann-Historie" statt „Crew-Historie".
          </>,
        ],
      },
    ],
  },
  {
    version: "2026.05.11",
    date: "2026-05-02",
    title: "Vollständigeres Backup — Admin-Accounts, Passkeys, SMTP, Audit-Log",
    changes: [
      {
        kind: "geändert",
        items: [
          <>
            <strong>Backup deckt jetzt alle Daten ab.</strong> Zusätzlich zu den
            Stammdaten (Segler, Regatten, Ergebnisse, Ranglisten) werden jetzt auch
            Admin-Accounts, Passkeys, SMTP-Einstellungen, Audit-Log und
            Push-Abonnements mit-gesichert und beim vollständigen Restore
            wiederhergestellt. Bislang fehlten diese Tabellen — ein Restore auf
            einem neuen Server hätte zu fehlenden Login-Daten geführt.
          </>,
        ],
      },
      {
        kind: "korrigiert",
        items: [
          <>
            Beim Restore gingen bislang stillschweigend einzelne Felder verloren:
            <code>Sailor.member420</code> (Pflicht für JWM/JEM-Quali),
            <code>Regatta.totalStarters</code> (DSV-Formel),
            <code>Ranking.sortOrder</code> und <code>Ranking.scoringUnit</code>.
            Diese Felder sind im Backup-File enthalten und werden jetzt auch
            zurückgespielt.
          </>,
        ],
      },
    ],
  },
  {
    version: "2026.05.10",
    date: "2026-05-02",
    title: "Einheitliches Logo im öffentlichen Bereich",
    changes: [
      {
        kind: "korrigiert",
        items: [
          <>
            Im öffentlichen Bereich (Regatten, Ranglisten) wird jetzt dasselbe
            Logo verwendet wie auf der Startseite — vorher zeigte der Header
            dort eine ältere Variante.
          </>,
        ],
      },
    ],
  },
  {
    version: "2026.05.9",
    date: "2026-05-02",
    title: "JWM/JEM-Quali: Teams mit ungenehmigtem Schottenwechsel werden unten ausgewiesen",
    changes: [
      {
        kind: "neu",
        items: [
          <>
            In der JWM/JEM-Qualifikationsrangliste erscheinen Teams, die nur durch
            einen <strong>ungenehmigten Schottenwechsel</strong> entstanden sind und
            deshalb kein gewertetes Ergebnis haben, jetzt unten in einer eigenen
            Sektion „Nicht gewertet — ungenehmigter Schottenwechsel". So ist
            nachvollziehbar, welche Helm/Crew-Kombination den Wechsel vorgenommen hat,
            statt dass diese Zeilen still verschwinden. DSV-Rangliste und
            IDJM-Quali sind nicht betroffen — sie ignorieren die Schottenwechsel-Logik
            ohnehin.
          </>,
        ],
      },
    ],
  },
  {
    version: "2026.05.8",
    date: "2026-05-01",
    title: "Altersklassen- und Gender-Filter in öffentlicher Rangliste",
    changes: [
      {
        kind: "neu",
        items: [
          <>
            Auf jeder öffentlichen Ranglistenseite gibt es jetzt eine Filterleiste für
            Altersklasse (U15–U22) und Geschlechtskategorie (Offen/Männer/Mix/Girls).
            Damit lässt sich z. B. eine OPEN/OPEN-Rangliste direkt auf U17/Mix einschränken,
            ohne eine separate Rangliste anlegen zu müssen. Der Filter wirkt über URL-Parameter
            und ist direkt verlinkbar.
          </>,
        ],
      },
    ],
  },
  {
    version: "2026.05.7",
    date: "2026-05-01",
    title: "Footer: Impressum, Datenschutz und Powered-by-Link",
    changes: [
      {
        kind: "neu",
        items: [
          <>
            Der Footer der öffentlichen Seite enthält jetzt Links zu Impressum und
            Datenschutz (pt-systemhaus.de) sowie den Hinweis „Powered by Porthun &amp;
            Thiede Systemhaus".
          </>,
        ],
      },
    ],
  },
  {
    version: "2026.05.6",
    date: "2026-05-01",
    title: "IDJM-Quali: U17 und U15 freigeschaltet",
    changes: [
      {
        kind: "korrigiert",
        items: [
          <>
            Die IDJM-Qualifikationsrangliste ließ bisher nur U19 und U16 zu — obwohl
            das Vorschau-Formular bereits U17 und U15 anbot. Die Runtime-Validierung
            wurde entsprechend erweitert.
          </>,
        ],
      },
    ],
  },
  {
    version: "2026.05.5",
    date: "2026-05-01",
    title: "JWM/JEM-Quali: Regatten-Spalten chronologisch sortiert",
    changes: [
      {
        kind: "korrigiert",
        items: [
          <>
            Die Spaltenreihenfolge in der JWM/JEM-Qualifikationsrangliste folgt jetzt
            dem Startdatum der Regatten (aufsteigend), unabhängig davon, in welcher
            Reihenfolge sie im Formular ausgewählt wurden.
          </>,
        ],
      },
    ],
  },
  {
    version: "2026.05.4",
    date: "2026-05-01",
    title: "JWM/JEM-Quali: Teilnehmerzahl in Spaltenköpfen",
    changes: [
      {
        kind: "neu",
        items: [
          <>
            Jeder Regatta-Spaltenkopf in der JWM/JEM-Qualifikationsrangliste zeigt jetzt
            die Anzahl gewerteter Starter (z. B. „12 TN"), damit der Gewichtungsfaktor
            (Rang × max. Starter / Starter) direkt nachvollziehbar ist.
          </>,
        ],
      },
    ],
  },
  {
    version: "2026.05.3",
    date: "2026-05-01",
    title: "JWM/JEM-Quali: Wechsel-Regatta bei ungenehmigtem Schottenwechsel ausgeschlossen",
    changes: [
      {
        kind: "korrigiert",
        items: [
          <>
            Teams mit einem nicht genehmigten Schottenwechsel werden jetzt bei der
            Regatta, an der der Wechsel stattfand, weder mit ihrer Platzierung noch
            in der Teilnehmerzahl berücksichtigt. Der erste Eintrag des neuen Teams
            zählt somit nicht als gültige Wertung; Folge-Einträge mit derselben Crew
            werden weiterhin normal gewertet.
          </>,
        ],
      },
    ],
  },
  {
    version: "2026.05.2",
    date: "2026-05-01",
    title: "JWM/JEM-Quali: PDF-Import ohne Crew-Daten kein Teamwechsel",
    changes: [
      {
        kind: "korrigiert",
        items: [
          <>
            Teams, deren erster Regatta-Eintrag aus einem PDF-Import stammt (Crew
            unbekannt), wurden beim nächsten Eintrag mit bekannter Crew fälschlicherweise
            als neues Team gewertet. Dadurch erschienen beide Teil-Teams als
            „Zwischenergebnis (unvollständig)" statt als ein vollständiges Team in der
            Qualifikationsrangliste. Die Null-Crew gilt jetzt als „unbekannte Besatzung"
            und führt nicht mehr zu einem Split.
          </>,
        ],
      },
    ],
  },
  {
    version: "2026.05.1",
    date: "2026-05-01",
    title: "Vorschoter-Ranglisten (Issue #47)",
    changes: [
      {
        kind: "neu",
        items: [
          <>
            Alle DSV-Ranglisten (Jahresrangliste, Aktuelle, IDJM-Quali) können jetzt
            wahlweise nach Vorschoter statt nach Steuermann berechnet werden.
            Im Vorschau-Formular gibt es dafür einen neuen "Einheit"-Selektor
            (Steuermann / Vorschoter), der beim Speichern mit der Rangliste
            gespeichert wird.
          </>,
        ],
      },
    ],
  },
  {
    version: "2026.04.43",
    date: "2026-04-30",
    title: "Ranglistenreihenfolge per Drag & Drop",
    changes: [
      {
        kind: "neu",
        items: [
          <>
            Im Adminbereich können Ranglisten per Drag & Drop umsortiert werden.
            Die Reihenfolge wird sofort gespeichert und gilt auch für die
            öffentliche Ranglisten-Übersicht.
          </>,
        ],
      },
    ],
  },
  {
    version: "2026.04.42",
    date: "2026-04-30",
    title: "JWM/JEM-Quali: Typ-Auswahl entfernt",
    changes: [
      {
        kind: "geändert",
        items: [
          <>JWM und JEM teilen eine gemeinsame Qualifikationsrangliste. Der Typ-Selektor im Formular entfällt.</>,
        ],
      },
    ],
  },
  {
    version: "2026.04.41",
    date: "2026-04-30",
    title: "Mitglied 420er-Klassenvereinigung",
    changes: [
      {
        kind: "neu",
        items: [
          <>
            Segler haben jetzt ein Flag „Mitglied 420er-Klassenvereinigung"
            (Standard: aktiviert). Nur Mitglieder werden in der
            JWM/JEM-Qualifikationsberechnung berücksichtigt.
          </>,
        ],
      },
    ],
  },
  {
    version: "2026.04.40",
    date: "2026-04-30",
    title: "IDJM: Altersfilter nach Saisonstichtag",
    changes: [
      {
        kind: "geändert",
        items: [
          <>
            IDJM-Qualifikation prüft Altersklassen jetzt gegen den
            Saisonstichtag (ganzes Saisonjahr), identisch zu
            Jahresrangliste und JWM/JEM-Quali.
          </>,
        ],
      },
    ],
  },
  {
    version: "2026.04.39",
    date: "2026-04-30",
    title: "JWM/JEM-Quali: Altersfilter nach Stichtag",
    changes: [
      {
        kind: "geändert",
        items: [
          <>
            Die Altersklassenprüfung bei der JWM/JEM-Qualifikationsberechnung
            basiert jetzt auf dem Saisonstichtag, nicht mehr auf dem
            Startdatum der einzelnen Regatta.
          </>,
        ],
      },
    ],
  },
  {
    version: "2026.04.38",
    date: "2026-04-30",
    title: "Altersklasse U22 für JWM/JEM-Quali",
    changes: [
      {
        kind: "neu",
        items: [
          <>Altersklasse U22 (max. 21 Jahre) steht jetzt in der JWM/JEM-Qualifikationsberechnung zur Verfügung.</>,
        ],
      },
    ],
  },
  {
    version: "2026.04.37",
    date: "2026-04-30",
    title: "JWM/JEM-Quali: Neu-Platzierung nur unter Deutschen",
    changes: [
      {
        kind: "geändert",
        items: [
          <>
            Bei der JWM/JEM-Qualifikationsberechnung werden Platzierungen und
            Starterzahlen jetzt rein unter deutschen Seglern neu ermittelt.
            Der gewichtete Score basiert damit auf dem deutschen Rang (nicht
            dem Gesamtrang), und <code>maxStarters</code> entspricht der
            höchsten deutschen Starterzahl über alle ausgewählten Regatten.
          </>,
        ],
      },
    ],
  },
  {
    version: "2026.04.36",
    date: "2026-04-30",
    title: "JWM/JEM-Quali bearbeiten",
    changes: [
      {
        kind: "neu",
        items: [
          <>
            Gespeicherte JWM- und JEM-Qualifikationsranglisten können jetzt
            über das ⚙️-Icon in der Ranglisten-Übersicht bearbeitet werden.
            Alle Parameter (Typ, Altersklasse, Gender, Stichtag, Regatten-
            auswahl, Name) werden vorausgefüllt; beim Speichern wird die
            bestehende Rangliste überschrieben statt neu angelegt.
          </>,
        ],
      },
    ],
  },
  {
    version: "2026.04.35",
    date: "2026-04-30",
    title: "CSV-Stammdatenimport",
    changes: [
      {
        kind: "neu",
        items: [
          <>
            Neues CSV-Importformat auf der Stammdaten-Import-Seite:
            Datei <code>Seglerdaten_JJJJ.csv</code> hochladen
            (Spalten Name · Vorname · Geburtsjahr). Bekannte Segler werden
            per Fuzzy-Matching zugeordnet; neue Segler können in einem
            Schritt direkt angelegt werden. Konflikte (unterschiedliches
            Geburtsjahr) werden farblich hervorgehoben.
          </>,
        ],
      },
    ],
  },
  {
    version: "2026.04.34",
    date: "2026-04-30",
    title: "Ergebnisliste: Einträge manuell hinzufügen",
    changes: [
      {
        kind: "neu",
        items: [
          <>
            Auf der Regatta-Detailseite gibt es jetzt den Button
            „Eintrag hinzufügen". Er öffnet ein Modal zur Auswahl
            von Steuermann und optionalem Vorschoter (Freitextsuche
            über alle Segler), Segelnummer, Startgebiet-Flag sowie
            allen Einzelwertungen. Nettopunkte und Platzierungen
            werden sofort neu berechnet.
          </>,
        ],
      },
    ],
  },
  {
    version: "2026.04.33",
    date: "2026-04-30",
    title: "Sailwave 2.38+ PDF-Format unterstützt",
    changes: [
      {
        kind: "neu",
        items: [
          <>
            Neuer Parser für Sailwave-PDFs im „Crewman 1 Name"-Format
            (z. B. JK Burja Spring Cup). Platzierung als „1st/2nd/…",
            eigene Nationality-Spalte, Integer-Punkte, Total/Nett.
            Auto-Detection erkennt das Format automatisch.
          </>,
          <>
            Penalty-Code <code>DNE</code> (Disqualification not
            excludable, Regel 88.3(b)) wird jetzt korrekt als
            nicht-streichbarer Strafpunktecode geparst.
          </>,
        ],
      },
    ],
  },
  {
    version: "2026.04.32",
    date: "2026-04-30",
    title: "Ergebnislisten manuell bearbeitbar",
    changes: [
      {
        kind: "neu",
        items: [
          <>
            Jeder Eintrag in der Regatta-Detailseite hat jetzt ein
            Stift-Icon. Das Modal erlaubt es, Segelnummer, Startgebiet-
            Flag (SG) sowie alle Einzelwertungen (Punkte, Code wie DNC /
            DNS / BFD / …, Streichungs-Flag) nachträglich zu korrigieren.
            Nettopunkte und Platzierungen der gesamten Regatta werden
            automatisch neu berechnet.
          </>,
          <>
            Mülleimer-Icon löscht einen Eintrag nach Bestätigung;
            die Platzierungen der verbleibenden Einträge werden neu vergeben.
          </>,
        ],
      },
    ],
  },
  {
    version: "2026.04.31",
    date: "2026-04-30",
    title: "Velaware-PDF: Nationen werden geparst",
    changes: [
      {
        kind: "korrigiert",
        items: [
          <>
            Beim Import von Velaware-Ergebnislisten (Italien, z. B.
            Imperia Winter Regatta) wurden die Nationenkürzel bisher
            verloren — die Spalte „Numero velico" enthält visuell zwei
            Sub-Zellen, lag aber unter einer einzelnen Headerschrift.
            Jetzt landet der NAT-Code („ESP", „ITA", …) korrekt in der
            Segelnummer und im neuen <code>nationality</code>-Feld.
          </>,
          <>
            Der Filter „nur deutsche Crews" beim PDF-Import nutzt jetzt
            die geparste Nationalität und entfernt ausländische Crews
            zuverlässig.
          </>,
        ],
      },
    ],
  },
  {
    version: "2026.04.30",
    date: "2026-04-30",
    title: "Suchfelder ignorieren Groß-/Kleinschreibung",
    changes: [
      {
        kind: "korrigiert",
        items: [
          <>
            Die Suchfelder auf der Segler- und Regatten-Liste finden
            jetzt Treffer unabhängig von Groß-/Kleinschreibung. Vorher
            war die Suche auf der Produktiv-Datenbank streng case-
            sensitiv. (Issue #38)
          </>,
        ],
      },
    ],
  },
  {
    version: "2026.04.29",
    date: "2026-04-30",
    title: "Inoffizielle Ranglisten auf der öffentlichen Seite",
    changes: [
      {
        kind: "geändert",
        items: [
          <>
            Hero-Texte auf Start- und Ranglisten-Seite sprechen jetzt
            von <em>Inoffizielle Ranglisten</em> / <em>Inoffizielle
            DSV-Jahresrangliste</em>. Die hier berechneten Ranglisten
            sind eine Service-Anwendung der Klassenvereinigung — die
            offiziellen DSV-Ranglisten bleiben bei den entsprechenden
            Stellen. (Issue #37)
          </>,
        ],
      },
    ],
  },
  {
    version: "2026.04.28",
    date: "2026-04-30",
    title: "Push-Benachrichtigungen",
    changes: [
      {
        kind: "neu",
        items: [
          <>
            <strong>Web-Push für neue Inhalte</strong>: Public-Visitors
            können sich per Banner („Aktivieren") für Notifications
            anmelden und bekommen eine Nachricht plus App-Plakette, sobald
            eine neue Rangliste veröffentlicht, eine neue
            Ranglistenregatta angelegt oder die App auf eine neue Version
            aktualisiert wird. Anonym, ohne Account. (Issue #36)
          </>,
          <>
            <strong>VAPID-Setup</strong>: Schlüssel einmalig per{" "}
            <code>node scripts/generate-vapid.mjs</code> erzeugen und als{" "}
            <code>VAPID_*</code>-Variablen in <code>.env</code> bzw.
            Vercel-Env hinterlegen. Ohne diese Variablen bleibt Push
            deaktiviert — Banner erscheint nicht.
          </>,
        ],
      },
    ],
  },
  {
    version: "2026.04.27",
    date: "2026-04-30",
    title: "Code-Dokumentation ausgebaut",
    changes: [
      {
        kind: "neu",
        items: [
          <>
            <strong>docs/architecture.md</strong>: File-Map des gesamten
            Projekts, Schichten-Architektur, Datenfluss-Diagramme für
            Import-Wizard und Ranglisten-Berechnung, Server-Action-Konvention,
            globale Invarianten.
          </>,
          <>
            <strong>JSDoc-Header für alle 12 Server-Action-Dateien</strong>{" "}
            in <code className="font-mono text-xs">lib/actions/</code> —
            beschreiben pro Datei was lebt hier, welche Tabellen geschrieben
            werden, Auth-Anforderungen, Invarianten.
          </>,
          <>
            <strong>ESLint ignoriert .claude/</strong>: Claude-Worktrees
            produzierten 20k+ false-positive-Warnings aus eigenen
            <code className="ml-1 font-mono text-xs">.next/</code>-Build-
            Artefakten.
          </>,
        ],
      },
    ],
  },
  {
    version: "2026.04.26",
    date: "2026-04-30",
    title: "App-Symbol-Plakette",
    changes: [
      {
        kind: "neu",
        items: [
          <>
            <strong>App-Badge</strong>: Das installierte PWA-Symbol bekommt
            eine kleine Zahl, sobald seit dem letzten Besuch ein neuer
            Changelog-Eintrag, eine neue Ranglistenregatta oder eine neue
            veröffentlichte Rangliste vorliegt. Markieren als gesehen
            passiert automatisch beim Öffnen der jeweiligen Liste.
            (Issue #35)
          </>,
        ],
      },
    ],
  },
  {
    version: "2026.04.25",
    date: "2026-04-30",
    title: "Codebase-Aufräumarbeiten",
    changes: [
      {
        kind: "neu",
        items: [
          <>
            <strong>docs/business-rules.md</strong>: Single source of truth für
            alle Geschäftsregeln (DSV-Formel, Filter-Verhalten,
            Schottenwechsel, Import-Flow, häufige Fehlerquellen).
          </>,
          <>
            <strong>calculateRAForResult-Helper</strong>: zentrale
            inStartArea-Logik, sodass Scoring-Engine und Regatta-Detail-
            Anzeige nicht mehr auseinanderdriften können (verhindert
            Wiederholung des s-Bugs vom 30.04.).
          </>,
          <>
            <strong>Schema-Sync-Lint</strong>: erkennt JSDoc-Kommentare in
            Prisma-Model-Bodies und blockt den Sync mit klarer
            Fehlermeldung.
          </>,
        ],
      },
    ],
  },
  {
    version: "2026.04.24",
    date: "2026-04-30",
    title: "Auto-Fetch Gesamtzahl von M2S",
    changes: [
      {
        kind: "neu",
        items: [
          <>
            <strong>„Aus Manage2Sail abrufen"-Button</strong> im
            Preview-Schritt des Import-Wizards. Wenn der Paste/PDF nur
            einen Teil der Crews enthält (z.B. nur die deutschen einer
            Auslandsregatta), holt der Button die echte Gesamtzahl direkt
            aus der M2S-API — und zwar <em>vor</em> dem germanOnly-Filter.
            URL-Feld wird mit der{" "}
            <code className="font-mono text-xs">sourceUrl</code> der
            Regatta vorbelegt, sofern bekannt.
          </>,
        ],
      },
    ],
  },
  {
    version: "2026.04.23",
    date: "2026-04-30",
    title: "Gesamtteilnehmerzahl im Import-Wizard",
    changes: [
      {
        kind: "neu",
        items: [
          <>
            <strong>Gesamtteilnehmerzahl im Import-Wizard editierbar</strong>:
            Im Preview-Schritt erscheint jetzt ein klar markiertes Feld für die
            Gesamtteilnehmerzahl der Regatta. Vorbelegt mit dem vom Parser
            ermittelten Wert (M2S API zählt VOR dem germanOnly-Filter,
            Paste/PDF zählen ihre eigenen Einträge). Bei Auslandsregatten,
            deren Paste nur die deutschen Crews enthält, kann der echte Wert
            (z.B. 126) hier vor dem Commit eingetragen werden und wird mit
            dem Import auf die Regatta geschrieben. Re-Imports überschreiben
            einen bereits gepflegten Wert nicht mehr stillschweigend.
          </>,
        ],
      },
    ],
  },
  {
    version: "2026.04.22",
    date: "2026-04-30",
    title: "Bugfix Regatta-Detail s-Wert",
    changes: [
      {
        kind: "korrigiert",
        items: [
          <>
            <strong>Öffentliche Regatta-Detail-Seite ignorierte totalStarters</strong>:
            Die R_A-Anzeige auf{" "}
            <code className="font-mono text-xs">/regatta/[id]</code> hat
            unabhängig von der Scoring-Engine{" "}
            <code className="font-mono text-xs">s = results.length</code>{" "}
            hartcodiert. Bei Auslandsregatten wie Carnival 2026 (126 Teilnehmer,
            12 importierte Deutsche) führte das zu negativen R_A-Werten
            (z.B. −450 für Platz 58 von 12 angeblichen Booten). Jetzt wird
            <code className="ml-1 font-mono text-xs">totalStarters ?? results.length</code>{" "}
            verwendet, konsistent zur Rangliste.
          </>,
        ],
      },
    ],
  },
  {
    version: "2026.04.21",
    date: "2026-04-30",
    title: "s-Wert in Vorschau sichtbar",
    changes: [
      {
        kind: "neu",
        items: [
          <>
            <strong>Effektive Teilnehmerzahl pro Regatta sichtbar</strong>:
            In der „Einbezogene Regatten"-Aufklappliste der Vorschau wird
            jetzt der tatsächlich verwendete{" "}
            <code className="font-mono text-xs">s</code>-Wert angezeigt
            (Gesamtteilnehmerzahl). Mit <span className="text-amber-700">*</span>{" "}
            markiert wenn aus dem manuellen{" "}
            <code className="font-mono text-xs">totalStarters</code>{" "}
            der Regatta — sonst aus der Anzahl importierter Ergebnisse.
            So lässt sich verifizieren, dass die Auslandsregatta-Korrektur
            wirklich in die R_A-Berechnung einfließt.
          </>,
        ],
      },
    ],
  },
  {
    version: "2026.04.20",
    date: "2026-04-29",
    title: "totalStarters pro Regatta",
    changes: [
      {
        kind: "neu",
        items: [
          <>
            <strong>Gesamtteilnehmerzahl pro Regatta gespeichert</strong>:
            Neues Feld <code className="font-mono text-xs">totalStarters</code>{" "}
            an der Regatta zählt alle gestarteten Boote — auch ausländische,
            die beim M2S-Import (Default <code className="font-mono text-xs">germanOnly</code>)
            nicht in die Sailor-Datenbank wandern. Der Wert kommt automatisch
            beim Import von Paste, PDF und M2S-API; kann im Regatta-Formular
            manuell überschrieben werden.
          </>,
          <>
            <strong>DSV-Scoring nutzt totalStarters</strong>: <code className="font-mono text-xs">s</code>{" "}
            in der R_A-Formel verwendet jetzt
            <code className="ml-1 font-mono text-xs">totalStarters ?? results.length</code>{" "}
            — Auslandsregatten werden damit korrekt mit voller Teilnehmerzahl
            bewertet, ohne dass alle ausländischen Crews als Sailor-Records
            angelegt werden müssen.
          </>,
        ],
      },
    ],
  },
  {
    version: "2026.04.19",
    date: "2026-04-29",
    title: "Beta-Hinweis Public-Seiten",
    changes: [
      {
        kind: "neu",
        items: [
          <>
            <strong>Beta-Hinweis</strong> auf allen öffentlichen Seiten
            (Issue #34): Klar sichtbarer amber-farbener Banner unter dem
            Header informiert die Besucher, dass die App noch in der
            Entwicklung ist und Ranglisten fehlerhaft oder unvollständig
            sein können. Admin-Bereich bleibt unverändert.
          </>,
        ],
      },
    ],
  },
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
