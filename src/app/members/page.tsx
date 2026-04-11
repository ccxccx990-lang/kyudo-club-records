import { sortMembers } from "@/lib/memberFields";
import { prisma } from "@/lib/prisma";
import { readIsAdmin } from "@/lib/serverAdmin";
import { MembersManager } from "./MembersManager";

export default async function MembersPage() {
  const isAdmin = await readIsAdmin();
  const raw = await prisma.member.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, gradeYear: true, gender: true, role: true },
  });
  const members = sortMembers(raw);

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-10">
      <div>
        <h1 className="text-2xl font-bold">部員</h1>
        <p className="mt-2 text-sm text-zinc-600">
          一覧は誰でも閲覧できます。部員の追加・表の編集・一括保存・削除は
          <strong className="text-zinc-800">管理者ログイン後のみ</strong>
          できます。
        </p>
      </div>
      <MembersManager initialMembers={members} isAdmin={isAdmin} />
    </main>
  );
}
