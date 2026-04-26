-- CreateTable
CREATE TABLE "Sailor" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "birthDate" DATETIME,
    "gender" TEXT,
    "nationality" TEXT NOT NULL DEFAULT 'GER',
    "club" TEXT,
    "sailingLicenseId" TEXT,
    "alternativeNames" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Regatta" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "location" TEXT,
    "country" TEXT NOT NULL DEFAULT 'GER',
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "numDays" INTEGER NOT NULL DEFAULT 1,
    "plannedRaces" INTEGER,
    "completedRaces" INTEGER NOT NULL,
    "multiDayAnnouncement" BOOLEAN NOT NULL DEFAULT false,
    "ranglistenFaktor" DECIMAL NOT NULL,
    "scoringSystem" TEXT NOT NULL DEFAULT 'LOW_POINT',
    "isRanglistenRegatta" BOOLEAN NOT NULL DEFAULT false,
    "sourceType" TEXT NOT NULL DEFAULT 'MANAGE2SAIL_PASTE',
    "sourceUrl" TEXT,
    "sourceFile" TEXT,
    "importedAt" DATETIME,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "TeamEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "regattaId" TEXT NOT NULL,
    "helmId" TEXT NOT NULL,
    "crewId" TEXT,
    "sailNumber" TEXT,
    "crewSwapApproved" BOOLEAN NOT NULL DEFAULT false,
    "crewSwapNote" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TeamEntry_regattaId_fkey" FOREIGN KEY ("regattaId") REFERENCES "Regatta" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TeamEntry_helmId_fkey" FOREIGN KEY ("helmId") REFERENCES "Sailor" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TeamEntry_crewId_fkey" FOREIGN KEY ("crewId") REFERENCES "Sailor" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Result" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "regattaId" TEXT NOT NULL,
    "teamEntryId" TEXT NOT NULL,
    "finalRank" INTEGER,
    "finalPoints" DECIMAL,
    "racePoints" TEXT NOT NULL DEFAULT '[]',
    "inStartArea" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Result_regattaId_fkey" FOREIGN KEY ("regattaId") REFERENCES "Regatta" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Result_teamEntryId_fkey" FOREIGN KEY ("teamEntryId") REFERENCES "TeamEntry" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Ranking" (
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "RankingRegatta" (
    "rankingId" TEXT NOT NULL,
    "regattaId" TEXT NOT NULL,
    "weight" REAL,

    PRIMARY KEY ("rankingId", "regattaId"),
    CONSTRAINT "RankingRegatta_rankingId_fkey" FOREIGN KEY ("rankingId") REFERENCES "Ranking" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RankingRegatta_regattaId_fkey" FOREIGN KEY ("regattaId") REFERENCES "Regatta" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ImportSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "regattaId" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "parserType" TEXT NOT NULL,
    "sourceFile" TEXT,
    "matchDecisions" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ImportSession_regattaId_fkey" FOREIGN KEY ("regattaId") REFERENCES "Regatta" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'ADMIN',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "TeamEntry_regattaId_helmId_key" ON "TeamEntry"("regattaId", "helmId");

-- CreateIndex
CREATE UNIQUE INDEX "Result_teamEntryId_key" ON "Result"("teamEntryId");

-- CreateIndex
CREATE UNIQUE INDEX "Result_regattaId_teamEntryId_key" ON "Result"("regattaId", "teamEntryId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
