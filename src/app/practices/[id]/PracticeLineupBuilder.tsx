"use client";

import { computeRoundPacking } from "@/lib/practiceRoundPacking";
import { uiBtnSmDanger, uiBtnSmMuted, uiBtnSmSecondary, uiPill, uiPillSm } from "@/lib/uiButtons";
import { lineupTeamInfoOptionsForTeam, roundNumberAfterMarker, sanitizeLineupTeamSizes } from "@/lib/practiceSessionPlan";
import { useMemo, useState, type Dispatch, type SetStateAction } from "react";

export type LineMember = { id: string; name: string; gender: string; gradeYear: string };

/** 末尾から見て最後の [] より後ろのチーム人数設定合計（現在の立ちの予定人数） */
function targetCountInTailSegment(teams: string[][], teamSizes: readonly number[], fallbackSize: number): number {
  let start = 0;
  for (let i = teams.length - 1; i >= 0; i--) {
    if (teams[i]!.length === 0) {
      start = i + 1;
      break;
    }
  }
  let n = 0;
  let teamInfoIndex = teams.slice(0, start).filter((team) => team.length > 0).length;
  for (let i = start; i < teams.length; i++) {
    const team = teams[i]!;
    if (team.length === 0) continue;
    n += teamSizes[teamInfoIndex] ?? Math.min(6, Math.max(1, fallbackSize));
    teamInfoIndex += 1;
  }
  return n;
}

type Props = {
  participatingMembers: LineMember[];
  teamSize: number;
  maxMato: number;
  lineupTeams: string[][];
  setLineupTeams: Dispatch<SetStateAction<string[][]>>;
  lineupTeamSizes: number[];
  setLineupTeamSizes: Dispatch<SetStateAction<number[]>>;
  lineupTeamInfos: string[];
  setLineupTeamInfos: Dispatch<SetStateAction<string[]>>;
  onTeamSizeChange: (n: number) => void;
};

export function PracticeLineupBuilder({
  participatingMembers,
  teamSize,
  maxMato,
  lineupTeams,
  setLineupTeams,
  lineupTeamSizes,
  setLineupTeamSizes,
  lineupTeamInfos,
  setLineupTeamInfos,
  onTeamSizeChange,
}: Props) {
  const [candidateGender, setCandidateGender] = useState<"all" | "男" | "女">("all");
  const [selectedTeamIndex, setSelectedTeamIndex] = useState<number | null>(null);

  const memberMap = useMemo(
    () => new Map(participatingMembers.map((m) => [m.id, m])),
    [participatingMembers],
  );

  const flatIds = useMemo(() => lineupTeams.flat(), [lineupTeams]);
  const normalizedTeamSizes = useMemo(
    () => sanitizeLineupTeamSizes(lineupTeams, lineupTeamSizes, teamSize),
    [lineupTeamSizes, lineupTeams, teamSize],
  );
  const nonEmptyTeamCount = normalizedTeamSizes.length;
  const activeSelectedTeamIndex =
    selectedTeamIndex !== null && selectedTeamIndex >= 0 && selectedTeamIndex < nonEmptyTeamCount
      ? selectedTeamIndex
      : null;
  const selectedTeamSize =
    activeSelectedTeamIndex === null ? teamSize : normalizedTeamSizes[activeSelectedTeamIndex] ?? teamSize;

  const candidates = useMemo(() => {
    let ms = participatingMembers.filter((m) => !flatIds.includes(m.id));
    if (candidateGender === "男") ms = ms.filter((m) => m.gender === "男");
    if (candidateGender === "女") ms = ms.filter((m) => m.gender === "女");
    return ms;
  }, [participatingMembers, flatIds, candidateGender]);

  const unassignedCount = participatingMembers.length - flatIds.length;

  const teamInfoIndexForLineupIndex = (teams: string[][], lineupIndex: number): number =>
    teams.slice(0, lineupIndex + 1).filter((team) => team.length > 0).length - 1;

  const lineupIndexForTeamInfoIndex = (teams: string[][], teamInfoIndex: number): number =>
    teams.findIndex((team, lineupIndex) => team.length > 0 && teamInfoIndexForLineupIndex(teams, lineupIndex) === teamInfoIndex);

  /** 末尾が立ち区切り [] のときは重ねない（次の立ちへは未入力のまま待つ） */
  const canAppendNextRound =
    lineupTeams.length === 0 || lineupTeams[lineupTeams.length - 1]!.length > 0;

  const addToLineup = (memberId: string) => {
    const copy = lineupTeams.map((t) => [...t]);
    const sizes = sanitizeLineupTeamSizes(copy, lineupTeamSizes, teamSize);
    const selectedLineupIndex =
      activeSelectedTeamIndex === null ? -1 : lineupIndexForTeamInfoIndex(copy, activeSelectedTeamIndex);

    if (activeSelectedTeamIndex !== null && selectedLineupIndex >= 0) {
      const selectedTeam = copy[selectedLineupIndex]!;
      const selectedSize = sizes[activeSelectedTeamIndex] ?? teamSize;
      if (selectedTeam.length < selectedSize) {
        copy[selectedLineupIndex] = [...selectedTeam, memberId];
        setLineupTeams(copy);
        if (copy[selectedLineupIndex]!.length >= selectedSize) setSelectedTeamIndex(null);
        return;
      }
      setSelectedTeamIndex(null);
    }

    const normalized = copy.length === 0 ? [[]] : copy;
    const tailCount = targetCountInTailSegment(normalized, sizes, teamSize);
    const lastTeam = normalized.length > 0 ? normalized[normalized.length - 1] : null;
    const shouldStartNextRound = tailCount + teamSize > maxMato && lastTeam && lastTeam.length > 0;
    const next =
      normalized.length === 0
        ? [[memberId]]
        : normalized[normalized.length - 1]!.length === 0
          ? [...normalized, [memberId]]
          : shouldStartNextRound
            ? [...normalized, [], [memberId]]
            : [...normalized, [memberId]];
    const nextTeamIndex = next.filter((team) => team.length > 0).length - 1;
    setLineupTeams(next);
    setLineupTeamSizes((prev) => {
      const out = sanitizeLineupTeamSizes(next, prev, teamSize);
      out[nextTeamIndex] = teamSize;
      return out;
    });
    setSelectedTeamIndex(teamSize <= 1 ? null : nextTeamIndex);
  };

  const removeFromLineup = (memberId: string) => {
    const teamIndex = lineupTeams.findIndex((team) => team.includes(memberId));
    const teamInfoIndex =
      teamIndex >= 0 ? lineupTeams.slice(0, teamIndex + 1).filter((team) => team.length > 0).length - 1 : -1;
    const removesTeam = teamIndex >= 0 && lineupTeams[teamIndex]!.length === 1;
    setLineupTeams((prev) => {
      const next = prev.map((t) => t.filter((id) => id !== memberId));
      while (next.length > 1 && next[next.length - 1]!.length === 0) next.pop();
      return next.length === 0 ? [[]] : next;
    });
    if (removesTeam && teamInfoIndex >= 0) {
      setLineupTeamInfos((prev) => prev.filter((_, idx) => idx !== teamInfoIndex));
      setLineupTeamSizes((prev) => prev.filter((_, idx) => idx !== teamInfoIndex));
      if (activeSelectedTeamIndex === teamInfoIndex) {
        setSelectedTeamIndex(null);
      } else if (activeSelectedTeamIndex !== null && activeSelectedTeamIndex > teamInfoIndex) {
        setSelectedTeamIndex(activeSelectedTeamIndex - 1);
      }
    }
  };

  const setTeamInfo = (teamInfoIndex: number, value: string) => {
    setLineupTeamInfos((prev) => {
      const next = [...prev];
      next[teamInfoIndex] = value;
      return next;
    });
  };

  const changeTeamSize = (size: number) => {
    if (activeSelectedTeamIndex === null) {
      onTeamSizeChange(size);
      return;
    }
    setLineupTeamSizes((prev) => {
      const next = sanitizeLineupTeamSizes(lineupTeams, prev, teamSize);
      const lineupIndex = lineupIndexForTeamInfoIndex(lineupTeams, activeSelectedTeamIndex);
      const memberCount = lineupIndex >= 0 ? lineupTeams[lineupIndex]!.length : 1;
      next[activeSelectedTeamIndex] = Math.min(6, Math.max(memberCount, size));
      return next;
    });
    const lineupIndex = lineupIndexForTeamInfoIndex(lineupTeams, activeSelectedTeamIndex);
    const memberCount = lineupIndex >= 0 ? lineupTeams[lineupIndex]!.length : 1;
    const nextSize = Math.min(6, Math.max(memberCount, size));
    if (lineupIndex >= 0) {
      const options = lineupTeamInfoOptionsForTeam(lineupTeams[lineupIndex]!, participatingMembers, nextSize);
      setLineupTeamInfos((prev) => {
        const next = [...prev];
        if (!options.includes(next[activeSelectedTeamIndex] ?? "")) next[activeSelectedTeamIndex] = "";
        return next;
      });
    }
    if (memberCount >= nextSize) setSelectedTeamIndex(null);
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
          <p className="text-xs font-semibold text-zinc-700">
            チーム人数
            {activeSelectedTeamIndex === null ? "（次に作るチーム）" : `（選択中: チーム ${activeSelectedTeamIndex + 1}）`}
          </p>
          <div className="flex flex-wrap gap-1">
            {[1, 2, 3, 4, 5, 6].map((sz) => (
              <button
                key={sz}
                type="button"
                onClick={() => changeTeamSize(sz)}
                className={uiPill(selectedTeamSize === sz)}
              >
                {sz}人
              </button>
            ))}
          </div>
          {activeSelectedTeamIndex !== null ? (
            <button
              type="button"
              className={`${uiBtnSmMuted} w-full justify-center`}
              onClick={() => setSelectedTeamIndex(null)}
            >
              チーム選択を解除
            </button>
          ) : null}
          <button
            type="button"
            disabled={!canAppendNextRound}
            className={`${uiBtnSmMuted} w-full justify-center disabled:cursor-not-allowed`}
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
                className={uiPillSm(candidateGender === k)}
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
                className={`${uiBtnSmSecondary} h-auto min-h-10 w-full justify-start py-2 text-left text-sm font-normal`}
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
          {lineupTeams.map((team, ti) => {
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
              const teamOrdinal = lineupTeams.slice(0, ti + 1).filter((row) => row.length > 0).length;
              const teamInfoIndex = teamOrdinal - 1;
              const targetTeamSize = normalizedTeamSizes[teamInfoIndex] ?? teamSize;
              const teamInfoOptions = lineupTeamInfoOptionsForTeam(team, participatingMembers, targetTeamSize);
              const selectedTeamInfo = teamInfoOptions.includes(lineupTeamInfos[teamInfoIndex] ?? "")
                ? lineupTeamInfos[teamInfoIndex]!
                : "";
              const selected = activeSelectedTeamIndex === teamInfoIndex;
              return (
                <div
                  key={`team-${ti}`}
                  className={`rounded-md border bg-zinc-50 ${selected ? "border-indigo-400 ring-2 ring-indigo-100" : "border-zinc-200"}`}
                >
                  <div className="flex flex-col gap-2 border-b border-zinc-200 bg-zinc-100 px-2 py-1.5 text-xs font-semibold text-zinc-800 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center justify-between gap-2 sm:justify-start">
                      <span>チーム {teamOrdinal}</span>
                      <span>
                        {team.length}/{targetTeamSize}人
                      </span>
                      <button
                        type="button"
                        className={selected ? uiPillSm(true) : uiPillSm(false)}
                        onClick={() => setSelectedTeamIndex(selected ? null : teamInfoIndex)}
                      >
                        {selected ? "選択中" : "選択"}
                      </button>
                    </div>
                    <label className="flex items-center gap-2 font-normal text-zinc-700">
                      <span className="shrink-0 text-xs font-semibold">チーム情報</span>
                      <select
                        className="min-w-0 rounded border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-900"
                        value={selectedTeamInfo}
                        onChange={(e) => setTeamInfo(teamInfoIndex, e.target.value)}
                      >
                        <option value="">-</option>
                        {teamInfoOptions.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </label>
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
                            className={`${uiBtnSmDanger} ml-auto shrink-0`}
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
            })}
        </div>
      </div>
    </div>
  );
}
