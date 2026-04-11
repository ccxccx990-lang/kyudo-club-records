import Link from "next/link";
import { readIsAdmin } from "@/lib/serverAdmin";

/** ホームのナビカード（見た目の高さ・幅をグリッド内で揃える。min-h は従来の約半分） */
const homeNavTileClass =
  "flex h-full min-h-[5.5rem] w-full flex-col rounded-xl border border-zinc-200 bg-white p-2 shadow-sm transition hover:border-indigo-200 hover:shadow";

export default async function HomePage() {
  const isAdmin = await readIsAdmin();

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-10">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">的中ログ</h1>
        <p className="text-zinc-600">
          大学弓道部向けの、部員管理と<strong>合同練習</strong>（男子・女子の同時練習）の的中記録です。
          代表端末（PC や iPad）から、1立ち（4射）を<strong>〇×</strong>で入力します。
        </p>
      </div>

      <ul
        className={`grid gap-3 sm:grid-cols-2 ${isAdmin ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}
      >
        <li className="min-h-0">
          <Link className={homeNavTileClass} href="/practices">
            <div className="text-xs font-semibold leading-tight text-indigo-800">合同練習</div>
            <div className="mt-0.5 text-xs leading-snug text-zinc-600">一覧・閲覧</div>
          </Link>
        </li>
        <li className="min-h-0">
          <Link className={homeNavTileClass} href="/members">
            <div className="text-xs font-semibold leading-tight text-indigo-800">部員</div>
            <div className="mt-0.5 text-xs leading-snug text-zinc-600">名前の登録（管理者）</div>
          </Link>
        </li>
        <li className="min-h-0">
          <Link className={homeNavTileClass} href="/reports/personal-hit-rate">
            <div className="text-xs font-semibold leading-tight text-indigo-800">個人的中率</div>
            <div className="mt-0.5 text-xs leading-snug text-zinc-600">集計・PDF</div>
          </Link>
        </li>
        {isAdmin ? (
          <li className="min-h-0">
            <Link className={homeNavTileClass} href="/practices/input">
              <div className="text-xs font-semibold leading-tight text-indigo-800">練習入力</div>
              <div className="mt-0.5 text-xs leading-snug text-zinc-600">
                合同練習の作成・出席・チーム・的中
              </div>
            </Link>
          </li>
        ) : null}
      </ul>

      <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
        <p className="font-medium">共有のしかた</p>
        <p className="mt-1">
          URL を部のグループだけで共有してください。編集は右上の「管理者ログイン」後にだけ行えます。一般の部員は閲覧のみです。
        </p>
      </section>
    </main>
  );
}
