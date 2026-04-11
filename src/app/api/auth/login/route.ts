import { NextResponse } from "next/server";
import {
  adminCookieName,
  adminCookieOptions,
  signAdminSession,
  verifyAdminPassword,
} from "@/lib/auth";

/** 管理者ログイン（合言葉を検証してクッキーをセット） */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON が読み取れません" }, { status: 400 });
  }
  const password =
    typeof body === "object" && body !== null && "password" in body
      ? String((body as { password?: unknown }).password ?? "")
      : "";

  if (!verifyAdminPassword(password)) {
    return NextResponse.json({ error: "合言葉が違います" }, { status: 401 });
  }

  try {
    const token = signAdminSession();
    const res = NextResponse.json({ ok: true });
    res.cookies.set(adminCookieName, token, adminCookieOptions(7 * 24 * 60 * 60));
    return res;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "設定エラー";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
