# Changelog

Alle nennenswerten Änderungen an der 420er-Ranglistenverwaltung.

Format orientiert sich an [Keep a Changelog](https://keepachangelog.com/de/1.1.0/).
Versionierung folgt [Calendar Versioning](https://calver.org/) im Format **JJJJ.MM.N**
(Jahr.Monat.laufende Nummer im Monat) ab Version 2026.04.1.

---

## [2026.05.55] — 2026-05-05

**Suchfeld in den Ranglisten zeigt nur noch ein Löschkreuz.**

### Korrigiert

- Im Suchfeld auf den Ranglisten-Detailseiten erschienen unter
  Chrome/Safari/Edge zwei Löschkreuze nebeneinander: das eigene
  ✕-Icon der Komponente und zusätzlich das vom Browser eingebaute
  Clear-Symbol bei `<input type="search">`. Die nativen Buttons
  werden jetzt global per CSS ausgeblendet — die Custom-Buttons
  bleiben erhalten.

---

## [2026.05.54] — 2026-05-05

**JWM/JEM-Quali: bis zu 4 Regatten auswählbar.**

### Korrigiert

- Beim Speichern und Berechnen einer JWM/JEM-Qualifikationsrangliste
  warf die Server-Action mit „Maximal 3 Regatten können ausgewählt
  werden" ab. Limit auf 4 Regatten angehoben (Compute-Action und
  Save-Action). Die Wertung bleibt unverändert: weiterhin werden die
  **2 besten gewichteten Platzierungen** addiert.
- UI-Texte, Onboarding-Tour und Hilfe-Seite passen jetzt durchgängig
  zur neuen Obergrenze.

---

## [2026.05.53] — 2026-05-05

**Neuer PDF-Parser für englische Velaware-Exporte.**

### Neu

- PDF-Import erkennt jetzt auch Velaware-Ergebnislisten mit englischen
  Spaltenüberschriften (`Rank | nat | sailno | Helmsman | Crew |
  birthdate | m/f | club | R1…Rn | Netto`). Solche Listen tauchen z. B.
  bei Regatten in Italien („5 Lupo Cup 420" / Circolo Vela Torbole) auf
  und scheiterten bisher mit „Keine Ergebnisse im PDF gefunden", weil
  der Auto-Detect nur die italienische Variante (Stichwort `Punti`)
  kannte.
- Nationalitäts-Filter zieht aus der separaten `nat`-Spalte deutsche
  Crews heraus; ausländische Teilnehmer zählen weiter in `s` für die
  DSV-Formel (siehe `docs/business-rules.md` §3.4).

### Bekannt

- Sonderzeichen in Club-Namen aus betroffenen PDFs erscheinen teils
  doppelt encodiert (z. B. `Grünau` → `GrÃ¼nau`). Tracked in
  Issue #66.

---

## [2026.05.52] — 2026-05-05

**Mobile-Empty-States kein horizontales Scrollen mehr.**

### Korrigiert

- Auf schmalen Viewports (<= 375px) wurden Empty-State-Texte in
  Tabellen mit fester Mindestbreite abgeschnitten und erforderten
  horizontales Scrollen. Empty-States werden jetzt ausserhalb der
  Tabelle als eigene Card gerendert. Betrifft:
  - `app/(public)/regatten/page.tsx`
  - `app/(public)/rangliste/[id]/regatten/page.tsx`
  - `app/(public)/regatta/[id]/page.tsx`
  - `app/admin/segler/page.tsx`
  - `app/admin/ranglisten/neu/page.tsx`
  - `components/admin/regatta-table-sync.tsx`
- `prisma/seed.ts` laedt jetzt `dotenv/config`, damit
  `npm run db:seed` in frischen Worktrees zuverlaessig den richtigen
  Driver-Adapter waehlt (sonst war `DATABASE_URL` undefiniert und der
  Seed lief in den pg-Adapter statt sqlite).

---

## [2026.05.51] — 2026-05-05

**Prisma 6 -> 7 mit Driver-Adapter (Schritt 2 von 2).**

### Geaendert

- **Issue #63 (PR 2/2)**: Prisma-ORM auf 7.8 gehoben — Abschluss
  der zweiteiligen Migration.
- **Generator-Wechsel** auf `prisma-client` (Pflicht in v7;
  `prisma-client-js` wird in zukuenftigen Versionen entfernt).
  Output landet jetzt im Source-Tree unter `generated/prisma`
  (gitignored, regeneriert per `prisma generate`).
- **Driver-Adapter** (Pflicht in v7):
  - `@prisma/adapter-better-sqlite3` + `better-sqlite3` fuer
    lokal/E2E
  - `@prisma/adapter-pg` + `pg` fuer Vercel/Neon
  - `lib/db/client.ts` waehlt den Adapter automatisch anhand des
    `DATABASE_URL`-Schemas
- **Konfig-Konsolidierung**: `datasource.url` (war im Schema)
  und `package.json#prisma`-Block (Seed-Hook) wandern in eine
  neue `prisma.config.ts` am Projektroot. `dotenv` ist neue
  Dep, weil die Config das `.env` explizit laedt.
- **Imports** in 5 Dateien (`lib/db/client.ts`, `prisma/seed.ts`,
  `e2e/global-setup.ts`, `components/sailor-form.tsx`,
  `components/regatta-form.tsx`) auf den neuen Pfad
  `@/generated/prisma/client` umgestellt.
- **`scripts/sync-prod-schema.mjs`** zieht den neuen Generator-
  Block + die schlanke Datasource fuer `prisma/prod/schema.prisma`
  mit.
- **`e2e/global-setup.ts`**: `datasourceUrl`-Option des
  PrismaClient ist in v7 entfallen — stattdessen explizit
  `PrismaBetterSqlite3`-Adapter mit `TEST_DB_URL`.

### Verifikation

- `npm run lint && typecheck && test` (321 Tests) gruen.
- `npm run build` (Next.js + Turbopack) lokal erfolgreich.
- Vercel-Sanity-Check ist Pflicht — bei kaputter Adapter-
  Konfiguration ist die Prod-DB unerreichbar. Rollback auf
  v2026.05.50 (Prisma 6) ohne DB-Migration moeglich.

---

## [2026.05.50] — 2026-05-05

**Prisma 5 -> 6 (Schritt 1 von 2).**

### Geaendert

- **Issue #63 (PR 1/2)**: Prisma-ORM von 5.22 auf 6.19.3 gehoben.
  Drop-in-Bump fuer unser Schema — keine Daten-Migration und
  keine Code-Aenderungen noetig:
  - Kein `Bytes`-Feld im Schema (kein `Buffer`/`Uint8Array`-Wechsel)
  - Keine `$use`-Middleware (keine Client-Extensions noetig)
  - Keine impliziten m-n-Relationen (alle Junction-Tables wie
    `RankingRegatta` haben explizite `@@id` — daher kein
    PG-Primary-Key-Auto-Migration-Fall)
  - Keine `findUniqueOrThrow`/`findFirstOrThrow`-Aufrufe
    (kein `P2025`-Catch-Update noetig)
  - Keine reservierten Modellnamen (`async`/`await`/`using`)
- Beide Schemas (`prisma/schema.prisma` SQLite,
  `prisma/prod/schema.prisma` PostgreSQL) generieren ohne Drift.

### Hinweis

Prisma 6 zeigt eine Deprecation-Warnung fuer den
`package.json#prisma`-Block (Seed-Hook). Der wird mit Schritt 6 -> 7
nach `prisma.config.ts` umziehen — separate Migration, nicht in
diesem Release.

---

## [2026.05.49] — 2026-05-05

**Passkey-Library auf Stand 13.x.**

### Geaendert

- **Issue #64**: Major-Bump der WebAuthn-Library
  `@simplewebauthn/browser` und `/server` von 9.x auf 13.x.
  `@simplewebauthn/types` ist mit v13 deprecated und wurde
  entfernt — die Types kommen jetzt direkt aus den
  `browser`/`server`-Paketen.
- **API-Umstellungen** (v10–v13 Breaking Changes):
  - `startAuthentication` / `startRegistration` werden mit
    `{ optionsJSON: options }` aufgerufen (v10).
  - `generateRegistrationOptions.userID` ist BufferSource statt
    String — Konvertierung via `TextEncoder` (v10).
  - `excludeCredentials/allowCredentials.id` sind Base64URL-
    Strings statt `Uint8Array` (v10).
  - `verifyRegistrationResponse` liefert ein
    `registrationInfo.credential`-Sub-Objekt (v11) — die
    flachen Felder `credentialID`/`credentialPublicKey`/
    `counter` sind weg.
  - `verifyAuthenticationResponse`-Parameter heisst jetzt
    `credential` (Typ `WebAuthnCredential`) statt
    `authenticator` (v11).
- **DB-Schema unveraendert.** Bestehende Passkeys in der
  `WebAuthnCredential`-Tabelle bleiben kompatibel: `credentialId`
  (Base64URL-String), `publicKey` (Base64URL), `counter`
  (BigInt), `transports` (JSON-Array) passen ohne Migration zur
  neuen API.

### Hinweis

`next-auth` v5-beta listet `@simplewebauthn` 9.x als peer-dep —
wird via `.npmrc legacy-peer-deps` toleriert. Wir nutzen den
WebAuthn-Provider von next-auth nicht (eigener Stack unter
`app/api/webauthn/*`), daher kein Runtime-Konflikt.

### Verifikation

Manueller Passkey-Roundtrip (Register + Login) pro Browser/
Authenticator-Setup ist Pflicht — nicht via Unit/E2E-Tests
abdeckbar.

---

## [2026.05.48] — 2026-05-05

**Import-Robustheit & E2E-Stabilitaet.**

### Korrigiert

- **Issue #65**: `parseName` im Manage2Sail-Paste-Parser
  (`lib/import/manage2sail-paste.ts`) behandelte Single-Letter-
  Initialen ("A", "M") und Initialen mit Punkt ("A.") als Anfang
  des Nachnamens, weil sie die all-caps-Bedingung erfuellen.
  Resultat: "Eckhard A. SCHMIDT" wurde zu Vorname "Eckhard" +
  Nachname "A. SCHMIDT". Jetzt: Worte mit < 2 Buchstaben werden
  als Vornamen-Abkuerzungen uebersprungen — bestehende Faelle
  (hyphenated firstName, Nobiliar-Partikel `VON`/`VAN`,
  mehrteilige Nachnamen) bleiben unveraendert.
- **Issue #62**: `e2e/ranking.spec.ts:75` schlug reproduzierbar
  fehl, weil das `MissingBirthYearBadge` ("ohne Jahrgang") seit
  Issue #52 inline neben dem Namen rendert und der
  exact-Cell-Match dadurch brach. `exact: true` entfernt,
  konsistent zur Admin-Preview-Erwartung in derselben Datei.

### Neu

- 7 dedizierte `parseName`-Edge-Case-Tests in
  `lib/import/__tests__/manage2sail-paste.test.ts`
  (Issue #65). `parseName` ist jetzt exportiert.

---

## [2026.05.47] — 2026-05-05

**inStartArea-Heuristik vereinheitlicht.**

### Geaendert

- **Issue #60**: Die "Boot kam ins Startgebiet"-Heuristik fuer den
  Import-Wizard war an vier Stellen mit drei verschiedenen Code-Sets
  definiert (`{DNS,BFD,OCS,UFD}` in pdf-utils, `{DNS,BFD,OCS}` in den
  Manage2Sail-Parsern und im Wizard-UI). Effektiv wirksam war nur die
  Wizard-Stelle, weil die Parser-Suggestion ein totes Feld war.
- Single source of truth: `IN_START_AREA_CODES` in
  `lib/import/pdf-utils.ts` mit `{DNS, OCS, BFD, UFD}` (Option B
  nach Pro/Kontra-Diskussion). Alle Parser und der Wizard
  importieren von dort.
- **UFD ist neu im Default-Vorschlag** — bisher zeigte der Wizard
  fuer UFD-Eintraege kein vorbelegtes Haekchen, obwohl UFD per
  RRS A11 semantisch zu BFD gehoert (Frühstart-DSQ).
- Persistierte Daten bleiben unveraendert — die Aenderung wirkt
  nur auf zukuenftige Importe.

### Neu

- `docs/business-rules.md` §2.1 listet jetzt die Code-Tabelle
  explizit (welcher Code → welcher Default → kurze RRS-Begruendung).
- `lib/import/__tests__/detect-in-start-area.test.ts` mit 14 Tests
  fuer die Single-Source-Helper (alle 4 In-Start-Codes, alle
  abgegrenzten Codes, Edge-Cases inkl. case-insensitive Matching).

---

## [2026.05.46] — 2026-05-05

**Rate-Limit serverless-tauglich (DB-basiert).**

### Geaendert

- **Issue #59**: Der Login-Pre-Check-Rate-Limiter
  (`lib/security/rate-limit.ts`) wurde von einer In-Memory-Map auf
  eine `RateLimitEntry`-Tabelle in der DB umgebaut. Auf Vercel
  haben parallele Lambda-Instanzen und Cold-Starts vorher zu
  effektiv `n × maxRequests` Versuchen gefuehrt — jetzt sieht jede
  Instanz denselben Counter.
- Lazy-Cleanup: Eintraege ohne aktuelle Timestamps werden beim
  naechsten Lesen verworfen. Zusatz-Helper
  `purgeStaleRateLimitEntries(maxAgeMs)` steht fuer einen optionalen
  Cron-Cleanup bereit, ist aber bei aktuellem Volumen nicht noetig.
- Per-User-DB-Lockout (10 Failures -> 30 min) bleibt unveraendert
  und ist weiterhin der primaere Brute-Force-Schutz.

---

## [2026.05.45] — 2026-05-05

**E2E-Test-Coverage erweitert.**

### Neu

- **Issue #61**: Zwei neue Playwright-Spec-Files:
  - `e2e/segler.spec.ts` — Sailor-CRUD (Anlegen, Bearbeiten, Liste filtern)
  - `e2e/zz-jwm-jem.spec.ts` — JWM/JEM-Quali Compute + Save mit
    Schottenwechsel-Schutz. Datei-Praefix `zz-` erzwingt
    Ausfuehrung nach `ranking.spec.ts`, damit dessen
    Entwurf-Toggle-Test nicht durch zusaetzliche Drafts gestoert wird.

### Korrigiert

- `auth.setup.ts` haertet die Setup-Phase: Changelog-Popup und Tour-
  Overlay werden vor dem `storageState`-Snapshot dismissed. Bisher
  blockierten beide alle Klicks auf `/admin/*`, sodass jeder neue
  Changelog-Eintrag die ganze Suite kippte.
- `import.spec.ts` matchte den Wizard-"Weiter"-Button via Substring,
  was seit dem Page-Tour-Feature einen zweiten "Weiter"-Button traf
  (strict-mode violation). Jetzt mit Pfeil-Suffix eingeschraenkt.
- `ranking.spec.ts` Publish-Toggle suchte den "Entwurf"-Button ohne
  `exact: true` und matchte deshalb auch den Duplizieren-Button
  ("Duplizieren — als neuer Entwurf"). Jetzt strict.

---

## [2026.05.44] — 2026-05-05

**Sicherheits-Update: nodemailer 7 → 8 (SMTP-Injection-Patch).**

### Geaendert

- **Issue #58**: nodemailer auf `^8.0.7` angehoben. Schliesst die
  CRLF-SMTP-Command-Injection-CVE (GHSA-vvjj-xcjg-gr5g, CVSS 4.9) und
  den `envelope.size`-Sanitization-Bug (GHSA-c7w3-x93f-qmm8). Einziger
  Breaking Change in v8 ist `'NoAuth'` → `'ENOAUTH'`-Fehlercode — wir
  matchen den String nirgends, sonst keine Code-Aenderung noetig.
  next-auth meldet eine peerOptional-Warnung (will `^7.0.7`), nutzt
  nodemailer aber nur fuer den nicht aktivierten Email-Provider.

---

## [2026.05.43] — 2026-05-05

**Senior-Code-Review: Korrektheit, Doku-Drift und tote Pfade.**

### Korrigiert

- **Issue #55**: `totalStarters` wurde beim PDF-Import von Auslandsregatten
  faelschlicherweise nach dem GER-Filter gezaehlt, sodass `s` in der
  DSV-Formel zu klein war (R-Werte zu hoch). `filterGerman` in
  `lib/import/pdf-auto-detect.ts` zaehlt jetzt **vor** dem Filter.
  Pre-Filter-Verhalten ist durch zwei neue Unit-Tests abgesichert.
- **Issue #54**: `BadgeState`-Test-Fixtures hatten die in v2026.05.40
  ergaenzten Felder (`latestRegattaId/Name`, `latestRankingId/Name`)
  nicht. `npm run typecheck` ist wieder grün — bisher haette
  `next build` auf Vercel an dieser Stelle abgebrochen.

### Geaendert

- **Issue #56**: Toten `useRegattaDateForAge`-Schalter aus
  `DsvRankingInput` und `calculateDsvRanking` entfernt. Der Schalter
  wurde von keinem Aufrufer mehr gesetzt; `idjm-quali.ts` nutzt schon
  laenger korrekt den Saisonstichtag (`referenceDate`). Begleitende
  Doku-Drift in `docs/architecture.md` korrigiert.
- **Issue #57**: README aktualisiert auf die aktuelle Schema-
  Verzeichnisstruktur (`prisma/prod/schema.prisma` statt
  `prisma/schema.prod.prisma`), inkl. korrekter npm-Scripts
  (`db:sync-prod`, `db:generate:prod`, `db:migrate:prod`) und
  `vercel-build`-Pipeline.
- `scripts/gitea-issue.mjs` um `create`-Subcommand erweitert.

---

## [2026.05.42] — 2026-05-05

**Update-Glocke nur fuer angemeldete Benutzer.**

### Geaendert

- Die App-Update-Markierung in der Glocke (und im OS-AppBadge)
  erscheint nur noch, wenn man angemeldet ist — anonyme Visitors
  haben keinen Zugriff auf /admin/changelog, und ein Klick fuehrte
  sie bisher in die Login-Wand. Inhalts-Updates (neue Rangliste,
  neue Regatta) bleiben fuer alle sichtbar.
- Technisch: /api/badge liefert latestChangelogVersion nur an
  authentifizierte Sessions. unreadItems() und countNew() springen
  fuer die changelog-Kategorie damit nur dann an, wenn der Server
  sie auch ausgeliefert hat.

---

## [2026.05.41] — 2026-05-04

**Glocke: schneller frischer Stand + verschwindet beim Klick.**

### Korrigiert

- Die Glocke (Update-Indicator) reagierte bisher nicht auf
  Navigation: nach Klick auf einen Eintrag oeffnete sich zwar die
  Detailseite, die Glocke blieb aber sichtbar — ihr seen-Status
  wurde nur vom OS-AppBadge im selben Tab fortgeschrieben, der
  Storage-Event davon erreicht den eigenen Tab aber nicht. Jetzt
  schreibt die Glocke selbst den seen-Status mit (gleicher
  localStorage-Key wie der OS-Badge), sodass sie nach Klick
  wirklich verschwindet.
- Der Poll-Intervall ist von 5 Minuten auf 60 Sekunden verkuerzt —
  damit erscheint die Glocke nach dem Veroeffentlichen einer
  Rangliste auch ohne aktiven Push-Abo deutlich schneller. Mit
  aktivem Push ist sie weiterhin sofort da (Service-Worker-
  postMessage-Trigger bleibt unveraendert).

---

## [2026.05.40] — 2026-05-04

**Glocke springt sofort an, sobald eine Push-Notification eingeht.**

### Geaendert

- Sobald eine Push-Notification beim Browser ankommt, schickt der
  Service Worker jetzt eine postMessage-Nachricht an alle offenen
  Tabs. Der **Update-Indicator (Glocke)** und der **OS-AppBadge**
  reagieren darauf und ziehen sofort den frischen Badge-State von
  /api/badge — ohne auf den 5-Minuten-Poll zu warten. So sieht man
  bei einem offenen Browser-Tab unmittelbar, dass es eine neue
  Rangliste oder ein App-Update gibt, auch wenn man die Notification
  gar nicht anklickt.

---

## [2026.05.39] — 2026-05-04

**App-Update-Push nur an angemeldete Benutzer.**

### Geaendert

- **App-Update-Notifications** ("App aktualisiert — Neue Version X
  ist aktiv") gehen ab sofort nur noch an Push-Subscriptions, die mit
  einer angemeldeten Sitzung verknuepft sind (Admins/Editors).
  Public-Visitors mit Push-Abo bekommen weiterhin "Neue Rangliste
  verfuegbar"-Pushes — das ist Inhalt, der sie interessiert — aber
  kein Versions-Spam mehr, der sie auf den Admin-Changelog wirft.
- Beim Aufruf der Einstellungs-Seite mit aktiver Sitzung wird die
  vorhandene Browser-Subscription nachtraeglich an den Benutzer
  gebunden, sodass auch Bestands-Subscriptions ohne erneutes
  Aktivieren wieder Update-Pushes erhalten.

### Migration

- Schema: PushSubscription.userId (nullable, FK auf User mit
  onDelete: SetNull). Bestehende anonyme Subscriptions bleiben
  erhalten und werden korrekt als "nur Inhalt"-Empfaenger behandelt.
  Dev: 20260504200029_add_user_to_push_subscription.
  Prod: 10_push_subscription_user (ALTER TABLE ADD COLUMN IF NOT
  EXISTS, kein Datenverlust).

---

## [2026.05.38] — 2026-05-04

**Push-Banner aus dem Public-Bereich entfernt.**

### Entfernt

- Der dezente "Bei neuen Ranglisten benachrichtigt werden?
  [Aktivieren] [x]"-Banner unter dem Header ist weg — Push-Aktivierung
  laeuft jetzt vollstaendig ueber **Einstellungen → Darstellung und
  Benachrichtigungen** (das Zahnrad-Icon im Header). Das nimmt Druck
  aus der ersten Bildschirmzeile und macht den Aktivierungs-Schritt
  zu einer bewussten Aktion auf der Einstellungs-Seite, statt eines
  wegklickbaren Pop-ups.

---

## [2026.05.37] — 2026-05-04

**Oeffentliche Einstellungs-Seite mit Darstellung und Push.**

### Neu

- Neue Seite /einstellungen im oeffentlichen Bereich mit dem
  Abschnitt **Darstellung und Benachrichtigungen**: Theme-Picker
  (Hell / Dunkel / Auto) und ein dauerhafter Aktivieren / Abbestellen-
  Button fuer Push-Benachrichtigungen. So laesst sich Push auch nach
  Banner-Dismiss jederzeit wieder einschalten — und auf iPhone/iPad
  ohne PWA bekommst du einen klaren Hinweis, was zu tun ist.

### Geaendert

- Im Public-Header wurde der dreistufige Theme-Cycle-Button durch
  ein dezentes Zahnrad-Icon ersetzt — Klick oeffnet die
  Einstellungs-Seite, dort gibt es das volle Hell/Dunkel/Auto-Panel.

---

## [2026.05.36] — 2026-05-04

**Update-Indicator im Header + Push-Klick navigiert zum Ziel.**

### Neu

- **Update-Indicator im Header:** Sobald es eine neue oeffentliche
  Rangliste, eine neue Regatta oder ein App-Update gibt, erscheint
  im Kopf der App eine kleine Glocke mit rotem Dot. Klick fuehrt
  direkt zum Ziel — bei einem einzigen unread-Eintrag oeffnet sich
  sofort die Detailseite, bei mehreren ein kleines Popover mit Liste.
  Der "gesehen"-Status ist mit dem bestehenden App-Badge synchron.

### Geaendert

- **Push-Klick wiederverwendet bestehende Tabs:** wer eine
  Push-Notification anklickt, waehrend die App schon offen ist,
  landet jetzt im vorhandenen Tab auf der Ziel-Seite (neue Rangliste
  oder Changelog) — vorher oeffnete sich ein zweiter Tab.
  Service-Worker-Handler probiert jetzt zuerst Focus + Navigate,
  faellt nur als letzter Schritt auf openWindow zurueck.

---

## [2026.05.35] — 2026-05-04

**Push-Aktivierung auf der Konto-Seite + Liste aktualisiert sich nach Duplizieren/Loeschen.**

### Neu

- Auf der Konto-Seite gibt es einen neuen Abschnitt
  "Push-Benachrichtigungen" — auch wer den Banner mit "Nicht jetzt"
  weggeklickt hat, kann von dort aus jederzeit wieder aktivieren oder
  abbestellen. Auf iPhone/iPad ohne installierte PWA erscheint statt
  der Schaltflaeche eine Schritt-fuer-Schritt-Anleitung zum
  Hinzufuegen zum Home-Bildschirm; bei blockierter Browser-Berechtigung
  ein Hinweis zum Zuruecksetzen.

### Korrigiert

- **Ranglisten-Liste aktualisiert sich nach Duplizieren oder Loeschen
  sofort.** Vorher behielt das Admin-Listing wegen cached Local-State
  den Stand vor der Aenderung — man musste die Seite manuell neu
  laden. Jetzt synchronisiert die Sortable-Liste zuverlaessig mit den
  Server-Daten nach jedem router.refresh() (Derived-State-Pattern).

---

## [2026.05.34] — 2026-05-04

**Logos auch offline verfuegbar.**

### Korrigiert

- Der Service-Worker-Cache hat das 420er-Logo bisher nicht erfasst,
  weil Next.js es ueber die Bild-Optimierungs-Pipeline
  (`/_next/image?url=…`) ausliefert und der SW-Filter nur Pfade mit
  den Endungen `.png`/`.svg` usw. erkannt hat. Im Offline-Modus
  wurde das Logo dadurch nicht angezeigt, obwohl die Seite selbst
  aus dem Cache kam. Jetzt erfasst der SW auch saemtliche
  `/_next/image`-Anfragen (Stale-While-Revalidate), sodass das Logo
  nach dem ersten Online-Aufruf einer beliebigen oeffentlichen Seite
  dauerhaft offline verfuegbar bleibt.

---

## [2026.05.33] — 2026-05-04

**Rangliste duplizieren.**

### Neu

- Im Admin-Listing der Ranglisten gibt es einen neuen Kopier-Button
  (zwischen Bearbeiten und Umbenennen). Klick erzeugt einen Klon
  der Rangliste mit Suffix "(Kopie)" direkt unter dem Original —
  alle Parameter (Typ, Saison, Altersklasse, Gender, Scoring-Unit)
  und die verknuepften Regatten werden 1:1 uebernommen, der Klon
  ist immer ein Entwurf (nicht oeffentlich). Praktisch, um z. B.
  die letztjaehrige Jahresrangliste als Vorlage fuer die neue
  Saison zu nutzen — danach nur noch Saison/Datum anpassen und
  neu berechnen.

---

## [2026.05.32] — 2026-05-04

**Offline-Lesen fuer die oeffentliche App.**

### Neu

- **Offline-Modus fuer Ranglisten und Regatten:** Die oeffentliche App
  funktioniert jetzt auch ohne Netz. Beim ersten Online-Besuch werden
  im Hintergrund alle veroeffentlichten Ranglisten, Regatta-Detailseiten
  und alle Steuermann-Detailseiten aus diesen Ranglisten in den lokalen
  Cache geladen — danach sind sie auch ohne Verbindung erreichbar,
  ideal am Regatta-Ort mit schwachem LTE. Wer trotzdem auf eine bisher
  nicht erfasste Seite navigiert, sieht eine kurze Offline-Hinweisseite.
  Admin-Bereich, Auth und API werden bewusst NICHT gecacht — dort
  braucht es stets Live-Daten und gueltige Sessions. Realisiert als
  Erweiterung des bestehenden Service Workers (public/sw.js) plus
  /api/offline-manifest fuer die Liste der zu cachenden URLs;
  Push-Benachrichtigungen bleiben unveraendert.

---

## [2026.05.31] — 2026-05-04

**Detail-Seite auch fuer Segler im "Noch nicht in der Wertung"-Block.**

### Neu

- Segler, die in der Hauptrangliste noch fehlen, weil sie unter der
  DSV-Mindestschwelle von 9 Wertungen liegen, sind jetzt auf der
  Ranglisten-Detailseite ebenfalls verlinkt. Klick auf den Namen
  (oder den Pfeil rechts in der Zeile) oeffnet die gleiche
  Detail-Ansicht wie fuer gewertete Segler — mit allen bisherigen
  R_A-Werten, Crew-Historie und Regatta-Details. Statt Rang/R steht
  oben ein orangefarbenes Badge "Noch nicht in der Wertung" und im
  Kopf der Wertungs-Fortschritt (z. B. 5 / 9), damit Trainer und
  Segler sehen, wie viele Wertungen noch fehlen.

---

## [2026.05.30] — 2026-05-04

**Manuell vergebene Platzierungen werden nicht mehr ueberschrieben.**

### Korrigiert

- Wenn der Admin auf der Regatta-Detailseite einen Eintrag mit
  manueller Platzierung anlegt, blieb dieser Rang bisher zwar beim
  Speichern erhalten — sobald aber ein anderer Eintrag derselben
  Regatta editiert wurde, lief das Auto-Reranking ueber alle
  Eintraege und ueberschrieb auch die manuell gesetzte Platzierung.
  Jetzt schuetzt ein neues Schema-Feld `Result.isRankManual` den
  Rang dauerhaft: beim Auto-Reranking werden manuell vergebene
  Slots uebersprungen, die anderen Eintraege bekommen automatisch
  die freien Plaetze.

### Geaendert

- Im "Eintrag bearbeiten"-Dialog ist das Rang-Feld nur noch dann
  vorbelegt, wenn die Platzierung tatsaechlich als manuell
  markiert ist. Bei automatisch berechneten Plaetzen bleibt das
  Feld leer (Placeholder "leer = automatisch") — so kippt ein
  einfaches Speichern ohne Aenderung den Rang nicht versehentlich
  auf manuell.

### Migration

- Schema-Aenderung: `Result.isRankManual: Boolean @default(false)`.
  Dev-Migration: 20260504151907_add_is_rank_manual_to_result.
  Prod-Migration: 9_result_is_rank_manual (ALTER TABLE ADD COLUMN
  IF NOT EXISTS, default false). Bestehende Eintraege erhalten
  automatisch false und werden weiterhin auto-gerankt.

---

## [2026.05.29] — 2026-05-04

**Saison-Anzeige korrigiert · iOS-Push-Hinweis im Handbuch.**

### Korrigiert

- **Saison-Anzeige im Detailheader:** Bei JWM/JEM-Quali wurde
  faelschlich das Jahr der ersten ausgewaehlten Quali-Regatta als
  "Saison" angezeigt — bei einer Quali fuer 2026, deren erste Regatta
  im Dezember 2025 lag, stand also "Saison 2025" im Header. Jetzt
  wird das Jahr aus dem Stichtag (seasonEnd) abgeleitet. Betrifft
  sowohl die DSV/IDJM-Detailseite als auch JWM/JEM-Quali.

### Geaendert

- **Handbuch um iOS-Push-Hinweis ergaenzt:** Im Kapitel
  "Push-Benachrichtigungen" stehen jetzt die iOS-spezifischen
  Voraussetzungen: Web-Push funktioniert auf iPhone/iPad nur, wenn
  die Webseite ueber "Zum Home-Bildschirm hinzufuegen" als PWA
  installiert und aus diesem Icon heraus geoeffnet wurde. Im
  normalen Safari-Tab ist PushManager nicht verfuegbar — der
  Aktivierungs-Banner erscheint dann gar nicht erst. Schritt-fuer-
  Schritt-Anleitung im Handbuch.

---

## [2026.05.28] — 2026-05-04

**Dark-Mode: Top-3-Platzierungen wieder lesbar.**

### Korrigiert

- Im Dark-Mode war der hellgelbe / hellgraue / hellorange Reihen-
  Hintergrund der Top-3-Platzierungen mit weisser Schrift kaum
  lesbar — die Tailwind-Klassen bg-yellow-50/60, bg-slate-50/60 und
  bg-orange-50/40 haben keinen automatischen Dark-Mode-Equivalent.
  Jetzt mit passenden dark:-Varianten (yellow-900/30 / slate-700/40
  / orange-900/25), sodass die Zeilen auf dunklem Card-Hintergrund
  kontrastreich bleiben. Betrifft sowohl die DSV/IDJM-Tabelle als
  auch die JWM/JEM-Quali-Tabelle.

---

## [2026.05.27] — 2026-05-04

**Handbuch aktualisiert · Entwurfs-Vorschau fuer Admin/Editor.**

### Neu

- **Entwurfs-Vorschau:** Als angemeldeter Admin oder Editor koennen
  Ranglisten-Entwuerfe (nicht-oeffentlich) jetzt direkt auf der oeffentlichen
  Detailseite angesehen werden. Ein orangefarbenes Badge "Entwurf — nicht
  oeffentlich" zeigt den Status. Anonyme Aufrufe sehen die Seite weiterhin
  als 404, der Entwurf bleibt versteckt bis zur Freischaltung. Auch in der
  Listenansicht /rangliste tauchen Entwuerfe nur fuer angemeldete Benutzer auf.

### Geaendert

- **Handbuch generalueberholt:** Altersklasse U22 in allen Aufzaehlungen
  ergaenzt; Gender-Bezeichnungen auf Maedchen / Mix / Jungen umgestellt;
  IDJM-Quali-Beschreibung korrigiert (Saisonstichtag statt
  Regatta-Startdatum als Alters-Referenz); Multiplikator-Tabelle um
  "6+ ohne Mehrtages-Ausschreibung" ergaenzt; Tiebreak-Hinweis praezisiert;
  JWM/JEM-Algorithmus mit Re-Ranking, Gewichtungsformel und
  Schottenwechsel-Sonderregel ausfuehrlich beschrieben; neues Kapitel
  "Push-Benachrichtigungen" mit allen ausgelieferten Ereignissen.

---

## [2026.05.26] — 2026-05-04

**Rangliste: redundanten Gender-Filter-Eintrag entfernt.**

### Geaendert

- Im Gender-Filter der Ranglisten-Detailseiten wurde der Eintrag "Alle
  Kategorien" entfernt — fachlich identisch mit **Open** (die DSV-
  Filterregel fuer OPEN trifft auf jedes Boot zu). Das Dropdown zeigt
  jetzt nur noch die vier Kategorien **Open / Maedchen / Mix / Jungen**.

---

## [2026.05.25] — 2026-05-04

**Rangliste: neue Reihenfolge im Gender-Filter.**

### Geaendert

- Im Gender-Filter der Ranglisten-Detailseiten ist die Reihenfolge jetzt
  **Open / Maedchen / Mix / Jungen** (vorher Open / Jungen / Mix /
  Maedchen). Werte und Filterlogik bleiben unveraendert — nur die
  Anordnung im Dropdown ist neu.

---

## [2026.05.24] — 2026-05-04

**Backups: chronologische Sortierung auf Vercel Blob.**

### Korrigiert

- Die Liste der gespeicherten Backups war auf der Produktiv-Umgebung
  (Vercel Blob) nicht chronologisch sortiert, sondern alphabetisch nach
  Wochentag-Namen — Folge eines Date.toString()-Aufrufs, der "Sat May
  04 ..." liefert statt eines ISO-Strings. Lokal (Filesystem-Backend)
  war die Sortierung schon immer korrekt. Jetzt werden auch Blob-Backups
  wieder neueste-zuerst angezeigt.

---

## [2026.05.23] — 2026-05-04

**Import: klare Fehlermeldung bei Bild-PDFs ohne Textebene.**

### Geaendert

- Beim PDF-Import wird jetzt erkannt, wenn die Datei keine Textebene hat
  (reine Bild-PDF, z. B. nach Scan oder Rasterisierung beim Druck).
  Statt der bisherigen generischen Meldung "Keine Ergebnisse im PDF
  gefunden" erscheint ein eindeutiger Hinweis: die PDF muss vorher per
  OCR (Adobe Acrobat: "Scan & OCR" / "Texterkennung", oder Online-Tools
  wie ilovepdf.com/ocr-pdf) in eine durchsuchbare PDF umgewandelt und
  dann erneut importiert werden.

---

## [2026.05.22] — 2026-05-03

**Rangliste: Excel-Export und Drucken/PDF fuer angemeldete Benutzer.**

### Neu

- Auf der Ranglisten-Detailseite gibt es zwei neue Aktions-Buttons —
  sichtbar nur fuer **angemeldete Benutzer**:
  - **Excel-Export** lädt eine .xlsx mit Hauptliste, „Noch nicht in der
    Wertung" und (bei JWM/JEM) Per-Regatta-Slots herunter. Filter aus
    der URL (Altersklasse, Gender) werden uebernommen.
  - **Drucken / PDF** ruft den Browser-Druckdialog auf. Das Print-CSS
    blendet Header-Banner, Filter, Suchfeld und die Action-Buttons aus,
    damit nur Tabelle + Kennzahlen aufs Papier kommen.

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
