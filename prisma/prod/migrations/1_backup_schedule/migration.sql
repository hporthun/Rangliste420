-- CreateTable
CREATE TABLE "BackupSchedule" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "hour" INTEGER NOT NULL DEFAULT 2,
    "minute" INTEGER NOT NULL DEFAULT 0,
    "daysOfWeek" TEXT NOT NULL DEFAULT '[1]',
    "maxKeep" INTEGER NOT NULL DEFAULT 30,
    "encryptionPassword" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BackupSchedule_pkey" PRIMARY KEY ("id")
);

