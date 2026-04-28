import { DbConnectionBanner } from "@/components/DbConnectionBanner";
import { publicDatabaseErrorMessage } from "@/lib/dbPageError";
import { sortMembers } from "@/lib/memberFields";
import { prisma } from "@/lib/prisma";
import { readIsAdmin } from "@/lib/serverAdmin";
import { MembersManager, type MemberRow } from "./MembersManager";

export const runtime = "nodejs";
/** DB 接続失敗をキャッシュしない */
export const dynamic = "force-dynamic";

export default async function MembersPage() {
  let isAdmin = false;
  let members: MemberRow[] = [];
  let dbError: string | null = null;

  try {
    isAdmin = await readIsAdmin();
    const raw = await prisma.member.findMany({
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, nameKana: true, gradeYear: true, gender: true, role: true },
    });
    members = sortMembers(raw);
  } catch (e) {
    console.error("[members page]", e);
    dbError = publicDatabaseErrorMessage(e);
  }

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
      {dbError ? <DbConnectionBanner message={dbError} /> : null}
      <MembersManager initialMembers={members} isAdmin={isAdmin} readOnlyDb={Boolean(dbError)} />
    </main>
  );
}
