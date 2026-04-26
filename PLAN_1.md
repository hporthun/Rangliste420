# Segel-Rangliste App – Projektplan (420er)

## Zielsetzung

Web-Anwendung zur Erstellung und Pflege von Ranglisten für die **420er-Klasse** (Zweihand-Jolle, Jugend-/Jüngstenbereich). Import primär aus Manage2Sail, zusätzlich aus anderen Quellen/Formaten. Admin pflegt Daten, Öffentlichkeit liest Ranglisten im Web mit vollständiger Transparenz der Berechnung.

**Besonderheiten:**
- Genehmigter Schottenwechsel (Crew kann wechseln, Steuermann ist Ranglisten-Einheit)
- DSV-konforme Ranglistenberechnung nach Ranglistenordnung (RO) des DSV, gültig ab 01.01.2026
- Zusätzlich klassenspezifische JWM/JEM-Quali-Regeln der 420er-Klassenvereinigung
- Matrix aus Altersklassen (U15/U16/U17/U19) und Gender-Kategorien (Open/Männer/Mix/Girls)
- Robustes Fuzzy-Matching beim Import (Tippfehler, Doppelnamen, Umlaute)

## Rechtsgrundlage

- **DSV-Ranglistenordnung (RO)** mit Anlage 1, gültig ab 01.01.2026. Quelle: DSV "Ordnungen für Regatten".
- **JWM/JEM-Quali-Regeln** der 420er-Klassenvereinigung: https://420class.de/index.php/sport/quali
- **Manage2Sail-Regatta-Übersicht 420er**: https://www.manage2sail.com/de-DE/ClassAssociation/Detail/62a2158f-24d2-4d26-8d4f-06f30408edb5?tab=regattas

## Ranglisten-Typen (Überblick)

| Typ | Regatta-Auswahl | Berechnung | Stichtag | Speicherung |
|---|---|---|---|---|
| **Jahresrangliste** | Regatten mit Beginn im Kalenderjahr | DSV-RO (R_A-Formel, 9 beste) | 30. November | Snapshot pro Jahr |
| **Aktuelle Rangliste** | Ranglistenregatten bis Stichtag | DSV-RO (R_A-Formel, 9 beste) | 14 Tage vor Meldeschluss | **On-Demand** (nicht gespeichert) |
| **IDJM-Quali** | Gefilterter Auszug aus aktueller Rangliste | DSV-RO, nur U19/U16-Konforme, Mindestpunktzahl 25 | Dynamisch | On-Demand |
| **JWM-Quali** | 3 festgelegte Regatten | Klassenspezifisch (420er): Summe beste 2, nur Deutsche | Je Kampagne | Konfiguration gespeichert |
| **JEM-Quali** | 3 festgelegte Regatten | Klassenspezifisch: wie JWM-Quali | Je Kampagne | Konfiguration gespeichert |

## Kategorie-Matrix

### Altersklassen
- **U15**: geboren 2011 oder später (bei Saison 2025; max. 14 im Kalenderjahr)
- **U16**: geboren 2010 oder später (max. 15 im Kalenderjahr) — DSV-offiziell für IDJM
- **U17**: geboren 2009 oder später (max. 16 im Kalenderjahr)
- **U19**: geboren 2007 oder später (max. 18 im Kalenderjahr) — DSV-offiziell für IDJM
- **Open**: keine Altersbeschränkung

**Stichtag:** 31.12. des Saisonjahrs (Jahrgangsregel).

**Scope:** Beide Mannschaftsmitglieder müssen das Alter erfüllen (DSV MO Anlage Jugend).

**Wichtige Regel — fehlendes Geburtsdatum:** Segler mit `birthDate = null` können an **keiner U-Wertung** teilnehmen (werden aus dem Filter ausgeschlossen). In Open-Kategorien werden sie normal gewertet. Admin-UI zeigt Segler ohne Geburtsdatum als Warnung, damit nachgepflegt werden kann.

### Gender-Kategorien
- **Open**: alle Teams
- **Männer**: beide Segler männlich
- **Mix**: ein männlich, eine weiblich
- **Girls**: beide Segler weiblich

**Fehlendes Geschlecht:** Analog zum Geburtsdatum — Segler ohne `gender` werden aus Männer/Mix/Girls-Filtern ausgeschlossen, bleiben in Open.

## Tech-Stack

| Schicht | Technologie | Warum |
|---|---|---|
| Framework | Next.js 15 (App Router) + TypeScript | Lokal + Web, Server Actions |
| UI | Tailwind CSS + shadcn/ui | Tabellen/Formulare |
| DB lokal | SQLite | Eine Datei |
| DB prod | PostgreSQL (Neon) | Webhosting-tauglich |
| ORM | Prisma | Typsicher, DB-agnostisch |
| Import-Parser | SheetJS, Papaparse, Cheerio | Excel, CSV, HTML |
| Fuzzy-Match | fastest-levenshtein + eigener Normalisierer | Name-Matching |
| Auth | NextAuth (Credentials) | Admin-Login |
| PDF | @react-pdf/renderer | PDF-Ausgabe |
| Validierung | Zod | Eingaben + Import-Daten |
| Tests | Vitest + Playwright | Unit + E2E |
| Hosting | Vercel + Neon | Free Tier ausreichend |

## Datenmodell

```
Sailor {
  id
  firstName, lastName
  birthDate?        // OPTIONAL: fehlend = keine U-Wertung möglich
  gender?           // OPTIONAL: fehlend = keine gefilterte Gender-Wertung
  nationality       // PFLICHT: ISO-3166-1 (z.B. "GER") — Default "GER" beim Anlegen
  club?
  sailingLicenseId? // DSV-ID
  // Aliase für Matching
  alternativeNames  String[]  // z.B. ["Müller-Schmidt", "Mueller Schmidt"]
  createdAt, updatedAt
}

TeamEntry {
  id
  regattaId
  helmId            -> Sailor
  crewId            -> Sailor
  sailNumber        // kann pro Regatta variieren
  crewSwapApproved  Boolean
  crewSwapNote?
  // Unique: (regattaId, helmId)
}

Regatta {
  id
  name, location
  country             // ISO (z.B. "GER", "DEN", "ESP") — Auslandsregatten explizit
  startDate, endDate
  numDays
  plannedRaces, completedRaces
  multiDayAnnouncement Boolean
  ranglistenFaktor    Decimal(3,2)  // 0.80–2.60, auch für Auslandsregatten
  scoringSystem       // LOW_POINT | BONUS_POINT
  isRanglistenRegatta Boolean
  sourceType          // MANAGE2SAIL | SAILWAVE | GENERIC_CSV | MANUAL
  sourceUrl?
  sourceFile?
  importedAt?
  notes?
}

Result {
  id
  regattaId, teamEntryId
  finalRank           // Gesamtplatz x
  finalPoints
  racePoints Json
  inStartArea         Boolean  // true wenn "ins Startgebiet gekommen", relevant für s
  // Unique: (regattaId, teamEntryId)
}

Ranking {
  id
  name
  type                // JAHRESRANGLISTE | JWM_QUALI | JEM_QUALI
  // Aktuelle Rangliste und IDJM-Quali werden NICHT als Ranking-Einträge gespeichert
  // (on-demand berechnet)
  season
  ageCategory         // U15 | U16 | U17 | U19 | OPEN
  genderCategory      // OPEN | MEN | MIX | GIRLS
  scoringRule Json
  isPublic Boolean
  publishedAt?
  createdAt, updatedAt
}

RankingRegatta {
  rankingId, regattaId
  // Nur für JWM/JEM-Quali
  weight Float?
}

// Audit/Konflikt-Log beim Import
ImportSession {
  id
  regattaId
  createdBy
  createdAt
  parserType
  sourceFile?
  matchDecisions Json  // welche Fuzzy-Matches akzeptiert/abgelehnt wurden
}

User {
  id, email, passwordHash, role
}
```

### Scoring-Rule (Zod-validiert)

```typescript
type ScoringRule =
  | DsvScoringRule
  | JwmJemQualiScoringRule

type DsvScoringRule = {
  mode: "dsv_standard"
  bestNValues: number                  // Standard: 9
  minValuesRequired: number            // Standard: 9
  idjmMinPoints?: number               // z.B. 25 für IDJM-Filter
}

type JwmJemQualiScoringRule = {
  mode: "jwm_jem_quali"
  specificRegattaIds: [string, string, string]
  rankingLevelBestN: 2
  nationalityFilter: {
    mode: "exclude_and_reshuffle"
    countries: ["GER"]
  }
  weightingMode: "by_participants_filtered"
  minimumParticipation: {
    minRegattas: 2
    behavior: "list_at_end"
    hideIfZero: true
  }
}
```

## DSV-Scoring-Engine

### Berechnungsformel (RO Anlage 1, §2)

```
R_A = f × 100 × ((s + 1 − x) / s)
```

- `f`: Ranglistenfaktor (0,80–2,60) aus `regatta.ranglistenFaktor`
- `s`: Anzahl Boote — gestartet **oder** "ins Startgebiet gekommen" (siehe unten)
- `x`: Gesamtplatz des Bootes

**Höhere R_A = besser** (umgekehrt zu Low Point).

### Definition von `s` (RO Anlage 1 §1)

`s` = Anzahl Boote, die
- mindestens einmal gestartet sind, **oder**
- ins Startgebiet gekommen sind und OCS oder eine Wertung nach WR 30 erhalten haben

Boote, die **nur** ins Startgebiet gekommen sind ohne Zieldurchgangsplatz, **bekommen R_A = 0** für diese Regatta, zählen aber als Wertungseinheit (m-fache Zählung) für ihren Berechnungszeitraum.

**Im Datenmodell:** Feld `result.inStartArea` = true bei diesen Fällen. Der Import-Wizard zeigt pro Regatta ein Review "Welche Teilnehmer sind ins Startgebiet gekommen ohne Zieldurchgang?", das der Admin bestätigt. Kennzeichnung durch DNC/DNS/BFD/OCS-Codes und/oder manuelle Zuweisung.

**420er-Entscheidung:** Alle Boote zählen in `s` und `x` (auch ausländische). Keine nationale Bereinigung.

### Multiplikator m (RO Anlage 1, §3)

| gesegelte Wettfahrten | Standard | wenn Ausschreibung >2 Tage |
|---|---|---|
| 1 | 1 | 1 |
| 2 | 2 | 2 |
| 3 | 3 | 3 |
| 4 oder 5 | 4 | 4 |
| 6 oder mehr | 4 | 5 |

Eine Regatta geht **bis zu m-mal** in die Werteliste eines Seglers ein.

### Ranglistenpunktzahl R

```
R = arithmetisches Mittel der 9 besten R_A-Werte
```

Segler mit <9 Wertungen sind **nicht** in der Rangliste.

### Berechnungszeitraum

Grundsätzlich ein Jahr. Regatten, die **zum Stichtag begonnen haben** (`regatta.startDate <= stichtag`), werden einbezogen.

### Stichtage

- **Jahresrangliste:** 30. November
- **Aktuelle Rangliste:** 14 Tage vor Meldeschluss der Ziel-Regatta

### Algorithmus (Pseudocode)

```typescript
function calculateDsvRanking(ranking, referenceDate): RankingResult {
  const { ageCategory, genderCategory, season } = ranking
  const periodStart = new Date(season, 0, 1)

  const regattas = db.regatta.findMany({
    where: {
      isRanglistenRegatta: true,
      startDate: { gte: periodStart, lte: referenceDate }
    }
  })

  const sailorValues = new Map<SailorId, Array<{value: number, regattaId: string, ...}>>()

  for (const regatta of regattas) {
    const s = countS(regatta)  // Starter + "ins Startgebiet gekommen"
    const m = calculateMultiplier(regatta.completedRaces, regatta.multiDayAnnouncement)
    const f = regatta.ranglistenFaktor

    const results = db.result.findMany({ where: { regattaId: regatta.id } })
    for (const result of results) {
      const entry = result.teamEntry
      if (!matchesAgeCategory(entry, ageCategory, season)) continue
      if (!matchesGenderCategory(entry, genderCategory)) continue

      const x = result.finalRank
      const rA = result.inStartArea && !result.finalRank
        ? 0
        : f * 100 * ((s + 1 - x) / s)

      const helmId = entry.helmId
      if (!sailorValues.has(helmId)) sailorValues.set(helmId, [])
      for (let i = 0; i < m; i++) {
        sailorValues.get(helmId).push({
          value: rA, regattaId: regatta.id, f, s, x, m, multiplierIndex: i
        })
      }
    }
  }

  const rankings = []
  for (const [helmId, values] of sailorValues) {
    if (values.length < 9) continue
    const sorted = [...values].sort((a, b) => b.value - a.value)
    const top9 = sorted.slice(0, 9)
    const R = top9.reduce((sum, v) => sum + v.value, 0) / 9
    rankings.push({ helmId, totalPoints: R, top9, allValues: sorted })
  }

  rankings.sort((a, b) => b.totalPoints - a.totalPoints)
  rankings.forEach((r, i) => r.finalRank = i + 1)
  return { rankings }
}

function matchesAgeCategory(entry, category, season): boolean {
  if (category === "OPEN") return true
  // Fehlendes Geburtsdatum → kein U-Kategorie-Match
  if (!entry.helm.birthDate || !entry.crew.birthDate) return false
  const maxAge = { U15: 14, U16: 15, U17: 16, U19: 18 }[category]
  const refDate = new Date(season, 11, 31)
  return calculateAge(entry.helm.birthDate, refDate) <= maxAge
      && calculateAge(entry.crew.birthDate, refDate) <= maxAge
}

function matchesGenderCategory(entry, category): boolean {
  if (category === "OPEN") return true
  // Fehlendes Gender → kein Match für gefilterte Gender-Kategorie
  if (!entry.helm.gender || !entry.crew.gender) return false
  const h = entry.helm.gender, c = entry.crew.gender
  switch (category) {
    case "MEN":   return h === "M" && c === "M"
    case "MIX":   return (h === "M" && c === "F") || (h === "F" && c === "M")
    case "GIRLS": return h === "F" && c === "F"
  }
}
```

### Zahlenbeispiel

Regatta "Kieler Woche 2025":
- f=2,60, s=80, completedRaces=7, multiDayAnnouncement=true → m=5
- Team A wird Platz 10

R_A = 2,60 × 100 × ((80+1−10)/80) = 260 × 0,8875 = **230,75**

Dieser Wert geht 5-mal in Team As Liste ein.

Beispielliste (bereits sortiert absteigend):
`[245,00; 238,12; 230,75; 230,75; 230,75; 230,75; 230,75; 198,40; 185,10; 170,00; 145,00]`

9 beste: Summe = 2020,37 → **R = 224,49**

## IDJM-Quali (DSV-konform)

Ist **keine eigene Berechnung**, sondern ein **gefilterter Auszug aus der aktuellen Rangliste**:
- Stichtag: 14 Tage vor IDJM-Meldeschluss
- Altersklasse: U19 oder U16
- Filter: R ≥ 25 Punkte (gemäß DSV-MO Anlage Jugend, MO 10)
- Anzeige: Nur qualifizierte Segler werden hervorgehoben

## JWM/JEM-Quali (420er-klassenspezifisch)

**Quelle:** https://420class.de/index.php/sport/quali

**TODO: Offizielle Regel aus der Webseite einfügen.** Bitte Text von der Seite einkopieren, damit die folgende Spezifikation verifiziert oder angepasst werden kann.

**Aktueller Stand (vorläufig, aus vorheriger Absprache):**

1. **3 festgelegte Regatten** (`regattaSelection: "specific"`)
2. **Nationalitäts-Filter:** Nur deutsche Teilnehmer — Ausländer entfernen, Deutsche rücken auf
3. **Gewichtung:** Nach Anzahl deutscher Teilnehmer, größte = 1,0
4. **Wertung:** Summe der besten 2 gewichteten Ergebnisse
5. **Mindestteilnahme:** 2 von 3; 1 Regatta → am Ende; 0 → nicht anzeigen
6. **Filter:** Altersklasse + Gender-Kategorie

### Algorithmus, Zahlenbeispiel

Siehe vorheriges PLAN.md (bleibt inhaltlich unverändert bis zur Verifikation gegen die Webseite). Kern:

- Pro Regatta: Ausländer entfernen, Deutsche neu durchnummerieren
- Gewicht = deutsche_diese_regatta / deutsche_max_regatta
- Pro Steuermann: alle gewichteten Ergebnisse sammeln
- Die besten 2 addieren → Gesamtpunkte
- Weniger = besser

## Import-Architektur

### Parser-Interface

```typescript
interface ResultsParser {
  canHandle(file: File | Url): boolean
  parse(input: File | Url): Promise<ParsedRegatta>
}

type ParsedRegatta = {
  metadata: {
    name: string
    location?: string
    country?: string
    startDate?: Date
    endDate?: Date
    numDays?: number
    completedRaces: number
  }
  entries: Array<{
    finalRank?: number       // optional, kann fehlen bei "nur Startgebiet"
    finalPoints?: number
    inStartArea: boolean     // true wenn kein Zieldurchgang, aber im Startgebiet
    helmName: string
    crewName?: string
    birthDateHelm?: Date
    birthDateCrew?: Date
    sailNumber?: string
    club?: string
    nationality?: string
    racePoints: Array<{race: number, points: number, code?: string}>
  }>
  warnings: string[]
}
```

### Implementierungen

- `Manage2SailExcelParser` (primär)
- `Manage2SailHtmlParser` (Sekundär, für URL-Import)
- `Manage2SailRegattaListParser` — liest die [Regatta-Übersichtsseite](https://www.manage2sail.com/de-DE/ClassAssociation/Detail/62a2158f-24d2-4d26-8d4f-06f30408edb5?tab=regattas), erzeugt Regatta-Stammdaten (ohne Ergebnisse)
- `SailWaveParser`
- `GenericCsvParser`
- `ManualParser`

### Import-Workflow

1. **Upload** (Datei oder URL)
2. **Automatischer Parser-Match**
3. **Regatta-Metadaten-Screen**: Bestätigen/ergänzen, inkl. Pflichtfelder:
   - `ranglistenFaktor` (0,80–2,60) — **vom Admin einzugeben**
   - `country` (für Auslandsregatten relevant)
   - `isRanglistenRegatta` (ja/nein)
   - `multiDayAnnouncement` (ja/nein)
4. **Startgebiet-Review**: Einträge ohne finalRank aber mit DNC/DNS/BFD/OCS-Codes werden aufgelistet, Admin markiert welche "ins Startgebiet gekommen" sind
5. **Matching-Assistent** (Fuzzy-Match, siehe unten)
6. **Vorschau**
7. **Speichern** → ImportSession + TeamEntry + Result anlegen

### Fuzzy-Matching (Kern-Feature)

**Normalisierungs-Pipeline (vor Levenshtein):**

```typescript
function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")   // Akzente entfernen
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .replace(/[-_.]/g, " ")                              // Bindestriche/Punkte zu Leerzeichen
    .replace(/\s+/g, " ")                                // Mehrfach-Spaces
    .trim()
}
```

**Match-Strategie:**

1. **Exakter Match** auf normalisierten Namen → Score 1,0
2. **Levenshtein-Distanz** auf (firstName + " " + lastName), normalisiert:
   - ≥ 0,90 Ähnlichkeit → "sehr wahrscheinlich"
   - 0,75–0,90 → "möglich"
   - < 0,75 → kein Auto-Vorschlag
3. **Vertauschte Reihenfolge** prüfen: "Max Müller" vs. "Müller, Max" oder "Müller Max"
4. **Segelnummer als Bonus**: Wenn die Segelnummer bei früheren TeamEntries des Match-Kandidaten aufgetaucht ist, Score +0,05
5. **Alternative Namen**: Sailors können mehrere `alternativeNames` haben (z.B. Doppelnamen-Varianten). Match auf diese zählt wie Haupt-Match.

**UI im Matching-Screen (pro importiertem Teilnehmer):**

- Beste Kandidaten mit Score und Begründung ("Levenshtein 0,92", "Segelnummer stimmt")
- Buttons: "Zuordnen zu X" / "Neu anlegen" / "Manuell suchen"
- Beim Zuordnen mit abweichendem Namen: Option "als alternativen Namen speichern" → lernt für die Zukunft
- Massen-Aktion: "Alle ≥ 0,90 automatisch zuordnen" (nur, wenn Admin das explizit bestätigt)

**Test-Strategie:**
- Fixture mit typischen Varianten: "Müller-Schmidt" / "Mueller-Schmidt" / "Müller Schmidt" / "Müller Smith" (Tippfehler)
- Edge Cases: sehr kurze Namen ("Lee"), häufige Nachnamen ("Müller"), Bindestrich-Varianten

### Manage2Sail-Regattaliste-Import

Die Übersichtsseite listet alle 420er-Ranglistenregatten mit (vermutlich) Datum, Ort, evtl. Faktor.

**Parser-Ziel:** Stammdaten-Befüllung, keine Ergebnisse.

**Workflow:**
1. Admin triggert "Regattaliste von Manage2Sail importieren"
2. Parser holt HTML, extrahiert alle Regatten
3. Vergleich mit DB: Welche Regatten sind neu, welche schon vorhanden?
4. Admin bekommt Liste "Neue Regatten gefunden" und kann diese anlegen
5. Pro neuer Regatta: `ranglistenFaktor` manuell nachpflegen (nicht auf der Übersichtsseite)

**TODO vor Implementierung:** HTML-Snapshot der Seite analysieren, um Selektoren zu definieren. Ich sehe von hier die Seite nicht — beim Bauen des Parsers bitte einen aktuellen HTML-Abzug bereitstellen oder Claude Code die Seite analysieren lassen.

## Transparenz in der öffentlichen Ansicht

### Ranglisten-Übersichtsseite

Tabelle mit Spalten: Platz, Name Steuermann, Verein, Punktzahl R, Anzahl Wertungen.

Klick auf einen Eintrag → Detail-Seite.

### Detail-Seite pro Steuermann

- Name, Verein, Geburtsdatum (falls bekannt), Segelnummer(n) der Saison
- **Einfließende 9 Wertungen** als Tabelle:
  - Regatta, Datum, Faktor f, Starter s, Platz x, R_A, Multiplikator m, wievielter Eintrag
  - Klick auf Regatta → Regatta-Detail mit Original-Ergebnisliste
- **Weitere Wertungen** (jenseits der Top 9) als ausklappbare Liste — zeigt, welche gestrichen wurden
- **Crew-Historie**: welche Vorschoter in welchen Regatten gefahren wurden
- Bei JWM/JEM-Quali zusätzlich:
  - Original-Platz + bereinigter Platz pro Regatta
  - Gewicht pro Regatta + verwendete Teilnehmerzahl
  - Welche 2 Ergebnisse zählen, welches gestrichen wurde

### Regatta-Detail-Seite

- Regatta-Metadaten (Ort, Datum, Faktor f, Anzahl gestarteter Boote s)
- Vollständige Ergebnisliste mit allen Teilnehmern inkl. Nationalität
- Für jedes Team: berechneter R_A-Wert (kann jeder nachrechnen)
- Link zu Quelldatei / Manage2Sail

## Schottenwechsel

- Genehmigter Schottenwechsel: Steuermann mit anderem Vorschoter, Ergebnisse zählen für denselben Ranglistenplatz
- `TeamEntry.crewSwapApproved` + `crewSwapNote`
- UI-Warnung bei neuer Crew-Kombination
- Seglerprofil zeigt Crew-Historie chronologisch
- **IDJM-Besonderheit**: Für Meldeberechtigung müssen alle Mannschaftsmitglieder zum Zeitpunkt der zugrunde liegenden Regatten das Alterskriterium erfüllt haben (pro Regatta prüfen)

## User Stories (MVP)

- **Als Admin** will ich Segler anlegen, optional mit Geburtsdatum und Geschlecht.
- **Als Admin** will ich beim Import Namens-Varianten automatisch erkennen und Vorschläge bestätigen/korrigieren.
- **Als Admin** will ich die Manage2Sail-Regattaliste laden, um neue Regatten schnell anzulegen.
- **Als Admin** will ich pro Regatta den Ranglistenfaktor eintragen (auch für Auslandsregatten).
- **Als Admin** will ich beim Import "Startgebiet-Fälle" bestätigen.
- **Als Admin** will ich bei Schottenwechsel eine Genehmigungsnotiz setzen.
- **Als Admin** will ich Ranglisten für alle Kategorien-Kombinationen generieren.
- **Als Admin** will ich eine aktuelle Rangliste für eine IDJM-Meldeberechtigung erzeugen (mit 25-Punkte-Filter).
- **Als Admin** will ich eine JWM-Quali konfigurieren.
- **Als Trainer/Elter** will ich auf der öffentlichen Detail-Seite alle 9 einfließenden Wertungen nachvollziehen.
- **Als Trainer/Elter** will ich sehen, wie R_A berechnet wurde (Formel und Zahlen).
- **Als Trainer/Elter** will ich die Rangliste als PDF drucken.

## Projektstruktur

```
/app
  /(public)
    /rangliste/[slug]
    /rangliste/[slug]/steuermann/[id]     # Detail-Ansicht mit 9 Werten
    /regatten
    /regatta/[id]
  /(admin)
    /segler
    /regatten
    /import
      /manage2sail-list                   # Regattaliste von m2s
    /ranglisten
      /[id]/konfiguration
      /[id]/vorschau
  /api
    /import/*
    /export/pdf/*
  /auth/login
/lib
  /db
  /scoring
    dsv.ts
    multiplier.ts
    filters.ts
    jwm-jem-quali.ts
    idjm-quali.ts
    __tests__/
  /import
    parser-interface.ts
    manage2sail-excel.ts
    manage2sail-html.ts
    manage2sail-regatta-list.ts
    sailwave.ts
    generic-csv.ts
    matching.ts                           # Fuzzy-Match-Logik
    normalize.ts                          # Namens-Normalisierung
    __fixtures__/
    __tests__/
  /pdf
/prisma
  schema.prisma
  /migrations
  seed.ts
/components
  /ui
  /tables
  /forms
  /import-wizard
    metadata-step.tsx
    startarea-step.tsx
    matching-step.tsx
    preview-step.tsx
/docs
  dsv-ranglistenordnung.md
  jwm-jem-quali-regeln.md                 # von 420class.de
  scoring-examples.md
  import-formats.md
```

## Test-Strategie

- **DSV-Formel** (dsv.ts): Zahlenbeispiel + Grenzfälle (f=0.8/2.6, s=1, x=1, x=s, <9/=9/>9 Wertungen, Startgebiet-Fall mit R_A=0)
- **Multiplikator**: alle Staffeln
- **Filter**: Altersklassen × Gender × fehlendes Geburtsdatum/Geschlecht
- **Fuzzy-Matching**: Fixture mit 20+ Varianten (Doppelnamen, Umlaute, Tippfehler, Vertauschungen)
- **JWM/JEM-Quali**: Zahlenbeispiel + Edge Cases
- **Import-Parser**: mind. 3 echte Fixtures pro Parser, plus Startgebiet-Fälle
- **E2E**: Import → Ranglisten-Erstellung → PDF-Export

## Deployment

- **Lokal:** SQLite, `npm run dev`
- **Produktion:** Vercel + Neon PostgreSQL
- **Backup:** Neon PITR + wöchentlicher manueller Export

## Milestones

1. **Woche 1:** Projekt-Setup, DB-Schema (inkl. Optional-Felder, country, inStartArea), Auth, Seglerverwaltung mit Warnanzeige bei fehlenden Stammdaten
2. **Woche 2:** Regatten-CRUD mit allen Pflichtfeldern, TeamEntry, Result mit inStartArea
3. **Woche 3:** Fuzzy-Matching-Modul + Normalisierer + Tests; Manage2Sail-Excel-Parser
4. **Woche 4:** Import-Wizard (Metadaten + Startgebiet + Matching + Vorschau) end-to-end
5. **Woche 5:** DSV-Scoring-Engine (dsv.ts + multiplier.ts + filters.ts) mit allen Tests
6. **Woche 6:** Jahresrangliste + Aktuelle Rangliste (on-demand) + IDJM-Filter + öffentliche Ansicht mit Transparenz-Detail
7. **Woche 7:** JWM/JEM-Quali-Logik
8. **Woche 8:** Manage2Sail-Regattaliste-Parser, PDF-Export, Deployment
9. **Woche 9+:** Phase 2 (weitere Parser, Seglerprofile, URL-Import)

## Offene Fragen / TODOs

1. **JWM/JEM-Quali-Regel aus 420class.de**: Text der offiziellen Quali-Seite verifizieren und hier einpflegen
2. **Manage2Sail-Regattaliste**: HTML-Struktur analysieren, um Parser-Selektoren festzulegen (beim Bauen)
3. **Tiebreak** bei gleicher Ranglistenpunktzahl: DSV gibt nichts vor. Vorschlag: bester Einzel-R_A, dann Anzahl Wertungen
4. **Auslandsregatten und Faktor**: Gibt es eine Faustregel, welchen Faktor Auslandsregatten üblicherweise bekommen, oder entscheidet die 420er-Klassenvereinigung ad hoc?
5. **"Ins Startgebiet gekommen"** - Erkennung aus Manage2Sail: Welche Codes/Werte tauchen in der Ergebnisliste auf? (Bei ersten Import-Tests konkretisieren)
6. **Alternative Namen pflegen**: Soll der Admin auch manuell "alternative Namen" zu einem Segler hinzufügen können (z.B. wenn ein Segler offiziell seinen Namen ändert)?
7. **Bulk-Import Regatten**: Wenn viele neue Regatten aus der Manage2Sail-Liste kommen — soll der Faktor später nachgetragen werden können (Regatta zunächst als "isRanglistenRegatta: false" angelegt)?
