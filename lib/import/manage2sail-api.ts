/**
 * Fetches regatta results from the community-discovered (undocumented but stable)
 * Manage2Sail API.
 *
 * Endpoints:
 *   GET /api/event/{eventId}/regattaresult/{classId}   ← results
 *   GET /api/event/{eventId}/regatta                   ← class list (best-effort)
 *
 * The eventId is the UUID in the event page URL.
 * The classId (= regattaId in Manage2Sail nomenclature) identifies a specific
 * class / fleet within the event.
 *
 * Key API quirks:
 *  - TotalPoints / NetPoints are *strings*, not numbers  → parseFloat()
 *  - Points in EntryRaceResults is a string too          → parseFloat()
 *  - PointsDiscarded is only present (and true) on discarded scores
 *  - RaceStatusCode (e.g. "DNF") is a separate field from Points
 *  - Rank is absent on penalty rows
 *  - EntryRaceResults may contain empty {} objects for unsailed races
 *  - Crew1Name / CrewList[0] use "N/A" as sentinel for "no crew"
 */

import type { ParsedEntry, ParsedRaceScore, ParsedRegatta } from "./manage2sail-paste";
import type { ParsedRegattaRow } from "./parse-regatta-list";
import { detectInStartArea } from "./pdf-utils";

const BASE = "https://www.manage2sail.com";

// ── Internal API type definitions ──────────────────────────────────────────────

interface ApiRaceResult {
  RaceId?: string;
  Points?: string;
  Fleet?: string;
  RaceType?: number;
  Rank?: number;
  OverallRaceIndex?: number;
  RaceStatusCode?: string;
  PointsDiscarded?: boolean;
}

interface ApiName {
  FirstName: string;
  LastName: string;
}

interface ApiEntryResult {
  Id: string;
  Rank: number;
  TeamName: string;
  Name?: string;
  Crew?: string;
  Crew1Name?: string;
  SailNumber?: string;
  SailNumberCountry?: string;
  Country?: string;
  ClubName?: string;
  TotalPoints?: string;
  NetPoints?: string;
  Skipper?: ApiName;
  CrewList?: ApiName[];
  EntryRaceResults: ApiRaceResult[];
}

interface ApiResultsResponse {
  RegattaName: string;
  RaceCount: number;
  LastRaceIndex: number;
  EntryResults: ApiEntryResult[];
}

interface ApiClassEntry {
  Id: string;
  Name: string;
  HasCrew?: boolean;
}

// ── URL parsing ────────────────────────────────────────────────────────────────

export interface M2SIds {
  eventId: string;
  classId?: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True when s is a 36-char hex UUID, false when it is an alias (e.g. "LJMMV2025"). */
function isUuid(s: string): boolean {
  return UUID_RE.test(s);
}

/**
 * If eventIdOrAlias is already a UUID, returns it unchanged.
 * Otherwise fetches the event page HTML and extracts the real UUID from the
 * embedded `api/event/{uuid}` references.
 */
async function resolveEventUUID(eventIdOrAlias: string): Promise<string> {
  if (isUuid(eventIdOrAlias)) return eventIdOrAlias.toLowerCase();

  const res = await fetch(`${BASE}/de-DE/event/${eventIdOrAlias}`, {
    headers: { Accept: "text/html", "User-Agent": "Mozilla/5.0" },
    cache: "no-store",
  });
  if (!res.ok)
    throw new Error(`Manage2Sail-Seite nicht erreichbar: HTTP ${res.status}`);

  const html = await res.text();
  // The page embeds the real UUID in inline JS as /api/event/{uuid}
  const match = html.match(
    /\/api\/event\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i
  );
  if (!match)
    throw new Error(
      `Konnte die Event-UUID für „${eventIdOrAlias}" nicht ermitteln. ` +
        "Bitte kopiere die vollständige URL mit der echten Event-ID."
    );
  return match[1].toLowerCase();
}

/**
 * Extract eventId and (optional) classId from any Manage2Sail URL.
 *
 * Supports:
 *   https://www.manage2sail.com/de-DE/event/{uuid}
 *   https://www.manage2sail.com/de-DE/event/{uuid}#!/results?classId={uuid}
 *   https://www.manage2sail.com/de-DE/event/{alias}#!/results?classId={uuid}
 *
 * eventId may be a UUID or an alias (e.g. "LJMMV2025").
 * Returns null if no /event/ segment is found.
 */
export function parseM2SUrl(url: string): M2SIds | null {
  // Match UUID or alphanumeric alias after /event/
  const eventMatch = url.match(/\/event\/([0-9a-zA-Z_-]+)/i);
  if (!eventMatch) return null;

  const eventId = eventMatch[1];

  // classId must still be a UUID
  const classMatch = url.match(/[?&]classId=([0-9a-f-]{36})/i);
  const classId = classMatch?.[1].toLowerCase();

  return { eventId, classId };
}

// ── API calls ──────────────────────────────────────────────────────────────────

/**
 * Extract the first JSON object that starts after `marker` in `html`.
 * Uses a string-aware bracket counter to handle nested objects correctly.
 */
function extractBootstrapObject(html: string, marker: string): unknown | null {
  const markerIdx = html.indexOf(marker);
  if (markerIdx === -1) return null;

  const start = html.indexOf("{", markerIdx + marker.length);
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < html.length; i++) {
    const ch = html[i];
    if (escape) { escape = false; continue; }
    if (ch === "\\" && inString) { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        try { return JSON.parse(html.slice(start, i + 1)); } catch { return null; }
      }
    }
  }
  return null;
}

/**
 * Fetch the list of classes / fleets for an event.
 *
 * Manage2Sail has no REST endpoint for this. The class list is bootstrapped
 * into the event page HTML as:
 *   window.boostrapedResourceData = { "Regatta": [{Id, Name, HasResults, …}, …], … };
 * (note: intentional typo "boostraped" in their codebase)
 */
export async function fetchEventClasses(
  eventIdOrAlias: string
): Promise<{ id: string; name: string; resolvedEventId: string }[] | { error: string }> {
  let res: Response;
  const urlPath = `${BASE}/de-DE/event/${eventIdOrAlias}`;
  try {
    res = await fetch(urlPath, {
      headers: { Accept: "text/html", "User-Agent": "Mozilla/5.0" },
      cache: "no-store",
    });
  } catch (e) {
    return { error: `Netzwerkfehler: ${e instanceof Error ? e.message : String(e)}` };
  }

  if (!res.ok) {
    return {
      error:
        `Manage2Sail Seite nicht erreichbar (HTTP ${res.status}). ` +
        `Bitte prüfe ob die Event-URL korrekt ist.`,
    };
  }

  const html = await res.text();

  // Resolve alias → real UUID from embedded /api/event/{uuid} references
  const uuidMatch = html.match(
    /\/api\/event\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i
  );
  const resolvedEventId = uuidMatch
    ? uuidMatch[1].toLowerCase()
    : isUuid(eventIdOrAlias)
    ? eventIdOrAlias.toLowerCase()
    : null;

  if (!resolvedEventId) {
    return {
      error:
        "Konnte die Event-UUID nicht ermitteln. Bitte kopiere die URL mit classId= direkt aus dem Browser.",
    };
  }

  const data = extractBootstrapObject(html, "window.boostrapedResourceData = ");
  if (!data || typeof data !== "object") {
    return {
      error:
        "Klassenliste konnte nicht aus der Manage2Sail-Seite gelesen werden. " +
        "Bitte kopiere stattdessen die vollständige URL mit classId= aus dem Browser.",
    };
  }

  const regattas = (data as Record<string, unknown>)["Regatta"];
  if (!Array.isArray(regattas)) {
    return { error: "Keine Klassen auf dieser Manage2Sail-Veranstaltung gefunden." };
  }

  const classes = regattas
    .filter(
      (r): r is ApiClassEntry =>
        r && typeof r === "object" && "Id" in r && "Name" in r
    )
    .map((r) => ({ id: r.Id, name: r.Name, resolvedEventId }));

  if (classes.length === 0) {
    return { error: "Diese Veranstaltung hat keine auswählbaren Klassen." };
  }

  return classes;
}

/**
 * Fetch and parse results for a specific class.
 *
 * @param germanOnly  When true (default), only entries with SailNumberCountry === "GER"
 *                    or no country at all (domestic regatta) are returned.
 *                    Important: regardless of the filter, the total starter
 *                    count from the original API response is captured in
 *                    `result.totalStarters`, sodass `s` für die DSV-Berechnung
 *                    korrekt ist (auch bei Auslandsregatten mit gemischten
 *                    Feldern).
 */
export async function fetchM2SResults(
  eventIdOrAlias: string,
  classId: string,
  { germanOnly = true }: { germanOnly?: boolean } = {}
): Promise<{ regattaName: string; result: ParsedRegatta }> {
  // Resolve alias → real UUID if necessary (API only accepts UUIDs)
  const eventId = await resolveEventUUID(eventIdOrAlias);
  const url = `${BASE}/api/event/${eventId}/regattaresult/${classId}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });

  if (res.status === 404) {
    throw new Error(
      "Ergebnisse nicht gefunden. Bitte prüfe Event-ID und Klassen-ID."
    );
  }
  if (!res.ok) {
    throw new Error(`Manage2Sail API: ${res.status} ${res.statusText}`);
  }

  const data: ApiResultsResponse = await res.json();

  const entries: ParsedEntry[] = [];

  // Vor dem Filter: Gesamtteilnehmerzahl der Regatta (inkl. ausländische
  // Crews). Wird später als totalStarters auf der Regatta gespeichert,
  // damit `s` für die DSV-Berechnung korrekt ist.
  const totalStarters = (data.EntryResults ?? []).length;

  for (const er of data.EntryResults ?? []) {
    // ── GER filter ──────────────────────────────────────────────────────────
    if (germanOnly) {
      const country = (er.SailNumberCountry ?? er.Country ?? "")
        .toUpperCase()
        .trim();
      // Non-empty country that is not GER → skip
      if (country && country !== "GER") continue;
    }

    // ── Helm name ───────────────────────────────────────────────────────────
    // Prefer pre-split Skipper object; fall back to TeamName string
    const helmFirstName = er.Skipper?.FirstName?.trim() ?? "";
    const helmLastName = er.Skipper?.LastName?.trim() ?? er.TeamName?.trim() ?? "";
    if (!helmFirstName && !helmLastName) continue;

    // ── Crew name ───────────────────────────────────────────────────────────
    // "N/A" is the Manage2Sail sentinel for "no crew registered"
    let crewFirstName: string | null = null;
    let crewLastName: string | null = null;
    const cl = er.CrewList?.[0];
    if (cl && cl.FirstName !== "N/A" && cl.LastName !== "N/A") {
      crewFirstName = cl.FirstName?.trim() || null;
      crewLastName = cl.LastName?.trim() || null;
    }

    // ── Race scores ─────────────────────────────────────────────────────────
    const raceScores: ParsedRaceScore[] = [];
    for (const rr of er.EntryRaceResults ?? []) {
      // Skip empty objects (unsailed races have no OverallRaceIndex or Points)
      if (!rr.OverallRaceIndex || rr.Points === undefined) continue;

      const points = parseFloat(rr.Points);
      if (isNaN(points)) continue;

      raceScores.push({
        race: rr.OverallRaceIndex,
        points,
        isDiscard: rr.PointsDiscarded === true,
        code: rr.RaceStatusCode?.toUpperCase() || undefined,
      });
    }

    entries.push({
      rank: er.Rank,
      sailNumber: er.SailNumber?.trim() || null,
      helmFirstName,
      helmLastName,
      crewFirstName,
      crewLastName,
      club: er.ClubName?.trim() || null,
      totalPoints: er.TotalPoints ? parseFloat(er.TotalPoints) : null,
      netPoints: er.NetPoints ? parseFloat(er.NetPoints) : null,
      raceScores,
      inStartAreaSuggestion: detectInStartArea(raceScores),
    });
  }

  // numRaces: use LastRaceIndex (completed races), fall back to manual max
  const numRaces =
    data.LastRaceIndex ??
    (entries.length > 0
      ? Math.max(0, ...entries.flatMap((e) => e.raceScores.map((s) => s.race)))
      : 0);

  return {
    regattaName: data.RegattaName ?? "",
    result: { entries, numRaces, totalStarters },
  };
}

// ── Class-Association regatta list ────────────────────────────────────────────

/** UUID of the 420er Klassenvereinigung on Manage2Sail */
const CA_ID = "62a2158f-24d2-4d26-8d4f-06f30408edb5";

export interface M2SRegattaCandidate extends ParsedRegattaRow {
  /** Full event URL, empty string when entry has no Manage2Sail link */
  sourceUrl: string;
  /** Event UUID, empty string when not available */
  eventId: string;
  /** "Wettfahrten" column from the M2S class-association page (planned races) */
  m2sRaces: number;
}

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&auml;/g, "ä")
    .replace(/&ouml;/g, "ö")
    .replace(/&uuml;/g, "ü")
    .replace(/&Auml;/g, "Ä")
    .replace(/&Ouml;/g, "Ö")
    .replace(/&Uuml;/g, "Ü")
    .replace(/&szlig;/g, "ß")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function parseGermanDate(s: string): string | null {
  const m = s.trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (!m) return null;
  return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
}

function parseClassAssociationHtml(html: string): M2SRegattaCandidate[] {
  const results: M2SRegattaCandidate[] = [];

  // Match each <tr> that starts with a date cell (width 10%)
  // Columns: date | name (with optional link) | class | country | factor | races
  const rowRe =
    /<tr[^>]*>\s*<td[^>]*>([^<]{6,30})<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<td[^>]*>([^<]+)<\/td>\s*<td[^>]*>([^<]+)<\/td>\s*<td[^>]*>([^<]+)<\/td>\s*<td[^>]*>([^<]+)<\/td>\s*<\/tr>/g;

  for (const match of html.matchAll(rowRe)) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [, rawDate, nameCell, _rawClass, rawCountry, rawFactor, rawRaces] = match;

    // Parse date range "DD.MM.YYYY - DD.MM.YYYY"
    const dateParts = rawDate.trim().split(/\s*-\s*/);
    const startDate = parseGermanDate(dateParts[0]);
    const endDate = parseGermanDate(dateParts[dateParts.length - 1]);
    if (!startDate || !endDate) continue;

    const numDays =
      Math.round(
        (new Date(endDate).getTime() - new Date(startDate).getTime()) / 86_400_000
      ) + 1;

    // Factor: "1,10" → 1.1
    const factor = parseFloat(rawFactor.trim().replace(",", "."));
    if (isNaN(factor) || factor < 0.5 || factor > 3.0) continue;

    // Races
    const plannedRaces = parseInt(rawRaces.trim()) || 0;

    // Name and optional event link
    const linkMatch = nameCell.match(/href="(\/de-DE\/event\/([^"]+))"[^>]*>([^<]+)</);
    let name: string;
    let eventId: string;
    let sourceUrl: string;

    if (linkMatch) {
      name = decodeHtmlEntities(linkMatch[3].trim());
      eventId = linkMatch[2].trim();
      sourceUrl = `${BASE}${linkMatch[1]}`;
    } else {
      // No link — plain text
      const text = nameCell.replace(/<[^>]+>/g, "").trim();
      if (!text) continue;
      name = decodeHtmlEntities(text);
      eventId = "";
      sourceUrl = "";
    }

    results.push({
      name,
      startDate,
      endDate,
      numDays,
      country: rawCountry.trim(),
      ranglistenFaktor: factor,
      completedRaces: 0,
      multiDayAnnouncement: numDays >= 3 && plannedRaces >= 6,
      sourceUrl,
      eventId,
      m2sRaces: plannedRaces,
    });
  }

  return results;
}

/**
 * Fetch the 420er class-association regatta list for a given year.
 * Returns an array of candidates compatible with the existing import flow,
 * extended with sourceUrl and eventId fields.
 */
export async function fetchClassAssociationRegattas(
  year: number
): Promise<M2SRegattaCandidate[] | { error: string }> {
  let res: Response;
  try {
    res = await fetch(
      `${BASE}/de-DE/ClassAssociation/Detail/${CA_ID}?tab=regattas&year=${year}`,
      { headers: { Accept: "text/html", "User-Agent": "Mozilla/5.0" }, cache: "no-store" }
    );
  } catch (e) {
    return { error: `Netzwerkfehler: ${e instanceof Error ? e.message : String(e)}` };
  }

  if (!res.ok)
    return { error: `Manage2Sail Seite nicht erreichbar: HTTP ${res.status}` };

  const html = await res.text();
  const candidates = parseClassAssociationHtml(html);

  if (candidates.length === 0)
    return { error: `Keine Regatten für ${year} gefunden.` };

  return candidates;
}
