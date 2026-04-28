import { db } from "@/lib/db/client";
import Link from "next/link";
import { MergeClient } from "./merge-client";

type Props = {
  searchParams: Promise<{ primary?: string; secondary?: string }>;
};

export default async function MergeSailorsPage({ searchParams }: Props) {
  const sp = await searchParams;

  // Load all sailors as small candidate list (id + name + sailingLicenseId + counts)
  const sailors = await db.sailor.findMany({
    select: {
      id: true,
      firstName: true,
      lastName: true,
      birthYear: true,
      gender: true,
      club: true,
      sailingLicenseId: true,
      _count: { select: { helmEntries: true, crewEntries: true } },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  const candidates = sailors.map((s) => ({
    id: s.id,
    firstName: s.firstName,
    lastName: s.lastName,
    birthYear: s.birthYear,
    gender: s.gender,
    club: s.club,
    sailingLicenseId: s.sailingLicenseId,
    entryCount: s._count.helmEntries + s._count.crewEntries,
  }));

  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <Link
          href="/admin/segler"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Segler
        </Link>
        <h1 className="text-xl font-semibold mt-1">Segler zusammenführen</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Wähle zwei Datensätze, die dieselbe Person beschreiben. Alle Regatta-
          Einträge werden auf den primären Datensatz übertragen, der sekundäre
          wird gelöscht.
        </p>
      </div>

      <MergeClient
        candidates={candidates}
        initialPrimaryId={sp.primary}
        initialSecondaryId={sp.secondary}
      />
    </div>
  );
}
