import type { MatchResult } from "@/lib/import/matching";

export type SailorSummary = {
  id: string;
  firstName: string;
  lastName: string;
  sailingLicenseId: string | null;
};

export type EntryMatchSuggestion = {
  entryIndex: number;
  helm: {
    query: { firstName: string; lastName: string; sailNumber: string | null };
    matches: MatchResult[];
  };
  crew: {
    query: { firstName: string; lastName: string };
    matches: MatchResult[];
  } | null;
};

export type PersonDecision =
  | { type: "accept"; sailorId: string; addAltName?: string }
  | { type: "create"; firstName: string; lastName: string };

export type EntryDecision = {
  entryIndex: number;
  helmDecision: PersonDecision;
  crewDecision: PersonDecision | { type: "none" };
  inStartArea: boolean;
  sailNumber: string | null;
  finalRank: number | null;
  finalPoints: number | null;
  racePoints: Array<{ race: number; points: number; code?: string; isDiscard?: boolean }>;
  /** Club from parsed results — applied to helm and crew on create/if currently unset */
  club: string | null;
};
