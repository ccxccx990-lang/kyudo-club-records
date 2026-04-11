import { cookies } from "next/headers";
import { adminCookieName, verifyAdminSessionToken } from "@/lib/auth";

/** サーバー側で管理者クッキーが有効か判定する */
export async function readIsAdmin(): Promise<boolean> {
  const jar = await cookies();
  return verifyAdminSessionToken(jar.get(adminCookieName)?.value);
}
