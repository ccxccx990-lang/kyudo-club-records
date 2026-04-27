import { NextResponse } from "next/server";
import { sortMembers } from "@/lib/memberFields";
import {
  isGenderScope,
  membersInGenderScope,
  parseAttendanceJson,
  parseLineupTeamsJson,
  parseSubstitutionsJson,
  stringifyAttendance,
  stringifyLineupTeams,
  stringifySubstitutions,
  validateLineupTeams,
  type AttendanceState,
  type GenderScope,
  type PracticeSubstitution,
} from "@/lib/practiceSessionPlan";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/http";
import { isIsoDate } from "@/lib/dates";

type Ctx = { params: Promise<{ id: string }> };

/** 1件の正規練習＋部員＋記録（閲覧は誰でも可） */
export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;

  const session = await prisma.practiceSession.findUnique({
    where: { id },
    include: {
      records: true,
    },
  });

  if (!session) {
    return NextResponse.json({ error: "練習が見つかりません" }, { status: 404 });
  }

  const rawMembers = await prisma.member.findMany({
    orderBy: { createdAt: "asc" },
  });
  const members = sortMembers(rawMembers);

  const { records, ...rest } = session;
  return NextResponse.json({
    session: rest,
    members,
    records: records.map((r) => ({
      memberId: r.memberId,
      roundIndex: r.roundIndex,
      marks: r.marks,
    })),
  });
}

/** 正規練習の更新（管理者のみ） */
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

  const practiceDate =
    typeof body === "object" && body !== null && "practiceDate" in body
      ? String((body as { practiceDate?: unknown }).practiceDate ?? "").trim()
      : undefined;
  const memo =
    typeof body === "object" && body !== null && "memo" in body
      ? String((body as { memo?: unknown }).memo ?? "")
      : undefined;
  const roundCountRaw =
    typeof body === "object" && body !== null && "roundCount" in body
      ? Number((body as { roundCount?: unknown }).roundCount)
      : undefined;

  const genderScopeRaw =
    typeof body === "object" && body !== null && "genderScope" in body
      ? String((body as { genderScope?: unknown }).genderScope ?? "").trim()
      : undefined;
  const attendanceUnknown =
    typeof body === "object" && body !== null && "attendance" in body
      ? (body as { attendance?: unknown }).attendance
      : undefined;
  const lineupTeamsUnknown =
    typeof body === "object" && body !== null && "lineupTeams" in body
      ? (body as { lineupTeams?: unknown }).lineupTeams
      : undefined;
  const teamSizeRaw =
    typeof body === "object" && body !== null && "teamSize" in body
      ? Number((body as { teamSize?: unknown }).teamSize)
      : undefined;
  const maxMatoRaw =
    typeof body === "object" && body !== null && "maxMato" in body
      ? Number((body as { maxMato?: unknown }).maxMato)
      : undefined;
  const sessionKindRaw =
    typeof body === "object" && body !== null && "sessionKind" in body
      ? String((body as { sessionKind?: unknown }).sessionKind ?? "").trim()
      : undefined;
  const substitutionsUnknown =
    typeof body === "object" && body !== null && "substitutions" in body
      ? (body as { substitutions?: unknown }).substitutions
      : undefined;

  const data: {
    practiceDate?: string;
    memo?: string;
    roundCount?: number;
    genderScope?: string;
    attendanceJson?: string;
    lineupTeamsJson?: string;
    teamSize?: number;
    maxMato?: number;
    sessionKind?: string;
    substitutionsJson?: string;
  } = {};

  if (practiceDate !== undefined) {
    if (!isIsoDate(practiceDate)) {
      return NextResponse.json(
        { error: "日付は YYYY-MM-DD 形式で送ってください" },
        { status: 400 },
      );
    }
    data.practiceDate = practiceDate;
  }
  if (memo !== undefined) data.memo = memo;
  if (roundCountRaw !== undefined) {
    if (!Number.isFinite(roundCountRaw) || roundCountRaw < 1 || roundCountRaw > 30) {
      return NextResponse.json(
        { error: "立ち数は 1〜30 の整数にしてください" },
        { status: 400 },
      );
    }
    data.roundCount = Math.floor(roundCountRaw);
  }

  const sessionRow = await prisma.practiceSession.findUnique({ where: { id } });
  if (!sessionRow) {
    return NextResponse.json({ error: "練習が見つかりません" }, { status: 404 });
  }

  const memberRows = await prisma.member.findMany({
    select: { id: true, name: true, gradeYear: true, gender: true },
  });
  const memberIdSet = new Set(memberRows.map((m) => m.id));

  let nextGenderScope: GenderScope = isGenderScope(sessionRow.genderScope)
    ? sessionRow.genderScope
    : "all";
  if (genderScopeRaw !== undefined) {
    if (!isGenderScope(genderScopeRaw)) {
      return NextResponse.json({ error: "参加区分が不正です" }, { status: 400 });
    }
    nextGenderScope = genderScopeRaw;
    data.genderScope = genderScopeRaw;
  }

  let nextAttendance = parseAttendanceJson(sessionRow.attendanceJson);
  if (attendanceUnknown !== undefined) {
    if (typeof attendanceUnknown !== "object" || attendanceUnknown === null) {
      return NextResponse.json({ error: "attendance はオブジェクトで送ってください" }, { status: 400 });
    }
    const inScopeIds = new Set(
      membersInGenderScope(memberRows, nextGenderScope).map((m) => m.id),
    );
    const sanitized: Record<string, AttendanceState> = {};
    for (const [k, v] of Object.entries(attendanceUnknown as Record<string, unknown>)) {
      if (!memberIdSet.has(k) || !inScopeIds.has(k)) continue;
      if (v === "present" || v === "absent") sanitized[k] = v;
    }
    nextAttendance = sanitized;
    data.attendanceJson = stringifyAttendance(sanitized);
  }

  if (teamSizeRaw !== undefined) {
    if (!Number.isFinite(teamSizeRaw) || teamSizeRaw < 1 || teamSizeRaw > 6) {
      return NextResponse.json({ error: "チーム人数は 1〜6 にしてください" }, { status: 400 });
    }
    data.teamSize = Math.floor(teamSizeRaw);
  }

  if (maxMatoRaw !== undefined) {
    if (!Number.isFinite(maxMatoRaw) || maxMatoRaw < 4 || maxMatoRaw > 24) {
      return NextResponse.json({ error: "最大的数は 4〜24 にしてください" }, { status: 400 });
    }
    data.maxMato = Math.floor(maxMatoRaw);
  }

  let nextSessionKind = sessionRow.sessionKind;
  if (sessionKindRaw !== undefined) {
    if (sessionKindRaw !== "joint" && sessionKindRaw !== "match") {
      return NextResponse.json({ error: "sessionKind は joint か match です" }, { status: 400 });
    }
    nextSessionKind = sessionKindRaw;
    data.sessionKind = sessionKindRaw;
  }

  let nextLineupTeams = parseLineupTeamsJson(sessionRow.lineupTeamsJson);
  if (lineupTeamsUnknown !== undefined) {
    if (!Array.isArray(lineupTeamsUnknown)) {
      return NextResponse.json({ error: "lineupTeams は配列で送ってください" }, { status: 400 });
    }
    const teams: string[][] = [];
    for (const t of lineupTeamsUnknown) {
      if (!Array.isArray(t)) continue;
      const ids = t.filter((x): x is string => typeof x === "string" && x.length > 0);
      teams.push(ids.length > 0 ? ids : []);
    }

    const attendingSet = new Set(
      membersInGenderScope(memberRows, nextGenderScope)
        .filter((m) => nextAttendance[m.id] !== "absent")
        .map((m) => m.id),
    );

    if (teams.length > 0) {
      const err = validateLineupTeams(teams, attendingSet);
      if (err) {
        return NextResponse.json({ error: err }, { status: 400 });
      }
    }
    nextLineupTeams = teams;
    data.lineupTeamsJson = stringifyLineupTeams(teams);
  }

  if (substitutionsUnknown !== undefined) {
    if (!Array.isArray(substitutionsUnknown)) {
      return NextResponse.json({ error: "substitutions は配列で送ってください" }, { status: 400 });
    }

    const attendingMembers = membersInGenderScope(memberRows, nextGenderScope).filter((m) => nextAttendance[m.id] !== "absent");
    const attendingSet = new Set(attendingMembers.map((m) => m.id));
    const lineupMemberSet = new Set(nextLineupTeams.flat());
    const unassignedSet = new Set(attendingMembers.filter((m) => !lineupMemberSet.has(m.id)).map((m) => m.id));

    const substitutions: PracticeSubstitution[] = [];
    for (const row of substitutionsUnknown) {
      const parsed = parseSubstitutionsJson(JSON.stringify([row]))[0];
      if (!parsed) {
        return NextResponse.json(
          { error: "交代には roundIndex, outMemberId, inMemberId が必要です" },
          { status: 400 },
        );
      }
      if (parsed.roundIndex > (data.roundCount ?? sessionRow.roundCount)) {
        return NextResponse.json({ error: "交代の立目が立ち数を超えています" }, { status: 400 });
      }
      if (!attendingSet.has(parsed.outMemberId)) {
        return NextResponse.json({ error: "交代元は出席者から選んでください" }, { status: 400 });
      }
      if (nextSessionKind === "match" && !lineupMemberSet.has(parsed.outMemberId)) {
        return NextResponse.json(
          { error: "試合の交代元はチーム内の出席者から選んでください" },
          { status: 400 },
        );
      }
      if (!attendingSet.has(parsed.inMemberId)) {
        return NextResponse.json({ error: "交代先は出席者から選んでください" }, { status: 400 });
      }
      if (nextSessionKind === "match" && !unassignedSet.has(parsed.inMemberId)) {
        return NextResponse.json(
          { error: "試合の交代先はチーム未割当の出席者から選んでください" },
          { status: 400 },
        );
      }
      substitutions.push(parsed);
    }
    data.substitutionsJson = stringifySubstitutions(substitutions);
  }

  /** 参加区分・出席のみ更新するときはチーム編成と〇×記録をリセット（同一リクエストで lineupTeams を送る場合は除外） */
  const clearLineupAndMarksOnPlanSave =
    (attendanceUnknown !== undefined || genderScopeRaw !== undefined) && lineupTeamsUnknown === undefined;

  if (clearLineupAndMarksOnPlanSave) {
    data.lineupTeamsJson = stringifyLineupTeams([]);
    data.substitutionsJson = stringifySubstitutions([]);
    data.teamSize = 4;
  } else if (lineupTeamsUnknown !== undefined && substitutionsUnknown === undefined) {
    data.substitutionsJson = stringifySubstitutions([]);
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "更新内容がありません" }, { status: 400 });
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const session = await tx.practiceSession.update({ where: { id }, data });

      if (typeof data.roundCount === "number") {
        await tx.roundRecord.deleteMany({
          where: { sessionId: id, roundIndex: { gt: data.roundCount } },
        });
      }

      if (clearLineupAndMarksOnPlanSave) {
        await tx.roundRecord.deleteMany({ where: { sessionId: id } });
      }

      return session;
    });

    return NextResponse.json({ session: updated });
  } catch {
    return NextResponse.json({ error: "練習が見つかりません" }, { status: 404 });
  }
}

/** 正規練習の削除（管理者のみ） */
export async function DELETE(_req: Request, ctx: Ctx) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await ctx.params;
  try {
    await prisma.practiceSession.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "練習が見つかりません" }, { status: 404 });
  }
}
