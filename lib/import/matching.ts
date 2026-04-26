import { distance } from "fastest-levenshtein";
import { normalizeName, nameVariants } from "./normalize";

export type MatchCandidate = {
  id: string;
  firstName: string;
  lastName: string;
  sailingLicenseId?: string | null;
  alternativeNames?: string; // JSON string array
};

export type MatchResult = {
  candidate: MatchCandidate;
  score: number;
  confidence: "high" | "medium" | "low";
};

const THRESHOLD_HIGH = 0.9;
const THRESHOLD_MEDIUM = 0.75;
const SAIL_NUMBER_BONUS = 0.05;

function levenshteinSimilarity(a: string, b: string): number {
  if (!a && !b) return 1;
  if (!a || !b) return 0;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - distance(a, b) / maxLen;
}

function bestSimilarity(queryVariants: string[], candidateVariants: string[]): number {
  let best = 0;
  for (const q of queryVariants) {
    for (const c of candidateVariants) {
      best = Math.max(best, levenshteinSimilarity(q, c));
    }
  }
  return best;
}

/**
 * Matches a parsed name (and optional sail number) against a pool of DB sailors.
 * Returns all candidates with score >= THRESHOLD_MEDIUM, sorted best-first.
 */
export function findMatches(
  parsedFirstName: string,
  parsedLastName: string,
  parsedSailNumber: string | null | undefined,
  candidates: MatchCandidate[]
): MatchResult[] {
  const queryFull = `${parsedFirstName} ${parsedLastName}`;
  const queryVariants = nameVariants(queryFull);

  const results: MatchResult[] = [];

  for (const candidate of candidates) {
    const candidateFull = `${candidate.firstName} ${candidate.lastName}`;
    const candidateVariants = nameVariants(candidateFull);

    // Also check against alternative names
    let altNames: string[] = [];
    try {
      altNames = JSON.parse(candidate.alternativeNames ?? "[]");
    } catch {
      // ignore malformed JSON
    }
    for (const alt of altNames) {
      candidateVariants.push(...nameVariants(alt));
    }

    let score = bestSimilarity(queryVariants, candidateVariants);

    // Sail number bonus
    if (
      parsedSailNumber &&
      candidate.sailingLicenseId &&
      normalizeName(parsedSailNumber) === normalizeName(candidate.sailingLicenseId)
    ) {
      score = Math.min(1, score + SAIL_NUMBER_BONUS);
    }

    if (score >= THRESHOLD_MEDIUM) {
      results.push({
        candidate,
        score,
        confidence: score >= THRESHOLD_HIGH ? "high" : "medium",
      });
    }
  }

  return results.sort((a, b) => b.score - a.score);
}
