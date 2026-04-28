# Changelog

Alle nennenswerten Änderungen an der 420er-Ranglistenverwaltung.

Format orientiert sich an [Keep a Changelog](https://keepachangelog.com/de/1.1.0/).
Versionierung folgt [Semantic Versioning](https://semver.org/lang/de/).

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
