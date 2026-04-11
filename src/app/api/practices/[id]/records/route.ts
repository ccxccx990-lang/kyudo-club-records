import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/http";
import { normalizeMarks } from "@/lib/marks";

type Ctx = { params: Promise<{ id: string }> };

type Item = { memberId: string; roundIndex: number; marks: string };

/** 〇×記録の一括保存（管理者のみ）。clears で行削除も可能 */
export async function PUT(req: Request, ctx: Ctx) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id: sessionId } = await ctx.params;

  const session = await prisma.practiceSession.findUnique({ where: { id: sessionId } });
  if (!session) {
    return NextResponse.json({ error: "練習が見つかりません" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON が読み取れません" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "JSON オブジェクトで送ってください" }, { status: 400 });
  }

  const b = body as { items?: unknown; clears?: unknown };

  const clearsUnknown = "clears" in b ? b.clears : undefined;
  if (clearsUnknown !== undefined && !Array.isArray(clearsUnknown)) {
    return NextResponse.json({ error: "clears は配列で送ってください" }, { status: 400 });
  }

  const itemsUnknown = "items" in b ? b.items : undefined;
  if (itemsUnknown !== undefined && !Array.isArray(itemsUnknown)) {
    return NextResponse.json({ error: "items は配列で送ってください" }, { status: 400 });
  }

  const clearsRaw = Array.isArray(clearsUnknown) ? clearsUnknown : [];
  const itemsRaw = Array.isArray(itemsUnknown) ? itemsUnknown : [];

  const clears: { memberId: string; roundIndex: number }[] = [];
  for (const row of clearsRaw) {
    if (typeof row !== "object" || row === null) continue;
    const r = row as { memberId?: unknown; roundIndex?: unknown };
    const memberId = typeof r.memberId === "string" ? r.memberId : "";
    const roundIndex =
      typeof r.roundIndex === "number" ? r.roundIndex : Number(r.roundIndex);
    if (!memberId || !Number.isFinite(roundIndex)) {
      return NextResponse.json(
        { error: "clears の各要素に memberId と roundIndex が必要です" },
        { status: 400 },
      );
    }
    const ri = Math.floor(roundIndex);
    if (ri < 1 || ri > session.roundCount) {
      return NextResponse.json(
        { error: `立ち番号は 1〜${session.roundCount} にしてください` },
        { status: 400 },
      );
    }
    clears.push({ memberId, roundIndex: ri });
  }

  const items: Item[] = [];
  for (const row of itemsRaw) {
    if (typeof row !== "object" || row === null) continue;
    const r = row as { memberId?: unknown; roundIndex?: unknown; marks?: unknown };
    const memberId = typeof r.memberId === "string" ? r.memberId : "";
    const roundIndex = typeof r.roundIndex === "number" ? r.roundIndex : Number(r.roundIndex);
    const marksNorm = normalizeMarks(typeof r.marks === "string" ? r.marks : "");
    if (!memberId || !Number.isFinite(roundIndex) || marksNorm === null) {
      return NextResponse.json(
        { error: "各 item に memberId, roundIndex, marks（o/x 4文字）が必要です" },
        { status: 400 },
      );
    }
    const ri = Math.floor(roundIndex);
    if (ri < 1 || ri > session.roundCount) {
      return NextResponse.json(
        { error: `立ち番号は 1〜${session.roundCount} にしてください` },
        { status: 400 },
      );
    }
    items.push({ memberId, roundIndex: ri, marks: marksNorm });
  }

  const memberIds = new Set(items.map((i) => i.memberId));
  for (const c of clears) memberIds.add(c.memberId);

  if (memberIds.size > 0) {
    const existing = await prisma.member.findMany({ where: { id: { in: [...memberIds] } } });
    if (existing.length !== memberIds.size) {
      return NextResponse.json({ error: "存在しない部員IDが含まれています" }, { status: 400 });
    }
  }

  if (items.length === 0 && clears.length === 0) {
    return NextResponse.json({ ok: true, saved: 0, cleared: 0 });
  }

  await prisma.$transaction([
    ...clears.map((c) =>
      prisma.roundRecord.deleteMany({
        where: {
          sessionId,
          memberId: c.memberId,
          roundIndex: c.roundIndex,
        },
      }),
    ),
    ...items.map((it) =>
      prisma.roundRecord.upsert({
        where: {
          sessionId_memberId_roundIndex: {
            sessionId,
            memberId: it.memberId,
            roundIndex: it.roundIndex,
          },
        },
        create: {
          sessionId,
          memberId: it.memberId,
          roundIndex: it.roundIndex,
          marks: it.marks,
        },
        update: { marks: it.marks },
      }),
    ),
  ]);

  return NextResponse.json({ ok: true, saved: items.length, cleared: clears.length });
}
