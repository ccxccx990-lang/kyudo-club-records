import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  aggregatePersonalHitRates,
  monthDateRangeIso,
  type MonthPeriod,
  type SessionKindFilter,
} from "@/lib/personalHitRateReport";

export const runtime = "nodejs";

type SessionRow = {
  practiceDate: string;
  sessionKind: string;
  records: { memberId: string; marks: string }[];
};

function isMissingSessionKindColumn(e: unknown): boolean {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2022") {
    const col = String((e.meta as Record<string, unknown> | undefined)?.column ?? "");
    return col.includes("sessionKind");
  }
  const msg = e instanceof Error ? e.message : String(e);
  return /sessionKind|Unknown field|does not exist|no such column/i.test(msg);
}

/** DB に sessionKind 列が無い（未マイグレート）場合は joint 固定で読み込む */
async function loadSessionsInDateRange(
  from: string,
  to: string,
): Promise<SessionRow[]> {
  try {
    return await prisma.practiceSession.findMany({
      where: { practiceDate: { gte: from, lte: to } },
      select: {
        practiceDate: true,
        sessionKind: true,
        records: { select: { memberId: true, marks: true } },
      },
    });
  } catch (e) {
    if (!isMissingSessionKindColumn(e)) throw e;
    const rows = await prisma.practiceSession.findMany({
      where: { practiceDate: { gte: from, lte: to } },
      select: {
        practiceDate: true,
        records: { select: { memberId: true, marks: true } },
      },
    });
    return rows.map((r) => ({ ...r, sessionKind: "joint" }));
  }
}

/** API 利用者向けに短い説明に変換（詳細はサーバーログ） */
function prismaErrorToUserMessage(e: unknown): string {
  if (e instanceof Prisma.PrismaClientInitializationError) {
    return "データベースに接続できません。DATABASE_URL（SSL・IPv4/プール設定）と Vercel の環境変数を確認してください。";
  }
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (e.code === "P1001" || e.code === "P1017") {
      return "データベースサーバーに届きません。接続文字列とネットワーク（Supabase の Session pooler 等）を確認してください。";
    }
    if (e.code === "P2021") {
      return "テーブルが見つかりません。本番で prisma migrate deploy が成功しているか確認してください。";
    }
  }
  return e instanceof Error ? e.message : "サーバーでエラーが発生しました";
}

function parseYear(s: string | null): number | null {
  if (!s) return null;
  const y = Number(s);
  if (!Number.isInteger(y) || y < 2000 || y > 2100) return null;
  return y;
}

function parseMonth(s: string | null): number | null {
  if (!s) return null;
  const m = Number(s);
  if (!Number.isInteger(m) || m < 1 || m > 12) return null;
  return m;
}

/** GET ?year=2026&month=4&period=full|firstHalf&gender=男|女&kind=all|joint|match */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const year = parseYear(searchParams.get("year"));
    const month = parseMonth(searchParams.get("month"));
    const periodRaw = searchParams.get("period") ?? "full";
    const genderRaw = searchParams.get("gender") ?? "男";
    const kindRaw = searchParams.get("kind") ?? "all";

    if (year === null || month === null) {
      return NextResponse.json({ error: "year と month（1〜12）が必要です" }, { status: 400 });
    }

    const period: MonthPeriod = periodRaw === "firstHalf" ? "firstHalf" : "full";
    const gender = genderRaw === "女" ? "女" : "男";
    let sessionKindFilter: SessionKindFilter = "all";
    if (kindRaw === "joint") sessionKindFilter = "joint";
    else if (kindRaw === "match") sessionKindFilter = "match";

    const { from, to } = monthDateRangeIso(year, month, period);

    const members = await prisma.member.findMany({
      select: { id: true, name: true, nameKana: true, gradeYear: true, gender: true },
    });

    const sessions = await loadSessionsInDateRange(from, to);

    const rows = aggregatePersonalHitRates({
      members,
      gender,
      sessions,
      dateFrom: from,
      dateTo: to,
      sessionKindFilter,
    });

    return NextResponse.json({
      meta: { year, month, period, gender, sessionKindFilter, dateFrom: from, dateTo: to },
      rows,
    });
  } catch (e) {
    const message = prismaErrorToUserMessage(e);
    console.error("[personal-hit-rate]", e);
    const status =
      e instanceof Prisma.PrismaClientInitializationError ||
      (e instanceof Prisma.PrismaClientKnownRequestError &&
        (e.code === "P1001" || e.code === "P1017"))
        ? 503
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
