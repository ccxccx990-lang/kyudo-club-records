"use client";

import { useGlobalBusy } from "@/components/GlobalBusyProvider";
import { uiBtnPrimary } from "@/lib/uiButtons";
import { useState } from "react";

/** 管理者ログインページ */
export default function AdminLoginPage() {
  const { replace, refresh, runBlocking, isBusy } = useGlobalBusy();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    await runBlocking(async () => {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "ログインに失敗しました");
        return;
      }
      replace("/");
      refresh();
    });
  };

  return (
    <main className="mx-auto max-w-md space-y-6 px-4 py-12">
      <div>
        <h1 className="text-xl font-bold">管理者ログイン</h1>
      </div>

      <form onSubmit={(e) => void submit(e)} className="space-y-4 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <label className="block space-y-1 text-sm font-medium text-zinc-800">
          パスワード
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
          disabled={isBusy || !password}
          className={`${uiBtnPrimary} w-full justify-center`}
        >
          {isBusy ? "確認中…" : "ログイン"}
        </button>
      </form>
    </main>
  );
}
