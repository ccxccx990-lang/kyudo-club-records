-- SQLite: 正規練習 / 試合の区分（個人的中率レポート用）
ALTER TABLE "PracticeSession" ADD COLUMN "sessionKind" TEXT NOT NULL DEFAULT 'joint';
