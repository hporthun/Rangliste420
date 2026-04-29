import { z } from "zod";

export const regattaSchema = z.object({
  name: z.string().min(1).max(200),
  location: z.string().max(200).optional().nullable(),
  country: z.string().length(3).default("GER"),
  startDate: z.string().min(1, "Startdatum erforderlich"),
  endDate: z.string().min(1, "Enddatum erforderlich"),
  plannedRaces: z.coerce.number().int().min(0).optional().nullable(),
  completedRaces: z.coerce.number().int().min(0),
  totalStarters: z.coerce.number().int().min(0).optional().nullable(),
  multiDayAnnouncement: z.boolean().default(false),
  ranglistenFaktor: z.coerce.number().min(0.8).max(2.6),
  scoringSystem: z.enum(["LOW_POINT", "BONUS_POINT"]).default("LOW_POINT"),
  isRanglistenRegatta: z.boolean().default(false),
  sourceUrl: z.string().url().optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

export type RegattaInput = z.infer<typeof regattaSchema>;
