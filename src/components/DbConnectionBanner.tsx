import Link from "next/link";

/** DB 接続失敗時にサーバーコンポーネントから表示する案内 */
export function DbConnectionBanner({ message }: { message: string }) {
  return (
    <div
      className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900"
      role="alert"
    >
      {message}
    </div>
  );
}

/** 練習まわりのページで DB 失敗時に一覧へ戻せるようにする */
export function DbConnectionFailPage({ message }: { message: string }) {
  return (
    <main className="mx-auto max-w-6xl space-y-4 px-4 py-10">
      <DbConnectionBanner message={message} />
      <p className="text-sm text-zinc-600">
        <Link className="font-medium text-indigo-800 underline" href="/practices">
          正規練習一覧へ
        </Link>
      </p>
    </main>
  );
}
