-- CreateTable
CREATE TABLE "Member" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "gradeYear" TEXT NOT NULL DEFAULT '',
    "gender" TEXT NOT NULL DEFAULT '',
    "role" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PracticeSession" (
    "id" TEXT NOT NULL,
    "practiceDate" TEXT NOT NULL,
    "memo" TEXT NOT NULL DEFAULT '',
    "sessionKind" TEXT NOT NULL DEFAULT 'joint',
    "roundCount" INTEGER NOT NULL DEFAULT 5,
    "genderScope" TEXT NOT NULL DEFAULT 'all',
    "attendanceJson" TEXT NOT NULL DEFAULT '{}',
    "lineupTeamsJson" TEXT NOT NULL DEFAULT '[]',
    "teamSize" INTEGER NOT NULL DEFAULT 4,
    "maxMato" INTEGER NOT NULL DEFAULT 8,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PracticeSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoundRecord" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "roundIndex" INTEGER NOT NULL,
    "marks" TEXT NOT NULL,

    CONSTRAINT "RoundRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RoundRecord_sessionId_memberId_roundIndex_key" ON "RoundRecord"("sessionId", "memberId", "roundIndex");

-- AddForeignKey
ALTER TABLE "RoundRecord" ADD CONSTRAINT "RoundRecord_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "PracticeSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoundRecord" ADD CONSTRAINT "RoundRecord_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
