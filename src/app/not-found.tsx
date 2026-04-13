import { uiBtnSecondary } from "@/lib/uiButtons";
import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-lg px-4 py-20 text-center">
      <h1 className="text-xl font-bold">ページが見つかりません</h1>
      <p className="mt-3 text-sm text-zinc-600">URL をご確認ください。</p>
      <Link className={`${uiBtnSecondary} mx-auto mt-8 inline-flex`} href="/">
        トップへ
      </Link>
    </main>
  );
}
