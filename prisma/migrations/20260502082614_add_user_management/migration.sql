-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT,
    "email" TEXT,
    "passwordHash" TEXT,
    "role" TEXT NOT NULL DEFAULT 'EDITOR',
    "disabledAt" DATETIME,
    "disabledBy" TEXT,
    "tokenVersion" INTEGER NOT NULL DEFAULT 0,
    "totpSecret" TEXT,
    "totpEnabled" BOOLEAN NOT NULL DEFAULT false,
    "totpBackupCodes" TEXT NOT NULL DEFAULT '[]',
    "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" DATETIME,
    "resetToken" TEXT,
    "resetTokenExpiry" DATETIME,
    "lastReadChangelogVersion" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_User" ("createdAt", "email", "failedLoginAttempts", "id", "lastReadChangelogVersion", "lockedUntil", "passwordHash", "resetToken", "resetTokenExpiry", "role", "totpBackupCodes", "totpEnabled", "totpSecret", "updatedAt", "username") SELECT "createdAt", "email", "failedLoginAttempts", "id", "lastReadChangelogVersion", "lockedUntil", "passwordHash", "resetToken", "resetTokenExpiry", "role", "totpBackupCodes", "totpEnabled", "totpSecret", "updatedAt", "username" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_resetToken_key" ON "User"("resetToken");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
