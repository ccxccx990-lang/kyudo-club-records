import { createHash, createHmac, timingSafeEqual } from "crypto";

const COOKIE_NAME = "kyudo_admin";

/** 管理者クッキーの名前（API ルートとページで共通） */
export const adminCookieName = COOKIE_NAME;

/** ログイン時にセットする httpOnly クッキー定義 */
export function adminCookieOptions(maxAgeSec: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: maxAgeSec,
  };
}

/** 管理者パスワードが環境変数と一致するか（長さが違っても情報が漏れにくいようハッシュ比較） */
export function verifyAdminPassword(input: string): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected || !input) return false;
  const a = createHash("sha256").update(input, "utf8").digest();
  const b = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(a, b);
}

/** 管理者セッショントークンを発行する */
export function signAdminSession(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("SESSION_SECRET が未設定か短すぎます（16文字以上）");
  }
  const exp = Date.now() + 7 * 24 * 60 * 60 * 1000;
  const payload = Buffer.from(JSON.stringify({ exp }), "utf8").toString("base64url");
  const sig = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

/** クッキー値が有効な管理者セッションか検証する */
export function verifyAdminSessionToken(token: string | undefined): boolean {
  if (!token) return false;
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) return false;
  const dot = token.indexOf(".");
  if (dot <= 0) return false;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expectedSig = createHmac("sha256", secret).update(payload).digest("base64url");
  try {
    const ok = timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig));
    if (!ok) return false;
  } catch {
    return false;
  }
  try {
    const json = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      exp: number;
    };
    return typeof json.exp === "number" && json.exp > Date.now();
  } catch {
    return false;
  }
}
