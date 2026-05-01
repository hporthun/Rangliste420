-- AlterTable: sortOrder (Issue #46) + scoringUnit (Issue #47)
ALTER TABLE "Ranking" ADD COLUMN IF NOT EXISTS "sortOrder" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Ranking" ADD COLUMN IF NOT EXISTS "scoringUnit" TEXT NOT NULL DEFAULT 'HELM';
