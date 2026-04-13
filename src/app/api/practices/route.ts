import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/http";
import { isIsoDate } from "@/lib/dates";

/** 合同練習の一覧（閲覧は誰でも可） */
export async function GET() {
  const practices = await prisma.practiceSession.findMany({
    orderBy: [{ practiceDate: "desc" }, { createdAt: "desc" }],
  });
  return NextResponse.json({ practices });
}

/** 合同練習の新規作成（管理者のみ） */
export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON が読み取れません" }, { status: 400 });
  }

  const practiceDate =
    typeof body === "object" && body !== null && "practiceDate" in body
      ? String((body as { practiceDate?: unknown }).practiceDate ?? "").trim()
      : "";
  const memo =
    typeof body === "object" && body !== null && "memo" in body
      ? String((body as { memo?: unknown }).memo ?? "")
      : "";
  const maxMatoRaw =
    typeof body === "object" && body !== null && "maxMato" in body
      ? Number((body as { maxMato?: unknown }).maxMato)
      : undefined;
  const roundCountRaw =
    typeof body === "object" && body !== null && "roundCount" in body
      ? Number((body as { roundCount?: unknown }).roundCount)
      : undefined;
  const sessionKindRaw =
    typeof body === "object" && body !== null && "sessionKind" in body
      ? String((body as { sessionKind?: unknown }).sessionKind ?? "").trim()
      : undefined;

  if (!isIsoDate(practiceDate)) {
    return NextResponse.json(
      { error: "日付は YYYY-MM-DD 形式で送ってください" },
      { status: 400 },
    );
  }

  let maxMato = 8;
  if (maxMatoRaw !== undefined) {
    if (!Number.isFinite(maxMatoRaw) || maxMatoRaw < 4 || maxMatoRaw > 24) {
      return NextResponse.json({ error: "最大的数は 4〜24 にしてください" }, { status: 400 });
    }
    maxMato = Math.floor(maxMatoRaw);
  }

  let roundCount = 5;
  if (roundCountRaw !== undefined) {
    if (!Number.isFinite(roundCountRaw) || roundCountRaw < 1 || roundCountRaw > 30) {
      return NextResponse.json({ error: "立ち数は 1〜30 にしてください" }, { status: 400 });
    }
    roundCount = Math.floor(roundCountRaw);
  }

  let sessionKind = "joint";
  if (sessionKindRaw === "match") sessionKind = "match";
  else if (sessionKindRaw && sessionKindRaw !== "joint") {
    return NextResponse.json({ error: "sessionKind は joint か match です" }, { status: 400 });
  }

  try {
    const session = await prisma.practiceSession.create({
      data: { practiceDate, memo, roundCount, maxMato, sessionKind },
    });
    return NextResponse.json({ session }, { status: 201 });
  } catch (e) {
    console.error("practiceSession.create", e);
    return NextResponse.json(
      {
        error:
          "データベースへの保存に失敗しました。Vercel ではローカル用の SQLite（file:…）は使えないことが多いです。PostgreSQL 等の DATABASE_URL を設定し、マイグレーションを実行してください。",
      },
      { status: 503 },
    );
  }
}
