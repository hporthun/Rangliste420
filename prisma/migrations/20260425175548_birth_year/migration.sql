/*
  Warnings:

  - You are about to drop the column `birthDate` on the `Sailor` table. All the data in the column will be lost.

*/
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Sailor" ("alternativeNames", "club", "createdAt", "firstName", "gender", "id", "lastName", "nationality", "sailingLicenseId", "updatedAt") SELECT "alternativeNames", "club", "createdAt", "firstName", "gender", "id", "lastName", "nationality", "sailingLicenseId", "updatedAt" FROM "Sailor";
DROP TABLE "Sailor";
ALTER TABLE "new_Sailor" RENAME TO "Sailor";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
