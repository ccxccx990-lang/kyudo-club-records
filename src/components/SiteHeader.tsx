"use client";

import AppLink from "@/components/AppLink";
import { useGlobalBusy } from "@/components/GlobalBusyProvider";
import { uiBtnHeader, uiBtnHeaderPrimary } from "@/lib/uiButtons";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

/** ログイン状態の取得のみ。logout 後の再検証にも使う（useEffect の依存配列とは無関係に置く）。 */
async function fetchIsAdmin(): Promise<boolean> {
  const res = await fetch("/api/auth/me", { cache: "no-store" });
  const data = (await res.json()) as { admin?: boolean };
  return Boolean(data.admin);
}

function navButtonClass(active: boolean): string {
  const base =
    "inline-flex min-h-9 items-center justify-center rounded-lg border px-3 py-1.5 text-sm font-semibold shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2";
  return active
    ? `${base} border-indigo-600 bg-indigo-50 text-indigo-950`
    : `${base} border-zinc-200 bg-white text-zinc-700 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-900`;
}

/** 画面上部のナビゲーション */
export function SiteHeader() {
  const pathname = usePathname();
  const { refresh, runBlocking } = useGlobalBusy();
  const [admin, setAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/auth/me", { cache: "no-store" })
      .then((res) => res.json() as Promise<{ admin?: boolean }>)
      .then((data) => {
        if (!cancelled) setAdmin(Boolean(data.admin));
      });
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  const logout = async () => {
    await runBlocking(async () => {
      await fetch("/api/auth/logout", { method: "POST" });
      setAdmin(await fetchIsAdmin());
      refresh();
    });
  };

  return (
    <header className="border-b border-zinc-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm font-medium text-zinc-800">
          <AppLink className="text-base font-semibold text-indigo-800" href="/">
            的中ログ
          </AppLink>
          <nav className="flex flex-wrap gap-2.5 text-zinc-600">
            <AppLink
              className={navButtonClass(
                pathname === "/practices" ||
                  (pathname.startsWith("/practices/") && !pathname.startsWith("/practices/input")),
              )}
              href="/practices"
            >
              記録
            </AppLink>
            <AppLink
              className={navButtonClass(pathname === "/members" || pathname.startsWith("/members/"))}
              href="/members"
            >
              部員
            </AppLink>
            <AppLink className={navButtonClass(pathname.startsWith("/reports/"))} href="/reports/personal-hit-rate">
              的中率
            </AppLink>
            {admin ? (
              <AppLink className={navButtonClass(pathname.startsWith("/practices/input"))} href="/practices/input">
                入力
              </AppLink>
            ) : null}
          </nav>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 text-sm">
          {admin === null ? (
            <span className="text-zinc-400">…</span>
          ) : admin ? (
            <>
              <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-800">
                管理者
              </span>
              <button type="button" className={uiBtnHeader} onClick={() => void logout()}>
                ログアウト
              </button>
            </>
          ) : (
            <AppLink className={uiBtnHeaderPrimary} href="/admin/login">
              管理者ログイン
            </AppLink>
          )}
        </div>
      </div>
    </header>
  );
}
