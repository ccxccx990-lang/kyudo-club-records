-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PracticeSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "practiceDate" TEXT NOT NULL,
    "memo" TEXT NOT NULL DEFAULT '',
    "roundCount" INTEGER NOT NULL DEFAULT 5,
    "genderScope" TEXT NOT NULL DEFAULT 'all',
    "attendanceJson" TEXT NOT NULL DEFAULT '{}',
    "lineupTeamsJson" TEXT NOT NULL DEFAULT '[]',
    "teamSize" INTEGER NOT NULL DEFAULT 4,
    "maxMato" INTEGER NOT NULL DEFAULT 8,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_PracticeSession" ("attendanceJson", "createdAt", "genderScope", "id", "lineupTeamsJson", "maxMato", "memo", "practiceDate", "roundCount", "teamSize", "updatedAt") SELECT "attendanceJson", "createdAt", "genderScope", "id", "lineupTeamsJson", "maxMato", "memo", "practiceDate", "roundCount", "teamSize", "updatedAt" FROM "PracticeSession";
DROP TABLE "PracticeSession";
ALTER TABLE "new_PracticeSession" RENAME TO "PracticeSession";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
