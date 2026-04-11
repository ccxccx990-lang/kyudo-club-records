import { NextResponse } from "next/server";
import { adminCookieName } from "@/lib/auth";

/** 管理者ログアウト */
export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(adminCookieName, "", { path: "/", maxAge: 0 });
  return res;
}
