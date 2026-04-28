# Changelog

Alle nennenswerten Änderungen an der 420er-Ranglistenverwaltung.

Format orientiert sich an [Keep a Changelog](https://keepachangelog.com/de/1.1.0/).
Versionierung folgt [Calendar Versioning](https://calver.org/) im Format **JJJJ.MM.N**
(Jahr.Monat.laufende Nummer im Monat) ab Version 2026.04.1.

---

## [2026.04.12] — 2026-04-29

**Passwort-Reset per E-Mail + PWA-Logo (Issues #29, #30).**

### Korrigiert

- **Passwort-Reset per E-Mail funktioniert jetzt** (Issue #29):
  vorher wurde der Reset-Link direkt im Browser angezeigt — gravierende
  Sicherheitslücke, da jeder Reset-Links für fremde Accounts erzeugen
  konnte. Jetzt wird der Link ausschließlich per E-Mail an die im
  Account hinterlegte Adresse versendet. Konfiguration über SMTP-
  Env-Vars (`SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`); ohne
  Konfiguration warnt das UI klar und der Link wird nur in den
  Server-Logs ausgegeben (Dev-Modus).

### Neu

- **PWA-Manifest mit 420er-Logo** (Issue #30): neues
  `app/manifest.ts` referenziert das tatsächliche Klassenlogo als
  Web-App-Icon. „Zum Home-Bildschirm hinzufügen" auf iOS/Android
  installiert die App jetzt mit dem 420er-Logo und maritime-blauem
  Theme. Zusätzlich `app/apple-icon.png` (Kopie des Logos),
  `appleWebApp`-Metadata und `themeColor`-Viewport in `layout.tsx`.

---

## [2026.04.11] — 2026-04-28

**Ranglisten editierbar + Saison-Dropdown + IDJM speicherbar (Issues #26, #27, #28).**

### Neu

- **Saison-Auswahl** in der Ranglisten-Vorschau (Issue #27): explizites
  Jahr-Dropdown, das Von/Bis automatisch auf die Standardgrenzen setzt
  (01.01. – 30.11. für Jahresrangliste/IDJM, 01.01. – heute für Aktuelle
  Rangliste). Datumsfelder bleiben als optionale Override-Felder
  bestehen für Sonderfälle.
- **Rangliste bearbeiten** (Issue #26): jede gespeicherte Rangliste
  bekommt in der Tabelle ein neues ⚙-Icon. Klick → Vorschau lädt mit
  den Originalparametern; Änderungen können direkt in den bestehenden
  Datensatz übernommen werden (`updateRanklisteAction` ersetzt das
  Regatten-Set in einer Transaktion). Veröffentlichungs-Status bleibt
  erhalten.
- **IDJM-Quali speicherbar** (Issue #28):
  `saveJahresranklisteAction` heißt jetzt `saveRanklisteAction` (Alias
  bleibt) und unterstützt `type: "JAHRESRANGLISTE"` *oder*
  `type: "IDJM"`. Aktuelle Rangliste wird weiterhin nicht persistiert.
  Schema-Kommentar, Type-Labels (admin + public) und Badge-Farben
  ergänzt.

---

## [2026.04.10] — 2026-04-28

**Auto-420er + OAuth-Anmeldung (Issues #24, #25).**

### Neu

- **OAuth-Anmeldung über Google, Microsoft, Apple und Meta** (Issue #25):
  Auf der Login-Seite erscheinen Buttons für jeden Provider, dessen
  Client-ID + Secret als Env-Variablen gesetzt sind. Sicherheit: der Login
  klappt nur, wenn die vom Provider gelieferte E-Mail einer existierenden
  Admin-E-Mail entspricht — kein Self-Sign-up. Audit-Log unterscheidet
  `LOGIN_OAUTH` (erfolgreich) und `LOGIN_OAUTH_REJECTED` (E-Mail unbekannt).
  Konfiguration in `.env.example` dokumentiert.

### Geändert

- **M2S-Klassenauswahl** (Issue #24): Wenn unter mehreren Klassen einer
  Veranstaltung exakt eine den String „420" enthält („420", „420er",
  „420 er" usw.), wird sie jetzt automatisch ausgewählt und die
  Ergebnisse werden direkt geladen. Bei mehreren 420-Klassen oder
  keiner 420-Klasse zeigt das Dropdown einen ⚓-Hinweis bei
  passenden Einträgen.

---

## [2026.04.9] — 2026-04-28

**Passkeys auf Vercel + Postgres-COPY-Stammdaten-Import (Issues #22, #23).**

### Korrigiert

- **Passkey-Erstellung auf Vercel** (Issue #22): Die WebAuthn Relying-Party-ID
  war hardcoded auf `localhost`, weshalb `navigator.credentials.create`
  unter dem Vercel-Hostnamen mit „The RP ID 'localhost' is invalid" abbrach.
  RP-ID und Origin werden jetzt pro Request aus den `host`- und
  `x-forwarded-proto`-Headern abgeleitet — funktioniert auf Localhost,
  Vercel-Previews und der Production-Domain ohne separate Env-Variablen.
  Optional bleiben `WEBAUTHN_RP_ID`/`WEBAUTHN_ORIGIN` als Override.

### Geändert

- **Segler-Stammdaten-Import** (Issue #23): Neben dem alten Tab-Format
  wird jetzt auch das PostgreSQL-COPY-Format akzeptiert — Werte in
  Anführungszeichen, `\N` als NULL-Marker. Beispiel:
  `"744"\t"Akerson besier"\t"Johanna"\t\N\t"female"`.
  10 Unit-Tests decken legacy- und Postgres-Format ab.

---

## [2026.04.8] — 2026-04-28

**Vercel-Cron-Hinweis + responsive Admin-Bereich (Issues #13, #21).**

### Geändert

- **Backup-Uhrzeit im Serverless-Modus** (Issue #13): Auf Vercel ist das
  Uhrzeit-Feld jetzt nicht mehr editierbar. Stattdessen wird „02:00 Uhr"
  fest angezeigt, mit klarem Hinweis dass der Hobby-Cron einmal täglich
  um 01:00 UTC (≈ 02:00 MEZ) läuft. Wochentag-Auswahl bleibt aktiv. Lokal
  (FS-Storage) ist die Uhrzeit weiter frei wählbar.
- **Admin-Header mit Mobile-Menü** (Issue #21): unter `md` (768 px)
  klappt der Nav in ein Hamburger-Menü, das von oben einfährt. Logo,
  Tour-Button und User-Menü bleiben sichtbar.

### Korrigiert

- **Alle Admin-Tabellen** (Issue #21): Tabellen mit `overflow-hidden`
  haben jetzt `overflow-x-auto` mit Mindestbreite — verhindert
  Layout-Brüche auf Smartphones (Segler-Liste, Regatta-Liste,
  Ranglisten, Wartung-Backups, Audit-Log u.a.).
- **Formular-Layouts** (Issue #21): Sailor- und Regatta-Form gehen auf
  Mobil von `grid-cols-2` (bzw. `grid-cols-3`) auf eine Spalte zurück.
- **Admin-Dashboard-Hero**: stapelt vertikal auf engen Viewports,
  Buttons brechen sauber um.

---

## [2026.04.7] — 2026-04-28

**Bugfix: Vercel-Build TypeScript-Fehler bei pdfjs-Worker (Issue #20).**

### Korrigiert

- **Type-Declaration für `pdfjs-dist/legacy/build/pdf.worker.mjs`**: pdfjs-dist
  liefert kein `.d.ts` für den Worker mit. Der dynamische Import in
  `lib/import/pdf-utils.ts` lief lokal durch (skipLibCheck), schlug aber im
  Vercel-Build mit „Could not find a declaration file for module
  'pdfjs-dist/legacy/build/pdf.worker.mjs'" fehl. Neues Stub-File
  `types/pdfjs-dist.d.ts` deklariert das Modul mit `WorkerMessageHandler:
  unknown` (mehr brauchen wir nicht — wir reichen den Wert nur an
  `globalThis.pdfjsWorker` weiter).

---

## [2026.04.6] — 2026-04-28

**Changelog-Popup nach Login + Mobile-Fixes (Issues #17, #18, #19).**

### Neu

- **Changelog-Popup nach Login**: zeigt nach dem Anmelden die seit dem
  letzten „als gelesen markieren" hinzugekommenen Änderungen. Pro
  Benutzer wird die zuletzt bestätigte Version in der Datenbank gespeichert
  (neues Feld `User.lastReadChangelogVersion`). Solange nicht bestätigt
  erscheint das Popup bei jedem Login. Inhalte stammen aus
  `lib/changelog.tsx`, das jetzt einzige Quelle der Wahrheit für
  Änderungseinträge ist (Issue #17).

### Korrigiert

- **Schreibfehler „Ranglistenregattaen"** auf der Public-Startseite
  korrigiert — jetzt korrekt „Ranglistenregatten" (Issue #18).
- **Public-Startseite mobil**: Statistik-Karten stapeln auf schmalen
  Bildschirmen statt zu überlaufen, kompakteres Hero, kleineres Logo
  und Fluid-Padding (Issue #19).

---

## [2026.04.5] — 2026-04-28

**Bugfix: pdfjs-Worker via globalThis.pdfjsWorker vorinstallieren.**

### Korrigiert

- **Dynamischen `import(workerSrc)` umgehen**: Next.js Turbopack schreibt
  `import.meta.url` externer Pakete auf eine synthetische
  `[project]/…`-URL um. pdfjs-dists `_setupFakeWorkerGlobal` versucht
  daraufhin `import("[project]/…/pdf.worker.mjs")` und scheitert mit
  „Cannot find package '[project]'". Lösung: pdfjs-dist bietet einen
  Bypass — wenn `globalThis.pdfjsWorker?.WorkerMessageHandler` gesetzt
  ist, überspringt der Loader den dynamischen Import. `pdf-utils.ts`
  importiert jetzt `pdf.worker.mjs` einmalig statisch und legt
  `WorkerMessageHandler` global ab. Verifiziert: getDocument
  funktioniert sogar mit absichtlich kaputtem workerSrc.

---

## [2026.04.4] — 2026-04-28

**Bugfix: [project]-Pfad-Fehler beim lokalen PDF-Import (Folge-Fix).**

### Korrigiert

- **Entfernung des `workerSrc`-Overrides**: Der in 2026.04.3 hinzugefügte
  `createRequire(import.meta.url)`-Ansatz schlug in Next.js fehl, weil
  `import.meta.url` im Dev-Server ein synthetisches `[project]/…`-Präfix
  enthält. pdfjs-dist interpretierte das als Paketname und konnte es nicht
  auflösen. Da `outputFileTracingIncludes` bereits sicherstellt, dass
  `pdf.worker.mjs` im Bundle vorhanden ist, reicht pdfjs-dists Standard-Pfad
  `"./pdf.worker.mjs"` aus — kein Override nötig.

---

## [2026.04.3] — 2026-04-28

**Bugfix: pdf.worker.mjs fehlt im Vercel-Bundle (Folge-Fix zu Issue #16).**

### Korrigiert

- **Worker-Datei im Vercel-Deployment**: pdfjs-dist importiert `pdf.worker.mjs`
  mit `/* webpackIgnore: true */`, weshalb weder webpack noch Vercels
  nft-File-Tracer die Datei ins Bundle aufnehmen. Beim ersten PDF-Import im
  Serverless-Context fehlschlug mit „Cannot find module pdf.worker.mjs".
  Fix: `outputFileTracingIncludes` in `next.config.ts` zwingt Vercel, die
  Worker-Datei explizit ins Bundle aufzunehmen. Zusätzlich setzt `pdf-utils.ts`
  `GlobalWorkerOptions.workerSrc` auf den absoluten, aufgelösten Pfad statt des
  relativen Strings `"./pdf.worker.mjs"`.
- **DOMMatrix-Polyfill ergänzt**: `scaleSelf`, `translateSelf` und weitere
  Methoden hinzugefügt, die `pdf.worker.mjs` ggf. aufruft.

---

## [2026.04.2] — 2026-04-28

**Bugfix: pdfjs-dist lädt nicht in Node.js (Issue #16).**

### Korrigiert

- **DOMMatrix-Polyfill für serverseitige PDF-Verarbeitung**: pdfjs-dist v5
  referenziert `DOMMatrix` bei der Modul-Initialisierung (Top-Level-Konstante),
  die in Node.js nicht vorhanden ist. Die App stürzte beim ersten PDF-Import mit
  `ReferenceError: DOMMatrix is not defined` ab. Fix: minimaler DOMMatrix-Stub
  wird in `instrumentation.ts` beim Server-Start installiert, bevor pdfjs-dist
  geladen wird. Text-Extraktion funktioniert vollständig; Canvas-Rendering-Pfade
  (nicht benötigt) bleiben Stub.

---

## [2026.04.1] — 2026-04-28

**Responsive öffentliche Seiten + CalVer-Versionierung (Issues #14, #15).**

### Geändert

- **Versionierungsformat** auf CalVer umgestellt: `JJJJ.MM.N` (z.B. `2026.04.1`).
  Gespeichert ohne führende Null im Monat (`2026.4.1`) um npm-Kompatibilität
  zu wahren; die Anzeige paddet den Monat automatisch.

### Neu

- **Responsive öffentliche Seiten**: alle Tabellen auf kleinen Bildschirmen
  horizontal scrollbar, überflüssige Spalten auf Mobilgeräten ausgeblendet
  (Land in Regatten-Tabelle war bereits ausgeblendet — jetzt konsistent).
- Kompakterer Header auf kleinen Bildschirmen (weniger Gap zwischen Logo
  und Navigation).

---

## [1.1.1] — 2026-04-28

**Bugfix beim „Neu anlegen" im Import-Matching (Gitea-Issue #12).**

### Korrigiert

- Beim Klick auf <em>„Neu anlegen"</em> aus dem Vorschlag heraus wurde
  der Name des **vorgeschlagenen** Seglers ins Formular übernommen
  statt der gerade aus den Importdaten geparste Name. Aus dem
  „Ändern → Neu anlegen"-Pfad waren die Felder sogar leer. Jetzt wird
  in allen drei Pfaden konsistent der geparste Helm- bzw. Crew-Name
  vorgeschlagen.

---

## [1.1.0] — 2026-04-28

**Segler-Merge (Gitea-Issue #7).**

### Neu

- **Zwei Segler zusammenführen**: über `/admin/segler/merge` (oder
  „Mit anderem zusammenführen…" auf der Segler-Detailseite) lassen sich
  Duplikate auflösen. Alle Regatta-Einträge wandern auf den primären
  Datensatz, der sekundäre wird gelöscht. Vorschoter-Beziehungen
  (Crew-IDs) werden ebenfalls migriert.
- **Vorschau vor dem Merge**: zeigt Anzahl betroffener Steuermann- und
  Crew-Einträge, neue alternative Namen und ergänzte Stammdaten an.
- **Konflikt-Erkennung**: Wenn beide Segler in derselben Regatta als
  Steuermann eingetragen sind (würde @@unique([regattaId, helmId])
  verletzen), blockiert die App den Merge mit einer aussagekräftigen
  Fehlermeldung und listet die betroffenen Regatten.
- **Audit-Log**: jeder Merge wird mit Quelle, Ziel und Übertragungs-
  zahlen im Sicherheitsprotokoll vermerkt.

---

## [1.0.1] — 2026-04-28

**Bugfix im Import-Wizard (Gitea-Issue #5).**

### Korrigiert

- **Alternative Treffer im Matching-Schritt sichtbar**: bei einem
  „mittleren" Match (75–90 % Ähnlichkeit) zeigt der Wizard jetzt
  alle ähnlichen Segler nebeneinander. Bisher wurde nur der beste
  Vorschlag dargestellt; weitere Kandidaten waren nur über das
  „Ändern"-Dropdown erreichbar.
- **Such-Feld statt langes Dropdown**: der „Ändern"-Modus nutzt
  jetzt eine Typeahead-Suche, die in Vor- und Nachname sowie
  Segelnummer filtert (egal in welcher Reihenfolge der Name
  eingegeben wird).

---

## [1.0.0] — 2026-04-28

**Erste Produktionsversion auf Vercel + Neon.**

### Neu

- **Vercel-Deployment**: Postgres-Schema parallel zu SQLite, automatische
  Migrations-Anwendung beim Build, Region Frankfurt.
- **Vercel Blob als Backup-Storage**: Backups überleben Cold-Starts und
  Deploys; FS-Storage bleibt für lokale Entwicklung.
- **Vercel Cron für automatische Backups**: tägliche Cron-Route prüft den
  konfigurierten Wochentag und erstellt das Backup wenn fällig.
- **BackupSchedule in der DB**: Konfiguration persistent im Postgres-
  Singleton statt im Filesystem.
- **PDF-fähiges Benutzerhandbuch** unter `/admin/hilfe` mit
  Inhaltsverzeichnis, Kapitelnummern, automatischen Seitenzahlen und
  420er-Logo auf der Coverseite.
- **Animiertes Tutorial-GIF** für den Regatta-Import-Workflow.
- **Sechs Screenshots** strategisch in der Hilfe verlinkt
  (Dashboard, Segler-Liste, Regatten-Liste, Import-Wizard,
  Ranglisten-Vorschau, Wartung).
- **Inhaltliche Hilfe-Erweiterungen**: Schottenwechsel-Abschnitt,
  JWM/JEM-Quali-Erläuterung, Tour-Hinweis.

---

## [0.7.0] — 2026-04-27

**Backup-Restore-Erweiterungen (Gitea-Issues #1, #2, #3).**

### Neu

- **Teilweise Rücksicherung** (Issue #1): Auswahl zwischen
  „Alles", „Nur Segler" und „Nur Regatten & Ergebnisse".
- **Sicherheits-Backup vor jeder Rücksicherung** (Issue #3): die App
  erstellt automatisch ein Backup mit dem Kommentar
  „Backup vor Rücksicherung".
- **Beschreibende Kommentare bei Auto-Backups** (Issue #2):
  „Backup vor Datenlöschung" oder „Backup vor Datenreduktion (Regatten
  vor JJJJ)" beim Aufräumen.

---

## [0.6.0] — 2026-04-27

**Sicherheitshärtung im Backup-Restore.**

### Geändert

- **Atomare Rücksicherung**: Phase 1 (Delete) + Phase 2 (Insert) jetzt in
  einer einzigen Transaktion — bei Insert-Fehlern werden die Deletes
  zurückgerollt.
- **Upload-Größe**: 100-MB-Limit für hochgeladene Backup-Dateien zum
  Schutz vor OOM.
- **Path-Traversal-Schutz**: korrekte Behandlung mit `path.normalize`
  und `path.sep` (vermeidet Prefix-Kollision wie `C:\backup` vs.
  `C:\backups` auf Windows).

---

## [0.5.0] — 2026-04-26

**Backup-Komfort und Tour-System.**

### Neu

- **Backup-Kommentarfeld**: optionaler Hinweis pro Backup; bei
  automatischen Backups wird der Zeitplan-Kontext eingetragen.
- **Tour-System auf Unterseiten**: PageTour-Komponente, „Seite erkunden"-
  Button auf jeder Hauptseite mit step-by-step-Highlight.
- **JWM/JEM-Rangliste**: Filter nach Jahr und Suchfeld auf der
  Quali-Berechnungs-Seite.

### Korrigiert

- Spotlight folgt jetzt dem Scrollen.
- Tour-Tooltip bleibt im sichtbaren Bereich (Flip-Logik).

---

## Frühere Versionen

Frühere Iterationen sind in der Git-Commit-Historie dokumentiert
(Milestones M1–M6 aus `PLAN_1.md`):

- M1/M2: Projekt-Setup, Datenmodell, Admin-CRUD für Segler und Regatten
- M3: Manage2Sail-Parser (API, Web-Copy-Paste, PDF) + Fuzzy-Matching
- M4: Import-Wizard mit Schritt-für-Schritt-Bestätigung
- M5: DSV-Scoring-Engine (R_A-Formel, Multiplikator, Tiebreak)
- M6: IDJM-Quali-Filter und öffentliche Detail-Seiten mit
  Berechnungs­transparenz
