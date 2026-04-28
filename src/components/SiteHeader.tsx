"use client";

import { uiBtnHeader, uiBtnHeaderPrimary } from "@/lib/uiButtons";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

/** 画面上部のナビゲーション */
export function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const [admin, setAdmin] = useState<boolean | null>(null);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/auth/me", { cache: "no-store" });
    const data = (await res.json()) as { admin?: boolean };
    setAdmin(Boolean(data.admin));
  }, []);

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
    await fetch("/api/auth/logout", { method: "POST" });
    await refresh();
    router.refresh();
  };

  return (
    <header className="border-b border-zinc-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm font-medium text-zinc-800">
          <Link className="text-base font-semibold text-indigo-800" href="/">
            的中ログ
          </Link>
          <nav className="flex flex-wrap gap-x-3 gap-y-1 text-zinc-600">
            <Link
              className={
                pathname === "/practices" ||
                (pathname.startsWith("/practices/") && !pathname.startsWith("/practices/input"))
                  ? "font-semibold text-indigo-900"
                  : "hover:text-zinc-900"
              }
              href="/practices"
            >
              的中記録
            </Link>
            <Link
              className={
                pathname === "/members" || pathname.startsWith("/members/")
                  ? "font-semibold text-indigo-900"
                  : "hover:text-zinc-900"
              }
              href="/members"
            >
              部員
            </Link>
            <Link
              className={
                pathname.startsWith("/reports/")
                  ? "font-semibold text-indigo-900"
                  : "hover:text-zinc-900"
              }
              href="/reports/personal-hit-rate"
            >
              個人的中率
            </Link>
            {admin ? (
              <Link
                className={
                  pathname.startsWith("/practices/input")
                    ? "font-semibold text-indigo-900"
                    : "hover:text-zinc-900"
                }
                href="/practices/input"
              >
                入力
              </Link>
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
            <Link className={uiBtnHeaderPrimary} href="/admin/login">
              管理者ログイン
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
