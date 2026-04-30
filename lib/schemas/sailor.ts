import { z } from "zod";

export const sailorSchema = z.object({
  firstName: z.string().min(1, "Vorname erforderlich").max(100),
  lastName: z.string().min(1, "Nachname erforderlich").max(100),
  birthYear: z.coerce.number().int().min(1900).max(2020).optional().nullable(),
  gender: z.enum(["M", "F"]).optional().nullable(),
  nationality: z.string().length(3).default("GER"),
  club: z.string().max(200).optional().nullable(),
  sailingLicenseId: z.string().max(50).optional().nullable(),
  alternativeNames: z.array(z.string().min(1).max(200)).default([]),
  member420: z.boolean().default(true),
});

export type SailorInput = z.infer<typeof sailorSchema>;
