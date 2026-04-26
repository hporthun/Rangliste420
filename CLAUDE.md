# CLAUDE.md

Diese Datei gibt Claude Code Kontext über das Projekt. Sie wird bei jedem Session-Start automatisch gelesen.

## Projekt-Überblick

Next.js-Webanwendung zur Erstellung von Ranglisten für die **420er-Klasse**. Import primär aus Manage2Sail (Web-Copy-Paste der Ergebnisseite oder PDF-Upload). Admin-Pflege, öffentliche Leseansicht mit vollständiger Transparenz der Berechnung.

**Fachliche Grundlagen:**
- **DSV-Ranglistenordnung (RO)** vom 01.01.2026 — verbindlich für Jahresrangliste, Aktuelle Rangliste, IDJM-Quali
- **Klassenspezifische Regeln** der 420er-Klassenvereinigung — ergänzend für JWM/JEM-Quali ([420class.de/sport/quali](https://420class.de/index.php/sport/quali))
- **Schottenwechsel**: Steuermann ist Ranglisten-Einheit, Crew kann wechseln
- **Kategorie-Matrix**: 4 Altersklassen (U15/U16/U17/U19/Open) × 4 Gender-Kategorien (Open/Männer/Mix/Girls)
- **Optionale Stammdaten**: Geburtsdatum und Geschlecht sind optional — fehlt eines, wird der Segler aus entsprechenden gefilterten Ranglisten ausgeschlossen

Detaillierte Spezifikation in `PLAN_1.md`. **Immer zuerst PLAN_1.md lesen**, insbesondere:
- "DSV-Scoring-Engine" (Formel + Algorithmus)
- "Fuzzy-Matching" (Import-Kernfeature)
- "Transparenz in der öffentlichen Ansicht"
- "JWM/JEM-Quali"
- "Datenmodell"

## Tech-Stack (nicht ohne Rücksprache ändern)

- Next.js 15 mit App Router und TypeScript (strict mode)
- Tailwind CSS + shadcn/ui
- Prisma ORM mit SQLite lokal, PostgreSQL in Produktion
- NextAuth (Credentials-Provider, Admin-only)
- pdfjs-dist für PDF-Import, Papaparse für CSV
- fastest-levenshtein für String-Ähnlichkeit
- Zod für alle Validierung
- Vitest für Unit-Tests, Playwright für E2E

## Import-Quellen

- **Manage2Sail Web-Copy-Paste** (primär) — enthält Helm + Crew, Sail Number, Verein, Race-Scores
- **Manage2Sail PDF „Overall Results"** (Fallback) — nur Helm, Crew wird nachgepflegt
- **Manage2Sail Regattaliste** — cached Stammdaten + Ranglistenfaktor ([Klassen-Übersicht](https://www.manage2sail.com/de-DE/ClassAssociation/Detail/62a2158f-24d2-4d26-8d4f-06f30408edb5?tab=regattas))
- SailWave, generisches CSV (Phase 2)

## Code-Konventionen

- **TypeScript strict**, keine `any`-Typen außer mit Begründung
- **Server Components** als Standard, Client Components nur bei Interaktivität
- **Server Actions** für Formulare, typisierte Rückgaben (`{ok: true, data} | {ok: false, error}`)
- **Zod-Schemas** für alle User-Eingaben und Import-Daten
- **Dateinamen**: kebab-case; **Komponenten**: PascalCase; **Funktionen**: camelCase
- **Imports**: Absolute Pfade über `@/`

## Architektur-Regeln

- **Import-Parser** (`/lib/import`): reine Funktionen, keine DB-Zugriffe
- **Scoring-Engine** (`/lib/scoring`): reine Funktionen, hohe Testabdeckung
- **DSV-Kernmodul** (`/lib/scoring/dsv.ts`): Formel `R_A = f × 100 × ((s+1−x)/s)`, 9-beste-Werte-Logik. Kommentar mit Quelle und Gültigkeitsdatum aktuell halten.
- **Fuzzy-Matching** (`/lib/import/matching.ts` + `normalize.ts`): Normalisierung → Levenshtein → Segelnummer-Bonus → Alternative Namen
- **JWM/JEM-Quali** (`/lib/scoring/jwm-jem-quali.ts`): klassenspezifisch, **nicht** DSV
- **IDJM-Quali** (`/lib/scoring/idjm-quali.ts`): Filter auf DSV-Rangliste
- **DB-Zugriff** nur über Prisma-Client aus `/lib/db`
- **Auth-Check** in jeder Admin-Route

## Testing

- **DSV-Formel**: Zahlenbeispiel + Grenzfälle (f=0.8/2.6, s=1, x=1, x=s, =9/<9/>9 Wertungen, Startgebiet-R_A=0)
- **Multiplikator**: alle Staffeln
- **Filter**: 4 Altersklassen × 4 Gender × fehlendes Geburtsdatum/Geschlecht
- **Fuzzy-Matching**: Fixture mit Varianten (Umlaute, Doppelnamen, Tippfehler, Vertauschungen)
- **JWM/JEM-Quali**: Zahlenbeispiel + Edge Cases
- **Import-Parser**: mindestens 3 echte Fixtures pro Parser + Startgebiet-Fälle
- `npm run test` muss grün sein vor jedem Commit

## Git-Workflow

- Kleine, atomare Commits
- Präfixe: `feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`
- Vor Commit: `npm run lint` und `npm run test`
- Branches: `main` immer deploybar, Features in `feature/kurzname`

## Was Claude nicht tun soll

- Keine Dependencies ohne Begründung
- Kein Scope-Creep — bei größeren Aufgaben nachfragen
- Keine DB-Migrationen ohne Nachfrage bei Produktiv-Daten
- Keine Änderungen an `prisma/schema.prisma` ohne Migrationshinweis
- **Keine eigenmächtige Abweichung von der DSV-Formel** (RO Anlage 1 §2)
- **DSV-Logik und JWM/JEM-Logik nicht vermischen** — getrennte Module
- **Segler nicht automatisch bei Fuzzy-Match anlegen** — immer Admin-Bestätigung
- **Geburtsdatum/Geschlecht nicht erraten** — bleiben leer, wenn nicht explizit vorhanden

## Hilfreiche Kommandos

```bash
npm run dev
npm run build
npm run test
npm run test:e2e
npm run lint
npx prisma studio
npx prisma migrate dev
npx prisma generate
```

## Kontext zur Domäne

### Grundbegriffe
- **Regatta**: Segel-Veranstaltung, 1–3 Tage
- **TeamEntry**: Paarung Steuermann + Crew bei einer Regatta
- **Steuermann (helm)**: Stabile Ranglisten-Einheit
- **Vorschoter (crew)**: Kann wechseln (Schottenwechsel)
- **Ranglistenregatta**: Von 420er-KV als solche festgelegt
- **Ranglistenfaktor f**: Pro Regatta, 0,80–2,60 (auch für Auslandsregatten)

### DSV-Ranglistenformel

```
R_A = f × 100 × ((s + 1 − x) / s)
```

- `s`: Gestartete Boote **plus** "ins Startgebiet gekommen" mit OCS/WR-30
- `x`: Gesamtplatz
- Boote, die nur im Startgebiet waren ohne Zieldurchgang → R_A = 0, aber zählen als m-fache Zählung
- **Höhere R_A = besser**
- **420er-Entscheidung**: Alle Boote zählen (auch ausländische) in s und x

**Multiplikator m**: 1/2/3 bei 1/2/3 Wettfahrten, 4 bei 4+, 5 bei 6+ mit multiDay-Ausschreibung. Regatta geht bis zu m-mal in Werteliste ein.

**Ranglistenpunktzahl R**: arithmetisches Mittel der 9 besten R_A-Werte. <9 Wertungen → nicht in Rangliste.

### Kategorie-Matrix
- Altersklassen: U15 (max. 14), U16 (max. 15), U17 (max. 16), U19 (max. 18), Open
- Stichtag: 31.12. des Saisonjahrs
- Gender: Open, Männer, Mix, Girls
- Alters-/Gender-Filter gilt für **beide** Mannschaftsmitglieder
- **Fehlendes Geburtsdatum/Geschlecht** → kein Match in gefilterter Kategorie

### Ranglisten-Typen
- **Jahresrangliste**: 30.11., Regatten des Kalenderjahrs — gespeichert als Snapshot
- **Aktuelle Rangliste**: 14 Tage vor Meldeschluss — **on-demand**, nicht gespeichert
- **IDJM-Quali**: Gefilterte aktuelle Rangliste (U19/U16, R ≥ 25)
- **JWM/JEM-Quali**: Klassenspezifische Sonderregel (3 Regatten, beste 2, nur Deutsche)

### Fuzzy-Matching beim Import

1. Normalisierung: lowercase, Akzente entfernen, Umlaute (ä→ae etc.), Bindestriche → Leerzeichen
2. Levenshtein-Distanz auf normalisierten Namen
3. Schwellen: ≥0,90 "sehr wahrscheinlich", 0,75–0,90 "möglich", <0,75 kein Vorschlag
4. Segelnummer als Bonus (+0,05)
5. Alternative Namen (am Sailor gespeichert) zählen wie Haupt-Match
6. **Immer Admin-Bestätigung** vor Zuordnung

### Transparenz

Öffentliche Detail-Seite pro Steuermann zeigt:
- Alle 9 einfließenden R_A-Werte mit Regatta, Faktor, s, x, m
- Nicht-einfließende Wertungen ausklappbar (was wurde gestrichen)
- Crew-Historie
- Bei JWM/JEM-Quali: Original-Platz + bereinigter Platz + Gewicht

### Schottenwechsel
- Steuermann mit anderem Vorschoter, `crewSwapApproved` + optionale Notiz
- Für IDJM: alle Mannschaftsmitglieder müssen zum Zeitpunkt der Regatta das Alterskriterium erfüllt haben

### DSV-Quelle
"Ordnungen für Regatten" des DSV, gültig ab 01.01.2026. Zitierte Abschnitte: RO §1.1–1.3, §2–3, Anlage 1 §1–4, MO Anlage Jugend (MO 10, MO 11).

Bei Fachbegriffen oder Regelfragen im Zweifel nachfragen, nicht raten.
