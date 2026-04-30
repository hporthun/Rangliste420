/**
 * Server-Actions: Ergebnis-Import-Wizard.
 *
 * Orchestriert den 5-Schritte-Wizard (source → metadata → matching →
 * preview → commit). Pure-Function-Parser und Fuzzy-Matching liegen in
 * `lib/import/` — diese Datei ist die Glue-Schicht zwischen UI-Components
 * und der DB.
 *
 * Workflow:
 *
 *   ┌────────────────────────────┐
 *   │  source-step (Tab-Auswahl) │
 *   └────────────┬───────────────┘
 *                │  parseTextAction      (Paste)
 *                │  parsePdfAction       (PDF, Auto-Format-Erkennung)
 *                │  fetchM2SResultsAction(API mit germanOnly-Filter)
 *                │  fetchM2SClassesAction(Klassen-Liste vor classId-Wahl)
 *                ▼
 *   ┌────────────────────────────┐
 *   │  metadata-step             │
 *   └────────────┬───────────────┘
 *                │  getMatchSuggestionsAction (fuzzy match je Helm/Crew)
 *                ▼
 *   ┌────────────────────────────┐
 *   │  matching-step + preview   │
 *   └────────────┬───────────────┘
 *                │  fetchM2STotalStartersAction (optional: echte
 *                │     Gesamtteilnehmerzahl aus M2S-API für s)
 *                ▼
 *   ┌────────────────────────────┐
 *   │  commit                    │  commitImportAction
 *   │                            │   ├── Regatta.update (numRaces, totalStarters)
 *   │                            │   ├── ImportSession.create (Audit)
 *   │                            │   ├── pro Decision:
 *   │                            │   │     Sailor.upsert (Helm/Crew)
 *   │                            │   │     TeamEntry.upsert
 *   │                            │   │     Result.upsert
 *   └────────────────────────────┘
 *
 * Schreibt in: `Sailor`, `TeamEntry`, `Result`, `Regatta` (totalStarters
 * + completedRaces), `ImportSession`.
 *
 * Auth: alle Actions erfordern eine gültige Session.
 *
 * Wichtige Invarianten:
 * - `germanOnly: true` (default in `fetchM2SResults`) — Sailor-DB bleibt
 *   schlank; aber `totalStarters` wird VOR dem Filter berechnet, damit
 *   `s` für die R_A-Formel korrekt bleibt
 * - Re-Import einer Regatta: TeamEntry/Result werden upserted (nicht
 *   dupliziert) dank `@@unique([regattaId, helmId])`
 * - `totalStarters` wird nur überschrieben, wenn der Wizard einen Wert
 *   übergibt; das verhindert das stille Zurücksetzen bei Re-Import
 */
"use server";

import { db } from "@/lib/db/client";
import { parsePaste } from "@/lib/import/manage2sail-paste";
import { parsePdf } from "@/lib/import/pdf-auto-detect";
import { findMatches } from "@/lib/import/matching";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { detectGender } from "@/lib/import/detect-gender";
import { toTitleCase } from "@/lib/import/normalize";
import { parseM2SUrl, fetchM2SResults, fetchEventClasses } from "@/lib/import/manage2sail-api";
import type { ParsedRegatta } from "@/lib/import/manage2sail-paste";
import type {
  SailorSummary,
  EntryMatchSuggestion,
  EntryDecision,
} from "@/lib/import/types";

// ── Parse actions ─────────────────────────────────────────────────────────────

export async function fetchM2SResultsAction(
  url: string
): Promise<
  | { ok: true; data: ParsedRegatta; regattaName: string }
  | { ok: false; error: string }
> {
  const session = await auth();
  if (!session) return { ok: false, error: "Nicht angemeldet." };
  try {
    const ids = parseM2SUrl(url);
    if (!ids) {
      return {
        ok: false,
        error:
          "Keine gültige Manage2Sail-URL erkannt. Die URL muss eine Event-UUID enthalten.",
      };
    }
    if (!ids.classId) {
      return {
        ok: false,
        error:
          "Die URL enthält keine Klassen-ID (classId=…). Bitte auf manage2sail.com " +
          "zur gewünschten Klasse → Ergebnisse navigieren und dann die URL kopieren.",
      };
    }

    const { regattaName, result } = await fetchM2SResults(ids.eventId, ids.classId);

    if (result.entries.length === 0) {
      return {
        ok: false,
        error:
          "Keine deutschen Teilnehmer gefunden oder Ergebnisse noch nicht veröffentlicht.",
      };
    }

    return { ok: true, data: result, regattaName };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function fetchM2SClassesAction(
  eventIdOrAlias: string
): Promise<
  | { ok: true; classes: { id: string; name: string }[]; resolvedEventId: string }
  | { ok: false; error: string }
> {
  const session = await auth();
  if (!session) return { ok: false, error: "Nicht angemeldet." };
  try {
    const result = await fetchEventClasses(eventIdOrAlias);
    if (!Array.isArray(result)) {
      return { ok: false, error: result.error };
    }
    const resolvedEventId = result[0]?.resolvedEventId ?? eventIdOrAlias;
    return { ok: true, classes: result.map(({ id, name }) => ({ id, name })), resolvedEventId };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Fragt nur die Gesamtteilnehmerzahl einer M2S-Regatta-Klasse ab — ohne
 * die Ergebnisse zu parsen oder zu importieren. Wird vom Import-Wizard
 * benutzt, um nach einem Paste-Import die echte Anzahl gestarteter Boote
 * von Manage2Sail zu holen, falls der Paste nur einen Teil enthält
 * (z.B. nur die deutschen Crews einer Auslandsregatta).
 *
 * Akzeptiert die gleichen URLs wie der API-Import (event-UUID/Alias
 * + optional classId).
 */
export async function fetchM2STotalStartersAction(
  url: string
): Promise<
  | { ok: true; total: number; classCount: number | null }
  | { ok: false; error: string }
> {
  const session = await auth();
  if (!session) return { ok: false, error: "Nicht angemeldet." };
  try {
    const ids = parseM2SUrl(url);
    if (!ids) {
      return {
        ok: false,
        error: "Keine gültige Manage2Sail-URL erkannt.",
      };
    }
    if (!ids.classId) {
      return {
        ok: false,
        error:
          "URL enthält keine Klassen-ID. Bitte zur 420er-Klasse → Ergebnisse navigieren und URL kopieren.",
      };
    }
    // germanOnly weiter true, damit nur die deutschen Crews als entries
    // zurückkommen — wir interessieren uns aber für die VOR-Filter-Anzahl,
    // die der Parser sowieso als totalStarters mit zurückliefert.
    const { result } = await fetchM2SResults(ids.eventId, ids.classId);
    return {
      ok: true,
      total: result.totalStarters ?? result.entries.length,
      classCount: result.entries.length,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function parseTextAction(
  text: string
): Promise<{ ok: true; data: ParsedRegatta } | { ok: false; error: string }> {
  const session = await auth();
  if (!session) return { ok: false, error: "Nicht angemeldet." };
  try {
    const data = parsePaste(text);
    if (data.entries.length === 0)
      return { ok: false, error: "Keine Einträge gefunden. Bitte prüfe das Format." };
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

export async function parsePdfAction(
  formData: FormData
): Promise<
  | { ok: true; data: ParsedRegatta; format: string }
  | { ok: false; error: string }
> {
  const session = await auth();
  if (!session) return { ok: false, error: "Nicht angemeldet." };
  try {
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return { ok: false, error: "Keine PDF-Datei erhalten." };
    }
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      return { ok: false, error: "Bitte nur PDF-Dateien hochladen." };
    }
    const buffer = await file.arrayBuffer();
    const { format, result } = await parsePdf(buffer);
    return { ok: true, data: result, format };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

// ── Match suggestions ─────────────────────────────────────────────────────────


export async function getMatchSuggestionsAction(
  entries: Array<{
    helmFirstName: string;
    helmLastName: string;
    crewFirstName: string | null;
    crewLastName: string | null;
    sailNumber: string | null;
  }>
): Promise<
  | { ok: true; data: { suggestions: EntryMatchSuggestion[]; allSailors: SailorSummary[] } }
  | { ok: false; error: string }
> {
  const session = await auth();
  if (!session) return { ok: false, error: "Nicht angemeldet." };
  try {
    const sailors = await db.sailor.findMany({
      select: {
        id: true,
        firstName: true,
        lastName: true,
        sailingLicenseId: true,
        alternativeNames: true,
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    });

    const allSailors: SailorSummary[] = sailors.map((s) => ({
      id: s.id,
      firstName: s.firstName,
      lastName: s.lastName,
      sailingLicenseId: s.sailingLicenseId,
    }));

    const suggestions: EntryMatchSuggestion[] = entries.map((entry, index) => {
      const helmMatches = findMatches(
        entry.helmFirstName,
        entry.helmLastName,
        entry.sailNumber,
        sailors
      );

      let crew: EntryMatchSuggestion["crew"] = null;
      if (entry.crewFirstName && entry.crewLastName) {
        const crewMatches = findMatches(
          entry.crewFirstName,
          entry.crewLastName,
          undefined,
          sailors
        );
        crew = {
          query: { firstName: entry.crewFirstName, lastName: entry.crewLastName },
          matches: crewMatches,
        };
      }

      return {
        entryIndex: index,
        helm: {
          query: {
            firstName: entry.helmFirstName,
            lastName: entry.helmLastName,
            sailNumber: entry.sailNumber,
          },
          matches: helmMatches,
        },
        crew,
      };
    });

    return { ok: true, data: { suggestions, allSailors } };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

// ── Commit ────────────────────────────────────────────────────────────────────


export async function commitImportAction(
  regattaId: string,
  decisions: EntryDecision[],
  numRaces: number,
  /**
   * Anzahl gestarteter Boote insgesamt (inkl. ausländischer Crews, die
   * ggf. nicht importiert wurden). Wird auf die Regatta gespeichert und
   * für `s` in der DSV-Formel benutzt.
   */
  totalStarters?: number
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const session = await auth();
    if (!session) return { ok: false, error: "Nicht angemeldet." };

    await db.$transaction(async (tx) => {
      // Update completedRaces + totalStarters on the regatta to reflect the imported data
      await tx.regatta.update({
        where: { id: regattaId },
        data: {
          completedRaces: numRaces,
          ...(totalStarters !== undefined && { totalStarters }),
        },
      });

      await tx.importSession.create({
        data: {
          regattaId,
          createdBy: session.user.email ?? "unknown",
          parserType: "MANAGE2SAIL_PASTE",
          matchDecisions: JSON.stringify({
            accepted: decisions
              .filter((d) => d.helmDecision.type === "accept")
              .map((d) => d.entryIndex),
            created: decisions
              .filter((d) => d.helmDecision.type === "create")
              .map((d) => d.entryIndex),
          }),
        },
      });

      for (const decision of decisions) {
        // Resolve helm
        let helmId: string;
        if (decision.helmDecision.type === "accept") {
          helmId = decision.helmDecision.sailorId;
          // Update alt name if requested
          if (decision.helmDecision.addAltName) {
            const sailor = await tx.sailor.findUnique({
              where: { id: helmId },
              select: { alternativeNames: true },
            });
            if (sailor) {
              const names: string[] = JSON.parse(sailor.alternativeNames);
              if (!names.includes(decision.helmDecision.addAltName)) {
                await tx.sailor.update({
                  where: { id: helmId },
                  data: {
                    alternativeNames: JSON.stringify([
                      ...names,
                      decision.helmDecision.addAltName,
                    ]),
                  },
                });
              }
            }
          }
          // Fill in club/gender if not yet set on existing sailor
          const helmCurrent = await tx.sailor.findUnique({
            where: { id: helmId },
            select: { gender: true, firstName: true, club: true },
          });
          if (helmCurrent) {
            const helmUpdate: Record<string, unknown> = {};
            if (!helmCurrent.club && decision.club) helmUpdate.club = decision.club;
            if (!helmCurrent.gender) {
              const detected = detectGender(helmCurrent.firstName).gender;
              if (detected) helmUpdate.gender = detected;
            }
            if (Object.keys(helmUpdate).length > 0)
              await tx.sailor.update({ where: { id: helmId }, data: helmUpdate });
          }
        } else {
          const helmFirstName = toTitleCase(decision.helmDecision.firstName);
          const helmGender = detectGender(helmFirstName).gender;
          const s = await tx.sailor.create({
            data: {
              firstName: helmFirstName,
              lastName: toTitleCase(decision.helmDecision.lastName),
              gender: helmGender,
              club: decision.club,
            },
          });
          helmId = s.id;
        }

        // Resolve crew
        let crewId: string | null = null;
        if (decision.crewDecision.type === "accept") {
          crewId = decision.crewDecision.sailorId;
          // Fill in club/gender if not yet set on existing sailor
          const crewCurrent = await tx.sailor.findUnique({
            where: { id: crewId },
            select: { gender: true, firstName: true, club: true },
          });
          if (crewCurrent) {
            const crewUpdate: Record<string, unknown> = {};
            if (!crewCurrent.club && decision.club) crewUpdate.club = decision.club;
            if (!crewCurrent.gender) {
              const detected = detectGender(crewCurrent.firstName).gender;
              if (detected) crewUpdate.gender = detected;
            }
            if (Object.keys(crewUpdate).length > 0)
              await tx.sailor.update({ where: { id: crewId }, data: crewUpdate });
          }
        } else if (decision.crewDecision.type === "create") {
          const crewFirstName = toTitleCase(decision.crewDecision.firstName);
          const crewGender = detectGender(crewFirstName).gender;
          const s = await tx.sailor.create({
            data: {
              firstName: crewFirstName,
              lastName: toTitleCase(decision.crewDecision.lastName),
              gender: crewGender,
              club: decision.club,
            },
          });
          crewId = s.id;
        }

        // TeamEntry (upsert for safe re-import)
        const teamEntry = await tx.teamEntry.upsert({
          where: { regattaId_helmId: { regattaId, helmId } },
          create: { regattaId, helmId, crewId, sailNumber: decision.sailNumber },
          update: { crewId, sailNumber: decision.sailNumber },
        });

        // Result (upsert for safe re-import)
        await tx.result.upsert({
          where: { teamEntryId: teamEntry.id },
          create: {
            regattaId,
            teamEntryId: teamEntry.id,
            finalRank: decision.finalRank,
            finalPoints: decision.finalPoints ?? undefined,
            racePoints: JSON.stringify(decision.racePoints),
            inStartArea: decision.inStartArea,
          },
          update: {
            finalRank: decision.finalRank,
            finalPoints: decision.finalPoints ?? undefined,
            racePoints: JSON.stringify(decision.racePoints),
            inStartArea: decision.inStartArea,
          },
        });
      }
    });

    revalidatePath("/admin/regatten");
    revalidatePath(`/admin/regatten/${regattaId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}
