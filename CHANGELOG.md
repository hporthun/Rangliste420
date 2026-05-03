# Changelog

Alle nennenswerten Änderungen an der 420er-Ranglistenverwaltung.

Format orientiert sich an [Keep a Changelog](https://keepachangelog.com/de/1.1.0/).
Versionierung folgt [Calendar Versioning](https://calver.org/) im Format **JJJJ.MM.N**
(Jahr.Monat.laufende Nummer im Monat) ab Version 2026.04.1.

---

## [2026.05.21] — 2026-05-03

**Rangliste: "ohne Jahrgang"-Hinweis auch fuer Vorschoter.**

### Neu

- Im Crew-Subtext der Ranglisten-Tabellen erscheint jetzt der gleiche
  **"ohne Jahrgang"**-Badge wie bei Steuerleuten, sobald das Geburtsjahr
  des Vorschoters in den Stammdaten fehlt. Das Flag wird auch fuer
  anonyme Aufrufe ausgeliefert (fachliche Info, kein PII).

---

## [2026.05.20] — 2026-05-03

**Rangliste: Live-Suche ueber Steuermann, Crew und Verein.**

### Neu

- Auf jeder Ranglisten-Detailseite (DSV, IDJM, JWM/JEM) gibt es ein
  **Suchfeld**, das beim Tippen Hauptliste, "Noch nicht in der Wertung"
  und JWM/JEM-Sektionen filtert. Match auf Helm-Name, Crew-Name(n) und
  Verein. Diakritika werden ignoriert (z. B. "muehlenberger" findet
  "Muehlenberger Segel-Club"). Sektionen ohne Treffer werden komplett
  ausgeblendet.

---

## [2026.05.19] — 2026-05-03

**Rangliste: Jahrgang auch fuer die Crews (Schotten).**

### Neu

- Die Jahrgangs-Anzeige fuer angemeldete Benutzer umfasst jetzt auch die
  Schotten/Vorschoter — im Crew-Subtext wird hinter jedem Namen
  `, Jg. 2008` ergaenzt (sofern bekannt). Anonyme Aufrufe sehen die
  Jahrgaenge weiterhin nicht.

---

## [2026.05.18] — 2026-05-03

**Rangliste: Jahrgang neben dem Seglernamen fuer angemeldete Benutzer.**

### Neu

- Auf den Ranglistenseiten (DSV-Haupttabelle, „Noch nicht in der Wertung",
  JWM/JEM-Quali) erscheint hinter jedem Seglernamen jetzt der Jahrgang
  als kleiner Subtext (z. B. **Jg. 2009**) — allerdings nur fuer
  angemeldete Benutzer. Anonyme Aufrufe bekommen das Geburtsjahr nicht in
  den RSC-Payload.

---

## [2026.05.17] — 2026-05-03

**Rangliste: Liste der Teams unter dem 9-Wertungs-Cutoff.**

### Neu

- Auf jeder DSV-Ranglistenseite (Jahres, Aktuelle, IDJM-Quali) erscheint
  unter der Haupttabelle die Sektion **„Noch nicht in der Wertung"**.
  Sie listet alle Steuerleute (bzw. Vorschoter im CREW-Modus), die bereits
  Wertungen gesammelt, aber noch keine 9 erreicht haben — mit Anzahl
  `X / 9`, Verein und Crew. Damit ist auf einen Blick zu sehen, wer noch
  eine Regatta bis zum Cutoff braucht.

---

## [2026.05.16] — 2026-05-02

**Regattenliste-Import: URL bestehender Regatten wird nachgepflegt.**

### Geändert

- Beim Re-Einlesen der Manage2Sail-Klassenvereinigungsliste werden Regatten,
  die wir schon kennen (Match per Name + Startdatum), nicht mehr stumm
  übersprungen, wenn die M2S-Liste eine `sourceUrl` liefert, die bei uns
  fehlt oder abweicht. In dem Fall wird die `sourceUrl` (und `sourceType` =
  `MANAGE2SAIL_PASTE`) am bestehenden Datensatz aktualisiert. Andere Felder
  (Faktor, Wettfahrten, Teilnehmerzahl, Ranglisten-Flag) bleiben unangetastet
  — die könnten manuell gepflegt sein.
- Die Erfolgsmeldung im Import-Wizard nennt jetzt zusätzlich, wie viele URLs
  ergänzt/aktualisiert wurden.

---

## [2026.05.15] — 2026-05-02

**IDJM-Quali: alle Jahrgänge zulässig (Issue #53).**

### Geändert

- Die IDJM-Quali-Rangliste lässt jetzt alle Altersklassen zu — also auch
  `OPEN` und `U22`, nicht mehr nur U19/U17/U16/U15. Der bisherige Guard in
  `lib/actions/rankings.ts` (Fehler „IDJM-Quali ist nur für U19, U17, U16
  und U15 verfügbar.") und die Type-Constraint in `lib/scoring/idjm-quali.ts`
  wurden entfernt. R ≥ 25-Schwelle und Saisonstichtag-Logik bleiben gleich.
- `app/admin/ranglisten/vorschau/page.tsx`: Altersklassen-Dropdown enthält
  zusätzlich `U22`.
- `components/rankings/ranking-filter-bar.tsx`: `hideU22`-Prop entfernt
  (war nur für IDJM gesetzt und nicht mehr nötig).

### Korrigiert

- Auf der öffentlichen Ranglisten-Detailseite (`app/(public)/rangliste/[id]`)
  wurde der Typ-Vergleich gegen `"IDJM_QUALI"` gemacht, gespeichert wird aber
  `"IDJM"`. Folge: das mit U22 verbundene IDJM-spezifische Filter-Verhalten
  griff nie, was im Zuge der obigen Lockerung ohnehin obsolet wird; der
  Vergleich wurde entfernt.

---

## [2026.05.14] — 2026-05-02

**Hinweis-Badge in Rang-/Quallisten für Segler ohne gepflegtes Geburtsjahr.**

### Neu

- In allen Rang- und Qualifikationslisten (öffentlich und Admin-Vorschau)
  erscheint neben dem Namen jetzt ein kleines „ohne Jahrgang"-Badge, sobald
  beim Segler kein Geburtsjahr in den Stammdaten gepflegt ist. Tooltip
  erklärt: „Geburtsjahr fehlt — bitte in den Stammdaten ergänzen, sonst
  erscheint der Segler nicht in Altersklassen-Ranglisten." Betrifft DSV-,
  IDJM-, JWM- und JEM-Quali-Listen. (Issue #52)

---

## [2026.05.13] — 2026-05-02

**Benutzerverwaltung mit Editor-Rolle (Issue #49).**

### Neu

- Admin-Bereich `/admin/benutzer` zum Anlegen, Bearbeiten und Löschen von
  Konten. Zwei Rollen: `ADMIN` (voller Zugriff) und `EDITOR` (Segler,
  Regatten, Ranglisten — kein Zugriff auf `/admin/wartung` und
  `/admin/benutzer`).
- Liste mit „letzter Login" (Zeit + Methode: Passwort/Passkey/OAuth) — gelesen
  aus dem bestehenden `AuditLog` ohne zusätzliches Feld am User.
- Manuelles Sperren (`disabledAt`) und Entsperren. Gesperrte Konten können
  sich nicht mehr einloggen; laufende Sessions werden bei der nächsten
  Auth-Prüfung invalidiert.
- „Rauswerfen": erhöht `tokenVersion`, vorhandene JWTs werden beim nächsten
  Request über `lib/auth-guard.ts` verworfen — sofortiges Session-Ende ohne
  Wechsel auf Database-Sessions (NextAuth v5 unterstützt mit Credentials
  noch keine `database`-Strategie).
- Admin-initiierter Passwort-Reset: setzt neues Passwort und invalidiert
  zugleich alle Sessions.
- Selbstschutz: der eingeloggte Admin kann sich selbst nicht löschen,
  sperren oder zum Editor degradieren. Mindestens ein aktiver Admin bleibt
  immer erhalten (letzter Admin kann nicht gelöscht/degradiert/gesperrt
  werden).

### Geändert

- Schema: `User.disabledAt`, `User.disabledBy`, `User.tokenVersion`
  ergänzt. Default-Rolle für neu angelegte User ist `EDITOR` (der
  Seed-Admin bleibt `ADMIN`).
- Audit-Aktionen `USER_CREATED`, `USER_UPDATED`, `USER_DELETED`,
  `USER_DISABLED`, `USER_ENABLED`, `USER_SESSIONS_REVOKED`,
  `USER_PASSWORD_RESET` ergänzt.
- Login-Pfad weist disabled User ab und loggt einen Fehlversuch.
- Admin-Layout liest die Session via neuem `requireSession()`-Helper, der
  pro Request gegen die DB prüft (Disabled-Check + tokenVersion-Vergleich).
- `/admin/wartung` und `/admin/benutzer` rufen `requireRole("ADMIN")` direkt
  am Anfang ihrer Server-Components auf, sodass Editor-Konten umgeleitet
  werden, bevor sensitive Daten geladen werden.

---

## [2026.05.12] — 2026-05-02

**Vorschoter-Rangliste: Detail-Ansicht zeigt jetzt den korrekten Eintrag.**

### Korrigiert

- In Vorschoter-Ranglisten (`scoringUnit = "CREW"`) führte ein Klick auf einen
  Vorschoter zur Fehlermeldung „Kein Ranglisten-Eintrag für diesen Segler".
  Ursache: die Detail-Seite las `scoringUnit` weder aus dem Ranking-Datensatz
  (öffentliche Seite) noch aus dem `?unit=`-Query-Parameter (Admin-Vorschau)
  und rief deshalb intern eine Steuermann-Rangliste mit der Crew-ID ab.
  (Issue #48)
- Die Tabellen-Überschrift „Crew-Historie" und die Spalte „Crew" auf der
  Detail-Seite werden in Vorschoter-Ranglisten zu „Steuermann-Historie" und
  „Steuermann".

---

## [2026.05.11] — 2026-05-02

**Vollständigeres Backup — Admin-Accounts, Passkeys, SMTP, Audit-Log.**

### Geändert

- Backup deckt jetzt alle Daten ab. Zusätzlich zu den Stammdaten werden
  Admin-Accounts (`User`), Passkeys (`WebAuthnCredential`), SMTP-Einstellungen
  (`MailConfig`), Audit-Log (`AuditLog`) und Push-Abonnements
  (`PushSubscription`) im Backup mit-gesichert und beim vollständigen Restore
  (`scope="all"`) wiederhergestellt. Backup-Dateiformat-Version steigt von 1
  auf 2; ältere Backups bleiben weiterhin lesbar (Admin-/Config-/Log-Tabellen
  werden dort schlicht übersprungen). (Issue #51)
- BigInt-Felder (`WebAuthnCredential.counter`) werden jetzt JSON-serialisiert
  als String und beim Restore zurück in BigInt konvertiert.

### Korrigiert

- Beim Restore gingen bislang einzelne Felder stillschweigend verloren, obwohl
  sie im Backup-JSON enthalten sind: `Sailor.member420`,
  `Regatta.totalStarters`, `Ranking.sortOrder`, `Ranking.scoringUnit`. Diese
  werden jetzt korrekt zurückgespielt. (Issue #51)

---

## [2026.05.10] — 2026-05-02

**Einheitliches Logo im öffentlichen Bereich.**

### Korrigiert

- Im öffentlichen Bereich (Regatten, Ranglisten) wurde im Header bislang ein
  anderes Logo (`logo-420-full.png`) angezeigt als auf der Startseite. Beide
  zeigen jetzt das einheitliche Logo (`logo-420.png`). (Issue #50)

---

## [2026.05.9] — 2026-05-02

**JWM/JEM-Quali: Teams mit ungenehmigtem Schottenwechsel werden unten ausgewiesen.**

### Neu

- In der JWM/JEM-Qualifikationsrangliste werden Teams, die nur durch einen
  ungenehmigten Schottenwechsel entstanden sind und deshalb kein gewertetes
  Ergebnis haben, jetzt in einer eigenen Sektion „Nicht gewertet —
  ungenehmigter Schottenwechsel" unten ausgewiesen. Bislang verschwanden
  diese Helm/Crew-Kombinationen still aus der Rangliste, weil ihr einziger
  Eintrag (die Wechsel-Regatta) ausgeschlossen wurde.
- Die Sektion erscheint sowohl in der Admin-Vorschau als auch auf der
  öffentlichen Rangliste; jede Zeile zeigt Helm-Name, Crew, Verein und die
  Regatta, in der der ungenehmigte Wechsel stattfand.
- DSV-Rangliste, Aktuelle Rangliste und IDJM-Quali sind nicht betroffen —
  sie ignorieren das `crewSwapApproved`-Flag ohnehin (siehe
  `docs/business-rules.md` §2.5).

---

## [2026.05.3] — 2026-05-01

**JWM/JEM-Quali: Ungenehmigter Schottenwechsel — Wechsel-Regatta wird ausgeschlossen.**

### Korrigiert

- Teams, die einen nicht genehmigten Schottenwechsel vorgenommen haben,
  werden bei der Regatta, an der der Wechsel stattfand, weder mit ihrer
  Platzierung noch in der Teilnehmerzahl berücksichtigt (z. B. Ida Marie
  Claussen). Der erste Eintrag eines solchen Teams erhält
  `weightedScore = null` und wird von der Starter-Summe dieser Regatta
  abgezogen. Folge-Einträge desselben neuen Teams (mit gleicher Crew,
  spätere Regatten) werden weiterhin normal gewertet.

---

## [2026.05.2] — 2026-05-01

**JWM/JEM-Quali: Null-Crew (PDF-Import) verursacht keinen Teamwechsel.**

### Korrigiert

- Teams, deren erster Regatta-Eintrag aus einem PDF-Import stammt (Crew
  unbekannt = `null`), wurden beim nächsten Eintrag mit bekannter Crew
  fälschlicherweise als neues Team gewertet. Dadurch erschienen beide
  Teil-Teams als „Zwischenergebnis (unvollständig)" statt als ein
  vollständiges Team in der Qualifikationsrangliste.
- Umgekehrt: bekannte Crew gefolgt von einem PDF-Eintrag ohne Crew-Daten
  führt ebenfalls nicht mehr zu einem Split.
- Nur ein echter, unterschiedlicher Crew-Wechsel (von einem bekannten zu
  einem anderen bekannten Vorschoter) löst weiterhin die Schottenwechsel-
  Logik aus.

---

## [2026.05.1] — 2026-05-01

**Vorschoter-Ranglisten (Issue #47).**

### Neu

- Alle DSV-Ranglisten (Jahresrangliste, Aktuelle, IDJM-Quali) können jetzt
  wahlweise nach Vorschoter statt nach Steuermann berechnet werden.
- Neues `scoringUnit`-Feld (`"HELM"` | `"CREW"`) am `Ranking`-Modell und in den
  Compute-Parametern.
- Vorschau-Formular: neuer "Einheit"-Selektor (Steuermann / Vorschoter).
- `HelmRanking.helmId` → `sailorId`; `RankingRow.helmId` → `sailorId`,
  `crews` → `partners`; `HelmDetailData.crewHistory` → `partnerHistory`.

---

## [2026.04.43] — 2026-04-30

**Ranglistenreihenfolge per Drag & Drop.**

### Neu

- Im Adminbereich können Ranglisten per Drag & Drop umsortiert werden.
  Die Reihenfolge wird sofort gespeichert und gilt auch für die
  öffentliche Ranglisten-Übersicht.
- Neues Datenbankfeld `sortOrder` auf dem `Ranking`-Modell.

---

## [2026.04.42] — 2026-04-30

**JWM/JEM-Quali: Typ-Auswahl entfernt.**

### Geändert

- JWM- und JEM-Qualifikation sind eine gemeinsame Rangliste. Der
  Typ-Selektor (JWM-Quali / JEM-Quali) wurde aus dem Formular entfernt.
  Alle neuen Ranglisten werden als `JWM_QUALI` gespeichert. Bestehende
  `JEM_QUALI`-Einträge bleiben editierbar.

---

## [2026.04.41] — 2026-04-30

**Segler: Flag „Mitglied 420er-Klassenvereinigung".**

### Neu

- Neues Boolean-Feld `member420` an jedem Segler (Default: aktiviert).
  Editierbar in der Segler-Bearbeitungsmaske als Checkbox.
- In der JWM/JEM-Qualifikationsberechnung werden nur Mitglieder
  berücksichtigt — Nicht-Mitglieder zählen weder als Starter noch
  erscheinen sie in der Rangliste.

---

## [2026.04.40] — 2026-04-30

**IDJM: Altersfilter nach Saisonstichtag statt Regattadatum.**

### Geändert

- IDJM-Quali prüft Altersklassen jetzt gegen den Saisonstichtag (ganzes
  Saisonjahr), identisch zu Jahresrangliste und JWM/JEM-Quali.
  `useRegattaDateForAge` entfernt, `referenceDate` wird übergeben.
- Dokumentation in `docs/business-rules.md` und `CLAUDE.md` aktualisiert:
  Altersregel explizit dokumentiert, U22 ergänzt.

---

## [2026.04.39] — 2026-04-30

**JWM/JEM-Quali: Altersfilter nach Stichtag statt Regattadatum.**

### Geändert

- Die Altersklassenprüfung bei der JWM/JEM-Qualifikationsberechnung
  verwendet jetzt den Stichtag der Saison, nicht mehr das Startdatum
  der jeweiligen Regatta. Eine Regatta im Folgejahr wird dadurch nicht
  mehr fälschlicherweise ausgeschlossen.

---

## [2026.04.38] — 2026-04-30

**U22 als neue Altersklasse für JWM/JEM-Quali.**

### Neu

- Altersklasse U22 (max. 21 Jahre) steht in der JWM/JEM-Qualifikationsberechnung zur Verfügung.

---

## [2026.04.37] — 2026-04-30

**JWM/JEM-Quali: Neu-Platzierung nur unter Deutschen.**

### Geändert

- Bei der Berechnung der JWM/JEM-Qualifikationsrangliste werden Platzierungen
  und Starterzahlen jetzt ausschließlich unter deutschen Seglern neu ermittelt.
  Der gewichtete Score (`weightedScore = rank × maxStarters / starters`) basiert
  damit auf dem deutschen Rang und der deutschen Starterzahl pro Regatta.
  `maxStarters` ist die höchste deutsche Starterzahl über alle ausgewählten
  Regatten.

---

## [2026.04.36] — 2026-04-30

**JWM/JEM-Quali bearbeiten.**

### Neu

- Gespeicherte JWM- und JEM-Qualifikationsranglisten lassen sich über das
  ⚙️-Icon in der Ranglisten-Übersicht bearbeiten. Die JWM/JEM-Seite liest
  `editId` aus den URL-Parametern, befüllt alle Felder (Typ, Altersklasse,
  Gender, Stichtag, Regattaauswahl, Name) vor und überschreibt die
  bestehende Rangliste beim Speichern anstatt eine neue anzulegen.

---

## [2026.04.35] — 2026-04-30

**CSV-Stammdatenimport.**

### Neu

- Neues Importformat auf `/admin/segler/import`: CSV-Datei `Seglerdaten_JJJJ.csv`
  hochladen (Spalten: Name, Vorname, Geburtsjahr; kommagetrennt).
  Bekannte Segler werden per Fuzzy-Matching zugeordnet, Geburtsjahr wird
  vorgeschlagen. Neue Segler (kein Match) können direkt angelegt werden.
  Konflikte (CSV-Geburtsjahr weicht von DB ab) werden farblich markiert.
  Duplikate im CSV (gleicher Name, unterschiedliches Geburtsjahr) werden
  mit „doppelt"-Badge gekennzeichnet.

---

## [2026.04.34] — 2026-04-30

**Ergebnisliste: Einträge manuell hinzufügen.**

### Neu

- Button „Eintrag hinzufügen" auf der Regatta-Detailseite öffnet ein Modal
  zur manuellen Erfassung: Steuermann (Pflicht, Suche über alle Segler),
  optionaler Vorschoter, Segelnummer, Startgebiet-Flag sowie alle
  Einzelwertungen (Punkte, Code, Streichungs-Flag). Nettopunkte und
  Platzierungen der Regatta werden automatisch neu berechnet (Issue #41).

---

## [2026.04.33] — 2026-04-30

**Sailwave 2.38+ PDF-Format unterstützt.**

### Neu

- Neuer Parser `sailwave2-pdf` erkennt und verarbeitet Sailwave-PDFs im
  „Crewman 1 Name / Crewman 2 Name"-Format (z. B. JK Burja Spring Cup).
  Unterschiede zum bisherigen Sailwave-Format: Platzierung als „1st/2nd/…",
  eigene Nationality-Spalte mit NAT-Kürzel, Punkte als Integer, Gesamt/Netto
  als „Total/Nett". Auto-Detection prüft jetzt als ersten Schritt auf
  `Crewman 1` oder `Crewman 2` im Seitentext.
- Penalty-Code `DNE` (Disqualification not excludable) in `PENALTY_CODES_SET`
  ergänzt — wird korrekt als Strafpunktecode geparst.

---

## [2026.04.32] — 2026-04-30

**Ergebnislisten manuell bearbeitbar.**

### Neu

- Jeder Eintrag in der Regatta-Detailseite hat jetzt ein Stift-Icon: das
  Modal erlaubt es, Segelnummer, Startgebiet-Flag (SG) sowie alle
  Einzelwertungen (Punkte, Code wie DNC/DNS/BFD/…, Streichungs-Flag) zu
  korrigieren. Nach dem Speichern werden Nettopunkte und Platzierungen der
  gesamten Regatta automatisch neu berechnet.
- Mülleimer-Icon löscht einen Eintrag nach Bestätigung; die Platzierungen
  der verbleibenden Einträge werden ebenfalls neu vergeben.

---

## [2026.04.31] — 2026-04-30

**Velaware-PDF: Nationen werden geparst.**

### Korrigiert

- Beim Import von Velaware-Ergebnislisten (Italien, z. B. Imperia
  Winter Regatta) hat der Parser bisher die Nationenkürzel verloren:
  Die Spalte „Numero velico" enthält visuell zwei Sub-Zellen (3-Letter-
  NAT-Code links, Segelnummer rechts), liegt aber unter einer
  einzelnen Headerschrift. Die Spaltengrenzen aus der Header-Mitte
  haben den NAT-Code in die Rang-Spalte rutschen und kurze
  Segelnummern in die Namens-Spalte fallen lassen. Beide Sub-Zellen
  werden jetzt korrekt erfasst, `sailNumber` enthält den Präfix
  („ESP 55249"), und `nationality` ist auf der `ParsedEntry` gesetzt.
- Der Filter „nur deutsche Crews" beim PDF-Import nutzt jetzt das
  explizite `nationality`-Feld und entfernt damit ausländische Crews
  zuverlässig — auch wenn die Segelnummer keinen Präfix trägt.

---

## [2026.04.30] — 2026-04-30

**Suchfelder ignorieren Groß-/Kleinschreibung (Issue #38).**

### Korrigiert

- Die Suchfelder auf der Segler- und Regatten-Liste finden jetzt
  Treffer unabhängig von Groß-/Kleinschreibung. Vorher mussten Eingaben
  in PostgreSQL (Produktion) exakt der Schreibweise entsprechen — auf
  SQLite (lokal) war ASCII tolerant, Umlaute aber nicht. Der Filter
  läuft jetzt als JavaScript-Vergleich nach `toLowerCase()` und liefert
  dieselben Ergebnisse auf beiden Datenbanken.

---

## [2026.04.29] — 2026-04-30

**Hinweis: „Inoffizielle Ranglisten" auf der öffentlichen Seite (Issue #37).**

### Geändert

- Hero-Texte auf der Startseite und der Ranglisten-Übersicht sprechen
  jetzt von „Inoffizielle Ranglisten" / „Inoffizielle DSV-
  Jahresrangliste". Die hier berechneten Ranglisten sind eine Service-
  Anwendung der Klassenvereinigung — die offiziellen DSV-Ranglisten
  bleiben bei den entsprechenden Stellen.

---

## [2026.04.28] — 2026-04-30

**Web-Push-Benachrichtigungen für neue Inhalte (Issue #36).**

### Neu

- **Push-Benachrichtigungen** für Public-Visitors. Banner unter dem Header
  („Bei neuen Ranglisten oder Regatten benachrichtigt werden? — Aktivieren");
  nach Bestätigung zeigt der Browser eine Notification UND aktualisiert
  die App-Plakette auf dem PWA-Symbol, sobald
  - eine neue Rangliste veröffentlicht wird,
  - eine neue Ranglistenregatta angelegt wird (auch beim Bulk-Import als
    Sammel-Push, nicht 30 Pings am Stück),
  - der Server eine neue App-Version startet.
- Banner ist anonym — keine Anmeldung nötig. „Abbestellen" jederzeit über
  denselben Banner möglich. Dismiss merkt sich für 30 Tage, dann fragt der
  Banner erneut.
- Browser-Unterstützung: Chrome/Edge auf Windows/macOS/ChromeOS sowie
  installierte iOS-PWAs ab iOS 16.4. Firefox unterstützt Push, aber kein
  Badge — die Notification kommt trotzdem.
- Server-Setup: VAPID-Keys einmalig per `node scripts/generate-vapid.mjs`
  erzeugen und in `.env` (lokal) bzw. Vercel-Env (Produktion) als
  `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` hinterlegen.
  Ohne diese Variablen ist Push deaktiviert — Banner erscheint dann nicht.

### Geändert

- Neue Prisma-Modelle `PushSubscription` (Endpoint + Keys, anonym pro
  Browser) und `PushBroadcastState` (Singleton mit zuletzt verteilter
  Version, idempotent über Serverless-Boots hinweg).
- Tote Subscriptions (HTTP 410 vom Push-Provider) werden beim nächsten
  Broadcast automatisch gelöscht.

---

## [2026.04.27] — 2026-04-30

**Code-Dokumentation deutlich ausgebaut.**

### Neu

- **`docs/architecture.md`**: technischer Überblick — File-Map des
  gesamten Projekts, Schichten + Abhängigkeitsregeln, Datenfluss-
  Diagramme für Import-Wizard und Ranglisten-Berechnung,
  Server-Action-Konvention als kanonisches Template, Liste der
  globalen Invarianten. CLAUDE.md verlinkt darauf.
- **JSDoc-Header für alle 12 Server-Action-Dateien** in `lib/actions/`:
  pro Datei eine 10–30-zeilige Beschreibung — was lebt hier, welche
  Tabellen werden geschrieben, welche Auth-Anforderungen, welche
  Invarianten gelten.

### Aufräum

- **ESLint ignoriert `.claude/`-Verzeichnis** (Claude-Worktrees mit
  eigenen `.next/`-Build-Artefakten produzierten 20.000+ false-positive-
  Warnings). Lint ist wieder schnell und sauber.

---

## [2026.04.26] — 2026-04-30

**App-Symbol-Plakette für neue Inhalte (Issue #35).**

### Neu

- **PWA-App-Badge**: Das installierte App-Symbol zeigt eine kleine Zahl,
  wenn seit dem letzten Besuch neue Inhalte vorliegen. Drei Kategorien
  zählen je 1: ein neuer Changelog-Eintrag, eine neue
  Ranglistenregatta, eine neue veröffentlichte Rangliste. Das Markieren
  als gesehen passiert automatisch beim Öffnen der jeweiligen Liste
  (`/admin/changelog`, `/regatten`, `/rangliste`).
- Browser-Unterstützung: Chrome/Edge auf Windows/macOS/ChromeOS sowie
  installierte iOS-PWAs ab iOS 16.4. Browser ohne Badging-API
  ignorieren die Aufrufe stillschweigend — keine Funktion geht verloren.
- Server-Endpoint `/api/badge` liefert nur Zeitstempel/Versionen, keine
  Nutzerdaten. Der Vergleich passiert clientseitig in localStorage.

---

## [2026.04.25] — 2026-04-30

**Codebase-Aufräumarbeiten — keine Verhaltensänderungen für End-User.**

### Neu

- **`docs/business-rules.md`**: Single source of truth für die Geschäftsregeln
  (DSV-Formel, Filter-Verhalten, Schottenwechsel-Regel, Import-Flow,
  häufige Fehlerquellen). CLAUDE.md verlinkt darauf — damit kann eine
  neue Session sofort den fachlichen Kontext laden.
- **`calculateRAForResult(f, s, result)`** in `lib/scoring/dsv.ts`:
  zentrale Funktion für die "inStartArea → R_A 0 / DNC → null"-Logik.
  Sowohl die Scoring-Engine als auch die öffentliche Regatta-Detail-
  Anzeige nutzen sie jetzt — kein Drift mehr zwischen den beiden Pfaden.
  4 neue Tests in `dsv.test.ts`.
- **Schema-Sync-Lint**: `npm run db:sync-prod` prüft jetzt vor dem Sync,
  ob JSDoc-Kommentare (`/** … */`) innerhalb von Prisma-Model-Bodies
  stehen — die werden vom Prisma-Parser nicht akzeptiert. Lint blockt
  den Sync mit klarer Fehlermeldung und Schnellfix-Hinweis.

### Aufräum

- **`.gitignore`** ignoriert jetzt `Sailors.txt`, `*.scratch.*` und
  `scratch-*`-Dateien im Repo-Root, die als Diagnose-Artefakte landen
  konnten.

---

## [2026.04.24] — 2026-04-30

**Auto-Fetch der Gesamtteilnehmerzahl aus Manage2Sail.**

### Neu

- **„Aus Manage2Sail abrufen"-Button** im Preview-Schritt des
  Import-Wizards. Auch wenn ein Paste/PDF nur einen Teil der Crews
  enthält (z.B. nur die deutschen einer Auslandsregatta), kann hier
  die echte Anzahl gestarteter Boote direkt aus der M2S-API geholt
  werden — und zwar VOR dem germanOnly-Filter, also die volle Klassen-
  Teilnehmerzahl. URL-Feld wird mit der `sourceUrl` der Regatta
  vorbelegt, falls dort eine M2S-URL steht.
- Neue Server-Action `fetchM2STotalStartersAction(url)` liefert nur
  den Gesamt-Count ohne die Ergebnisse zu re-importieren.

---

## [2026.04.23] — 2026-04-30

**Gesamtteilnehmerzahl im Import-Wizard editierbar.**

### Neu

- **Eingabefeld „Gesamtteilnehmerzahl der Regatta"** im Preview-Schritt
  des Import-Wizards. Der Wert wird automatisch aus dem Parser vorbelegt
  (M2S API zählt vor dem germanOnly-Filter, Paste/PDF zählen ihre eigenen
  Einträge). Bei Auslandsregatten, deren Paste nur die deutschen Crews
  enthält, lässt sich der echte Gesamtwert (z.B. 126) hier vor dem
  Commit eintragen — und wird dann zusammen mit dem Import auf die
  Regatta gespeichert. Default berücksichtigt zudem einen bereits
  manuell gepflegten Wert auf der Regatta, sodass ein Re-Import einen
  vorher gesetzten Wert nicht stillschweigend überschreibt.

---

## [2026.04.22] — 2026-04-30

**Bugfix: öffentliche Regatta-Detail-Seite ignorierte totalStarters.**

### Korrigiert

- **`/regatta/[id]` (Public-Seite) nutzt jetzt totalStarters**: die
  zweite, von der Scoring-Engine unabhängige R_A-Berechnung in der
  Regatta-Detail-Ansicht hat hartcodiert `s = results.length` benutzt
  und damit die manuell gepflegte Gesamtteilnehmerzahl ignoriert.
  Konkret bei Auslandsregatten wie „Carnival Race 2026" (126 Teilnehmer
  insgesamt, 12 importierte Deutsche) lieferte das negative R_A-Werte
  (z.B. −450 für Platz 58 von 12). Jetzt: korrekter Wert via
  `regatta.totalStarters ?? regatta.results.length` — analog zur
  Scoring-Engine. Auch die „Starter s"-Karte oben zeigt jetzt 126.

---

## [2026.04.21] — 2026-04-30

**`s` pro Regatta in der Vorschau sichtbar.**

### Neu

- **Effektive Teilnehmerzahl wird in der Vorschau angezeigt**: in der
  „Einbezogene Regatten"-Aufklappung erscheint pro Regatta jetzt der
  tatsächlich verwendete `s`-Wert. Mit `*` markiert, wenn er aus dem
  manuell gesetzten `totalStarters` der Regatta kommt — sonst aus der
  Anzahl importierter Ergebnisse. Damit lässt sich auf einen Blick
  prüfen, ob die Auslandsregatta-Korrektur tatsächlich in die Berechnung
  einfließt.

### Verifiziert

- 4 neue Unit-Tests in `dsv.test.ts` belegen: `totalStarters` überschreibt
  `results.length`, fällt bei undefined/null korrekt zurück, akzeptiert
  auch unsinnig kleine Werte (Admin-Vertrauen).

---

## [2026.04.20] — 2026-04-29

**Gesamtteilnehmerzahl pro Regatta speichern.**

### Neu

- **`Regatta.totalStarters`-Feld**: pro Regatta wird jetzt die Anzahl
  gestarteter Boote insgesamt gespeichert — inkl. ausländischer Crews,
  die ggf. nicht importiert wurden. Wert kommt automatisch beim Import
  (Paste, PDF und M2S-API liefern ihn jetzt mit), kann manuell im
  Regatta-Formular nachträglich korrigiert werden. SQLite + Postgres-
  Migration.
- **DSV-Scoring nutzt totalStarters**: `s` in der Formel
  R_A = f × 100 × ((s+1−x)/s) verwendet jetzt
  `totalStarters ?? results.length`. Damit ist die Berechnung auch bei
  Auslandsregatten korrekt, bei denen aus Sailor-DB-Hygiene-Gründen
  nur die deutschen Boote importiert wurden.
- **Regatta-Formular** erhält neues Feld „Gestartete Boote (s)" mit
  Hinweis-Text. Leer = automatisch aus Anzahl importierter Ergebnisse.

---

## [2026.04.19] — 2026-04-29

**Beta-Hinweis-Banner auf Public-Seiten (Issue #34).**

### Neu

- **Sichtbarer Hinweis** auf allen öffentlichen Seiten (Startseite,
  Ranglisten, Regatten, Detail-Seiten): „Diese App ist noch in der
  Entwicklung. Die angezeigten Ranglisten können fehlerhaft oder
  unvollständig sein und sind nicht als verbindliche Ergebnisse zu
  betrachten." Banner ist amber, mit Warn-Icon, direkt unter dem
  Header positioniert. Bewusst nicht ausblendbar, solange wir noch
  in der Beta-Phase sind. Admin-Bereich bleibt unberührt.

---

## [2026.04.18] — 2026-04-29

**Bugfix: IDJM-Quali zählt jetzt korrekt alle gestarteten Boote in s.**

### Korrigiert

- **IDJM-Quali R_A-Verzerrung**: Das `idjm-quali.ts`-Modul filterte vorher
  die Regatta-Ergebnisse nach Altersklasse, BEVOR die DSV-Berechnung lief.
  Damit war `s` (Gesamtteilnehmerzahl) für IDJM-Berechnungen die
  *gefilterte* Anzahl statt der tatsächlichen Starter — die R_A-Werte
  wurden dadurch teils massiv überschätzt. Jetzt delegiert IDJM die
  per-Regatta-Altersprüfung an `calculateDsvRanking` über das neue
  `useRegattaDateForAge`-Flag, sodass `s` unverändert die
  Gesamtteilnehmerzahl bleibt — auch bei Auslandsregatten und auch
  wenn ein Großteil der Crews die Altersgrenze nicht erfüllt.
- 2 neue Unit-Tests in `idjm-quali.test.ts` verifizieren konkret, dass
  `s = Anzahl aller Boote` ist und `R_A` mit der echten Teilnehmerzahl
  berechnet wird.

---

## [2026.04.17] — 2026-04-29

**JWM/JEM-Schottenwechsel-Regel umgesetzt.**

### Geändert

- **JWM/JEM-Quali wertet Helm + Crew als Team**: Pro Helm ist nur ein
  einziger genehmigter Schottenwechsel zulässig. Ungenehmigte oder
  weitere Wechsel starten ein neues Team (eigene Zeile in der
  Quali-Rangliste).
  - `lib/scoring/jwm-jem-quali.ts`: chronologische Partitionierung der
    Helm-Einträge in Teams. Jedes Team trackt seine akzeptierten
    Crew-IDs und ob die 1×-Swap-Erlaubnis verbraucht ist.
  - `JwmJemRow` und `JwmJemDisplayRow` erhalten neuen `teamKey` (für
    React-Keys, da ein Helm jetzt mehrere Zeilen haben kann),
    `crewIds` (Crews dieses Teams) und `splitFromSwap`-Flag.
  - UI (Admin + Public): Tabelle nutzt `teamKey` als Key und zeigt
    Crew-Namen + „neues Team"-Badge bei gesplitteten Teams.
  - 6 neue Unit-Tests: stabile Crew, ungenehmigter Wechsel, genehmigter
    Wechsel, zweiter Wechsel, Rückkehr zur Original-Crew, eindeutige
    teamKeys.

---

## [2026.04.16] — 2026-04-29

**Schottenwechsel-Toggle in Regatta-Detail (Issue #11).**

### Neu

- **Schottenwechsel-Toggle**: in der Regatta-Detail-Tabelle erscheint
  jetzt neben jedem Crew-Eintrag ein kleines ↻-Icon. Klick öffnet ein
  Popover mit „Genehmigt"-Checkbox + optionalem Notizfeld. Der Status
  ist pro TeamEntry gespeichert (`crewSwapApproved`, `crewSwapNote`).
  Hinweis im Popover: das Flag wirkt sich nur auf JWM/JEM-Quali aus,
  nicht auf DSV-/Aktuelle-/IDJM-Ranglisten.

---

## [2026.04.15] — 2026-04-29

**Bugfix: OAuth-Buttons werden auf Vercel nicht angezeigt (Issue #33).**

### Korrigiert

- **Login-Page nicht mehr statisch generiert**: ohne explizites
  `dynamic`-Flag prerenderte Next.js die Login-Seite zur Build-Zeit
  und las dabei Env-Vars aus dem Build-Container statt aus dem
  Vercel-Runtime. OAuth-Buttons fehlten dadurch dauerhaft, auch
  wenn `GOOGLE_CLIENT_ID`/`SECRET` & Co. im Vercel-Dashboard
  nachträglich gesetzt wurden. Fix:
  `export const dynamic = "force-dynamic"` zwingt Per-Request-Rendering
  → Env-Var-Änderungen wirken sofort, ohne Re-Deploy.
- **`auth-providers.ts` refaktoriert**: Provider-Liste und
  Display-Metadaten werden jetzt in einem einzigen Pass aufgebaut,
  statt die `id` zur Laufzeit aus dem Provider-Objekt zu extrahieren.
  Robust gegen die unterschiedlichen Rückgabetypen, die NextAuth-v5-
  Provider-Helfer zurückgeben können.

---

## [2026.04.14] — 2026-04-29

**E-Mail-Konfiguration über das Webinterface (Issue #32).**

### Neu

- **SMTP-Konfiguration via Admin-UI**: neue Seite `/admin/mail` mit
  Formular für Host, Port, Login, Passwort und Absenderadresse. Werte
  werden in der Datenbank persistiert (Singleton-Tabelle `MailConfig`)
  und überschreiben dann die `SMTP_*`-Env-Variablen, sobald „Aktivieren"
  gesetzt ist. So lassen sich Zugänge ändern, ohne dass die App neu
  deployed werden muss.
- **Test-Mail-Button**: schickt sofort eine Test-Mail mit den im
  Formular eingetragenen Werten — auch ohne vorher zu speichern. So
  prüft man Host/Port/Login bevor man committed.
- **Status-Banner** auf der Seite zeigt, ob aktuell die DB-Konfig
  greift, ein Env-Fallback aktiv ist oder gar nichts konfiguriert ist.
- Wartung-Seite verlinkt auf die Mail-Konfiguration als Sub-Sektion.

### Geändert

- `lib/mail/send.ts` resolved jetzt die Konfiguration pro Aufruf:
  zuerst DB (wenn `enabled` und Host gesetzt), sonst Env-Vars, sonst
  Konsolen-Log. `isMailConfigured()` ist daher jetzt async — Aufrufer
  in `lib/actions/account.ts` entsprechend angepasst.

---

## [2026.04.13] — 2026-04-29

**Crew-Namen in den Ranglisten anzeigen (Issue #31).**

### Neu

- **Crew-Namen in jeder Rangliste**: jede Zeile zeigt jetzt unter dem
  Steuermann die Crew-Namen, mit denen er in der Saison gesegelt ist.
  Bei nur einer Crew steht der volle Name, bei zwei Crews beide,
  ab drei Crews der häufigste + „+N weitere". Hover zeigt alle
  vollständig. Funktioniert in der öffentlichen Rangliste, in der
  Admin-Vorschau, im Speichern-Dialog und in JWM/JEM-Quali-Tabellen.
  Bei PDF-Imports ohne Crew-Information bleibt die Zeile schlank
  (kein leeres Crew-Label).

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
