-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Sailor" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "birthYear" INTEGER,
    "gender" TEXT,
    "nationality" TEXT NOT NULL DEFAULT 'GER',
    "club" TEXT,
    "sailingLicenseId" TEXT,
    "alternativeNames" TEXT NOT NULL DEFAULT '[]',
    "member420" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Sailor" ("alternativeNames", "birthYear", "club", "createdAt", "firstName", "gender", "id", "lastName", "nationality", "sailingLicenseId", "updatedAt") SELECT "alternativeNames", "birthYear", "club", "createdAt", "firstName", "gender", "id", "lastName", "nationality", "sailingLicenseId", "updatedAt" FROM "Sailor";
DROP TABLE "Sailor";
ALTER TABLE "new_Sailor" RENAME TO "Sailor";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
