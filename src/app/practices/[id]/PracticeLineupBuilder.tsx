"use client";

import { computeRoundPacking } from "@/lib/practiceRoundPacking";
import { roundNumberAfterMarker } from "@/lib/practiceSessionPlan";
import { useMemo, useState, type Dispatch, type SetStateAction } from "react";

export type LineMember = { id: string; name: string; gender: string; gradeYear: string };

/** 末尾から見て最後の [] より後ろのチームにいる人数合計（現在の立ちの累計） */
function memberCountInTailSegment(teams: string[][]): number {
  let start = 0;
  for (let i = teams.length - 1; i >= 0; i--) {
    if (teams[i]!.length === 0) {
      start = i + 1;
      break;
    }
  }
  let n = 0;
  for (let i = start; i < teams.length; i++) {
    n += teams[i]!.length;
  }
  return n;
}

type Props = {
  participatingMembers: LineMember[];
  teamSize: number;
  maxMato: number;
  lineupTeams: string[][];
  setLineupTeams: Dispatch<SetStateAction<string[][]>>;
  onTeamSizeChange: (n: number) => void;
};

export function PracticeLineupBuilder({
  participatingMembers,
  teamSize,
  maxMato,
  lineupTeams,
  setLineupTeams,
  onTeamSizeChange,
}: Props) {
  const [candidateGender, setCandidateGender] = useState<"all" | "男" | "女">("all");

  const memberMap = useMemo(
    () => new Map(participatingMembers.map((m) => [m.id, m])),
    [participatingMembers],
  );

  const flatIds = useMemo(() => lineupTeams.flat(), [lineupTeams]);

  const candidates = useMemo(() => {
    let ms = participatingMembers.filter((m) => !flatIds.includes(m.id));
    if (candidateGender === "男") ms = ms.filter((m) => m.gender === "男");
    if (candidateGender === "女") ms = ms.filter((m) => m.gender === "女");
    return ms;
  }, [participatingMembers, flatIds, candidateGender]);

  const unassignedCount = participatingMembers.length - flatIds.length;

  /** 末尾が立ち区切り [] のときは重ねない（次の立ちへは未入力のまま待つ） */
  const canAppendNextRound =
    lineupTeams.length === 0 || lineupTeams[lineupTeams.length - 1]!.length > 0;

  const addToLineup = (memberId: string) => {
    setLineupTeams((prev) => {
      const copy = prev.map((t) => [...t]);
      const tailCount = memberCountInTailSegment(copy);
      const lastTeam = copy.length > 0 ? copy[copy.length - 1] : null;
      if (tailCount >= maxMato && lastTeam && lastTeam.length > 0) {
        copy.push([]);
      }
      if (copy.length === 0) return [[memberId]];
      const li = copy.length - 1;
      // 末尾が立ち区切りの空チームなら、そこに詰めず「その次」の新チームに入れる
      if (copy[li]!.length === 0) {
        copy.push([memberId]);
        return copy;
      }
      if (copy[li]!.length >= teamSize) {
        copy.push([memberId]);
        return copy;
      }
      copy[li]!.push(memberId);
      return copy;
    });
  };

  const removeFromLineup = (memberId: string) => {
    setLineupTeams((prev) => {
      const next = prev.map((t) => t.filter((id) => id !== memberId));
      while (next.length > 1 && next[next.length - 1]!.length === 0) next.pop();
      return next.length === 0 ? [[]] : next;
    });
  };

  /** 「次の立ちへ」— 最大的人数に達していなくても、ここから次の立ちのチーム編成に進む */
  const appendNextRoundMarker = () => {
    if (!canAppendNextRound) return;
    setLineupTeams((prev) => {
      if (prev.length === 0) return [[]];
      return [...prev, []];
    });
  };

  const roundPacking = useMemo(() => computeRoundPacking(lineupTeams, maxMato), [lineupTeams, maxMato]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4 text-sm text-zinc-600">
        <span>
          最大的数: <strong className="text-zinc-900">{maxMato}</strong>
        </span>
        <span>
          配置済: <strong className="text-zinc-900">{flatIds.length}</strong> /{" "}
          {participatingMembers.length}人
        </span>
        {unassignedCount > 0 ? (
          <span className="text-amber-800">未配置 {unassignedCount}人</span>
        ) : (
          <span className="text-emerald-700">全員配置済み</span>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3 rounded-lg border border-zinc-200 bg-zinc-50/80 p-3">
          <p className="text-xs font-semibold text-zinc-700">チーム人数（次に追加するチームへの詰め込み人数）</p>
          <div className="flex flex-wrap gap-1">
            {[1, 2, 3, 4, 5, 6].map((sz) => (
              <button
                key={sz}
                type="button"
                onClick={() => onTeamSizeChange(sz)}
                className={`rounded-full border px-3 py-1 text-xs font-medium ${
                  teamSize === sz
                    ? "border-indigo-600 bg-indigo-600 text-white"
                    : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
                }`}
              >
                {sz}人
              </button>
            ))}
          </div>
          <button
            type="button"
            disabled={!canAppendNextRound}
            className="w-full rounded-md border border-indigo-300 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-900 hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={appendNextRoundMarker}
          >
            次の立ちへ
          </button>
          <p className="text-xs leading-relaxed text-zinc-500">
            現在の立ちにいる人数が最大的数（{maxMato}的）に達すると、次の立ちの区切りが自動で入ります。それより前に立ちを分けたいときだけ「次の立ちへ」を押してください。
          </p>

          <div>
            <p className="mb-1 text-xs font-semibold text-zinc-700">立ち構成プレビュー</p>
            <div className="max-h-48 space-y-1 overflow-y-auto text-xs">
              {roundPacking.map((rd, ri) => (
                <div key={ri} className="rounded border border-zinc-200 bg-white px-2 py-1.5">
                  <span className="font-semibold text-indigo-900">
                    第{ri + 1}立ち ({rd.count}/{maxMato}的)
                  </span>
                  {rd.teams.map((t, ti) => (
                    <div key={ti} className="text-zinc-600">
                      チーム: {t.length}人
                    </div>
                  ))}
                  {rd.rem > 0 ? <div className="text-amber-800">余り {rd.rem}的</div> : null}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-3 rounded-lg border border-zinc-200 bg-zinc-50/80 p-3">
          <p className="text-xs font-semibold text-zinc-700">候補（{candidates.length}人）</p>
          <div className="mb-2 flex flex-wrap gap-1">
            {(
              [
                ["all", "全員"],
                ["男", "男子"],
                ["女", "女子"],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setCandidateGender(k)}
                className={`rounded-full border px-2 py-0.5 text-xs ${
                  candidateGender === k
                    ? "border-indigo-600 bg-indigo-600 text-white"
                    : "border-zinc-300 bg-white text-zinc-600"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="max-h-64 space-y-1 overflow-y-auto">
            {candidates.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => addToLineup(m.id)}
                className="flex w-full items-center gap-2 rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-left text-sm hover:bg-zinc-50"
              >
                <span className={m.gender === "女" ? "text-rose-600" : "text-sky-700"}>
                  {m.gender === "女" ? "女" : m.gender === "男" ? "男" : "—"}
                </span>
                <span className="font-medium text-zinc-900">{m.name}</span>
                <span className="ml-auto text-xs text-zinc-500">{m.gradeYear || "—"}</span>
              </button>
            ))}
            {candidates.length === 0 ? (
              <p className="text-xs text-zinc-500">全員配置済みです</p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white p-3">
        <p className="mb-2 text-xs font-semibold text-zinc-700">部員プレビュー</p>
        <div className="flex flex-col gap-3">
          {(() => {
            let teamOrdinal = 0;
            return lineupTeams.map((team, ti) => {
              if (team.length === 0) {
                const rn = roundNumberAfterMarker(lineupTeams, ti);
                return (
                  <div
                    key={`round-break-${ti}`}
                    className="rounded border border-dashed border-indigo-200 bg-indigo-50/50 py-2 text-center text-xs font-medium text-indigo-900"
                  >
                    第{rn}立ち
                  </div>
                );
              }
              teamOrdinal += 1;
              return (
                <div key={`team-${ti}`} className="rounded-md border border-zinc-200 bg-zinc-50">
                  <div className="flex justify-between border-b border-zinc-200 bg-zinc-100 px-2 py-1 text-xs font-semibold text-zinc-800">
                    <span>チーム {teamOrdinal}</span>
                    <span>
                      {team.length}/{teamSize}人
                    </span>
                  </div>
                  <div className="divide-y divide-zinc-100">
                    {team.map((mid) => {
                      const m = memberMap.get(mid);
                      return (
                        <div key={mid} className="flex items-center gap-2 px-2 py-1.5 text-sm">
                          <span className={m?.gender === "女" ? "text-rose-600" : "text-sky-700"}>
                            {m?.gender === "女" ? "女" : m?.gender === "男" ? "男" : "—"}
                          </span>
                          <span className="font-medium">{m?.name ?? mid}</span>
                          <button
                            type="button"
                            className="ml-auto text-xs text-red-700 hover:underline"
                            onClick={() => removeFromLineup(mid)}
                          >
                            外す
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            });
          })()}
        </div>
      </div>
    </div>
  );
}
