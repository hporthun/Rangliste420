# Erste Schritte mit Claude Code

Diese Anleitung führt dich vom leeren Ordner zum ersten lauffähigen Prototyp.

## 1. Projekt-Ordner vorbereiten

```bash
mkdir 420er-rangliste
cd 420er-rangliste
```

Lege die drei mitgelieferten Dateien in diesen Ordner:
- `PLAN.md` (Spezifikation)
- `CLAUDE.md` (Konventionen)
- Diese `README-erste-schritte.md` (zum Nachlesen)

## 2. Claude Code installieren (einmalig)

```bash
npm install -g @anthropic-ai/claude-code
```

Voraussetzung: Node.js 18+ und ein Anthropic-Account.

## 3. Claude Code starten

```bash
claude
```

Beim ersten Start wirst du durch die Authentifizierung geführt.

## 4. Erste Session: Projekt verstehen lassen

Sag Claude Folgendes (ruhig wortwörtlich):

> Lies zuerst PLAN.md und CLAUDE.md gründlich. Fasse mir danach in 5 Stichpunkten zusammen, was du verstanden hast. Geh dabei besonders auf das Thema Schottenwechsel und die JWM-Quali-Logik ein. Stelle mir anschließend alle offenen Fragen, die vor dem Coden geklärt werden müssen. Fange noch nicht mit dem Code an.

**Warum so?** Du stellst sicher, dass Claude den Plan tatsächlich gelesen hat und keine falschen Annahmen trifft. Die JWM-Quali-Regel ist der komplexeste Teil — hier sind saubere Zahlenbeispiele vor dem Coden Gold wert.

## 5. Offene Fragen klären (siehe PLAN.md unten)

Bevor das Coden losgeht, beantworte die "Offenen Fragen" aus PLAN.md. Am wichtigsten:

- Wie wird ein Team gewertet, das nur in 1–2 der 3 Quali-Regatten war?
- Gewichtung nach Gesamt-Teilnehmern oder nur deutschen?
- Altersklassen-Wertungen gewünscht?

Du kannst die Antworten direkt in PLAN.md eintragen (Abschnitt "JWM/JEM-Quali-Rangliste" konkretisieren) oder Claude sie eintragen lassen.

## 6. Setup-Schritt

Nach der Klärung:

> Richte jetzt das Projekt ein: Next.js 15 mit TypeScript, Tailwind, shadcn/ui, Prisma mit SQLite, NextAuth, Vitest. Erstelle die Ordnerstruktur aus PLAN.md und ein initiales Prisma-Schema gemäß Datenmodell (inkl. TeamEntry für Schottenwechsel-Unterstützung). Mache nach dem Setup einen ersten Git-Commit.

## 7. Iterativ weiterbauen

Arbeite Milestone für Milestone (siehe PLAN.md → "Milestones"). Faustregel: Jede Aufgabe an Claude sollte in unter 30 Minuten fertig sein.

**Reihenfolge-Empfehlung:**
1. Grund-Setup + Seglerverwaltung (auch zum Vertrautwerden)
2. Regatta-CRUD + manuelle Result-Eingabe
3. Scoring-Engine (Standard-Fall zuerst, mit Tests!)
4. Manage2Sail-Parser (mit echten Fixture-Dateien)
5. Matching-Assistent
6. Standard-Rangliste + öffentliche Ansicht
7. **JWM-Quali-Logik zuletzt** — diese braucht am meisten Test-Aufmerksamkeit

## 8. Testdaten sammeln

Parallel zum Aufbau: Lade dir 3–5 echte Manage2Sail-Ergebnislisten der 420er-Klasse herunter (Excel oder CSV), idealerweise:
- Eine kleine Regatta (10–20 Teams)
- Eine große Regatta mit internationaler Beteiligung (wichtig für JWM-Quali-Tests!)
- Eine mehrtägige Regatta mit Layday
- Eine mit DNF/DNS-Einträgen

Ablage unter `__fixtures__/manage2sail/`.

## 9. Wenn Claude den Faden verliert

- `/clear` im Chat setzt den Kontext zurück
- Verweise auf PLAN.md und CLAUDE.md neu, falls nötig
- Bei Fehlern: "Schau dir den aktuellen Fehler an und schlage drei mögliche Ursachen vor, bevor du etwas änderst."
- Bei komplexen Änderungen: "Mache einen Plan, bevor du Code schreibst. Zeige mir den Plan, ich gebe grünes Licht, dann implementierst du."

## 10. Typische Stolperstellen

- **Port-Konflikte:** Falls 3000 belegt, `npm run dev -- -p 3001`
- **Prisma-Fehler nach Schema-Änderung:** `npx prisma generate`
- **SQLite in Produktion funktioniert nicht auf Vercel:** Umstellung auf Postgres ist Teil von Milestone 6

## Wann wieder mit mir sprechen?

- Wenn die JWM-Quali-Logik schwieriger wird als auf dem Papier
- Vor dem ersten Deployment (Konfiguration Vercel + Neon)
- Wenn ein Manage2Sail-Format nicht sauber geparst wird
- Bei Performance-Problemen mit großen Ergebnislisten

Viel Erfolg! 🛥️
