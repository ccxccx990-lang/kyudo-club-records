import { NextResponse } from "next/server";
import { isAllowedGender, isAllowedGrade, isAllowedRole } from "@/lib/memberFields";
import { isCompleteMemberDisplayName } from "@/lib/memberDisplayName";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/http";

type Ctx = { params: Promise<{ id: string }> };

/** 部員更新（管理者のみ） */
export async function PATCH(req: Request, ctx: Ctx) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await ctx.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON が読み取れません" }, { status: 400 });
  }

  const name =
    typeof body === "object" && body !== null && "name" in body
      ? String((body as { name?: unknown }).name ?? "").trim()
      : undefined;
  const gradeYear =
    typeof body === "object" && body !== null && "gradeYear" in body
      ? String((body as { gradeYear?: unknown }).gradeYear ?? "").trim()
      : undefined;
  const gender =
    typeof body === "object" && body !== null && "gender" in body
      ? String((body as { gender?: unknown }).gender ?? "").trim()
      : undefined;
  const role =
    typeof body === "object" && body !== null && "role" in body
      ? String((body as { role?: unknown }).role ?? "").trim()
      : undefined;

  const data: { name?: string; gradeYear?: string; gender?: string; role?: string } = {};
  if (name !== undefined) {
    if (!name) return NextResponse.json({ error: "名前が空です" }, { status: 400 });
    if (!isCompleteMemberDisplayName(name)) {
      return NextResponse.json(
        { error: "名前は「苗字 + 半角空白 + 名前」の形式にしてください" },
        { status: 400 },
      );
    }
    const duplicate = await prisma.member.findFirst({
      where: { name, id: { not: id } },
      select: { id: true },
    });
    if (duplicate) {
      return NextResponse.json(
        { error: "同じ苗字と名前の部員が既にいます" },
        { status: 409 },
      );
    }
    data.name = name;
  }
  if (gradeYear !== undefined) {
    if (!isAllowedGrade(gradeYear)) {
      return NextResponse.json({ error: "学年の値が不正です" }, { status: 400 });
    }
    data.gradeYear = gradeYear;
  }
  if (gender !== undefined) {
    if (!isAllowedGender(gender)) {
      return NextResponse.json({ error: "男女の値が不正です" }, { status: 400 });
    }
    data.gender = gender;
  }
  if (role !== undefined) {
    if (!isAllowedRole(role)) {
      return NextResponse.json({ error: "役職の値が不正です" }, { status: 400 });
    }
    data.role = role;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "更新内容がありません" }, { status: 400 });
  }

  try {
    const member = await prisma.member.update({ where: { id }, data });
    return NextResponse.json({ member });
  } catch {
    return NextResponse.json({ error: "部員が見つかりません" }, { status: 404 });
  }
}

/** 部員削除（管理者のみ） */
export async function DELETE(_req: Request, ctx: Ctx) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await ctx.params;
  try {
    await prisma.member.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "部員が見つかりません" }, { status: 404 });
  }
}
