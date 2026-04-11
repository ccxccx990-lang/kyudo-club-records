"use client";

import { formatPracticeDate } from "@/lib/format";
import {
  isGenderScope,
  membersInGenderScope,
  parseAttendanceJson,
  parseLineupTeamsJson,
  trimLineupSentinels,
  type MemberForPractice,
} from "@/lib/practiceSessionPlan";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { SessionLite } from "./PracticeDetail";
import { PracticeLineupBuilder } from "./PracticeLineupBuilder";

type Props = {
  session: SessionLite;
  members: MemberForPractice[];
  isAdmin: boolean;
};

/** チーム編成のみ（/practices/[id]/lineup） */
export function PracticeLineupEditor({ session, members, isAdmin }: Props) {
  const router = useRouter();

  const sessionGenderScope = isGenderScope(session.genderScope) ? session.genderScope : "all";
  const attendance = useMemo(() => parseAttendanceJson(session.attendanceJson), [session.attendanceJson]);

  const inScopeMembers = useMemo(
    () => membersInGenderScope(members, sessionGenderScope),
    [members, sessionGenderScope],
  );

  const participatingMembers = useMemo(
    () => inScopeMembers.filter((m) => attendance[m.id] !== "absent"),
    [inScopeMembers, attendance],
  );

  const [lineupTeams, setLineupTeams] = useState<string[][]>(() => {
    const lt = parseLineupTeamsJson(session.lineupTeamsJson);
    return lt.length === 0 ? [[]] : lt;
  });
  const [teamSize, setTeamSize] = useState(session.teamSize);

  const [planMsg, setPlanMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const serverLineupFingerprint = useMemo(
    () =>
      JSON.stringify({
        lineup: trimLineupSentinels(parseLineupTeamsJson(session.lineupTeamsJson)),
        teamSize: session.teamSize,
      }),
    [session.lineupTeamsJson, session.teamSize],
  );

  const localLineupFingerprint = useMemo(
    () =>
      JSON.stringify({
        lineup: trimLineupSentinels(lineupTeams),
        teamSize,
      }),
    [lineupTeams, teamSize],
  );

  const lineupDirty = localLineupFingerprint !== serverLineupFingerprint;
  const hasUnsavedChanges = isAdmin && lineupDirty;

  useEffect(() => {
    const lt = parseLineupTeamsJson(session.lineupTeamsJson);
    setLineupTeams(lt.length === 0 ? [[]] : lt);
    setTeamSize(session.teamSize);
  }, [session.id, session.lineupTeamsJson, session.teamSize]);

  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [hasUnsavedChanges]);

  const confirmDiscardIfNeeded = () => {
    if (!hasUnsavedChanges) return true;
    return window.confirm(
      "保存していない変更があります。このまま進むと失われることがあります。続けますか？",
    );
  };

  const saveLineup = async () => {
    if (!isAdmin) return;
    setBusy(true);
    setPlanMsg(null);
    const res = await fetch(`/api/practices/${session.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lineupTeams: trimLineupSentinels(lineupTeams),
        teamSize,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setPlanMsg(data.error ?? "保存に失敗しました");
      return;
    }
    router.refresh();
  };

  const clearLineup = () => {
    if (!isAdmin) return;
    setLineupTeams([[]]);
  };

  const memberMap = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);
  const normalizedSaved = parseLineupTeamsJson(session.lineupTeamsJson).filter((t) => t.length > 0);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-zinc-500">
            <Link className="text-indigo-800 hover:underline" href={`/practices/${session.id}`}>
              ← 参加区分・出席へ
            </Link>
            {" · "}
            <Link className="text-indigo-800 hover:underline" href="/practices">
              一覧へ
            </Link>
          </p>
          <h1 className="mt-2 text-2xl font-bold">{formatPracticeDate(session.practiceDate)}</h1>
          <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-600">メモ: {session.memo || "—"}</p>
        </div>
        {!isAdmin ? (
          <Link
            href={`/practices/${session.id}/marks`}
            className="rounded-md bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800"
          >
            的中入力へ →
          </Link>
        ) : null}
      </div>

      {hasUnsavedChanges ? (
        <div
          role="status"
          className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950"
        >
          未保存の変更があります。離れる前に「チーム編成を保存」を押してください。
        </div>
      ) : null}

      {isAdmin ? (
        <section className="space-y-4 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-zinc-900">チーム編成（1チーム1〜6人）</h2>
          <p className="text-xs text-zinc-500">
            候補からタップで現在のチームに追加します。人数が上限に達すると次のチームに回ります。現在の立ちの人数が最大的数に達すると次の立ちの区切りが自動で入ります。それより早く立ちを分ける場合は「次の立ちへ」を使ってください。保存すると
            <Link className="font-medium text-indigo-800 underline" href={`/practices/${session.id}/marks`}>
              的中入力
            </Link>
            ページでの行順がこのチーム順になります。チームを保存しない場合は、出席者を学年・男女・名前順で表示します。
          </p>
          <PracticeLineupBuilder
            participatingMembers={participatingMembers}
            teamSize={teamSize}
            maxMato={session.maxMato}
            lineupTeams={lineupTeams}
            setLineupTeams={setLineupTeams}
            onTeamSizeChange={setTeamSize}
          />
          <div className="flex flex-wrap items-center gap-2 border-t border-zinc-100 pt-4">
            <button
              type="button"
              disabled={busy}
              className="rounded-md bg-indigo-700 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-800 disabled:opacity-50"
              onClick={() => void saveLineup()}
            >
              チーム編成を保存
            </button>
            <Link
              href={`/practices/${session.id}/marks`}
              className="inline-flex items-center rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
              onClick={(e) => {
                if (!hasUnsavedChanges) return;
                if (!confirmDiscardIfNeeded()) e.preventDefault();
              }}
            >
              的中入力へ →
            </Link>
            <button
              type="button"
              disabled={busy}
              className="ml-auto rounded-md border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-50 disabled:opacity-50"
              onClick={clearLineup}
            >
              チームをすべてクリア
            </button>
          </div>
          {planMsg ? <p className="text-sm text-red-700">{planMsg}</p> : null}
        </section>
      ) : (
        <section className="space-y-4 rounded-xl border border-zinc-200 bg-zinc-50/80 p-4 text-sm text-zinc-700">
          <h2 className="text-sm font-semibold text-zinc-900">チーム編成</h2>
          {normalizedSaved.length === 0 ? (
            <p>チームは未設定です。的中の行は出席者の学年・男女・名前順です。</p>
          ) : (
            <div className="space-y-3">
              {normalizedSaved.map((ids, ti) => (
                <div key={ti} className="rounded-md border border-zinc-200 bg-white p-3">
                  <p className="mb-2 text-xs font-semibold text-zinc-600">チーム {ti + 1}</p>
                  <ul className="space-y-1">
                    {ids.map((mid) => {
                      const m = memberMap.get(mid);
                      return (
                        <li key={mid} className="text-zinc-800">
                          <span className="mr-1 text-xs text-zinc-500">
                            {m?.gender === "女" ? "女" : m?.gender === "男" ? "男" : ""}
                          </span>
                          {m?.name ?? mid}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
