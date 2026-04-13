# kyudo-club-records — 的中ログ（合同練習の〇×記録）

大学弓道部向けの小さな Web アプリ。部員管理と、**合同練習**（男子・女子の同時練習）ごとの **1立ち＝4射の〇×記録** を扱う。

**SQLite で手元だけ動かす用**のコピーは、同階層の **`kyudo-club-records-sqlite`** を参照（このフォルダは PostgreSQL / Supabase 想定）。

## 使い方（人間向け）

1. 依存関係: `npm install`
2. `.env.example` を `.env` にコピーし、**`DATABASE_URL`** と **`DIRECT_URL`**（Supabase は **Vercel 向けに Transaction pooler + Session pooler**、`.env.example` 参照）、`ADMIN_PASSWORD`、`SESSION_SECRET` を設定する
3. DB: `npx prisma migrate dev`（初回でテーブル作成。Vercel 本番は `vercel.json` の `prisma migrate deploy` で適用）
4. 起動: `npm run dev` → ブラウザで `http://localhost:3000`

- **一般部員**: URL を開いて閲覧のみ（一覧・記録の閲覧）
- **管理者**: 右上「管理者ログイン」→ 合言葉（`ADMIN_PASSWORD`）でログインすると、部員追加・練習の作成・記録の編集ができる
- **部員**: 名前に加え **学年**・**役職** を保存できる。表を編集したあと **一覧を一括で保存** で反映する

## コマンド一覧

| コマンド | 説明 |
|---------|------|
| `npm install` | 依存関係インストール |
| `npm run dev` | 開発サーバー |
| `npm run build` / `npm start` | 本番ビルドと起動 |
| `npm run db:migrate` | Prisma マイグレーション |
| `npm run db:studio` | DB を GUI で確認 |

## プロジェクト構成（抜粋）

```
kyudo-club-records/
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── src/
│   ├── app/
│   │   ├── api/…          # REST API（認可は管理者クッキー）
│   │   ├── members/       # 部員一覧
│   │   ├── practices/     # 合同練習一覧・詳細
│   │   └── admin/login/   # 管理者ログイン
│   ├── components/
│   └── lib/               # prisma, auth, marks など
├── .env.example
└── CLAUDE.md              # このファイル
```

## 今回のスコープに「含まない」もの（後回し・非対応）

次の機能は **意図的に未実装**（将来の拡張用にコードも入れていない）。

- 的中率の算出・個人成績表
- 試合入力・試合の的中入力・相手校まわり
- 個人練習の的中
- 感想入力

## 技術メモ

- Next.js（App Router）+ TypeScript + Tailwind CSS
- **PostgreSQL** + Prisma 5（例: **Supabase**）。`DATABASE_URL`（プール）と `DIRECT_URL`（マイグレーション用）を設定する。Vercel 本番は Supabase **Transaction pooler（6543）** を `DATABASE_URL` に使うと IPv4 からも繋がりやすい。Vercel では `vercel.json` で `prisma migrate deploy` を実行する
- 管理者は **httpOnly クッキー**（`SESSION_SECRET` で署名）＋合言葉 `ADMIN_PASSWORD`
- **個人的中率の PDF**: クライアントの `#hit-rate-pdf-vertical-wrap` の HTML を **`POST /api/reports/personal-hit-rate/pdf`** に送り、**サーバーで Playwright（Chromium）** が `page.pdf()` する。クライアントの html2canvas 系は使わない。初回・本番イメージでは **`npx playwright install chromium`** が必要。別レポートを PDF 化するときも同様の API + Playwright パターンを推奨（エージェント向け詳細は `.cursor/rules/pdf-playwright.mdc`）。

## よくあるエラーと対処

- **ログインできない**: `.env` の `ADMIN_PASSWORD` が空／違う値になっていないか確認する
- **SESSION_SECRET が…**: 16 文字以上のランダム文字列にする
- **DB エラー**: `.env` の `DATABASE_URL` と Supabase のプロジェクト状態を確認する。`npx prisma migrate dev` を再実行する
- **`PrismaClientInitializationError`（親プロジェクト）**: `schema.prisma` に `directUrl` があるため **`.env` に `DIRECT_URL` が必須**です。未設定なら `DATABASE_URL` と同じ URI を `DIRECT_URL` にも書く。**SQLite 用コピー**（`kyudo-club-records-sqlite`）では `DATABASE_URL=file:./dev.db` のみでよい
- **部員画面で `PrismaClientValidationError`（`gradeYear` や `Unknown arg` など）**: DB のマイグレーション後に **Prisma クライアントが古い**状態です。手順: (1) 動いている `npm run dev` を **Ctrl+C で停止**する (2) `npx prisma generate` を実行する (3) `npm run dev` を再度起動する。`EPERM` や `rename … query_engine` で失敗したときも、まず開発サーバーを止めてから (2) をやり直す
- **PDF が出ない / Playwright エラー**: サーバーで `npx playwright install chromium` を実行する。ホストが Google Fonts に届かないと文字化け・タイムアウトのことがある

## エージェント向け

- 変更は **このリポジトリ内** に閉じる。初心者が追えるよう、小さな関数と日本語コメントを維持する
- API の認可は `src/lib/http.ts` の `requireAdmin()` を踏襲する
