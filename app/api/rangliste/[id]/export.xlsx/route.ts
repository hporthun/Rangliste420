/**
 * Excel-Export einer Rangliste — nur fuer angemeldete Benutzer.
 *
 * Endpoint: GET /api/rangliste/<id>/export.xlsx?age=&gender=
 * Antwort: xlsx-Datei zum Download.
 *
 * Auth-Gate: Session noetig. Anonyme Aufrufe bekommen 401.
 *
 * Compute-Pfad ist identisch zur Server-Component der Detail-Seite —
 * computeRankingAction / computeJwmJemAction. birthYear wird hier
 * mitgeladen, weil ohnehin nur signed-in User reinkommen.
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { auth } from "@/lib/auth";
import {
  computeRankingAction,
  type ComputeParams,
  type RankingType,
} from "@/lib/actions/rankings";
import { computeJwmJemAction, type JwmJemParams } from "@/lib/actions/jwm-jem";
import {
  buildDsvRanglisteWorkbook,
  buildJwmJemWorkbook,
} from "@/lib/export/rangliste-excel";

const VALID_AGE_PARAMS = ["U22", "U19", "U17", "U16", "U15"] as const;
const VALID_GENDER_PARAMS = ["OPEN", "MEN", "MIX", "GIRLS"] as const;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { error: "Authentifizierung erforderlich" },
      { status: 401 }
    );
  }

  const { id } = await params;
  const url = new URL(request.url);
  const ageParam = url.searchParams.get("age") ?? "";
  const genderParam = url.searchParams.get("gender") ?? "";

  const filterAge = (VALID_AGE_PARAMS as readonly string[]).includes(ageParam) ? ageParam : "";
  const filterGender = (VALID_GENDER_PARAMS as readonly string[]).includes(genderParam) ? genderParam : "";

  const ranking = await db.ranking.findUnique({
    where: { id, isPublic: true },
    select: {
      id: true,
      name: true,
      type: true,
      ageCategory: true,
      genderCategory: true,
      seasonStart: true,
      seasonEnd: true,
      scoringUnit: true,
      rankingRegattas: { select: { regattaId: true } },
    },
  });

  if (!ranking) {
    return NextResponse.json({ error: "Rangliste nicht gefunden" }, { status: 404 });
  }

  const effectiveAge = filterAge || ranking.ageCategory;
  const effectiveGender = filterGender || ranking.genderCategory;
  const fileBaseName =
    `${ranking.name}-${effectiveAge}-${effectiveGender}`.replace(/[^A-Za-z0-9._-]+/g, "_");
  const filename = `${fileBaseName}.xlsx`;

  // ── JWM/JEM branch ───────────────────────────────────────────────────────
  if (ranking.type === "JWM_QUALI" || ranking.type === "JEM_QUALI") {
    const jwmParams: JwmJemParams = {
      regattaIds: ranking.rankingRegattas.map((rr) => rr.regattaId),
      ageCategory: effectiveAge as JwmJemParams["ageCategory"],
      genderCategory: effectiveGender as JwmJemParams["genderCategory"],
      referenceDate: ranking.seasonEnd.toISOString().slice(0, 10),
    };
    const result = await computeJwmJemAction(jwmParams);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    const allIds = [
      ...result.data.ranked,
      ...result.data.preliminary,
      ...result.data.excludedSwap,
    ].flatMap((r) => [r.helmId, ...r.crews.map((c) => c.id)]);
    const sailors = await db.sailor.findMany({
      where: { id: { in: Array.from(new Set(allIds)) } },
      select: { id: true, birthYear: true },
    });
    const birthYearMap = new Map(sailors.map((s) => [s.id, s.birthYear]));

    const buf = await buildJwmJemWorkbook(
      {
        rankingName: ranking.name,
        effectiveAge,
        effectiveGender,
        scoringUnit: "HELM",
        seasonStart: ranking.seasonStart,
        seasonEnd: ranking.seasonEnd,
        typeLabel: ranking.type === "JWM_QUALI" ? "JWM-Qualifikation" : "JEM-Qualifikation",
      },
      result.data,
      birthYearMap
    );
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  }

  // ── DSV / IDJM branch ────────────────────────────────────────────────────
  const scoringUnit = (ranking.scoringUnit ?? "HELM") as "HELM" | "CREW";
  const computeParams: ComputeParams = {
    type: ranking.type as RankingType,
    seasonStart: ranking.seasonStart.toISOString().slice(0, 10),
    referenceDate: ranking.seasonEnd.toISOString().slice(0, 10),
    ageCategory: effectiveAge as ComputeParams["ageCategory"],
    genderCategory: effectiveGender as ComputeParams["genderCategory"],
    scoringUnit,
  };
  const result = await computeRankingAction(computeParams);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  const allIds = [
    ...result.data.rows.flatMap((r) => [r.sailorId, ...r.partners.map((p) => p.id)]),
    ...result.data.belowCutoff.flatMap((r) => [r.sailorId, ...r.partners.map((p) => p.id)]),
  ];
  const sailors = await db.sailor.findMany({
    where: { id: { in: Array.from(new Set(allIds)) } },
    select: { id: true, birthYear: true },
  });
  const birthYearMap = new Map(sailors.map((s) => [s.id, s.birthYear]));

  const buf = await buildDsvRanglisteWorkbook(
    {
      rankingName: ranking.name,
      effectiveAge,
      effectiveGender,
      scoringUnit,
      seasonStart: ranking.seasonStart,
      seasonEnd: ranking.seasonEnd,
    },
    result.data,
    birthYearMap
  );
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
