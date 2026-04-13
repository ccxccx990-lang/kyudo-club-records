"use client";

import { uiBtnPrimary } from "@/lib/uiButtons";
import { useRouter } from "next/navigation";
import { useState } from "react";

/** 管理者ログインページ */
export default function AdminLoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? "ログインに失敗しました");
      return;
    }
    router.replace("/");
    router.refresh();
  };

  return (
    <main className="mx-auto max-w-md space-y-6 px-4 py-12">
      <div>
        <h1 className="text-xl font-bold">管理者ログイン</h1>
        <p className="mt-2 text-sm text-zinc-600">
          編集用の合言葉を入力してください（環境変数 <code className="text-xs">ADMIN_PASSWORD</code>{" "}
          に設定した値）。
        </p>
      </div>

      <form onSubmit={(e) => void submit(e)} className="space-y-4 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <label className="block space-y-1 text-sm font-medium text-zinc-800">
          合言葉
          <input
            type="password"
            autoComplete="current-password"
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-base outline-none ring-indigo-200 focus:ring-2"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
        <button
          type="submit"
          disabled={busy || !password}
          className={`${uiBtnPrimary} w-full justify-center`}
        >
          {busy ? "確認中…" : "ログイン"}
        </button>
      </form>
    </main>
  );
}
