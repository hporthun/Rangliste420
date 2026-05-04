-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Result" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "regattaId" TEXT NOT NULL,
    "teamEntryId" TEXT NOT NULL,
    "finalRank" INTEGER,
    "finalPoints" DECIMAL,
    "racePoints" TEXT NOT NULL DEFAULT '[]',
    "inStartArea" BOOLEAN NOT NULL DEFAULT false,
    "isRankManual" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Result_regattaId_fkey" FOREIGN KEY ("regattaId") REFERENCES "Regatta" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Result_teamEntryId_fkey" FOREIGN KEY ("teamEntryId") REFERENCES "TeamEntry" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Result" ("createdAt", "finalPoints", "finalRank", "id", "inStartArea", "racePoints", "regattaId", "teamEntryId", "updatedAt") SELECT "createdAt", "finalPoints", "finalRank", "id", "inStartArea", "racePoints", "regattaId", "teamEntryId", "updatedAt" FROM "Result";
DROP TABLE "Result";
ALTER TABLE "new_Result" RENAME TO "Result";
CREATE UNIQUE INDEX "Result_teamEntryId_key" ON "Result"("teamEntryId");
CREATE INDEX "Result_regattaId_idx" ON "Result"("regattaId");
CREATE UNIQUE INDEX "Result_regattaId_teamEntryId_key" ON "Result"("regattaId", "teamEntryId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
