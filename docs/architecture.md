# Architektur-Überblick

> Stand: 2026-04-30. Dieser Dokument liefert die Vogelperspektive: wo
> welche Logik lebt, wie die Daten fließen, welche Konventionen gelten.
> Geschäftsregeln stehen separat in [`business-rules.md`](business-rules.md).

---

## File-Map

```
.
├── app/                           # Next.js App Router
│   ├── (public)/                  # Öffentliche Routen ohne Auth
│   │   ├── layout.tsx             # Header + Beta-Banner
│   │   ├── page.tsx → /           # NB: Landing-Page liegt im app/ root,
│   │   │                          #     nicht in (public)/, hat aber eigenen Header
│   │   ├── rangliste/             # /rangliste, /rangliste/[id], /rangliste/[id]/steuermann/[helmId]
│   │   ├── regatten/              # /regatten, /regatta/[id]
│   │   └── dev-warning-banner.tsx
│   ├── admin/                     # Geschützte Admin-Bereiche (Middleware-Auth)
│   │   ├── layout.tsx             # Admin-Header + Changelog-Popup-Mount
│   │   ├── segler/                # Sailor-CRUD + Merge + Stammdaten-Import
│   │   ├── regatten/              # Regatta-CRUD + Bulk-Import + Detail mit
│   │   │                          #     Schottenwechsel-Toggle
│   │   ├── ranglisten/            # Rangliste-Vorschau, Save, Edit, JWM/JEM-Page
│   │   ├── import/                # 5-Schritt-Wizard für Ergebnis-Import
│   │   ├── wartung/               # Backup/Restore/Prune/Audit-Log
│   │   ├── mail/                  # SMTP-Konfig (Issue #32)
│   │   ├── konto/                 # User-Self-Service (Username/PW/2FA/Passkey)
│   │   ├── hilfe/                 # PDF-fähiges Benutzerhandbuch
│   │   └── changelog/             # /admin/changelog (read full history)
│   ├── api/                       # Route Handlers
│   │   ├── auth/                  # NextAuth-Endpoints
│   │   ├── webauthn/              # Passkey-Register/Authenticate
│   │   ├── admin/backup/          # Manuelle Sofort-Backup-Downloads
│   │   ├── admin/backups/         # Stored-Backup-Download
│   │   └── cron/backup/           # Vercel-Cron-Endpoint (täglich 01:00 UTC)
│   ├── auth/                      # Login, Forgot, Reset (öffentlich)
│   ├── layout.tsx                 # Root-Layout (ThemeProvider, Server-Theme)
│   ├── manifest.ts                # PWA-Manifest
│   └── robots.txt
│
├── lib/                           # Reine Module ohne UI-Bezug
│   ├── scoring/                   # Pure Functions: DSV-Formel, Multiplikator,
│   │   │                          #     Filter, IDJM, JWM/JEM
│   │   ├── dsv.ts                 # Kernformel + calculateDsvRanking
│   │   ├── multiplier.ts          # m-Staffel
│   │   ├── filters.ts             # matchesAgeCategory / matchesGenderCategory
│   │   ├── idjm-quali.ts          # IDJM-Wrapper (Saisonstichtag-Age + R ≥ 25)
│   │   └── jwm-jem-quali.ts       # JWM/JEM mit Schottenwechsel-Partitionierung
│   ├── import/                    # Pure Functions: Parser + Fuzzy-Matching
│   │   ├── manage2sail-paste.ts   # Web-Copy-Paste-Parser
│   │   ├── manage2sail-pdf.ts     # PDF-Parser (M2S-Format)
│   │   ├── sailwave-pdf.ts        # PDF-Parser (Sailwave)
│   │   ├── sailresults-pdf.ts     # PDF-Parser (SailResults)
│   │   ├── velaware-pdf.ts        # PDF-Parser (Velaware)
│   │   ├── pdf-auto-detect.ts     # erkennt Format aus PDF-Inhalt
│   │   ├── manage2sail-api.ts     # M2S-JSON-API-Client (event/class/results)
│   │   ├── matching.ts            # Levenshtein + Bonus-Logic
│   │   ├── normalize.ts           # NFD/Umlaute/Bindestriche
│   │   ├── parse-stammdaten.ts    # Bulk-Stammdaten-Tab-Parser (legacy + Postgres-COPY)
│   │   ├── parse-regatta-list.ts  # Regatta-Liste-Bulk-Parser
│   │   └── types.ts               # EntryDecision / EntryMatchSuggestion
│   ├── actions/                   # Server-Actions (Glue: UI ↔ DB ↔ pure libs)
│   │   ├── sailors.ts             # CRUD + Merge + Bulk-Stammdaten
│   │   ├── regattas.ts            # CRUD + Bulk-Import-Liste
│   │   ├── team-entries.ts        # Schottenwechsel-Toggle
│   │   ├── import.ts              # Ergebnis-Import-Wizard (5-Schritt)
│   │   ├── rankings.ts            # DSV-Compute + Save/Edit für Jahres/IDJM
│   │   ├── jwm-jem.ts             # JWM/JEM-Quali Compute + Save
│   │   ├── account.ts             # User-Self-Service (Auth-Settings)
│   │   ├── auth.ts                # Backward-Compat-Aliase
│   │   ├── changelog.ts           # markChangelogReadAction
│   │   ├── mail-config.ts         # SMTP-Settings via Web-UI
│   │   ├── backup-schedule.ts     # Backup-Plan + Trigger + List/Delete
│   │   └── maintenance.ts         # Delete-All / Prune / Restore
│   ├── auth.ts                    # NextAuth v5 Config (Credentials + OAuth)
│   ├── auth-providers.ts          # OAuth-Provider-Builder (env-gated)
│   ├── db/client.ts               # Prisma-Singleton
│   ├── schemas/                   # Zod-Schemas für FormData-Validierung
│   ├── webauthn/config.ts         # RP-ID/Origin-Resolver (per-request)
│   ├── backup/                    # Storage (FS + Vercel Blob), Scheduler, Encryption
│   ├── mail/                      # SMTP-Schicht + Templates
│   ├── security/                  # Audit-Log + Rate-Limit + Input-Sanitization
│   ├── totp.ts                    # TOTP-Helper (otplib-Wrapper)
│   ├── changelog.tsx              # ENTRIES-Liste (single source of truth)
│   ├── version.ts                 # APP_VERSION (CalVer-Padding)
│   └── utils.ts                   # cn() + diverse kleine Helpers
│
├── components/                    # React-Components
│   ├── ui/                        # shadcn-Primitives
│   ├── admin/                     # Admin-spezifische Components
│   │   ├── admin-nav.tsx          # Top-Nav + Mobile-Menü
│   │   ├── user-menu.tsx          # Logout-Dropdown
│   │   ├── changelog-popup.tsx    # Modal-Dialog für unread changelog entries
│   │   ├── crew-swap-toggle.tsx   # Repeat-Icon + Popover für Schottenwechsel
│   │   └── regatta-table-sync.tsx
│   ├── import-wizard/             # 5-Schritt-Import-Wizard
│   │   ├── wizard.tsx             # State-Machine + Step-Routing
│   │   ├── source-step.tsx        # Tab-Auswahl (API / Paste / PDF)
│   │   ├── metadata-step.tsx      # Regatta-Auswahl
│   │   ├── matching-step.tsx      # Fuzzy-Match je Helm/Crew + accept/create
│   │   ├── startarea-step.tsx     # inStartArea-Review
│   │   └── preview-step.tsx       # Final-Vorschau + totalStarters-Edit + commit
│   ├── tour/                      # PageTour (geführte Touren)
│   ├── rankings/crew-label.tsx    # Crew-Sublabel in Ranglisten-Tabellen
│   ├── sailor-form.tsx
│   ├── regatta-form.tsx
│   └── theme-provider.tsx
│
├── prisma/
│   ├── schema.prisma              # Source-of-Truth (SQLite-Provider, lokal)
│   ├── migrations/                # SQLite-Migrations (von prisma migrate dev)
│   ├── prod/
│   │   ├── schema.prisma          # AUTO-GENERIERT (Postgres-Provider)
│   │   └── migrations/            # Manuell gepflegte Postgres-Migrations
│   └── seed.ts                    # Default-Admin-Account beim Erst-Seed
│
├── scripts/
│   ├── sync-prod-schema.mjs       # SQLite→Postgres-Schema-Sync mit JSDoc-Lint
│   ├── gitea-issue.mjs            # Issue-Workflow-CLI für Claude-Sessions
│   ├── read-pdfs.mjs              # Dev-Helper: PDFs in pages.json parsen
│   └── test-pdf-parsers.mjs       # Dev-Helper: PDF-Parser-Smoke-Test
│
├── docs/
│   ├── business-rules.md          # FACHLICHE Regeln (Formeln, Filter, Schottenwechsel)
│   └── architecture.md            # DIESES Dokument (technischer Überblick)
│
├── e2e/                           # Playwright-Tests (Smoke-Pfade)
├── types/                         # Globale TS-Deklarationen
│
├── README.md                      # Setup für Menschen
├── DEPLOY.md                      # Vercel-Deployment-Guide
├── PLAN_1.md                      # Original-Spec (eingefroren, fachlich solide)
├── CLAUDE.md                      # Onboarding für Claude-Sessions
├── AGENTS.md                      # Agent-Hinweise (Next.js-Version-Quirks)
└── CHANGELOG.md                   # Detaillierte Release-Historie (CalVer)
```

---

## Schichten und Abhängigkeiten

Strikte Abhängigkeitsrichtung — von **außen** nach **innen** ist erlaubt,
umgekehrt nicht:

```
┌────────────────────────────────────────────────────┐
│  app/  (Pages + Route Handlers + Layouts)          │
│  components/  (React UI)                           │
└────────────────────────────────────────────────────┘
                       │  ruft auf
                       ▼
┌────────────────────────────────────────────────────┐
│  lib/actions/  (Server-Actions, "use server")      │
│  - auth() check                                    │
│  - zod-Validierung                                 │
│  - DB-Reads/Writes via Prisma                      │
│  - revalidatePath nach Mutationen                  │
│  - Audit-Log für sicherheitsrelevante Aktionen     │
└────────────────────────────────────────────────────┘
                       │  importiert
                       ▼
┌────────────────────────────────────────────────────┐
│  lib/scoring/    Pure Functions, keine DB-Zugriffe │
│  lib/import/     (Parser + Fuzzy-Match)            │
│  lib/security/   (Audit-Log-Helper)                │
│  lib/mail/       (SMTP-Versand)                    │
│  lib/webauthn/   (RP-Config)                       │
│  lib/backup/     (Storage-Schicht, FS + Blob)      │
│  lib/db/         (Prisma-Client-Singleton)         │
└────────────────────────────────────────────────────┘
```

**Verbote**:
- Pure-Funktions-Module (`lib/scoring/`, `lib/import/`) machen **keine
  DB-Aufrufe**. Tests sind dadurch trivial.
- React-Components rufen **keine Prisma**-APIs direkt auf. Immer über
  Server-Actions.
- Server-Actions stehen ausschließlich in `lib/actions/`. (Inline-`"use
  server"`-Closures in Page-Komponenten kommen vor — z.B. für
  `signOutAction` im Admin-Layout — und sind auf solche kurzen
  ad-hoc-Wrapper beschränkt.)

---

## Datenfluss: Ergebnis-Import-Wizard

Der wichtigste Use-Case der App. 5 Schritte mit klar getrennter
Verantwortung:

```
┌────────────┐
│  source    │  User wählt Tab (API / Paste / PDF)
│            │
│  API:      │  fetchM2SResultsAction(url)
│            │  → fetchM2SResults() in lib/import/manage2sail-api.ts
│            │  → JSON-API-Call, germanOnly-Filter (default true)
│            │  → ParsedRegatta { entries, numRaces, totalStarters }
│            │     (totalStarters = VOR-Filter-Anzahl, also alle Boote)
│  Paste:    │  parseTextAction(text)
│            │  → parsePaste() — kein Country-Filter, alles parsen
│  PDF:      │  parsePdfAction(file)
│            │  → pdf-auto-detect erkennt Format → richtigen Parser
└─────┬──────┘
      │  ParsedRegatta
      ▼
┌────────────┐
│  metadata  │  User wählt Regatta in DB (Match-Vorschlag falls Name passt)
└─────┬──────┘
      │  regattaId + ParsedRegatta
      ▼
┌────────────┐
│  matching  │  getMatchSuggestionsAction(parsedEntries)
│            │  → findMatches() pro Helm/Crew (Fuzzy)
│            │  → User entscheidet pro Eintrag: accept / create
└─────┬──────┘
      │  EntryDecision[]
      ▼
┌────────────┐
│  startarea │  User markiert "ins Startgebiet gekommen" (DNS/BFD/OCS)
└─────┬──────┘
      │
      ▼
┌────────────┐
│  preview   │  Letzte Review + editierbare Felder:
│            │  - totalStarters (Default = parser-Wert oder DB-Wert)
│            │  - "Aus M2S abrufen"-Button für Auto-Fetch der Klassen-
│            │     Teilnehmerzahl bei Auslandsregatten
│            │  → commitImportAction(...)
└─────┬──────┘
      │  in einer Transaktion:
      ▼
┌─────────────────────────────────────────────────────────────────┐
│  1. Regatta.update    (completedRaces, totalStarters)           │
│  2. ImportSession.create  (Audit + Match-Decisions)             │
│  3. pro Decision:                                               │
│       Sailor.upsert     (Helm/Crew, falls "create")             │
│       TeamEntry.upsert  (Unique [regattaId, helmId] schützt     │
│                          Re-Imports vor Duplikaten)             │
│       Result.upsert     (finalRank, finalPoints, racePoints)    │
└─────────────────────────────────────────────────────────────────┘
```

---

## Datenfluss: Ranglisten-Berechnung

Drei verschiedene Compute-Pfade, gleiche Engine:

```
                ┌─────────────────────┐
                │  UI: vorschau /     │
                │      gespeicherte   │
                │      Rangliste      │
                └──────────┬──────────┘
                           │
                           ▼
            ┌──────────────────────────────┐
            │  computeRankingAction(params)│
            │  in lib/actions/rankings.ts  │
            │                              │
            │  type ∈ {JAHRESRANGLISTE,    │
            │          AKTUELLE, IDJM}     │
            └──────────────┬───────────────┘
                           │
              ┌────────────┴────────────┐
              │                         │
              ▼                         ▼
    ┌───────────────────┐     ┌───────────────────┐
    │ calculateDsvRank- │     │ calculateIdjmQuali│
    │   ing()           │     │  (Wrapper)        │
    │ (lib/scoring/     │     │                   │
    │   dsv.ts)         │     │ - useRegattaDate- │
    │                   │     │   ForAge: true    │
    │ Pure function:    │     │ - R ≥ 25 Filter   │
    │ - Filter Helm/    │     │                   │
    │   Crew Alter+Sex  │     │ Delegiert dann an │
    │ - calculateRA-    │     │ calculateDsv-     │
    │   ForResult()     │     │   Ranking()       │
    │ - Multiplier m    │     └───────────────────┘
    │ - Top-9-Mittel    │
    │ - Tiebreak        │
    └─────────┬─────────┘
              │
              ▼
    ┌─────────────────────────────────────────┐
    │  rankings = HelmRanking[]               │
    │  { helmId, rank, R, top9, allValues }   │
    └─────────┬───────────────────────────────┘
              │
              │  in computeRankingAction:
              │  - Sailor-Lookup für Names
              │  - Crew-Aggregation (Issue #31)
              │  - regattaMetas mit s + Override-Marker
              ▼
    ┌─────────────────────────────────────────┐
    │  RankingComputeResult { rows, regattas }│
    │  → Render in Vorschau-Tabelle           │
    └─────────────────────────────────────────┘
```

JWM/JEM-Quali läuft **separat** (`computeJwmJemAction` →
`calculateJwmJemQuali`) mit anderer Formel und eigenem
Schottenwechsel-Team-Partitioning. Siehe `business-rules.md` §2.4 + §2.5.

---

## Server-Action-Konvention

Jede Server-Action in `lib/actions/` folgt diesem Template:

```ts
"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { logAudit, A } from "@/lib/security/audit";

const inputSchema = z.object({
  // …
});

type Result<T = void> = { ok: true; data: T } | { ok: false; error: string };

export async function someAction(input: unknown): Promise<Result> {
  // 1. Auth-Check (außer bei expliziten public-Actions wie Compute-Reads)
  const session = await auth();
  if (!session) return { ok: false, error: "Nicht angemeldet." };

  // 2. Zod-Validierung
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Ungültige Eingabe: " + parsed.error.issues[0]?.message };
  }

  try {
    // 3. DB-Operation (idealerweise in einer Transaktion bei mehreren Schritten)
    await db.someTable.update({ where: { … }, data: parsed.data });

    // 4. Audit-Log für sicherheitsrelevante Events
    await logAudit({
      userId: session.user.id,
      action: A.SOMETHING_CHANGED,
      detail: "…",
    });

    // 5. revalidatePath für betroffene UI-Pfade
    revalidatePath("/admin/something");

    return { ok: true, data: undefined };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
```

**Konventionen**:
- Returntyp ist immer `{ ok: true; data: T } | { ok: false; error: string }`
  — niemals `throw`. Aufrufer können auf `result.ok` switchen.
- Auth-Check als erstes (Code-Reuse-pattern: User wird oft im Folgeschritt
  gebraucht).
- Audit-Log für: Login-Events, Passwort-Changes, Datenoperationen
  (Backup/Restore/Delete/Merge), TOTP/Passkey-Changes. Reine UI-Updates
  ohne Sicherheitsrelevanz **nicht** loggen (zu rauschig).
- `revalidatePath` IMMER nach Mutationen, sonst zeigt der React-Cache
  alte Daten.

---

## Wichtige globale Invarianten

| Was | Wo durchgesetzt |
|---|---|
| `s = regatta.totalStarters ?? regatta.results.length` | `lib/scoring/dsv.ts` + `app/(public)/regatta/[id]/page.tsx` (über `calculateRAForResult`) |
| AKTUELLE Rangliste wird nie persistiert | `SAVEABLE_TYPES`-Whitelist in `rankings.ts` |
| Schottenwechsel wirkt nur auf JWM/JEM-Quali | nur `lib/scoring/jwm-jem-quali.ts` liest `crewSwapApproved` |
| Foreign Boats zählen in `s` und `x`, kein Helm-Filter | `lib/scoring/dsv.ts`, `business-rules.md` §3.4 |
| `germanOnly` beim Import ist Default | `fetchM2SResults` — schlanke Sailor-DB |
| Login nur für existierende User-E-Mails | `signIn`-Callback in `lib/auth.ts` (OAuth-Pfad) |
| Schema-Änderung → SQLite + Postgres-Migration | `prisma migrate dev` + manuell `prisma/prod/migrations/` |
| Schema-`/** … */`-Kommentare crashen Prisma | Lint in `scripts/sync-prod-schema.mjs` |

---

## Test-Strategie

| Layer | Tools | Coverage |
|---|---|---|
| Pure libs (`lib/scoring/`, `lib/import/`) | Vitest | hoch — 200+ Tests |
| Server-Actions | (kein Direkt-Test) | über E2E impliziert |
| React-Components | (kein Snapshot) | über E2E impliziert |
| End-to-End | Playwright (`e2e/`) | Smoke-Pfade: Login, Import, Vorschau |

**Wenn ein Bug auf einem UI-Pfad gefangen werden soll**: erst Test in der
Pure-Lib-Schicht versuchen (am schnellsten + zuverlässigsten), dann E2E.

---

## Build + Deploy

| Stufe | Was |
|---|---|
| `npm run dev` | Next.js dev-server (Turbopack), SQLite, Prisma-Schema aus `schema.prisma` |
| `npm run lint` | ESLint (next/core-web-vitals + next/typescript) |
| `npm run test` | Vitest (Pure-Lib-Tests) |
| `npm run test:e2e` | Playwright-Tests (Smoke-Pfade) |
| `npm run db:sync-prod` | SQLite-Schema → Postgres-Schema regenerieren |
| `npm run vercel-build` | Vercel-Build: sync → migrate (Postgres) → next build |

**Vercel-Setup**:
- Region: `fra1` (Frankfurt)
- DB: Neon PostgreSQL (pooled + unpooled URL)
- Storage: Vercel Blob (für Backups, sonst `/tmp`)
- Cron: 1× täglich `01:00 UTC` (`/api/cron/backup`)
- ENV-Vars siehe [`DEPLOY.md`](../DEPLOY.md)
