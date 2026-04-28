# Deploy — Vercel + Neon (Phase 1)

Dieses Dokument beschreibt das Deployment der 420er-Ranglistenverwaltung
auf **Vercel** mit **Neon** als PostgreSQL-Datenbank.

> **Status Phase 1**: Anwendung läuft vollständig, alle Lese- und Schreib-
> operationen funktionieren. Automatische Backups sind temporär deaktiviert
> — sie werden in Phase 2 über Vercel Cron Jobs + Vercel Blob nachgerüstet.

---

## 1. Neon einrichten

1. Account anlegen unter [neon.tech](https://neon.tech) (Login mit GitHub oder
   Google ist am einfachsten).
2. Neues Projekt erzeugen:
   - **Project name**: `rangliste420`
   - **Postgres version**: 16
   - **Region**: `eu-central-1 (Frankfurt)` ← wichtig für Latenz
3. Aus dem Connection-String-Dialog **beide** URLs kopieren:
   - **Pooled connection** → `DATABASE_URL`
   - **Direct connection** → `DATABASE_URL_UNPOOLED`

   Beispiel:
   ```
   postgresql://owner:abc123@ep-shy-fog-12345-pooler.eu-central-1.aws.neon.tech/rangliste420?sslmode=require
   postgresql://owner:abc123@ep-shy-fog-12345.eu-central-1.aws.neon.tech/rangliste420?sslmode=require
   ```

## 2. GitHub-Mirror einrichten (Gitea → GitHub)

Vercel kann direkt nur GitHub/GitLab/Bitbucket lesen. Da das Hauptrepo auf
Gitea liegt, richten wir einen automatischen Push-Mirror ein.

1. **Auf GitHub**: leeres Repo `Rangliste420` anlegen (Public reicht).
   Notiere die HTTPS-URL: `https://github.com/<username>/Rangliste420.git`.
2. **Personal Access Token (GitHub)** erzeugen
   *(Settings → Developer settings → Personal access tokens → Fine-grained)*:
   - Repository access: nur das eine Repo
   - Permissions: `Contents: Read and write`
   - Token kopieren (`ghp_…`).
3. **In Gitea** zum Projekt navigieren → *Settings → Repository → Mirror*
   *Settings* → *Add Push Mirror*:
   - URL: `https://<github-username>:<github-token>@github.com/<username>/Rangliste420.git`
   - Push-Intervall: `8h` (oder kürzer)
   - Speichern; `Sync Now` zum Test.

Ab jetzt wird jeder Push auf Gitea-master automatisch nach GitHub gespiegelt.

## 3. Vercel-Projekt anlegen

1. [vercel.com](https://vercel.com) → mit GitHub einloggen → **Add New → Project**.
2. GitHub-Repo `Rangliste420` importieren.
3. **Framework Preset**: Next.js (wird automatisch erkannt).
4. **Build Command**: `npm run vercel-build` (steht bereits in `vercel.json`).
5. **Root Directory**: `./` (Default).
6. **Environment Variables** (im Vercel-Dashboard unter Settings → Environment Variables):

   | Name | Wert | Scope |
   |---|---|---|
   | `DATABASE_URL` | Neon Pooled-URL | Production + Preview |
   | `DATABASE_URL_UNPOOLED` | Neon Direct-URL | Production + Preview |
   | `AUTH_SECRET` | Output von `openssl rand -base64 32` | Production + Preview |
   | `AUTH_URL` | `https://<projekt>.vercel.app` | Production |
   | `TZ` | `Europe/Berlin` | Production + Preview |

7. **Deploy** klicken. Der erste Build dauert 2–3 Minuten.

### Was passiert beim Build?

Das Skript `npm run vercel-build` führt aus:
1. `node scripts/sync-prod-schema.mjs` — synchronisiert das Postgres-Schema
   aus dem SQLite-Schema (alle Modell-Änderungen werden 1:1 übernommen).
2. `prisma migrate deploy --schema=prisma/prod/schema.prisma` — wendet alle
   PostgreSQL-Migrationen aus `prisma/prod/migrations/` an.
3. `prisma generate --schema=prisma/prod/schema.prisma` — generiert den
   Prisma-Client für PostgreSQL.
4. `next build` — produktiver Next.js-Build.

## 4. Erst-Login einrichten

Nach dem ersten erfolgreichen Deploy ist die Datenbank leer — kein Admin-User.
Es gibt zwei Wege, den ersten Account anzulegen:

### Variante A — Seed-Skript via Vercel CLI

```bash
# Lokal mit Vercel-CLI verbinden
npx vercel link

# Mit Production-Env in deine lokale Shell laden
npx vercel env pull .env.production.local

# Seed mit den Production-Credentials laufen lassen (legt
# hajo@porthun.de mit Zufallspasswort an, das in der Konsole ausgegeben wird)
NODE_ENV=production npm run db:seed
```

### Variante B — Direkt in Neon (SQL Editor)

Im Neon-Dashboard → SQL Editor — führe folgendes aus, mit einem
zuvor lokal generierten bcrypt-Hash:

```bash
# Lokal: Hash generieren
node -e "console.log(require('bcryptjs').hashSync('DeinPasswort', 10))"
```

```sql
-- In Neon SQL Editor
INSERT INTO "User" (id, username, email, "passwordHash", role, "totpEnabled",
                    "totpBackupCodes", "failedLoginAttempts", "createdAt", "updatedAt")
VALUES (
  'cltest0001',
  'hajo',
  'hajo@porthun.de',
  '$2a$10$...HIER_DEN_HASH_EINFÜGEN...',
  'ADMIN',
  false, '[]', 0, NOW(), NOW()
);
```

## 5. Custom Domain (optional)

Im Vercel-Dashboard → Settings → Domains:
- Eigene Domain hinzufügen (z. B. `rangliste.420er-klasse.de`)
- Vercel zeigt die nötigen DNS-Einträge (A-Record oder CNAME).
- Der DNS-Provider muss diese Einträge setzen.
- SSL-Zertifikat wird automatisch über Let's Encrypt ausgestellt.

## 6. Daten aus dem alten System migrieren

Falls du bereits eine SQLite-DB lokal hast (`prisma/dev.db`):

```bash
# Lokal: ein Backup im JSON-Format erzeugen
npm run dev   # Server starten
# Im Browser: /admin/wartung → "Backup herunterladen"
```

Dann auf der Production-Seite: `/admin/wartung → Rücksicherung →
JSON-Datei hochladen`. Innerhalb des bereits angemeldeten Admin-Sessions
können alle Daten so übertragen werden.

## 7. Bekannte Phase-1-Einschränkungen

- **Automatische Backups**: deaktiviert. Der Hinweis-Banner auf der
  Wartungsseite informiert den Admin.
- **Manuelle „Jetzt sichern"**: schreibt nach `/tmp` — bitte sofort
  herunterladen, danach Datei verloren.
- **Einmalige Datensicherung („Backup herunterladen")**: funktioniert
  uneingeschränkt (Stream direkt zum Browser, kein Disk-IO).
- **Rücksicherung**: funktioniert (Upload geht in den Memory-Stream
  und direkt in die DB).

Phase 2 wird:
1. Den Backup-Scheduler durch eine Vercel-Cron-Route ersetzen.
2. Backup-Storage auf Vercel Blob umstellen (1 GB gratis).
3. Konfigurierbare Schedules über die DB persistieren statt im FS.

---

## Lokale Entwicklung bleibt unverändert

Lokal wird weiter SQLite verwendet:

```bash
npm install
npm run db:migrate   # erstellt prisma/dev.db
npm run db:seed
npm run dev
```

Die Postgres-Konfiguration (`prisma/prod/`) wird ausschließlich beim
Vercel-Build aktiviert.

## Schema-Änderungen

Nach jeder Schema-Änderung in `prisma/schema.prisma`:

```bash
# 1. Lokale SQLite-Migration
npm run db:migrate -- --name <kurz_und_aussagekraeftig>

# 2. Postgres-Schema synchronisieren
npm run db:sync-prod

# 3. Postgres-Migration gegen einen Neon-Dev-Branch erzeugen
DATABASE_URL="<neon-dev-branch-url>" \
DATABASE_URL_UNPOOLED="<neon-dev-branch-direct-url>" \
  npx prisma migrate dev --schema=prisma/prod/schema.prisma --name <gleicher_name>

# 4. Beide Migrations-Dateien committen
git add prisma/migrations prisma/prod/migrations prisma/schema.prisma prisma/prod/schema.prisma
git commit -m "schema: <was geändert wurde>"
```
