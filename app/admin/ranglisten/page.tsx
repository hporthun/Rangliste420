import { db } from "@/lib/db/client";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { PublishToggle } from "./publish-toggle";
import { RankingActions } from "./ranking-actions";

export default async function RanglistenPage() {
  const rankings = await db.ranking.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      type: true,
      ageCategory: true,
      genderCategory: true,
      seasonStart: true,
      seasonEnd: true,
      isPublic: true,
      publishedAt: true,
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Ranglisten</h1>
        <Link
          href="/admin/ranglisten/vorschau"
          className={cn(buttonVariants({ size: "sm" }))}
        >
          + Rangliste berechnen
        </Link>
      </div>

      {rankings.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Noch keine Ranglisten gespeichert.{" "}
          <Link href="/admin/ranglisten/vorschau" className="text-blue-600 hover:underline">
            Rangliste berechnen →
          </Link>
        </p>
      ) : (
        <div className="rounded-md border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-muted-foreground uppercase">
              <tr>
                <th className="px-4 py-2 text-left">Name</th>
                <th className="px-4 py-2 text-left hidden sm:table-cell">Typ</th>
                <th className="px-4 py-2 text-left hidden sm:table-cell">Saison</th>
                <th className="px-4 py-2 text-left hidden md:table-cell">Kategorie</th>
                <th className="px-4 py-2 text-left">Status</th>
                <th className="px-4 py-2"></th>
                <th className="px-4 py-2 w-16"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rankings.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-2 font-medium">{r.name}</td>
                  <td className="px-4 py-2 text-muted-foreground text-xs hidden sm:table-cell">{r.type}</td>
                  <td className="px-4 py-2 text-xs hidden sm:table-cell">
                    {r.seasonStart.getFullYear()}
                    {r.seasonStart.getFullYear() !== r.seasonEnd.getFullYear()
                      ? `/` + r.seasonEnd.getFullYear()
                      : ""}
                  </td>
                  <td className="px-4 py-2 text-xs hidden md:table-cell">
                    {r.ageCategory} / {r.genderCategory}
                  </td>
                  <td className="px-4 py-2">
                    <PublishToggle id={r.id} isPublic={r.isPublic} />
                  </td>
                  <RankingActions id={r.id} name={r.name} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
