import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminCookieName, verifyAdminSessionToken } from "@/lib/auth";

/** 管理者クッキーが有効か確認する */
export async function isAdminRequest(): Promise<boolean> {
  const jar = await cookies();
  const token = jar.get(adminCookieName)?.value;
  return verifyAdminSessionToken(token);
}

/** 管理者以外なら 401 を返す（ルートハンドラ用） */
export async function requireAdmin(): Promise<NextResponse | null> {
  const ok = await isAdminRequest();
  if (ok) return null;
  return NextResponse.json(
    { error: "管理者のみが実行できます。ログインしてください。" },
    { status: 401 },
  );
}
