-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Ranking" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "seasonStart" DATETIME NOT NULL,
    "seasonEnd" DATETIME NOT NULL,
    "ageCategory" TEXT NOT NULL,
    "genderCategory" TEXT NOT NULL,
    "scoringRule" TEXT NOT NULL,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" DATETIME,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Ranking" ("ageCategory", "createdAt", "genderCategory", "id", "isPublic", "name", "publishedAt", "scoringRule", "seasonEnd", "seasonStart", "type", "updatedAt") SELECT "ageCategory", "createdAt", "genderCategory", "id", "isPublic", "name", "publishedAt", "scoringRule", "seasonEnd", "seasonStart", "type", "updatedAt" FROM "Ranking";
DROP TABLE "Ranking";
ALTER TABLE "new_Ranking" RENAME TO "Ranking";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
