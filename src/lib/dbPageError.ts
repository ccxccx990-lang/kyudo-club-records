/** 本番では詳細を隠し、環境変数の確認手順だけ返す（閲覧ページ用） */
export function publicDatabaseErrorMessage(e: unknown): string {
  if (process.env.NODE_ENV === "development") {
    return e instanceof Error ? e.message : String(e);
  }
  return [
    "データベースに接続できませんでした。",
    "Vercel の Project Settings → Environment Variables で次を確認し、保存後に再デプロイしてください。",
    "・DATABASE_URL … Supabase の Transaction pooler（ポート 6543、pgbouncer=true）",
    "・DIRECT_URL … Session pooler（ポート 5432、同じ pooler ホスト）",
    "・どちらも Production に付いているか",
  ].join(" ");
}
