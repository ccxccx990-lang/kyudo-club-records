import Link from "next/link";
import { notFound } from "next/navigation";
import { sortMembers } from "@/lib/memberFields";
import { prisma } from "@/lib/prisma";
import { readIsAdmin } from "@/lib/serverAdmin";
import { PracticeDetail } from "./PracticeDetail";

type PageProps = { params: Promise<{ id: string }> };

export default async function PracticePage({ params }: PageProps) {
  const { id } = await params;

  const session = await prisma.practiceSession.findUnique({
    where: { id },
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

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      {members.length === 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          部員がまだいません。先に{" "}
          <Link className="font-semibold text-indigo-900 underline" href="/members">
            部員
          </Link>{" "}
          を登録してください。
        </div>
      ) : null}

      <PracticeDetail session={session} members={members} isAdmin={isAdmin} />
    </main>
  );
}
