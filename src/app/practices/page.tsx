import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatPracticeDate } from "@/lib/format";
import { readIsAdmin } from "@/lib/serverAdmin";

export default async function PracticesPage() {
  const isAdmin = await readIsAdmin();
  const practices = await prisma.practiceSession.findMany({
    orderBy: [{ practiceDate: "desc" }, { createdAt: "desc" }],
    select: { id: true, practiceDate: true, memo: true },
  });

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-10">
      <div>
        <h1 className="text-2xl font-bold">合同練習</h1>
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
                  <Link className="font-medium text-emerald-800 hover:underline" href={`/practices/${p.id}/marks`}>
                    {formatPracticeDate(p.practiceDate)}
                  </Link>
                </td>
                <td className="whitespace-pre-wrap px-4 py-3 text-zinc-700">{p.memo || "—"}</td>
                <td className="px-4 py-3">
                  {isAdmin ? (
                    <div className="flex flex-wrap gap-x-2 gap-y-1 text-xs">
                      <Link className="font-medium text-indigo-800 underline" href={`/practices/${p.id}`}>
                        出欠
                      </Link>
                      <span className="text-zinc-300">|</span>
                      <Link className="font-medium text-indigo-800 underline" href={`/practices/${p.id}/lineup`}>
                        チーム
                      </Link>
                      <span className="text-zinc-300">|</span>
                      <Link className="font-medium text-emerald-800 underline" href={`/practices/${p.id}/marks`}>
                        的中
                      </Link>
                    </div>
                  ) : (
                    <Link
                      className="text-sm font-medium text-emerald-800 hover:underline"
                      href={`/practices/${p.id}/marks`}
                    >
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
                    ? "まだ合同練習がありません。「練習入力」から追加できます。"
                    : "まだ合同練習がありません。管理者が追加してください。"}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </main>
  );
}
