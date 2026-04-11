import Link from "next/link";
import { notFound } from "next/navigation";
import { sortMembers } from "@/lib/memberFields";
import { prisma } from "@/lib/prisma";
import { readIsAdmin } from "@/lib/serverAdmin";
import { PracticeMarksEditor } from "../PracticeMarksEditor";

type PageProps = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

export default async function PracticeMarksPage({ params }: PageProps) {
  const { id } = await params;

  const session = await prisma.practiceSession.findUnique({
    where: { id },
    include: { records: true },
  });

  if (!session) {
    notFound();
  }

  const rawMembers = await prisma.member.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, gradeYear: true, gender: true },
  });
  const members = sortMembers(rawMembers);

  const isAdmin = await readIsAdmin();

  const { records, ...sessionRest } = session;

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      {members.length === 0 ? (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          部員がまだいません。先に{" "}
          <Link className="font-semibold text-indigo-900 underline" href="/members">
            部員
          </Link>{" "}
          を登録してください。
        </div>
      ) : null}

      <PracticeMarksEditor
        session={{
          id: sessionRest.id,
          practiceDate: sessionRest.practiceDate,
          memo: sessionRest.memo,
          roundCount: sessionRest.roundCount,
          genderScope: sessionRest.genderScope,
          attendanceJson: sessionRest.attendanceJson,
          lineupTeamsJson: sessionRest.lineupTeamsJson,
          teamSize: sessionRest.teamSize,
          maxMato: sessionRest.maxMato,
        }}
        members={members}
        records={records.map((r) => ({
          memberId: r.memberId,
          roundIndex: r.roundIndex,
          marks: r.marks,
        }))}
        isAdmin={isAdmin}
      />
    </main>
  );
}
