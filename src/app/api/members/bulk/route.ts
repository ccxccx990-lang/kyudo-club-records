import { NextResponse } from "next/server";
import {
  isAllowedGender,
  isAllowedGrade,
  isAllowedRole,
} from "@/lib/memberFields";
import { isCompleteMemberDisplayName } from "@/lib/memberDisplayName";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/http";

type Row = {
  id: string;
  name: string;
  gradeYear: string;
  gender: string;
  role: string;
};

/** 部員一覧を一括更新（管理者のみ） */
export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON が読み取れません" }, { status: 400 });
  }

  const membersUnknown =
    typeof body === "object" && body !== null && "members" in body
      ? (body as { members?: unknown }).members
      : null;

  if (!Array.isArray(membersUnknown)) {
    return NextResponse.json({ error: "members は配列で送ってください" }, { status: 400 });
  }

  const rows: Row[] = [];
  for (const item of membersUnknown) {
    if (typeof item !== "object" || item === null) continue;
    const m = item as {
      id?: unknown;
      name?: unknown;
      gradeYear?: unknown;
      gender?: unknown;
      role?: unknown;
    };
    const id = typeof m.id === "string" ? m.id : "";
    const name = typeof m.name === "string" ? m.name.trim() : "";
    const gradeYear = typeof m.gradeYear === "string" ? m.gradeYear.trim() : "";
    const gender = typeof m.gender === "string" ? m.gender.trim() : "";
    const role = typeof m.role === "string" ? m.role.trim() : "";

    if (!id) {
      return NextResponse.json({ error: "各行に id が必要です" }, { status: 400 });
    }
    if (!name) {
      return NextResponse.json({ error: "名前が空の行があります" }, { status: 400 });
    }
    if (!isCompleteMemberDisplayName(name)) {
      return NextResponse.json(
        { error: "各行の名前は「苗字 + 半角空白 + 名前」の形式にしてください" },
        { status: 400 },
      );
    }
    if (!isAllowedGrade(gradeYear)) {
      return NextResponse.json({ error: "学年の値が不正な行があります" }, { status: 400 });
    }
    if (!isAllowedGender(gender)) {
      return NextResponse.json({ error: "男女の値が不正な行があります" }, { status: 400 });
    }
    if (!isAllowedRole(role)) {
      return NextResponse.json({ error: "役職の値が不正な行があります" }, { status: 400 });
    }

    rows.push({
      id,
      name,
      gradeYear,
      gender,
      role,
    });
  }

  if (rows.length === 0) {
    return NextResponse.json({ error: "更新する部員がありません" }, { status: 400 });
  }

  const ids = rows.map((r) => r.id);
  if (new Set(ids).size !== ids.length) {
    return NextResponse.json({ error: "同じ id が重複しています" }, { status: 400 });
  }
  const existing = await prisma.member.findMany({ where: { id: { in: ids } }, select: { id: true } });
  if (existing.length !== ids.length) {
    return NextResponse.json({ error: "存在しない部員が含まれています" }, { status: 400 });
  }

  const newById = new Map(rows.map((r) => [r.id, r]));

  const nameToHolderIds = new Map<string, Set<string>>();
  for (const r of rows) {
    let set = nameToHolderIds.get(r.name);
    if (!set) {
      set = new Set();
      nameToHolderIds.set(r.name, set);
    }
    set.add(r.id);
  }
  for (const holderIds of nameToHolderIds.values()) {
    if (holderIds.size > 1) {
      return NextResponse.json(
        { error: "苗字と名前の組み合わせが、別の行と重複しています" },
        { status: 400 },
      );
    }
  }

  const distinctNames = [...nameToHolderIds.keys()];
  const dbSameName = await prisma.member.findMany({
    where: { name: { in: distinctNames } },
    select: { id: true, name: true },
  });
  for (const [name, holderIds] of nameToHolderIds) {
    for (const m of dbSameName) {
      if (m.name !== name) continue;
      if (holderIds.has(m.id)) continue;
      const updated = newById.get(m.id);
      if (updated && updated.name !== name) continue;
      return NextResponse.json(
        { error: "同じ苗字と名前の部員が既にいます" },
        { status: 409 },
      );
    }
  }

  await prisma.$transaction(
    rows.map((r) =>
      prisma.member.update({
        where: { id: r.id },
        data: {
          name: r.name,
          gradeYear: r.gradeYear,
          gender: r.gender,
          role: r.role,
        },
      }),
    ),
  );

  return NextResponse.json({ ok: true, updated: rows.length });
}
