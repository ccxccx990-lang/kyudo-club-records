import { NextResponse } from "next/server";
import {
  GENDER_OPTIONS,
  GRADE_OPTIONS,
  isAllowedRole,
  sortMembers,
} from "@/lib/memberFields";
import { buildMemberDisplayName } from "@/lib/memberDisplayName";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/http";

/** 部員一覧（閲覧は誰でも可） */
export async function GET() {
  const raw = await prisma.member.findMany({
    orderBy: { createdAt: "asc" },
  });
  const members = sortMembers(raw);
  return NextResponse.json({ members });
}

/** 部員追加（管理者のみ） */
export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON が読み取れません" }, { status: 400 });
  }
  const familyName =
    typeof body === "object" && body !== null && "familyName" in body
      ? String((body as { familyName?: unknown }).familyName ?? "").trim()
      : "";
  const givenName =
    typeof body === "object" && body !== null && "givenName" in body
      ? String((body as { givenName?: unknown }).givenName ?? "").trim()
      : "";
  const gradeYear =
    typeof body === "object" && body !== null && "gradeYear" in body
      ? String((body as { gradeYear?: unknown }).gradeYear ?? "").trim()
      : "";
  const gender =
    typeof body === "object" && body !== null && "gender" in body
      ? String((body as { gender?: unknown }).gender ?? "").trim()
      : "";
  const role =
    typeof body === "object" && body !== null && "role" in body
      ? String((body as { role?: unknown }).role ?? "").trim()
      : "";

  if (!familyName || !givenName) {
    return NextResponse.json({ error: "苗字と名前を入力してください" }, { status: 400 });
  }
  const name = buildMemberDisplayName(familyName, givenName);
  if (!GRADE_OPTIONS.includes(gradeYear as (typeof GRADE_OPTIONS)[number])) {
    return NextResponse.json({ error: "学年を選んでください" }, { status: 400 });
  }
  if (!GENDER_OPTIONS.includes(gender as (typeof GENDER_OPTIONS)[number])) {
    return NextResponse.json({ error: "男女を選んでください" }, { status: 400 });
  }
  if (!isAllowedRole(role)) {
    return NextResponse.json({ error: "役職の値が不正です" }, { status: 400 });
  }

  const duplicate = await prisma.member.findFirst({
    where: { name },
    select: { id: true },
  });
  if (duplicate) {
    return NextResponse.json(
      { error: "同じ苗字と名前の部員が既にいます" },
      { status: 409 },
    );
  }

  const member = await prisma.member.create({
    data: { name, gradeYear, gender, role },
  });
  return NextResponse.json({ member }, { status: 201 });
}
