"use client";

import { formatPracticeDate } from "@/lib/format";
import {
  GENDER_SCOPE_OPTIONS,
  isGenderScope,
  membersInGenderScope,
  parseAttendanceJson,
  parseLineupTeamsJson,
  stableAttendanceJson,
  type AttendanceState,
  type GenderScope,
  type MemberForPractice,
} from "@/lib/practiceSessionPlan";
import {
  uiBtnAccent,
  uiBtnDangerOutline,
  uiBtnDangerSolid,
  uiBtnPrimary,
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
  lineupTeamsJson: string;
  teamSize: number;
  maxMato: number;
};

type Props = {
  session: SessionLite;
  members: MemberLite[];
  isAdmin: boolean;
};

/** 合同練習の詳細・参加区分・出席（チーム編成は /lineup） */
export function PracticeDetail({ session, members, isAdmin }: Props) {
  const router = useRouter();

  const sessionGenderScope: GenderScope = isGenderScope(session.genderScope) ? session.genderScope : "all";

  const [genderScope, setGenderScope] = useState<GenderScope>(sessionGenderScope);
  const [attendance, setAttendance] = useState<Record<string, AttendanceState>>(() =>
    parseAttendanceJson(session.attendanceJson),
  );

  const [planMsg, setPlanMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const inScopeMembers = useMemo(
    () => membersInGenderScope(members, genderScope),
    [members, genderScope],
  );

  const participatingMembers = useMemo(
    () => inScopeMembers.filter((m) => attendance[m.id] !== "absent"),
    [inScopeMembers, attendance],
  );

  const serverPlanFingerprint = useMemo(
    () =>
      JSON.stringify({
        genderScope: sessionGenderScope,
        attendance: stableAttendanceJson(parseAttendanceJson(session.attendanceJson)),
      }),
    [sessionGenderScope, session.attendanceJson],
  );

  const localPlanFingerprint = useMemo(
    () =>
      JSON.stringify({
        genderScope,
        attendance: stableAttendanceJson(attendance),
      }),
    [genderScope, attendance],
  );

  const planDirty = localPlanFingerprint !== serverPlanFingerprint;

  const hasUnsavedChanges = isAdmin && planDirty;

  useEffect(() => {
    const gs = isGenderScope(session.genderScope) ? session.genderScope : "all";
    setGenderScope(gs);
    setAttendance(parseAttendanceJson(session.attendanceJson));
  }, [session.id, session.genderScope, session.attendanceJson]);

  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [hasUnsavedChanges]);

  useEffect(() => {
    if (!deleteDialogOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDeleteDialogOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [deleteDialogOpen]);

  const saveAttendanceToServer = async (): Promise<boolean> => {
    const res = await fetch(`/api/practices/${session.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ genderScope, attendance }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setPlanMsg(data.error ?? "保存に失敗しました");
      return false;
    }
    setPlanMsg(null);
    return true;
  };

  const savePlan = async () => {
    if (!isAdmin) return;
    setBusy(true);
    setPlanMsg(null);
    const ok = await saveAttendanceToServer();
    setBusy(false);
    if (ok) router.refresh();
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

  const openDeleteDialog = () => {
    if (!isAdmin || busy) return;
    setDeleteDialogOpen(true);
  };

  const closeDeleteDialog = () => setDeleteDialogOpen(false);

  /** カスタム確認の「はい」以降（未保存・最終確認・DELETE） */
  const runDeleteAfterFirstConfirm = async () => {
    setDeleteDialogOpen(false);
    if (!isAdmin) return;
    if (hasUnsavedChanges) {
      const ok = window.confirm(
        "保存していない参加区分・出席の変更があります。このまま削除すると失われます。続けますか？",
      );
      if (!ok) return;
    }
    if (!window.confirm("この合同練習をまるごと削除しますか？記録もすべて消えます。")) return;
    setBusy(true);
    setPlanMsg(null);
    const res = await fetch(`/api/practices/${session.id}`, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setPlanMsg(data.error ?? "削除に失敗しました");
      return;
    }
    router.replace("/practices");
    router.refresh();
  };

  const toggleAttendance = (memberId: string) => {
    setAttendance((prev) => {
      const cur = prev[memberId];
      const next: AttendanceState = cur === "absent" ? "present" : "absent";
      return { ...prev, [memberId]: next };
    });
  };

  return (
    <div className="space-y-8">
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
          未保存の変更があります。離れる前に「参加区分・出席を保存」を押してください。
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
            です。「参加区分・出席を保存」または「チーム編成（1〜6人）へ」で保存すると、
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
            <p className="mb-2 text-xs font-medium text-zinc-600">出席（タップで参加／休み）</p>
            <div className="flex flex-wrap gap-2">
              {inScopeMembers.map((m) => {
                const isAbsent = attendance[m.id] === "absent";
                return (
                  <button
                    key={m.id}
                    type="button"
                    disabled={busy}
                    onClick={() => toggleAttendance(m.id)}
                    className={`flex min-h-[3.25rem] min-w-[4.75rem] flex-col justify-center rounded-lg border-2 px-2.5 py-2 text-left text-xs shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 ${
                      isAbsent
                        ? "border-red-300 bg-red-50 text-red-900"
                        : "border-emerald-300 bg-emerald-50 text-emerald-950"
                    }`}
                  >
                    <span className="font-semibold">{m.name}</span>
                    <span>{isAbsent ? "休み" : "参加"}</span>
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-zinc-500">
              参加: <strong>{participatingMembers.length}</strong>人 / 対象{" "}
              <strong>{inScopeMembers.length}</strong>人
            </p>
          </div>

          <div className="flex flex-col gap-3 border-t border-zinc-100 pt-4 sm:flex-row sm:flex-wrap sm:items-center">
            <button
              type="button"
              disabled={busy}
              className={`${uiBtnDangerOutline} w-full justify-center sm:w-auto`}
              onClick={openDeleteDialog}
            >
              この練習を削除
            </button>
            <button
              type="button"
              disabled={busy}
              className={`${uiBtnPrimary} w-full justify-center sm:w-auto`}
              onClick={() => void savePlan()}
            >
              参加区分・出席を保存
            </button>
            <Link
              href={`/practices/${session.id}/lineup`}
              className={`${uiBtnSecondary} w-full justify-center sm:ml-auto sm:w-auto`}
              onClick={navigateToLineup}
            >
              チーム編成（1〜6人）へ →
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

      {deleteDialogOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="presentation"
          onClick={closeDeleteDialog}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-practice-dialog-title"
            className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-5 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <p
              id="delete-practice-dialog-title"
              className="whitespace-pre-line text-sm font-medium text-zinc-900"
            >{`この練習を削除します。
本当によろしいですか？`}</p>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
              <button type="button" className={`${uiBtnSecondary} w-full sm:w-auto`} onClick={closeDeleteDialog}>
                いいえ
              </button>
              <button
                type="button"
                className={`${uiBtnDangerSolid} w-full sm:w-auto`}
                onClick={() => void runDeleteAfterFirstConfirm()}
              >
                はい
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
