-- Issue #49: Benutzerverwaltung
-- - Editor-Rolle (Default für neu angelegte User), ADMIN bleibt bestehender
--   Default für den initialen Seed-Admin
-- - Manuelle Sperrung via disabledAt/disabledBy
-- - Session-Invalidierung via tokenVersion (in JWT eingebettet, in
--   lib/auth-guard.ts pro Request gegen DB geprüft)

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "disabledAt"   TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "disabledBy"   TEXT,
  ADD COLUMN IF NOT EXISTS "tokenVersion" INTEGER NOT NULL DEFAULT 0;

-- Default für neu angelegte User auf EDITOR umstellen.
-- Bestehende ADMIN-Rows bleiben unverändert, damit der initiale Seed-Admin
-- weiter ADMIN ist.
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'EDITOR';
