import { DbConnectionBanner } from "@/components/DbConnectionBanner";
import { publicDatabaseErrorMessage } from "@/lib/dbPageError";
import { formatPracticeDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { readIsAdmin } from "@/lib/serverAdmin";
import { uiLinkChip, uiLinkChipAccent } from "@/lib/uiButtons";
import Link from "next/link";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function PracticesPage() {
  let isAdmin = false;
  let practices: { id: string; practiceDate: string; memo: string }[] = [];
  let dbError: string | null = null;

  try {
    isAdmin = await readIsAdmin();
    practices = await prisma.practiceSession.findMany({
      orderBy: [{ practiceDate: "desc" }, { createdAt: "desc" }],
      select: { id: true, practiceDate: true, memo: true },
    });
  } catch (e) {
    console.error("[practices page]", e);
    dbError = publicDatabaseErrorMessage(e);
  }

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-10">
      <div>
        <h1 className="text-2xl font-bold">正規練習</h1>
        <p className="mt-2 text-sm text-zinc-600">
          {isAdmin ? (
            <>
              日付から的中（〇×）を開けます。出欠・チーム・的中の
              <strong className="text-zinc-800">修正</strong>
              は「管理」列からのみ行えます（管理者のみ）。新規作成は上部ナビの
              <Link className="font-medium text-indigo-800 underline" href="/practices/input">
                練習入力
              </Link>
              です。
            </>
          ) : (
            <>
              一覧から日付を開くと的中（〇×）を確認できます。「的中（閲覧）」列のリンクでも同じです。出欠の変更・的中の修正・部員管理は管理者のみです。
            </>
          )}
        </p>
      </div>

      {dbError ? <DbConnectionBanner message={dbError} /> : null}

      <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-4 py-3">日付</th>
              <th className="px-4 py-3">メモ</th>
              <th className="px-4 py-3">{isAdmin ? "管理（管理者のみ）" : "的中（閲覧）"}</th>
            </tr>
          </thead>
          <tbody>
            {practices.map((p) => (
              <tr key={p.id} className="border-t border-zinc-100">
                <td className="px-4 py-3">
                  <Link className={uiLinkChipAccent} href={`/practices/${p.id}/marks`}>
                    {formatPracticeDate(p.practiceDate)}
                  </Link>
                </td>
                <td className="whitespace-pre-wrap px-4 py-3 text-zinc-700">{p.memo || "—"}</td>
                <td className="px-4 py-3">
                  {isAdmin ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <Link className={uiLinkChip} href={`/practices/${p.id}`}>
                        出欠
                      </Link>
                      <Link className={uiLinkChip} href={`/practices/${p.id}/lineup`}>
                        チーム
                      </Link>
                      <Link className={uiLinkChipAccent} href={`/practices/${p.id}/marks`}>
                        的中
                      </Link>
                    </div>
                  ) : (
                    <Link className={uiLinkChipAccent} href={`/practices/${p.id}/marks`}>
                      閲覧
                    </Link>
                  )}
                </td>
              </tr>
            ))}
            {practices.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-center text-zinc-500" colSpan={3}>
                  {isAdmin
                    ? "まだ正規練習がありません。「練習入力」から追加できます。"
                    : "まだ正規練習がありません。管理者が追加してください。"}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </main>
  );
}
