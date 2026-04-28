import { DbConnectionBanner } from "@/components/DbConnectionBanner";
import { publicDatabaseErrorMessage } from "@/lib/dbPageError";
import { formatPracticeDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { readIsAdmin } from "@/lib/serverAdmin";
import { uiLinkChip, uiLinkChipAccent } from "@/lib/uiButtons";
import Link from "next/link";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function singleParam(params: SearchParams, key: string): string {
  const value = params[key];
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function parseYear(value: string): string {
  return /^\d{4}$/.test(value) ? value : "";
}

function parseMonth(value: string): string {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 && n <= 12 ? String(n).padStart(2, "0") : "";
}

function parseKind(value: string): "all" | "joint" | "match" {
  return value === "joint" || value === "match" ? value : "all";
}

function kindLabel(kind: string): string {
  return kind === "match" ? "試合" : "正規練習";
}

export default async function PracticesPage({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  const params = (await searchParams) ?? {};
  const year = parseYear(singleParam(params, "year"));
  const month = parseMonth(singleParam(params, "month"));
  const kind = parseKind(singleParam(params, "kind"));

  let isAdmin = false;
  let practices: { id: string; practiceDate: string; memo: string; sessionKind: string }[] = [];
  let yearOptions: string[] = [];
  let dbError: string | null = null;

  try {
    isAdmin = await readIsAdmin();
    const where: {
      practiceDate?: { gte?: string; lte?: string; contains?: string };
      sessionKind?: string;
    } = {};
    if (year) {
      where.practiceDate = month
        ? { gte: `${year}-${month}-01`, lte: `${year}-${month}-31` }
        : { gte: `${year}-01-01`, lte: `${year}-12-31` };
    } else if (month) {
      where.practiceDate = { contains: `-${month}-` };
    }
    if (kind !== "all") {
      where.sessionKind = kind;
    }
    practices = await prisma.practiceSession.findMany({
      where,
      orderBy: [{ practiceDate: "desc" }, { createdAt: "desc" }],
      select: { id: true, practiceDate: true, memo: true, sessionKind: true },
    });
    const allDates = await prisma.practiceSession.findMany({
      orderBy: { practiceDate: "desc" },
      select: { practiceDate: true },
    });
    yearOptions = [...new Set(allDates.map((p) => p.practiceDate.slice(0, 4)).filter(Boolean))];
  } catch (e) {
    console.error("[practices page]", e);
    dbError = publicDatabaseErrorMessage(e);
  }

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-10">
      <div>
        <h1 className="text-2xl font-bold">記録</h1>
        <p className="mt-2 text-sm text-zinc-600">
          {isAdmin ? (
            <>
              日付から的中（〇×）を開けます。出欠・チーム・的中の
              <strong className="text-zinc-800">修正</strong>
              は「管理」列からのみ行えます（管理者のみ）。新規作成は上部ナビの
              <Link className="font-medium text-indigo-800 underline" href="/practices/input">
                入力
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

      <form className="rounded-xl border border-zinc-200 bg-white p-4 text-sm shadow-sm">
        <div className="grid gap-3 sm:grid-cols-4 sm:items-end">
          <label className="block text-zinc-700">
            年
            <select
              name="year"
              defaultValue={year}
              className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2"
            >
              <option value="">すべて</option>
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {y}年
                </option>
              ))}
            </select>
          </label>
          <label className="block text-zinc-700">
            月
            <select
              name="month"
              defaultValue={month ? String(Number(month)) : ""}
              className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2"
            >
              <option value="">すべて</option>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>
                  {m}月
                </option>
              ))}
            </select>
          </label>
          <label className="block text-zinc-700">
            練習区分
            <select
              name="kind"
              defaultValue={kind}
              className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2"
            >
              <option value="all">すべて</option>
              <option value="joint">正規練習</option>
              <option value="match">試合</option>
            </select>
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-md bg-indigo-700 px-4 py-2 font-semibold text-white hover:bg-indigo-800"
            >
              検索
            </button>
            <Link className={uiLinkChip} href="/practices">
              解除
            </Link>
          </div>
        </div>
      </form>

      <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-4 py-3">日付</th>
              <th className="px-4 py-3">区分</th>
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
                <td className="px-4 py-3 text-zinc-700">{kindLabel(p.sessionKind)}</td>
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
                <td className="px-4 py-8 text-center text-zinc-500" colSpan={4}>
                  {year || month || kind !== "all"
                    ? "条件に合う練習がありません。"
                    : isAdmin
                      ? "まだ記録がありません。「入力」から追加できます。"
                      : "まだ記録がありません。管理者が追加してください。"}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </main>
  );
}
