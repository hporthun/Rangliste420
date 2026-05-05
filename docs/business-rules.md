# Geschäftsregeln 420er-Rangliste

> Stand: 2026-04-30. Single source of truth für die fachlichen Regeln,
> die an mehreren Stellen im Code zusammenwirken müssen. Wenn eine Regel
> hier dokumentiert ist und der Code abweicht, ist der Code falsch (oder
> diese Doku zu aktualisieren).
>
> Quellen:
> - **DSV-Ranglistenordnung (RO)**, Anlage 1, gültig ab 01.01.2026
> - **DSV-Meldeordnung (MO)**, Anlage Jugend (MO 10) — IDJM
> - **420er-Klassenvereinigung**, [Quali-Ordnung](https://420class.de/index.php/sport/quali) — JWM/JEM
> - **CLAUDE.md** im Repo-Root für Tech-Stack, Code-Konventionen und
>   Issue-Workflow (Gitea via `scripts/gitea-issue.mjs`)
> - [`architecture.md`](architecture.md) — technischer Überblick:
>   File-Map, Schichten, Datenfluss, Server-Action-Konvention

---

## 1. Datenmodell-Invarianten

Diese Eigenschaften sind im gesamten Code **immer** gültig und werden
durch Schema-Constraints und Server-Action-Validierung durchgesetzt:

| Invariante | Wo durchgesetzt |
|---|---|
| Steuermann (helm) ist die stabile Ranglisten-Einheit | `TeamEntry.@@unique([regattaId, helmId])` |
| Vorschoter (crew) kann pro Regatta wechseln | `TeamEntry.crewId` ist nullable |
| `Sailor.birthYear` und `Sailor.gender` sind optional | Schema; Filter werten `null` als „nicht in Kategorie" |
| `Regatta.ranglistenFaktor` ∈ [0.80, 2.60] | Zod-Schema in `lib/schemas/regatta.ts` |
| `Regatta.totalStarters` (nullable Int) | Anzahl gestarteter Boote inkl. Auslandsboote |
| Alle Boote zählen in `s` und `x` (auch Ausländer) | Scoring-Engine, dokumentiert in §2.1 |
| `Ranking.type ∈ {JAHRESRANGLISTE, IDJM, JWM_QUALI, JEM_QUALI}` | Type-Kommentar im Schema |
| `Ranking.type` enthält **nicht** `AKTUELLE` (wird nie persistiert) | `SAVEABLE_TYPES` in `lib/actions/rankings.ts` |

---

## 2. Ranglisten-Typen und Berechnung

### 2.1 DSV-Jahresrangliste (Anlage 1, §2)

Formel:

```
R_A = f × 100 × ((s + 1 − x) / s)
```

mit
- `f` = Ranglistenfaktor der Regatta (0.80–2.60)
- `s` = **Gesamtteilnehmerzahl der Regatta** (siehe unten)
- `x` = Platzierung des Teams in der Regatta (1 = bestes)

**Wichtig**: `s` ist die Anzahl ALLER gestarteten Boote der Klasse —
**inkl. ausländischer Crews**, die ggf. nicht als Sailor-Records
importiert sind. Implementierung:

```ts
const s = regatta.totalStarters ?? regatta.results.length;
```

`totalStarters` wird beim Import gepflegt (siehe §3.4) und kann vom
Admin auf der Regatta-Detailseite manuell korrigiert werden.

**Sonderfall „nur Startgebiet"**: Boote mit `inStartArea = true` und
`finalRank = null` bekommen `R_A = 0`, zählen aber m-fach in der
Werteliste.

Beim Import schlägt der Wizard die `inStartArea`-Checkbox automatisch
für folgende Race-Codes vor (RRS A11):

| Code | Bedeutung | Default |
|---|---|---|
| `OCS` | On Course Side at start (Frühstart, Recall ignoriert) | ✅ |
| `BFD` | Black Flag Disqualification (Frühstart unter Black Flag) | ✅ |
| `UFD` | U-Flag Disqualification (Frühstart unter U-Flag) | ✅ |
| `DNS` | Did Not Start (defensiv: erschienen, aber nicht über die Linie) | ✅ |
| `DNC` | Did Not Come (gar nicht erschienen) | ❌ |
| `DNF` | Did Not Finish (gestartet, aber nicht ins Ziel — gehört in den normalen Pool) | ❌ |
| `DSQ` `RET` `WFD` | gestartet, dann disqualifiziert/zurückgezogen | ❌ |

Der Default ist nur ein Vorschlag — der Admin kann pro Eintrag
toggeln. Single source of truth ist `IN_START_AREA_CODES` in
`lib/import/pdf-utils.ts`; Parser und Wizard importieren beide von
dort. Issue #60 für die Begründung der DNS-Aufnahme.

**R-Wert**: arithmetisches Mittel der **9 besten R_A-Werte** des Helms.
Mit weniger als 9 Wertungen → kein Listeneintrag.

**Multiplikator m** (`lib/scoring/multiplier.ts`): 1/2/3 bei 1/2/3
Wettfahrten, 4 ab 4 WF, **5 ab 6 WF wenn `multiDayAnnouncement = true`**.
Eine Regatta geht m-fach in die Werteliste eines Helms ein.

**Tiebreak** bei gleichem R: 1) höchster Einzel-R_A der Top 9,
2) Anzahl einfließender Wertungen.

### 2.2 Aktuelle Rangliste

- Gleicher Algorithmus wie Jahresrangliste
- **Wird nie persistiert** — nur live berechnet
- Stichtag = aktuelles Datum (statt 30.11.)
- Speichern ist explizit verboten (siehe `SAVEABLE_TYPES`)

### 2.3 IDJM-Quali (DSV MO Anlage Jugend, MO 10)

- Gleicher Algorithmus wie Jahresrangliste, aber:
- Altersprüfung gegen den **Saisonstichtag** (`referenceDate`) — das
  gesamte Saisonjahr gilt (identisch zu Jahresrangliste und JWM/JEM-Quali)
- Keine Pre-Filterung der Regatta-Ergebnisse, damit `s` ungefiltert bleibt
- Schwelle: `R ≥ 25` (Helms unterhalb fallen raus)
- Nur U19 oder U16
- Wird optional persistiert

### 2.4 JWM/JEM-Quali (Klassenspezifisch)

Anderes Modul — nutzt **NICHT** die DSV-Formel:

```
weightedScore = finalRank × (maxStarters / startersThisRegatta)
qualiScore    = Summe der 2 besten (niedrigsten) weightedScores
```

- Bis zu 4 Regatten ausgewählt, beste 2 zählen
- Nur Helms mit `Sailor.nationality = "GER"` (`germanOnly: true`
  in der Compute-Action)
- Tiebreak: 1) niedrigster bester Einzel-weightedScore,
  2) mehr Regatten teilgenommen

### 2.5 Schottenwechsel (nur JWM/JEM-Quali relevant)

Pro Helm ist **genau ein** genehmigter Schottenwechsel zulässig.
Ungenehmigte oder weitere Wechsel starten ein neues Team — der Helm
erscheint dann mehrfach in der Quali-Rangliste, einmal pro Crew-Konstellation.

| Situation | Verhalten |
|---|---|
| Gleiche Crew (oder bereits akzeptierte) | Eintrag zum aktuellen Team |
| Andere Crew + `crewSwapApproved = true` + Swap-Allowance frei | Team wird auf beide Crews erweitert, Allowance verbraucht |
| Andere Crew, ungenehmigt oder zweiter Wechsel | Aktuelles Team abgeschlossen, neues Team mit `splitFromSwap = true` |

UI: pro TeamEntry kleines ↻-Icon in der Regatta-Detail-Tabelle. Setzt
`crewSwapApproved` und optional `crewSwapNote`.

DSV-Jahresrangliste, Aktuelle Rangliste und IDJM **ignorieren** diesen
Flag vollständig.

---

## 3. Kategorien und Filter

### 3.1 Altersklassen (Saisonstichtag-basiert)

| Kategorie | Maximales Alter |
|---|---|
| U15 | 14 |
| U16 | 15 |
| U17 | 16 |
| U19 | 18 |
| U22 | 21 |
| Open | — |

**Regel: Das gesamte Saisonjahr gilt.**
Ein Segler qualifiziert sich für eine U-Klasse, wenn er im Saisonjahr das
Maximalalter nicht überschreitet — unabhängig davon, wann im Jahr eine
Regatta stattfindet. Formel: `Saisonjahr − Geburtsjahr ≤ Maximalalter`.

**Stichtag** (legt das Saisonjahr fest, nur Jahr-Teil wird ausgewertet):
- Jahresrangliste: `{Jahr}-11-30` (30.11. des Saisonjahrs)
- Aktuelle Rangliste: heutiges Datum (Saisonjahr = laufendes Jahr)
- IDJM-Quali: Saisonstichtag (`referenceDate`)
- JWM/JEM-Quali: konfigurierbarer Stichtag, Default `{Jahr}-12-31`

### 3.2 Gender-Kategorien

| Kategorie | Filter |
|---|---|
| Open | beide Geschlechter erlaubt |
| Männer | Helm UND Crew = `M` |
| Mix | beide ≠ null und unterschiedlich |
| Girls | Helm UND Crew = `F` |

### 3.3 Fehlende Stammdaten

Wenn `birthYear` oder `gender` an Helm oder Crew **nicht** gesetzt sind:
- Open-Open: Eintrag erlaubt (keine Filter aktiv)
- Jede gefilterte Kategorie: Eintrag wird **ausgeschlossen**

### 3.4 Nationalität

- `Sailor.nationality` default `"GER"`
- DSV-Rankings (Jahres, Aktuell, IDJM): **kein Nationalitäts-Filter**
  auf Helm-Seite — ausländische Helms könnten theoretisch in der
  Rangliste auftauchen, falls sie ≥ 9 Wertungen an deutschen Regatten
  haben (sehr selten in der Praxis)
- JWM/JEM-Quali: hartcodiert `germanOnly: true`
- Beim **Import** ist `germanOnly: true` der Default in der M2S-API
  (`fetchM2SResults`), damit die Sailor-Datenbank schlank bleibt.
  **Aber**: `totalStarters` wird **vor** dem Filter aus
  `EntryResults.length` berechnet, sodass `s` korrekt bleibt.

---

## 4. Import-Flow

### 4.1 Import-Quellen

| Quelle | Filter? | totalStarters-Quelle |
|---|---|---|
| M2S API (`fetchM2SResults`) | `germanOnly` (default true) | Pre-filter `EntryResults.length` |
| Web-Copy-Paste | nein | `entries.length` (= was im Paste war) |
| PDF (M2S, Sailwave, SailResults, Velaware) | nein | `entries.length` |

Für Auslandsregatten, deren Paste/PDF nur einen Teil der Crews
enthält, kann der User im Wizard-Preview-Schritt:
- den `totalStarters`-Wert manuell eintragen
- oder mit „Aus Manage2Sail abrufen" + URL die echte Klassen-
  Teilnehmerzahl per API holen

### 4.2 Persistierung beim Commit

`commitImportAction(regattaId, decisions, numRaces, totalStarters)`
schreibt in einer Transaktion:

1. `Regatta`: setzt `completedRaces`, `totalStarters` (wenn nicht
   undefined)
2. `ImportSession`: Audit-Log mit Match-Decisions
3. Pro Decision:
   - Helm: accept (existing Sailor) oder create (new Sailor)
   - Crew: accept / create / none
   - `TeamEntry` upsert (sicher gegen Re-Import dank
     `@@unique([regattaId, helmId])`)
   - `Result` mit finalRank, finalPoints, racePoints, inStartArea

### 4.3 Re-Import-Verhalten

- TeamEntries werden geupdatet (nicht dupliziert) wegen Unique-Constraint
- `totalStarters` wird **überschrieben**, wenn vom Parser/Wizard ein Wert
  übergeben wird. Der Preview-Schritt verwendet daher
  `regatta.totalStarters ?? parsedData.totalStarters` als Default,
  damit ein vorher manuell gepflegter Wert nicht stillschweigend
  zerstört wird

---

## 5. Public vs. Persistiert

| Ranking-Typ | Persistiert | Snapshot |
|---|---|---|
| Jahresrangliste | ja, am Stichtag (30.11.) | `Ranking` + `RankingRegatta` |
| Aktuelle Rangliste | nein | live berechnet pro Aufruf |
| IDJM-Quali | optional | wenn gespeichert: snapshot |
| JWM-Quali / JEM-Quali | optional | wenn gespeichert: snapshot |

Beim Anzeigen einer gespeicherten Rangliste wird die Berechnung
**immer** live wiederholt — die `Ranking`-Tabelle speichert nur die
Parameter (Saison, Kategorien, Regatten-Set), nicht die R-Werte. So
fließen nachträgliche Korrekturen (z.B. an `totalStarters` oder
`crewSwapApproved`) sofort in die Anzeige ein.

---

## 6. UI-Konventionen

### 6.1 Wo welche Berechnung passiert

- **Listen-/Tabellen-Anzeigen** (Vorschau, gespeicherte Ranglisten,
  öffentliche Ansichten): über `computeRankingAction` → `calculateDsvRanking`
- **Pro-Regatta-Detail** (öffentliche `regatta/[id]`-Seite):
  inline-Anzeige nutzt `calculateRA({ f, s, x })`-Helper aus
  `lib/scoring/dsv.ts`. Direkt im Server-Component berechnen ist
  okay, aber **immer** über den Helper, nie das `f * 100 * (...)`
  manuell hinschreiben — sonst entsteht Drift wie der `s`-Bug von
  2026-04-30 (zwei Berechnungspfade, einer fehlte das totalStarters-Update)
- **Steuermann-Detail**: über `computeHelmDetailAction` → liefert
  `top9` und `nonContributing` mit allen R_A-Werten

### 6.2 Saison-Normalisierung

Im Vorschau/Save-Form:
- `?season=2026` → impliziert `from=2026-01-01`, `ref=2026-11-30`
  (für JAHRESRANGLISTE/IDJM) oder `ref=heute` (für AKTUELLE im
  laufenden Jahr)
- Explizite `?from` / `?ref` Overrides haben Vorrang

---

## 7. Sicherheit / Auth

- Alle Server-Actions im `lib/actions/`-Verzeichnis prüfen
  `await auth()` und werfen `{ ok: false, error }` bei
  fehlender Session
- Audit-Log (`AuditLog`-Tabelle) speichert
  Login-Erfolge/-Fehler, Lockouts, Passkey-Events,
  Daten-Operationen (Backup/Restore/Delete) und kürzlich
  `LOGIN_OAUTH` / `LOGIN_OAUTH_REJECTED`
- OAuth (Google/MS/Apple/Meta) erlaubt nur Login mit E-Mail, die
  bereits einem `User`-Record entspricht — **kein Self-Sign-up**

---

## 8. Häufige Fehlerquellen / Debugging-Hinweise

### 8.1 „R-Werte sind negativ oder unsinnig"

→ `s` ist zu klein. Prüfen:
- `regatta.totalStarters` in der DB
- Anzeige in der Vorschau: „Einbezogene Regatten" zeigt `s=N` und
  `s=N*` (mit Override-Marker)
- Wenn keine Stelle 126 zeigt, war der Import nicht vollständig

### 8.2 „Helm taucht plötzlich mehrfach in JWM/JEM auf"

→ Schottenwechsel-Logik. In der Regatta-Tabelle prüfen, ob die
unterschiedlichen Crews durch genehmigten Wechsel verbunden sind.
Den ↻-Toggle setzen.

### 8.3 „Ranking enthält keinen Eintrag für Helm X"

→ Mögliche Ursachen:
1. Weniger als 9 Wertungen
2. Helm/Crew passt nicht zur Alters- oder Gender-Kategorie
3. IDJM: R < 25 → ausgefiltert
4. Stammdaten (`birthYear`/`gender`) fehlen → in gefilterten Kategorien
   automatisch raus

### 8.4 „totalStarters wird nach Re-Import zurückgesetzt"

→ Der Wizard nutzt jetzt einen Default `regatta.totalStarters ??
parsedData.totalStarters`. Wenn der User den Wert im Preview-Schritt
nicht aktiv ändert, bleibt der bestehende Wert erhalten.

---

## 9. Glossar

- **Helm / Steuermann**: stabile Ranglisten-Einheit
- **Crew / Vorschoter**: kann pro Regatta wechseln (Schottenwechsel)
- **TeamEntry**: 1 Helm + 1 (optionale) Crew bei 1 Regatta
- **Ranglistenfaktor f**: pro Regatta vergebener Multiplikator
  (DSV-Klassifizierung der Regatta-Bedeutung)
- **IDJM**: Internationale Deutsche Jugendmeisterschaft (DSV)
- **JWM**: Jugend-Weltmeisterschaft (Klassen-Quali)
- **JEM**: Jugend-Europameisterschaft (Klassen-Quali)
- **DSV-RO / MO**: Ranglisten-/Meldeordnung des Deutschen
  Segler-Verbands
- **Schottenwechsel**: Crew-Wechsel beim selben Helm zwischen Regatten
