"use client";

import { formatPracticeDate } from "@/lib/format";
import {
  ABSENT_REASON_OPTIONS,
  GENDER_SCOPE_OPTIONS,
  isGenderScope,
  membersInGenderScope,
  parseAbsentReasonsJson,
  parseAttendanceJson,
  parseLineupTeamsJson,
  stableAbsentReasonsJson,
  stableAttendanceJson,
  type AbsentReason,
  type AttendanceState,
  type GenderScope,
  type MemberForPractice,
} from "@/lib/practiceSessionPlan";
import {
  uiBtnAccent,
  uiBtnSecondary,
  uiLinkChip,
  uiToggleChoice,
} from "@/lib/uiButtons";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

export type MemberLite = MemberForPractice;
export type SessionLite = {
  id: string;
  practiceDate: string;
  memo: string;
  roundCount: number;
  genderScope: string;
  attendanceJson: string;
  absentReasonsJson: string;
  lineupTeamsJson: string;
  lineupTeamSizesJson: string;
  lineupTeamInfoJson: string;
  teamSize: number;
  maxMato: number;
};

type Props = {
  session: SessionLite;
  members: MemberLite[];
  isAdmin: boolean;
};

const GRADE_BLOCKS = ["4年", "3年", "2年", "1年"] as const;
const ATTENDANCE_OPTIONS: { value: AttendanceState; label: string }[] = [
  { value: "present", label: "参加" },
  { value: "absent", label: "休み" },
  { value: "late", label: "遅刻" },
  { value: "early", label: "早退" },
  { value: "partial", label: "中抜け" },
];
const NON_PRESENT_ATTENDANCE_OPTIONS = ATTENDANCE_OPTIONS.filter((opt) => opt.value !== "present");

function attendanceLabel(state: AttendanceState): string {
  return ATTENDANCE_OPTIONS.find((opt) => opt.value === state)?.label ?? "参加";
}

function attendanceChoiceClass(state: AttendanceState, selected: boolean): string {
  const base =
    "rounded-md border px-2 py-1 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2";
  if (!selected) return `${base} border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50`;
  if (state === "absent") return `${base} border-red-300 bg-red-50 text-red-900`;
  if (state === "late") return `${base} border-amber-300 bg-amber-50 text-amber-950`;
  if (state === "early") return `${base} border-sky-300 bg-sky-50 text-sky-950`;
  if (state === "partial") return `${base} border-violet-300 bg-violet-50 text-violet-950`;
  return `${base} border-emerald-300 bg-emerald-50 text-emerald-950`;
}

/** 正規練習の詳細・参加区分・出席（チーム編成は /lineup） */
export function PracticeDetail({ session, members, isAdmin }: Props) {
  const router = useRouter();

  const sessionGenderScope: GenderScope = isGenderScope(session.genderScope) ? session.genderScope : "all";

  const [genderScope, setGenderScope] = useState<GenderScope>(sessionGenderScope);
  const [attendance, setAttendance] = useState<Record<string, AttendanceState>>(() =>
    parseAttendanceJson(session.attendanceJson),
  );
  const [absentReasons, setAbsentReasons] = useState<Record<string, AbsentReason>>(() =>
    parseAbsentReasonsJson(session.absentReasonsJson),
  );

  const [planMsg, setPlanMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const inScopeMembers = useMemo(
    () => membersInGenderScope(members, genderScope),
    [members, genderScope],
  );

  const participatingMembers = useMemo(
    () => inScopeMembers.filter((m) => attendance[m.id] !== "absent"),
    [inScopeMembers, attendance],
  );

  const reasonMembers = useMemo(
    () => inScopeMembers.filter((m) => (attendance[m.id] ?? "present") !== "present"),
    [inScopeMembers, attendance],
  );

  const attendanceMemberBlocks = useMemo(() => {
    const grouped = GRADE_BLOCKS.map((grade) => ({
      grade,
      members: inScopeMembers.filter((m) => m.gradeYear === grade),
    })).filter((block) => block.members.length > 0);
    const otherMembers = inScopeMembers.filter((m) => !GRADE_BLOCKS.includes(m.gradeYear as (typeof GRADE_BLOCKS)[number]));
    return otherMembers.length > 0 ? [...grouped, { grade: "その他", members: otherMembers }] : grouped;
  }, [inScopeMembers]);

  const serverPlanFingerprint = useMemo(
    () =>
      JSON.stringify({
        genderScope: sessionGenderScope,
        attendance: stableAttendanceJson(parseAttendanceJson(session.attendanceJson)),
        absentReasons: stableAbsentReasonsJson(parseAbsentReasonsJson(session.absentReasonsJson)),
      }),
    [sessionGenderScope, session.attendanceJson, session.absentReasonsJson],
  );

  const localPlanFingerprint = useMemo(
    () =>
      JSON.stringify({
        genderScope,
        attendance: stableAttendanceJson(attendance),
        absentReasons: stableAbsentReasonsJson(absentReasons),
      }),
    [genderScope, attendance, absentReasons],
  );

  const planDirty = localPlanFingerprint !== serverPlanFingerprint;

  const hasUnsavedChanges = isAdmin && planDirty;

  useEffect(() => {
    const gs = isGenderScope(session.genderScope) ? session.genderScope : "all";
    setGenderScope(gs);
    setAttendance(parseAttendanceJson(session.attendanceJson));
    setAbsentReasons(parseAbsentReasonsJson(session.absentReasonsJson));
  }, [session.id, session.genderScope, session.attendanceJson, session.absentReasonsJson]);

  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [hasUnsavedChanges]);

  const saveAttendanceToServer = async (): Promise<boolean> => {
    const res = await fetch(`/api/practices/${session.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ genderScope, attendance, absentReasons }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setPlanMsg(data.error ?? "保存に失敗しました");
      return false;
    }
    setPlanMsg(null);
    return true;
  };

  /** チーム編成ページへ。未保存の参加区分・出席があれば先に保存（サーバー側でチーム・的中もクリアされる） */
  const navigateToLineup = async (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    if (!isAdmin) {
      router.push(`/practices/${session.id}/lineup`);
      return;
    }
    if (busy) return;
    if (hasUnsavedChanges) {
      setBusy(true);
      const ok = await saveAttendanceToServer();
      setBusy(false);
      if (!ok) return;
    }
    router.push(`/practices/${session.id}/lineup`);
  };

  const setAttendanceStatus = (memberId: string, status: AttendanceState) => {
    setAttendance((prev) => {
      return { ...prev, [memberId]: status };
    });
    setAbsentReasons((prev) => {
      if (status !== "present") return { ...prev, [memberId]: prev[memberId] ?? "私用" };
      const next = { ...prev };
      delete next[memberId];
      return next;
    });
  };

  const setAbsentReason = (memberId: string, reason: AbsentReason) => {
    setAbsentReasons((prev) => ({ ...prev, [memberId]: reason }));
  };

  return (
    <div className="space-y-8">
      {busy ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/40"
          role="status"
          aria-live="polite"
          aria-label="保存中"
        >
          <div className="flex flex-col items-center gap-3 rounded-xl bg-white px-6 py-5 text-sm font-semibold text-zinc-900 shadow-lg">
            <span className="h-9 w-9 animate-spin rounded-full border-4 border-zinc-200 border-t-indigo-600" />
            <span>保存中...</span>
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div className="min-w-0 space-y-2">
          <Link className={`${uiLinkChip} text-xs`} href="/practices">
            ← 一覧へ
          </Link>
          <h1 className="mt-2 text-2xl font-bold">
            <Link
              href={`/practices/${session.id}/marks`}
              className="text-emerald-900 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
            >
              {formatPracticeDate(session.practiceDate)}
            </Link>
          </h1>
          <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-600">メモ: {session.memo || "—"}</p>
          <p className="mt-1 text-xs text-zinc-500">立ち数: {session.roundCount}</p>
        </div>
        {!isAdmin ? (
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:items-end">
            <Link href={`/practices/${session.id}/marks`} className={`${uiBtnAccent} w-full justify-center sm:w-auto`}>
              的中を見る
            </Link>
          </div>
        ) : null}
      </div>

      {isAdmin && hasUnsavedChanges ? (
        <div
          role="status"
          className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950"
        >
          未保存の変更があります。「チーム編成へ」を押すと保存して次のページに進みます。
        </div>
      ) : null}

      {isAdmin ? (
        <section className="space-y-4 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-zinc-900">参加区分・出席（管理者）</h2>
          <p className="text-xs text-zinc-500">
            チーム編成（1チーム1〜6人）は
            <Link
              className="font-medium text-indigo-800 underline"
              href={`/practices/${session.id}/lineup`}
              onClick={navigateToLineup}
            >
              次のページ
            </Link>
            です。「チーム編成へ」で保存して次のページに進みます。保存すると、
            <strong className="text-zinc-800">既存のチーム編成と的中記録はすべてクリア</strong>
            されます。
          </p>
          <div>
            <p className="mb-2 text-xs font-medium text-zinc-600">練習の対象</p>
            <div className="flex flex-wrap gap-2">
              {GENDER_SCOPE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  disabled={busy}
                  onClick={() => setGenderScope(opt.value)}
                  className={uiToggleChoice(genderScope === opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-medium text-zinc-600">出欠（参加、またはプルダウンで区分を選択）</p>
            <div className="space-y-3">
              {attendanceMemberBlocks.map((block) => (
                <section key={block.grade} className="rounded-lg border border-zinc-200 bg-zinc-50/60 p-3">
                  <div className="mb-2 flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-zinc-800">{block.grade}</h3>
                    <span className="text-xs text-zinc-500">{block.members.length}人</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {block.members.map((m) => {
                      const current = attendance[m.id] ?? "present";
                      return (
                        <div
                          key={m.id}
                          className="min-w-[10.5rem] rounded-lg border border-zinc-200 bg-white px-2.5 py-2 shadow-sm"
                        >
                          <p className="mb-2 text-sm font-semibold text-zinc-900">{m.name}</p>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => setAttendanceStatus(m.id, "present")}
                              className={attendanceChoiceClass("present", current === "present")}
                            >
                              参加
                            </button>
                            <select
                              className={`rounded-md border px-2 py-1 text-xs font-medium ${
                                current === "present" ? "border-zinc-200 bg-white text-zinc-600" : attendanceChoiceClass(current, true)
                              }`}
                              value={current === "present" ? "absent" : current}
                              disabled={busy}
                              onClick={() => {
                                if (current === "present") setAttendanceStatus(m.id, "absent");
                              }}
                              onChange={(e) => {
                                const next = e.target.value as Exclude<AttendanceState, "present">;
                                setAttendanceStatus(m.id, next);
                              }}
                            >
                              {NON_PRESENT_ATTENDANCE_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
            <p className="mt-2 text-xs text-zinc-500">
              出席扱い: <strong>{participatingMembers.length}</strong>人 / 対象{" "}
              <strong>{inScopeMembers.length}</strong>人
              <span className="ml-2">休み以外はチーム編成の対象に含まれます。</span>
            </p>
            {reasonMembers.length > 0 ? (
              <section className="mt-3 rounded-lg border border-red-200 bg-red-50/60 p-3">
                <div className="mb-2 flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-red-950">休み・遅刻・早退・中抜け一覧</h3>
                  <span className="text-xs text-red-800">{reasonMembers.length}人</span>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {reasonMembers.map((m) => (
                    <label key={m.id} className="block rounded-lg border border-red-100 bg-white px-3 py-2 text-sm">
                      <span className="mb-1 block font-semibold text-zinc-900">
                        {m.name}
                        <span className="ml-2 text-xs font-medium text-zinc-500">
                          {attendanceLabel(attendance[m.id] ?? "present")}
                        </span>
                      </span>
                      <select
                        className="w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
                        value={absentReasons[m.id] ?? "私用"}
                        disabled={busy}
                        onChange={(e) => setAbsentReason(m.id, e.target.value as AbsentReason)}
                      >
                        {ABSENT_REASON_OPTIONS.map((reason) => (
                          <option key={reason} value={reason}>
                            {reason}
                          </option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
              </section>
            ) : null}
          </div>

          <div className="flex flex-col gap-3 border-t border-zinc-100 pt-4 sm:flex-row sm:flex-wrap sm:items-center">
            <Link
              href={`/practices/${session.id}/lineup`}
              className={`${uiBtnSecondary} w-full justify-center sm:ml-auto sm:w-auto`}
              onClick={navigateToLineup}
            >
              チーム編成へ →
            </Link>
          </div>
          {planMsg ? <p className="mt-2 text-sm text-red-700">{planMsg}</p> : null}
        </section>
      ) : (
        <section className="space-y-4 rounded-xl border border-zinc-200 bg-zinc-50/80 p-4 text-sm text-zinc-700">
          <p>
            対象:{" "}
            <strong>
              {sessionGenderScope === "all"
                ? "男女合同"
                : sessionGenderScope === "男"
                  ? "男子のみ"
                  : "女子のみ"}
            </strong>
            ／ 出席 {participatingMembers.length}人
            {parseLineupTeamsJson(session.lineupTeamsJson).some((t) => t.length > 0)
              ? "（チーム編成あり）"
              : ""}
          </p>
          <p>
            <Link className="font-medium text-indigo-800 underline" href={`/practices/${session.id}/lineup`}>
              チーム編成の表示
            </Link>
            {" · "}
            <Link className="font-medium text-emerald-800 underline" href={`/practices/${session.id}/marks`}>
              的中を見る
            </Link>
          </p>
        </section>
      )}

    </div>
  );
}
