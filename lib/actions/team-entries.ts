/**
 * Server-Action: TeamEntry-Schottenwechsel-Toggle.
 *
 * `setCrewSwapAction` setzt `crewSwapApproved` und optional
 * `crewSwapNote` an einem TeamEntry. UI-Aufruf aus dem Repeat-Icon-
 * Popover in der Regatta-Detail-Tabelle (`/admin/regatten/[id]`).
 *
 * Wirkt fachlich nur auf JWM/JEM-Quali (Team-Identität bei Crew-Wechsel,
 * 1× genehmigter Swap erlaubt). DSV-/Aktuelle-/IDJM-Ranglisten
 * ignorieren das Flag — siehe `docs/business-rules.md` §2.5.
 *
 * Schreibt in: `TeamEntry` (kein Audit-Log, weil low-impact).
 *
 * Auth: erfordert eine gültige Session.
 */
"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";

type Result = { ok: true } | { ok: false; error: string };

const swapSchema = z.object({
  teamEntryId: z.string().min(1),
  approved: z.boolean(),
  note: z.string().max(500).default(""),
});

/**
 * Setzt den Schottenwechsel-Status für einen TeamEntry.
 *
 * Issue #11: Pro Regatta-Eintrag (TeamEntry) lässt sich kennzeichnen, ob
 * für die Crew ein vom Veranstalter genehmigter Schottenwechsel vorlag.
 * Der Schalter ist relevant für die IDJM-Quali-Berechnung und für die
 * öffentliche Transparenz auf den Detail-Seiten.
 */
export async function setCrewSwapAction(
  input: z.infer<typeof swapSchema>
): Promise<Result> {
  const session = await auth();
  if (!session) return { ok: false, error: "Nicht angemeldet." };

  const parsed = swapSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Ungültige Eingabe: " + parsed.error.issues[0]?.message };
  }
  const { teamEntryId, approved, note } = parsed.data;

  const entry = await db.teamEntry.findUnique({
    where: { id: teamEntryId },
    select: { regattaId: true },
  });
  if (!entry) return { ok: false, error: "Eintrag nicht gefunden." };

  await db.teamEntry.update({
    where: { id: teamEntryId },
    data: {
      crewSwapApproved: approved,
      // Note nur überschreiben, wenn der Caller einen schickt — leere
      // Strings behalten wir aber bei (User wollte vielleicht löschen).
      crewSwapNote: note,
    },
  });

  revalidatePath(`/admin/regatten/${entry.regattaId}`);
  return { ok: true };
}
