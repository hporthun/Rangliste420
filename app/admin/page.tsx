import Image from "next/image";
import Link from "next/link";
import { db } from "@/lib/db/client";
import {
  Users,
  Trophy,
  FileBarChart2,
  BarChart3,
  Download,
  ArrowRight,
} from "lucide-react";

export default async function AdminPage() {
  const [sailorCount, regattaCount, entryCount, rankingCount] = await Promise.all([
    db.sailor.count(),
    db.regatta.count(),
    db.teamEntry.count(),
    db.ranking.count(),
  ]);

  // Most recent import
  const lastImport = await db.importSession.findFirst({
    orderBy: { createdAt: "desc" },
    select: { createdAt: true, regatta: { select: { name: true } } },
  });

  // Most recent regatta with results
  const lastRegatta = await db.regatta.findFirst({
    where: { teamEntries: { some: {} } },
    orderBy: { startDate: "desc" },
    select: { id: true, name: true, startDate: true, completedRaces: true },
  });

  const stats = [
    { label: "Segler", value: sailorCount, icon: Users,        href: "/admin/segler" },
    { label: "Regatten", value: regattaCount, icon: Trophy,    href: "/admin/regatten" },
    { label: "Einträge", value: entryCount, icon: FileBarChart2, href: "/admin/regatten" },
    { label: "Ranglisten", value: rankingCount, icon: BarChart3, href: "/admin/ranglisten" },
  ];

  const sections = [
    {
      href: "/admin/segler",
      icon: Users,
      title: "Segler",
      desc: "Stammdaten pflegen, alternative Namen verwalten, Geburtsjahr und Geschlecht ergänzen.",
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      href: "/admin/regatten",
      icon: Trophy,
      title: "Regatten",
      desc: "Regatten anlegen, Manage2Sail-Abgleich starten, Ergebnisse importieren.",
      color: "text-emerald-600",
      bg: "bg-emerald-50",
    },
    {
      href: "/admin/ranglisten",
      icon: BarChart3,
      title: "Ranglisten",
      desc: "Jahresrangliste, Aktuelle Rangliste und IDJM-Quali berechnen und veröffentlichen.",
      color: "text-purple-600",
      bg: "bg-purple-50",
    },
    {
      href: "/admin/wartung",
      icon: Download,
      title: "Wartung",
      desc: "Datensicherung, Rücksicherung, automatische Backups und Datenreduktion.",
      color: "text-amber-600",
      bg: "bg-amber-50",
    },
  ];

  return (
    <div className="space-y-10 max-w-4xl">

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <div
        className="rounded-2xl px-8 py-10 flex items-center gap-8"
        style={{
          background:
            "linear-gradient(135deg, oklch(0.175 0.095 248) 0%, oklch(0.26 0.09 235) 100%)",
        }}
      >
        <Image
          src="/logo-420.png"
          alt="420er Klasse"
          width={1000}
          height={665}
          className="h-20 w-auto rounded-lg ring-2 ring-white/20 shadow-lg shrink-0"
          priority
        />
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            420er Ranglisten­verwaltung
          </h1>
          <p className="text-white/70 text-sm mt-1">
            DSV-Ranglistensystem · gültig ab 01.01.2026
          </p>
          <div className="mt-4 flex gap-3">
            <Link
              href="/admin/regatten"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white text-primary text-sm font-semibold hover:bg-white/90 transition-colors shadow-sm"
            >
              Regatten verwalten <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <Link
              href="/rangliste"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white/10 text-white text-sm font-medium hover:bg-white/20 transition-colors border border-white/20"
              target="_blank"
            >
              Öffentliche Rangliste
            </Link>
          </div>
        </div>
      </div>

      {/* ── Stats row ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {stats.map(({ label, value, icon: Icon, href }) => (
          <Link
            key={label}
            href={href}
            className="group rounded-xl border bg-card px-5 py-4 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {label}
              </span>
              <Icon className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
            <p className="text-3xl font-bold tabular-nums">{value.toLocaleString("de-DE")}</p>
          </Link>
        ))}
      </div>

      {/* ── Recent activity ────────────────────────────────────────────────── */}
      {(lastRegatta || lastImport) && (
        <div className="rounded-xl border bg-muted/30 px-5 py-4 text-sm space-y-2">
          <p className="font-medium text-xs uppercase text-muted-foreground tracking-wide mb-3">
            Zuletzt
          </p>
          {lastRegatta && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Letzte Regatta mit Ergebnissen</span>
              <Link
                href={`/admin/regatten/${lastRegatta.id}`}
                className="font-medium hover:underline"
              >
                {lastRegatta.name} ({lastRegatta.completedRaces}&thinsp;WF)
              </Link>
            </div>
          )}
          {lastImport && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Letzter Import</span>
              <span className="font-medium">
                {lastImport.regatta.name} ·{" "}
                {new Date(lastImport.createdAt).toLocaleDateString("de-DE")}
              </span>
            </div>
          )}
        </div>
      )}

      {/* ── Section cards ─────────────────────────────────────────────────── */}
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-4">
          Bereiche
        </h2>
        <div className="grid sm:grid-cols-2 gap-4">
          {sections.map(({ href, icon: Icon, title, desc, color, bg }) => (
            <Link
              key={href}
              href={href}
              className="group rounded-xl border bg-card p-5 hover:shadow-md transition-shadow flex gap-4"
            >
              <div className={`${bg} ${color} rounded-lg p-2.5 h-fit`}>
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-sm mb-1 group-hover:text-primary transition-colors">
                  {title}
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
