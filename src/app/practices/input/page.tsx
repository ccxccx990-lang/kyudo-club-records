import Link from "next/link";
import { redirect } from "next/navigation";
import { readIsAdmin } from "@/lib/serverAdmin";
import { PracticesInputPanel } from "../PracticesInputPanel";

export default async function PracticesInputPage() {
  if (!(await readIsAdmin())) {
    redirect("/practices");
  }

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-10">
      <div>
        <p className="text-sm text-zinc-500">
          <Link className="text-indigo-800 hover:underline" href="/practices">
            ← 的中記録（閲覧）
          </Link>
        </p>
        <h1 className="mt-2 text-2xl font-bold">入力</h1>
        <p className="mt-2 text-sm text-zinc-600">
          的中記録の新規作成と、各練習の出席・チーム・的中の修正に進みます。
        </p>
      </div>

      <PracticesInputPanel />
    </main>
  );
}
