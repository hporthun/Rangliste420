# 420er-Rangliste

Next.js-Webanwendung zur Erstellung von Ranglisten für die **420er-Klasse** nach DSV-Ranglistenordnung 2026 sowie der klassenspezifischen JWM/JEM-Quali. Import primär aus Manage2Sail (Web-Copy-Paste oder PDF), öffentliche Ansicht mit voller Transparenz der Berechnung, Admin-Pflege mit 2FA/Passkey-Support.

Die fachliche Spezifikation steht in [`PLAN_1.md`](./PLAN_1.md), die Code-Konventionen in [`CLAUDE.md`](./CLAUDE.md).

## Voraussetzungen

- **Node.js 20+** (Next.js 16 setzt mindestens Node 20.9 voraus)
- **npm 10+** (mit Node 20 mitgeliefert)
- **Git**
- **Windows / macOS / Linux** — auf Windows funktioniert sowohl PowerShell als auch Git-Bash

> Hinweis: Lokal wird **SQLite** verwendet (`prisma/schema.prisma`). Produktion läuft auf **PostgreSQL/Neon** (`prisma/prod/schema.prisma`, automatisch generiert via `scripts/sync-prod-schema.mjs`). Für die Entwicklung muss kein Postgres installiert sein.

## Setup (lokale Entwicklung mit SQLite)

### 1. Repository klonen und Abhängigkeiten installieren

```bash
git clone <repo-url> Rangliste420
cd Rangliste420
npm install
```

### 2. `.env` anlegen

Kopiere `.env.example` nach `.env` und passe sie an:

```bash
cp .env.example .env
```

Für die lokale Entwicklung mit SQLite reicht folgender Inhalt:

```dotenv
# DATABASE_URL ist relativ zum prisma/-Verzeichnis
DATABASE_URL="file:./dev.db"
DATABASE_URL_UNPOOLED="file:./dev.db"

# Zufallsschlüssel für NextAuth (32 Byte, base64)
AUTH_SECRET="<bitte ersetzen>"
```

**AUTH_SECRET generieren:**

```bash
# Linux/macOS/Git-Bash:
openssl rand -base64 32

# Windows PowerShell:
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Max 256 }))

# Plattformunabhängig (mit Node):
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

> Die `.env`-Datei ist per `.gitignore` ausgeschlossen und darf nicht eingecheckt werden.

### 3. Datenbank initialisieren

Beim Erst-Setup eines geclonten Repos sind die Migrationen schon vorhanden — sie müssen nur angewendet werden:

```bash
npx prisma migrate deploy   # Migrationen 1:1 anwenden (kein Schema-Drift erlaubt)
npx prisma generate         # Prisma-Client generieren
```

Wer aktiv am Schema arbeitet (Schema-Änderungen + neue Migration), nimmt stattdessen:

```bash
npx prisma migrate dev      # erzeugt/applied Migrationen + generate
```

> Achtung: `migrate deploy` setzt voraus, dass alle Migrationen 1:1 zum aktuellen `schema.prisma` passen. Bei lokalen Schema-Experimenten lieber `migrate dev` verwenden.

### 4. Admin-Account anlegen (Seed)

```bash
npx prisma db seed
```

Der Seed legt einen Admin-User mit Benutzernamen `admin` an und gibt ein **zufällig generiertes Initialpasswort** auf der Konsole aus. **Bitte sofort sicher notieren** — es wird nicht erneut angezeigt. Beim Erst-Login sollte das Passwort über die Account-Einstellungen gewechselt werden, ebenso 2FA/Passkey aktiviert werden.

Wenn der Admin-Account bereits existiert, läuft der Seed idempotent (kein Reset).

### 5. Entwicklungsserver starten

```bash
npm run dev
```

Anschließend [http://localhost:3000](http://localhost:3000) öffnen. Der Admin-Bereich liegt unter `/admin` und leitet bei fehlender Session auf den Login um.

## Häufige Kommandos

| Kommando | Zweck |
| --- | --- |
| `npm run dev` | Next.js Dev-Server (Turbopack, Port 3000; `-- -p 3001` bei Konflikt) |
| `npm run build` | Produktions-Build (lokal mit SQLite-Schema) |
| `npm run start` | Produktions-Server nach `build` |
| `npm run lint` | ESLint |
| `npm run test` | Vitest-Unit-Tests einmalig |
| `npm run test:watch` | Vitest im Watch-Mode |
| `npm run test:e2e` | Playwright-E2E-Tests (siehe Hinweis unten) |
| `npm run db:seed` | Seed manuell ausführen |
| `npm run db:migrate` | `prisma migrate dev` (Schema-Änderung + neue Migration) |
| `npm run db:studio` | Prisma Studio (DB-Browser auf [http://localhost:5555](http://localhost:5555)) |
| `npm run db:sync-prod` | Prod-Schema (`prisma/prod/schema.prisma`) aus Dev-Schema regenerieren |
| `npm run db:generate:prod` | Prisma-Client gegen Produktions-Schema (PostgreSQL) generieren |
| `npm run db:migrate:prod` | Produktions-Migrationen (`prisma/prod/migrations`) gegen `DATABASE_URL` anwenden |

### E2E-Tests

Die Playwright-Tests verwenden eine **separate** SQLite-Datenbank (`prisma/test.db`, siehe `e2e/constants.ts`). Vor dem ersten Lauf muss diese Datenbank ebenfalls migriert werden:

```bash
DATABASE_URL="file:./test.db" npx prisma migrate deploy
npm run test:e2e
```

Auf Windows PowerShell:

```powershell
$env:DATABASE_URL = "file:./test.db"; npx prisma migrate deploy
npm run test:e2e
```

## Projektstruktur (Auszug)

```
app/                Next.js App Router (Pages, Layouts, API-Routes)
components/         UI-Komponenten (shadcn/ui-basiert)
lib/
├── actions/        Server Actions
├── auth.ts         NextAuth-Konfiguration (Credentials + Passkeys)
├── backup/         Backup-/Restore-Logik
├── db/client.ts    Prisma-Client-Singleton
├── import/         Parser (Manage2Sail Web/PDF, CSV) — reine Funktionen
├── scoring/        DSV-Engine, JWM/JEM-Quali, IDJM-Quali — reine Funktionen
├── schemas/        Zod-Schemas
├── security/       Rate-Limiting, Audit-Log
├── totp.ts         TOTP-2FA
├── webauthn/       Passkey-/WebAuthn-Flows
prisma/
├── schema.prisma         Lokales Schema (SQLite, Single Source of Truth)
├── prod/
│   ├── schema.prisma     Auto-generiertes Produktions-Schema (PostgreSQL/Neon)
│   └── migrations/       Produktions-Migrationen (provider=postgresql)
├── migrations/           Lokale Migrationen (provider=sqlite)
└── seed.ts               Admin-Seed
e2e/                Playwright-Tests
scripts/            Hilfsskripte (PDF-Parser-Diagnose etc.)
data/backups/       Lokale Backup-Ablage (per .gitignore ausgeschlossen)
```

## Architektur-Leitplanken

Vollständig in [`CLAUDE.md`](./CLAUDE.md). Die wichtigsten:

- **DSV-Kernformel** in `lib/scoring/dsv.ts` (`R_A = f × 100 × ((s+1−x)/s)`) — Quelle: DSV-RO Anlage 1 §2, gültig ab 01.01.2026. Nicht eigenmächtig ändern.
- **DSV- und JWM/JEM-Logik strikt getrennt** (verschiedene Module).
- **Import-Parser und Scoring-Engine sind reine Funktionen** (keine DB-Zugriffe).
- **Fuzzy-Matching** schlägt nur vor — Zuordnung zu Seglern erfordert immer **Admin-Bestätigung**.
- **Geburtsdatum/Geschlecht** werden nie geraten; fehlen sie, wird der Segler aus gefilterten Ranglisten ausgeschlossen.

## Stolperstellen

- **Port 3000 belegt** → `npm run dev -- -p 3001`
- **Prisma-Client nach Schema-Änderung veraltet** → `npx prisma generate`
- **`Environment variable not found: DATABASE_URL`** → `.env` fehlt oder wurde nicht geladen; prüfe Inhalt und Speicherort
- **`The provider in your schema does not match the migration_lock.toml`** → die lokalen Migrationen sind für SQLite; nicht versehentlich `prisma/prod/schema.prisma` als Default verwenden
- **Build/Lint klagt über fehlenden Prisma-Client** → `npx prisma generate` ausführen (passiert auch automatisch bei `migrate deploy`/`migrate dev`)
- **Pre-existing `prisma/dev.db-journal` ohne `dev.db`** → Reste eines abgebrochenen Vorlaufs, einfach löschen und neu migrieren

## Deployment (Vercel + Neon)

Die Produktion läuft auf Vercel mit Neon (PostgreSQL). Build-Command (siehe `vercel.json`): `npm run vercel-build`. Dieses Script führt vier Schritte aus:

```
npm run db:sync-prod \
  && prisma migrate deploy --schema=prisma/prod/schema.prisma \
  && prisma generate --schema=prisma/prod/schema.prisma \
  && next build
```

`db:sync-prod` regeneriert `prisma/prod/schema.prisma` aus der lokalen `prisma/schema.prisma` (datasource auf PostgreSQL umgestellt) — die Single Source of Truth bleibt das Dev-Schema.

Erforderliche Vercel-Environment-Variablen:

- `DATABASE_URL` (Neon **Pooled** Connection String, `?sslmode=require`)
- `DATABASE_URL_UNPOOLED` (Neon **Direct** Connection String — von Prisma für Migrationen genutzt)
- `AUTH_SECRET` (eigener 32-Byte-Wert, **nicht** denselben wie lokal)
- `AUTH_URL` (z. B. `https://deine-domain.vercel.app`)
- optional `BACKUP_DIR=/tmp` (Vercel-Filesystem ist read-only außer `/tmp`)

Vor dem ersten Deploy gegen Neon einmalig die Migrationen anwenden:

```bash
DATABASE_URL="<neon-direct-url>" npm run db:migrate:prod
```

Anschließend Seed ausführen, um den initialen Admin-Account anzulegen:

```bash
DATABASE_URL="<neon-direct-url>" npm run db:seed
```

## Lizenz / Hinweise

Internes Projekt der 420er-Klassenvereinigung. Fachliche Quelle: DSV-„Ordnungen für Regatten" gültig ab 01.01.2026 sowie [420class.de/sport/quali](https://420class.de/index.php/sport/quali).
