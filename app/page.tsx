import Image from "next/image";
import Link from "next/link";
import { db } from "@/lib/db/client";
import { BarChart3, Trophy, ArrowRight, ExternalLink } from "lucide-react";
import { PublicNav } from "./(public)/public-nav";

export default async function Home() {
  const [rankingCount, regattaCount, recentRankings] = await Promise.all([
    db.ranking.count({ where: { isPublic: true } }),
    db.regatta.count({ where: { isRanglistenRegatta: true } }),
    db.ranking.findMany({
      where: { isPublic: true },
      orderBy: { publishedAt: "desc" },
      take: 4,
      select: { id: true, name: true, type: true, ageCategory: true, genderCategory: true, seasonEnd: true },
    }),
  ]);

  const typeLabel: Record<string, string> = {
    JAHRESRANGLISTE: "Jahresrangliste",
    JWM_QUALI: "JWM-Quali",
    JEM_QUALI: "JEM-Quali",
  };
  const typeColor: Record<string, string> = {
    JAHRESRANGLISTE: "bg-blue-100 text-blue-800",
    JWM_QUALI: "bg-purple-100 text-purple-800",
    JEM_QUALI: "bg-purple-100 text-purple-800",
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">

      {/* ── Maritime header ──────────────────────────────────────────────── */}
      <header className="maritime-header">
        <div className="max-w-5xl mx-auto px-3 sm:px-4 flex items-center gap-3 sm:gap-6 h-14">
          <Link href="/" className="flex items-center gap-2.5 shrink-0 group">
            <Image
              src="/logo-420.png"
              alt="420er Klasse"
              width={1000}
              height={665}
              className="h-8 w-auto rounded-sm ring-1 ring-white/20 group-hover:ring-white/40 transition-all"
              priority
            />
            <span className="font-semibold text-white tracking-tight text-sm leading-tight">
              420er<br />
              <span className="font-normal text-white/75 text-xs">Rangliste</span>
            </span>
          </Link>
          <PublicNav />
        </div>
      </header>

      <main className="flex-1">

        {/* ── Hero ─────────────────────────────────────────────────────────── */}
        <div
          className="py-10 sm:py-16 px-3 sm:px-4"
          style={{
            background:
              "linear-gradient(160deg, oklch(0.175 0.095 248) 0%, oklch(0.245 0.088 238) 55%, oklch(0.30 0.08 228) 100%)",
          }}
        >
          <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center gap-6 sm:gap-8">
            <Image
              src="/logo-420.png"
              alt="420er Klasse"
              width={1000}
              height={665}
              className="h-20 sm:h-28 w-auto rounded-xl ring-2 ring-white/20 shadow-2xl shrink-0"
              priority
            />
            <div className="text-center sm:text-left min-w-0">
              <h1 className="text-2xl sm:text-4xl font-bold text-white tracking-tight leading-tight break-words">
                420er&thinsp;Klassen-<wbr />Rangliste
              </h1>
              <p className="text-white/70 mt-2 text-sm sm:text-base max-w-md">
                Offizielle DSV-Jahresrangliste, Aktuelle Rangliste und
                IDJM-Qualifikation für die deutsche 420er-Klasse.
              </p>
              <div className="mt-6 flex flex-wrap gap-3 justify-center sm:justify-start">
                <Link
                  href="/rangliste"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-white text-primary font-semibold text-sm hover:bg-white/90 transition-colors shadow-md"
                >
                  <BarChart3 className="h-4 w-4" />
                  Zu den Ranglisten
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/regatten"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-white/10 text-white font-medium text-sm hover:bg-white/20 transition-colors border border-white/20"
                >
                  <Trophy className="h-4 w-4" />
                  Regatten
                </Link>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-3 sm:px-4 py-8 sm:py-10 space-y-8 sm:space-y-10">

          {/* ── Stats ──────────────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <Link
              href="/rangliste"
              className="group rounded-xl border bg-card px-4 sm:px-6 py-4 sm:py-5 hover:shadow-md transition-shadow flex items-center gap-3 sm:gap-4"
            >
              <div className="rounded-lg bg-blue-50 p-2.5 shrink-0">
                <BarChart3 className="h-5 w-5 text-blue-600" />
              </div>
              <div className="min-w-0">
                <p className="text-2xl font-bold tabular-nums">{rankingCount}</p>
                <p className="text-sm text-muted-foreground break-words">
                  {rankingCount === 1
                    ? "veröffentlichte Rangliste"
                    : "veröffentlichte Ranglisten"}
                </p>
              </div>
            </Link>
            <Link
              href="/regatten"
              className="group rounded-xl border bg-card px-4 sm:px-6 py-4 sm:py-5 hover:shadow-md transition-shadow flex items-center gap-3 sm:gap-4"
            >
              <div className="rounded-lg bg-emerald-50 p-2.5 shrink-0">
                <Trophy className="h-5 w-5 text-emerald-600" />
              </div>
              <div className="min-w-0">
                <p className="text-2xl font-bold tabular-nums">{regattaCount}</p>
                <p className="text-sm text-muted-foreground break-words">
                  {regattaCount === 1 ? "Ranglistenregatta" : "Ranglistenregatten"}
                </p>
              </div>
            </Link>
          </div>

          {/* ── Recent rankings ────────────────────────────────────────────── */}
          {recentRankings.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-base">Aktuelle Ranglisten</h2>
                <Link
                  href="/rangliste"
                  className="text-sm text-primary hover:underline flex items-center gap-1"
                >
                  Alle anzeigen <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                {recentRankings.map((r) => (
                  <Link
                    key={r.id}
                    href={`/rangliste/${r.id}`}
                    className="group rounded-xl border bg-card px-5 py-4 hover:shadow-md transition-shadow flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate group-hover:text-primary transition-colors">
                        {r.name}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {r.ageCategory} · {r.genderCategory} ·{" "}
                        {new Date(r.seasonEnd).getFullYear()}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${
                        typeColor[r.type] ?? "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {typeLabel[r.type] ?? r.type}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* ── Empty state if no published rankings yet ─────────────────── */}
          {recentRankings.length === 0 && (
            <div className="rounded-xl border bg-muted/30 px-6 py-10 text-center space-y-2">
              <BarChart3 className="h-8 w-8 text-muted-foreground mx-auto" />
              <p className="font-medium">Noch keine veröffentlichten Ranglisten</p>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                Sobald Ranglisten im Admin-Bereich veröffentlicht werden, erscheinen sie hier.
              </p>
            </div>
          )}

          {/* ── Transparency note ──────────────────────────────────────────── */}
          <div className="rounded-xl border bg-muted/20 px-5 py-4 flex items-start gap-3">
            <div className="rounded-md bg-muted p-2 shrink-0 mt-0.5">
              <ExternalLink className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium">Vollständige Transparenz</p>
              <p className="text-sm text-muted-foreground mt-0.5">
                Jede Rangliste zeigt alle einfließenden Wertungen mit Regatta, Faktor, Starter­anzahl
                und Einzelpunkten. Berechnung nach DSV-Ranglistenordnung (RO), gültig ab 01.01.2026.
              </p>
            </div>
          </div>

        </div>
      </main>

      {/* ── Footer ───────────────────────────────────────────────────────────── */}
      <footer className="border-t border-border/50 py-4 text-center text-xs text-muted-foreground">
        420er Rangliste · DSV-Ranglistensystem ·{" "}
        <Link href="/admin" className="hover:underline">
          Admin
        </Link>
      </footer>
    </div>
  );
}
