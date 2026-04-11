-- AlterTable
ALTER TABLE "PracticeSession" ADD COLUMN "genderScope" TEXT NOT NULL DEFAULT 'all';
ALTER TABLE "PracticeSession" ADD COLUMN "attendanceJson" TEXT NOT NULL DEFAULT '{}';
ALTER TABLE "PracticeSession" ADD COLUMN "lineupTeamsJson" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "PracticeSession" ADD COLUMN "teamSize" INTEGER NOT NULL DEFAULT 4;
ALTER TABLE "PracticeSession" ADD COLUMN "maxMato" INTEGER NOT NULL DEFAULT 8;
