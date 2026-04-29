"use client";

import { formatPracticeDate } from "@/lib/format";
import {
  buildGridFromOrdered,
  cellKey,
  gridsEqual,
  initialSavedKeys,
  memberMarksHitsOverTotalSlots,
  slotsToMarks,
  type MarksMember,
  type MarksRecord,
  type Shot,
} from "@/lib/practiceMarksGrid";
import {
  buildSyntheticLineupWithRounds,
  isGenderScope,
  layoutBlocksToRoundSections,
  lineupToMarksLayoutBlocks,
  membersInGenderScope,
  orderedMemberIdsForMarks,
  parseAttendanceJson,
  parseLineupTeamInfoJson,
  parseLineupTeamSizesJson,
  parseLineupTeamsJson,
  parseSubstitutionsJson,
  sanitizeLineupTeamInfos,
  sanitizeLineupTeamSizes,
  lineupMemberIdsSelfConsistent,
  validateLineupTeams,
  type GenderScope,
  type MemberForPractice,
  type PracticeSubstitution,
} from "@/lib/practiceSessionPlan";
import { uiBtnPrimary, uiBtnSecondary, uiBtnSmDanger, uiLinkChip } from "@/lib/uiButtons";
import AppLink from "@/components/AppLink";
import { useGlobalBusy } from "@/components/GlobalBusyProvider";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

export type SessionMarksProps = {
  id: string;
  practiceDate: string;
  memo: string;
  roundCount: number;
  sessionKind: string;
  genderScope: string;
  attendanceJson: string;
  lineupTeamsJson: string;
  lineupTeamSizesJson: string;
  lineupTeamInfoJson: string;
  substitutionsJson: string;
  /** チーム編成未保存時の仮チーム人数（1〜6） */
  teamSize: number;
  /** 仮の立ち区切りに使う最大的数（チーム編成と同じ） */
  maxMato: number;
};

type Props = {
  session: SessionMarksProps;
  members: MemberForPractice[];
  records: MarksRecord[];
  isAdmin: boolean;
};

const EMPTY_SHOTS: Shot[] = [null, null, null, null];

/** 名前列・各「立目」4マス列の幅をチーム見出しと揃える */
const MARKS_NAME_COL_CLASS =
  "sticky left-0 z-10 min-w-0 max-w-[11rem] shrink-0 basis-[min(10rem,40vw)] border-r py-1 pl-1 pr-2";

/** 交代表示セル（各立目の前に常設） */
const MARKS_SUB_CELL_CLASS = "w-[1.45rem] shrink-0 sm:w-[1.55rem]";

/** 1立目ぶんの的中マス幅（4射） */
const MARKS_SHOTS_BLOCK_CLASS = "w-[7.5rem] shrink-0 sm:w-[8.25rem]";

/** 交代セル＋的中マスを合わせた1立目ぶんの幅 */
const MARKS_ROUND_BLOCK_CLASS = "w-[8.95rem] shrink-0 sm:w-[9.8rem]";

/** 右端の合計列の幅（見出し・データで共通） */
const MARKS_TOTAL_COL_CLASS =
  "flex w-[4.75rem] shrink-0 flex-col items-center justify-center px-0.5 py-0.5 text-center sm:w-[5.25rem]";

/** チーム見出し・未割当見出しで、下の的中マスと同じ位置に「1立目」…を並べる */
function MarksRoundLabelsStrip({ rounds }: { rounds: number[] }) {
  return (
    <div className="flex shrink-0 items-center justify-start">
      <div className="inline-flex flex-nowrap items-center justify-start gap-0">
        {rounds.map((r) => (
          <div
            key={r}
            className={`flex items-center justify-center text-center text-xs font-bold leading-tight text-zinc-900 ${MARKS_ROUND_BLOCK_CLASS} ${
              r > 1 ? "border-l-2 border-l-zinc-700" : ""
            }`}
          >
            {r}立目
          </div>
        ))}
      </div>
    </div>
  );
}

/** 1立目あたり4マスをエクセル風の連続セルに。立目の境は左に太線（2立目以降） */
function MarksRoundShotGrid({
  roundIndex,
  slots,
  isAdmin,
  onCycle,
}: {
  roundIndex: number;
  slots: Shot[];
  isAdmin: boolean;
  onCycle: (shotIdx: number) => void;
}) {
  const sizing = MARKS_SHOTS_BLOCK_CLASS;
  const frame =
    roundIndex > 1
      ? `inline-grid ${sizing} grid-cols-4 border-t border-b border-r border-zinc-500 border-l-2 border-l-zinc-700`
      : `inline-grid ${sizing} grid-cols-4 border border-zinc-500`;
  return (
    <div className={frame}>
      {slots.map((shot, idx) => (
        <button
          key={idx}
          type="button"
          disabled={!isAdmin}
          onClick={() => onCycle(idx)}
          className={`flex min-h-8 w-full min-w-0 items-center justify-center rounded-none border-r border-zinc-400 bg-white text-xs leading-none text-zinc-900 last:border-r-0 sm:min-h-9 sm:text-sm ${
            isAdmin
              ? "cursor-pointer hover:bg-sky-50 active:bg-sky-100 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-0"
              : "cursor-default bg-zinc-50 text-zinc-600"
          }`}
          aria-label={`${roundIndex}立目 第${idx + 1}射`}
        >
          {shot === null ? "・" : shot === "o" ? "〇" : "×"}
        </button>
      ))}
    </div>
  );
}

/** 見出し行の右端（合計列の位置合わせ用・中身なし） */
function MarksTotalsHeaderSpacer({ tone }: { tone: "zinc" | "amber" }) {
  const skin =
    tone === "amber" ? "border-l border-amber-300/80 bg-amber-100/50" : "border-l border-zinc-400 bg-zinc-200/90";
  return <div className={`${MARKS_TOTAL_COL_CLASS} min-h-8 ${skin}`} aria-hidden />;
}

function splitDisplayName(name: string): { familyName: string; givenInitial: string } {
  const [familyName = name, givenName = ""] = name.trim().split(/\s+/, 2);
  return { familyName, givenInitial: givenName.charAt(0) };
}

function shotsHaveMarks(slots: Shot[] | undefined): boolean {
  return !!slots && slots.some((shot) => shot !== null);
}

function SubstitutionNameMarker({
  name,
  showGivenInitial,
}: {
  name: string | null;
  showGivenInitial: boolean;
}) {
  if (!name) {
    return <div className={`${MARKS_SUB_CELL_CLASS} min-h-8 border-l border-zinc-200 bg-white sm:min-h-9`} aria-hidden />;
  }
  const sub = splitDisplayName(name);
  const needsInitial = showGivenInitial && sub.givenInitial.length > 0;
  const displayChars = [...Array.from(sub.familyName), ...(needsInitial ? [`(${sub.givenInitial})`] : [])];
  const markerWidthRem = Math.min(2.15, Math.max(1.05, 0.46 * displayChars.length + 0.34));
  const mainFontRem = Math.max(0.52, Math.min(0.72, 2.15 / displayChars.length));
  const initialFontRem = Math.max(0.46, mainFontRem * 0.82);
  return (
    <div
      className="flex min-h-8 shrink-0 items-stretch justify-center border-l-2 border-l-indigo-700 bg-indigo-50 px-0 text-center font-bold leading-none text-indigo-900 sm:min-h-9"
      style={{ width: `${markerWidthRem}rem` }}
    >
      <span
        className="grid h-full w-full items-center justify-items-center"
        style={{ gridTemplateRows: `repeat(${displayChars.length}, minmax(0, 1fr))` }}
      >
        {displayChars.map((char, idx) => (
          <span
            key={`${char}-${idx}`}
            className="block w-full text-center leading-none"
            style={{ fontSize: `${char.startsWith("(") ? initialFontRem : mainFontRem}rem` }}
          >
            {char}
          </span>
        ))}
      </span>
    </div>
  );
}

/** 部員行の右端 〇の数／記録した射数（・は中抜け） */
function MarksMemberTotalsCell({
  memberId,
  rounds,
  grid,
  variant,
}: {
  memberId: string;
  rounds: number[];
  grid: Record<string, Shot[]>;
  variant: "zinc" | "amber";
}) {
  const totals = rounds.reduce(
    (sum, roundIndex) => {
      const roundTotals = memberMarksHitsOverTotalSlots(memberId, 1, {
        [cellKey(memberId, 1)]: grid[cellKey(memberId, roundIndex)] ?? [null, null, null, null],
      });
      return { hits: sum.hits + roundTotals.hits, totalSlots: sum.totalSlots + roundTotals.totalSlots };
    },
    { hits: 0, totalSlots: 0 },
  );
  const borderL = variant === "amber" ? "border-l border-amber-200/90" : "border-l border-zinc-300";
  return (
    <div className={`${MARKS_TOTAL_COL_CLASS} bg-white ${borderL}`}>
      <span className="text-sm font-semibold tabular-nums text-zinc-900">
        {totals.hits}/{totals.totalSlots}
      </span>
    </div>
  );
}

/** 名前列＋立目ブロックをチーム枠内で中央寄せ */
function MarksMemberMarksRow({
  memberId,
  label,
  rounds,
  grid,
  isAdmin,
  cycle,
  variant,
  substitutionMarkerNameForRound,
  shouldShowGivenInitial,
  hideTopBorder,
}: {
  memberId: string;
  label: ReactNode;
  rounds: number[];
  grid: Record<string, Shot[]>;
  isAdmin: boolean;
  cycle: (memberId: string, roundIndex: number, shotIdx: number) => void;
  variant: "zinc" | "amber";
  substitutionMarkerNameForRound: (memberId: string, roundIndex: number) => string | null;
  shouldShowGivenInitial: (name: string) => boolean;
  hideTopBorder?: boolean;
}) {
  const rowBorder =
    hideTopBorder ? "" : variant === "amber" ? "border-t border-amber-100" : "border-t border-zinc-200";
  const nameBorder = variant === "amber" ? "border-amber-200/90" : "border-zinc-300";
  return (
    <div className={`flex w-max min-w-full gap-0 bg-white px-1 py-1 ${rowBorder}`}>
      <div className={`${MARKS_NAME_COL_CLASS} bg-white font-medium text-zinc-900 ${nameBorder}`}>{label}</div>
      <div className="flex shrink-0 items-center justify-start">
        <div className="inline-flex flex-nowrap items-stretch justify-start gap-0">
          {rounds.map((r) => {
            const markerName = substitutionMarkerNameForRound(memberId, r);
            const slots = grid[cellKey(memberId, r)] ?? [null, null, null, null];
            return (
              <div key={r} className={`${MARKS_ROUND_BLOCK_CLASS} inline-flex items-stretch`}>
                <SubstitutionNameMarker name={markerName} showGivenInitial={markerName ? shouldShowGivenInitial(markerName) : false} />
                <MarksRoundShotGrid
                  roundIndex={r}
                  slots={slots}
                  isAdmin={isAdmin}
                  onCycle={(idx) => cycle(memberId, r, idx)}
                />
              </div>
            );
          })}
        </div>
      </div>
      <MarksMemberTotalsCell
        memberId={memberId}
        rounds={rounds}
        grid={grid}
        variant={variant}
      />
    </div>
  );
}

/** 的中入力（別ページ用） */
export function PracticeMarksEditor({ session, members, records, isAdmin }: Props) {
  const { refresh, runBlocking, isBusy } = useGlobalBusy();

  const sessionGenderScope: GenderScope = isGenderScope(session.genderScope) ? session.genderScope : "all";
  // JSON パース結果は毎レンダーで新参照になるため useMemo で安定化（useEffect 無限ループ防止）
  const attendance = useMemo(
    () => parseAttendanceJson(session.attendanceJson),
    [session.attendanceJson],
  );
  const lineupTeamsRaw = useMemo(() => parseLineupTeamsJson(session.lineupTeamsJson), [session.lineupTeamsJson]);
  const lineupTeamInfos = useMemo(
    () =>
      sanitizeLineupTeamInfos(
        lineupTeamsRaw,
        parseLineupTeamInfoJson(session.lineupTeamInfoJson),
        members,
        sanitizeLineupTeamSizes(lineupTeamsRaw, parseLineupTeamSizesJson(session.lineupTeamSizesJson), session.teamSize),
      ),
    [lineupTeamsRaw, members, session.lineupTeamInfoJson, session.lineupTeamSizesJson, session.teamSize],
  );
  const serverSubstitutions = useMemo(
    () => parseSubstitutionsJson(session.substitutionsJson).filter((s) => s.roundIndex <= session.roundCount),
    [session.substitutionsJson, session.roundCount],
  );

  const inScopeMembers = useMemo(
    () => membersInGenderScope(members, sessionGenderScope),
    [members, sessionGenderScope],
  );

  const participatingMembers = useMemo(
    () => inScopeMembers.filter((m) => attendance[m.id] !== "absent"),
    [inScopeMembers, attendance],
  );

  const attendingSet = useMemo(() => new Set(participatingMembers.map((m) => m.id)), [participatingMembers]);

  const hasSavedLineupTeams = useMemo(() => lineupTeamsRaw.some((t) => t.length > 0), [lineupTeamsRaw]);

  /** 出席者がチームに全員ちょうど一度ずつ（API 保存と同条件） */
  const lineupFullyValid = useMemo(() => {
    if (!hasSavedLineupTeams) return false;
    return validateLineupTeams(lineupTeamsRaw, attendingSet) === null;
  }, [hasSavedLineupTeams, lineupTeamsRaw, attendingSet]);

  /**
   * 的中表の区切りに使うチーム配列。
   * 保存済みで ID が妥当ならそれを使い、未保存（[] のみ）なら出席者を teamSize 人ずつの仮チームにする。
   */
  const displayLineupForPreview = useMemo(() => {
    if (hasSavedLineupTeams && lineupMemberIdsSelfConsistent(lineupTeamsRaw, attendingSet)) {
      return lineupTeamsRaw;
    }
    if (!hasSavedLineupTeams && participatingMembers.length > 0) {
      const syn = buildSyntheticLineupWithRounds(participatingMembers, session.teamSize, session.maxMato);
      return syn.length > 0 ? syn : null;
    }
    return null;
  }, [
    hasSavedLineupTeams,
    lineupTeamsRaw,
    attendingSet,
    participatingMembers,
    session.teamSize,
    session.maxMato,
  ]);

  const isSyntheticLineupPreview = !hasSavedLineupTeams && displayLineupForPreview !== null;

  const layoutBlocks = useMemo(() => {
    if (!displayLineupForPreview) return null;
    return lineupToMarksLayoutBlocks(displayLineupForPreview);
  }, [displayLineupForPreview]);

  const roundSections = useMemo(() => {
    if (!layoutBlocks || !displayLineupForPreview) return null;
    return layoutBlocksToRoundSections(layoutBlocks, displayLineupForPreview);
  }, [layoutBlocks, displayLineupForPreview]);

  const lineupMemberIdSet = useMemo(
    () => new Set(displayLineupForPreview?.flat() ?? []),
    [displayLineupForPreview],
  );

  const orderedIds = useMemo(
    () =>
      orderedMemberIdsForMarks({
        members,
        genderScope: sessionGenderScope,
        attendance,
        lineupTeams: displayLineupForPreview ?? [],
      }),
    [members, sessionGenderScope, attendance, displayLineupForPreview],
  );

  const orderedMembers: MarksMember[] = useMemo(
    () => orderedIds.map((id) => members.find((m) => m.id === id)).filter((m): m is MarksMember => !!m),
    [orderedIds, members],
  );

  const memberById = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);
  const duplicateFamilyNames = useMemo(() => {
    const counts = new Map<string, number>();
    for (const m of members) {
      const familyName = splitDisplayName(m.name).familyName;
      counts.set(familyName, (counts.get(familyName) ?? 0) + 1);
    }
    return new Set([...counts.entries()].filter(([, count]) => count > 1).map(([familyName]) => familyName));
  }, [members]);
  const shouldShowGivenInitial = useCallback(
    (name: string) => duplicateFamilyNames.has(splitDisplayName(name).familyName),
    [duplicateFamilyNames],
  );

  const membersNotInLineupTeams = useMemo(
    () => orderedMembers.filter((m) => !lineupMemberIdSet.has(m.id)),
    [orderedMembers, lineupMemberIdSet],
  );

  const rounds = useMemo(() => Array.from({ length: session.roundCount }, (_, i) => i + 1), [session.roundCount]);
  const recordsResetKey = useMemo(
    () => JSON.stringify({ orderedIds, roundCount: session.roundCount, records }),
    [orderedIds, records, session.roundCount],
  );

  const [grid, setGrid] = useState<Record<string, Shot[]>>(() =>
    buildGridFromOrdered(orderedMembers, session.roundCount, records),
  );
  const [savedKeys, setSavedKeys] = useState<Set<string>>(() => initialSavedKeys(records));
  const [substitutions, setSubstitutions] = useState<PracticeSubstitution[]>(serverSubstitutions);
  const [substitutionDialogOpen, setSubstitutionDialogOpen] = useState(false);
  const [subRoundIndex, setSubRoundIndex] = useState(1);
  const [subOutMemberId, setSubOutMemberId] = useState("");
  const [subInMemberId, setSubInMemberId] = useState("");
  const [substitutionMsg, setSubstitutionMsg] = useState<string | null>(null);
  const [marksMsg, setMarksMsg] = useState<string | null>(null);

  useEffect(() => {
    setSubstitutions(serverSubstitutions);
  }, [serverSubstitutions]);

  const slotOccupantsForRound = useCallback(
    (roundIndex: number, extraMemberIds: readonly string[] = []): Map<string, string> => {
      const slotIds = new Set(orderedMembers.map((m) => m.id));
      for (const sub of substitutions) {
        slotIds.add(sub.outMemberId);
        slotIds.add(sub.inMemberId);
      }
      for (const id of extraMemberIds) slotIds.add(id);
      const slotOccupants = new Map([...slotIds].map((id) => [id, id]));

      for (const sub of substitutions) {
        if (roundIndex < sub.roundIndex) continue;
        const outMemberId = slotOccupants.get(sub.outMemberId) ?? sub.outMemberId;
        const inMemberId = slotOccupants.get(sub.inMemberId) ?? sub.inMemberId;
        slotOccupants.set(sub.outMemberId, inMemberId);
        slotOccupants.set(sub.inMemberId, outMemberId);
      }
      return slotOccupants;
    },
    [orderedMembers, substitutions],
  );

  const effectiveMemberIdForRound = useCallback(
    (memberId: string, roundIndex: number): string => slotOccupantsForRound(roundIndex, [memberId]).get(memberId) ?? memberId,
    [slotOccupantsForRound],
  );

  const buildMarksGrid = useCallback(
    (sourceRecords: MarksRecord[]): Record<string, Shot[]> => {
      const nextGrid = buildGridFromOrdered(orderedMembers, session.roundCount, sourceRecords);

      // 以前の実装では交代後メンバーIDへ的中を保存していたため、
      // 元の行が空ならその記録を表示だけ救済する（保存時の自動クリアはしない）。
      for (const m of orderedMembers) {
        for (let r = 1; r <= session.roundCount; r++) {
          const ownKey = cellKey(m.id, r);
          if (shotsHaveMarks(nextGrid[ownKey])) continue;
          const effectiveMemberId = effectiveMemberIdForRound(m.id, r);
          if (effectiveMemberId === m.id) continue;
          const fallbackKey = cellKey(effectiveMemberId, r);
          if (shotsHaveMarks(nextGrid[fallbackKey])) {
            nextGrid[ownKey] = [...(nextGrid[fallbackKey] ?? EMPTY_SHOTS)];
          }
        }
      }

      return nextGrid;
    },
    [effectiveMemberIdForRound, orderedMembers, session.roundCount],
  );
  const latestRecordsRef = useRef(records);
  const latestBuildMarksGridRef = useRef(buildMarksGrid);

  const serverGrid = useMemo(() => buildMarksGrid(records), [buildMarksGrid, records]);

  const marksDirty = useMemo(() => !gridsEqual(grid, serverGrid), [grid, serverGrid]);

  useEffect(() => {
    latestRecordsRef.current = records;
    latestBuildMarksGridRef.current = buildMarksGrid;
  }, [buildMarksGrid, records]);

  useEffect(() => {
    const latestRecords = latestRecordsRef.current;
    setGrid(latestBuildMarksGridRef.current(latestRecords));
    setSavedKeys(initialSavedKeys(latestRecords));
    // 交代だけの変更では、保存前の的中入力を保持する。
  }, [recordsResetKey]);

  const substitutionMarkerNameForRound = useCallback(
    (memberId: string, roundIndex: number): string | null => {
      const current = effectiveMemberIdForRound(memberId, roundIndex);
      const prev = roundIndex > 1 ? effectiveMemberIdForRound(memberId, roundIndex - 1) : memberId;
      if (current === prev) return null;
      return memberById.get(current)?.name ?? current;
    },
    [effectiveMemberIdForRound, memberById],
  );

  const substitutionSummariesForMember = useCallback(
    (memberId: string): string[] => {
      const summaries: string[] = [];
      let prevMemberId = memberId;
      for (const roundIndex of rounds) {
        const currentMemberId = effectiveMemberIdForRound(memberId, roundIndex);
        if (currentMemberId === prevMemberId) continue;
        summaries.push(`${roundIndex}立目〜 ${memberById.get(currentMemberId)?.name ?? currentMemberId}`);
        prevMemberId = currentMemberId;
      }
      return summaries;
    },
    [effectiveMemberIdForRound, memberById, rounds],
  );

  const memberLabel = useCallback(
    (m: MarksMember): ReactNode => {
      const summaries = substitutionSummariesForMember(m.id);
      return (
        <>
          <span className="mr-1 text-xs text-zinc-500">
            {m.gender === "女" ? "女" : m.gender === "男" ? "男" : ""}
          </span>
          <span>{m.name}</span>
          {summaries.length > 0 ? (
            <span className="mt-0.5 block text-[0.68rem] font-normal leading-tight text-indigo-700">
              {summaries.map((summary) => (
                <span key={summary} className="block">
                  {summary}
                </span>
              ))}
            </span>
          ) : null}
        </>
      );
    },
    [substitutionSummariesForMember],
  );

  const replacementCandidates = useMemo(() => {
    if (session.sessionKind === "match") return membersNotInLineupTeams;
    return participatingMembers;
  }, [membersNotInLineupTeams, participatingMembers, session.sessionKind]);

  const substitutionOutCandidates = useMemo(() => {
    if (session.sessionKind === "match") {
      return orderedMembers.filter((m) => lineupMemberIdSet.has(m.id));
    }
    return orderedMembers;
  }, [lineupMemberIdSet, orderedMembers, session.sessionKind]);

  const openSubstitutionDialog = () => {
    if (!isAdmin || isBusy || substitutionOutCandidates.length === 0) return;
    const firstOut = substitutionOutCandidates[0]?.id ?? "";
    const firstIn = replacementCandidates.find((m) => m.id !== firstOut)?.id ?? "";
    setSubRoundIndex(1);
    setSubOutMemberId(firstOut);
    setSubInMemberId(firstIn);
    setSubstitutionMsg(null);
    setSubstitutionDialogOpen(true);
  };

  const saveSubstitutionsToServer = async (next: PracticeSubstitution[]): Promise<boolean> => {
    setSubstitutionMsg(null);
    return runBlocking(async () => {
      const res = await fetch(`/api/practices/${session.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ substitutions: next }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setSubstitutionMsg(data.error ?? "交代の保存に失敗しました");
        return false;
      }
      setSubstitutions(next);
      return true;
    });
  };

  const addSubstitution = async () => {
    if (!isAdmin) return;
    const roundIndex = Math.floor(subRoundIndex);
    if (roundIndex < 1 || roundIndex > session.roundCount) {
      setSubstitutionMsg("立目を選んでください");
      return;
    }
    if (!subOutMemberId || !subInMemberId || subOutMemberId === subInMemberId) {
      setSubstitutionMsg("交代する2人を選んでください");
      return;
    }
    const previousRoundIndex = Math.max(0, roundIndex - 1);
    const extraMemberIds = [subOutMemberId, subInMemberId];
    const beforeRoundOccupants = slotOccupantsForRound(previousRoundIndex, extraMemberIds);
    const currentRoundOccupants = slotOccupantsForRound(roundIndex, extraMemberIds);
    const slotIds = [...currentRoundOccupants.keys()];
    const outSlotMemberId = slotIds.find((id) => currentRoundOccupants.get(id) === subOutMemberId) ?? subOutMemberId;
    const inSlotMemberId = slotIds.find((id) => currentRoundOccupants.get(id) === subInMemberId) ?? subInMemberId;
    if (outSlotMemberId === inSlotMemberId) {
      setSubstitutionMsg("交代する2人を選んでください");
      return;
    }
    const desiredRoundOccupants = new Map(currentRoundOccupants);
    desiredRoundOccupants.set(outSlotMemberId, currentRoundOccupants.get(inSlotMemberId) ?? inSlotMemberId);
    desiredRoundOccupants.set(inSlotMemberId, currentRoundOccupants.get(outSlotMemberId) ?? outSlotMemberId);

    const workingOccupants = new Map(beforeRoundOccupants);
    const nextSameRoundSubstitutions: PracticeSubstitution[] = [];
    for (const slotId of slotIds) {
      const wantedMemberId = desiredRoundOccupants.get(slotId) ?? slotId;
      if ((workingOccupants.get(slotId) ?? slotId) === wantedMemberId) continue;
      const swapSlotId = slotIds.find((id) => (workingOccupants.get(id) ?? id) === wantedMemberId);
      if (!swapSlotId) continue;
      const currentMemberId = workingOccupants.get(slotId) ?? slotId;
      const swapMemberId = workingOccupants.get(swapSlotId) ?? swapSlotId;
      nextSameRoundSubstitutions.push({ roundIndex, outMemberId: slotId, inMemberId: swapSlotId });
      workingOccupants.set(slotId, swapMemberId);
      workingOccupants.set(swapSlotId, currentMemberId);
    }

    const next = [
      ...substitutions.filter((s) => s.roundIndex !== roundIndex),
      ...nextSameRoundSubstitutions,
    ].sort((a, b) => a.roundIndex - b.roundIndex);
    const ok = await saveSubstitutionsToServer(next);
    if (ok) setSubstitutionDialogOpen(false);
  };

  const removeSubstitution = async (target: PracticeSubstitution) => {
    if (!isAdmin || isBusy) return;
    const next = substitutions.filter(
      (s) =>
        !(
          s.roundIndex === target.roundIndex &&
          s.outMemberId === target.outMemberId &&
          s.inMemberId === target.inMemberId
        ),
    );
    await saveSubstitutionsToServer(next);
  };

  useEffect(() => {
    if (!isAdmin || !marksDirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isAdmin, marksDirty]);

  const cycle = useCallback(
    (memberId: string, roundIndex: number, shotIndex: number) => {
      if (!isAdmin) return;
      const k = cellKey(memberId, roundIndex);
      setGrid((prev) => {
        const next = { ...prev };
        const row = [...(next[k] ?? [null, null, null, null])];
        const cur = row[shotIndex];
        row[shotIndex] = cur === null ? "o" : cur === "o" ? "x" : null;
        next[k] = row;
        return next;
      });
    },
    [isAdmin],
  );

  const saveMarks = async () => {
    if (!isAdmin) return;
    setMarksMsg(null);

    const items: { memberId: string; roundIndex: number; marks: string }[] = [];
    const clears: { memberId: string; roundIndex: number }[] = [];

    for (const m of orderedMembers) {
      for (let r = 1; r <= session.roundCount; r++) {
        const k = cellKey(m.id, r);
        const slots = grid[k] ?? [null, null, null, null];
        const marks = slotsToMarks(slots);
        const had = savedKeys.has(k);
        if (marks) items.push({ memberId: m.id, roundIndex: r, marks });
        else if (had) clears.push({ memberId: m.id, roundIndex: r });
      }
    }

    await runBlocking(async () => {
      const res = await fetch(`/api/practices/${session.id}/records`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items, clears }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setMarksMsg(data.error ?? "保存に失敗しました");
        return;
      }
      refresh();
    });
  };

  const useLineupPreviewLayout =
    displayLineupForPreview !== null &&
    layoutBlocks !== null &&
    layoutBlocks.length > 0 &&
    roundSections !== null &&
    roundSections.length > 0;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap gap-2">
            <AppLink className={uiLinkChip} href={`/practices/${session.id}`}>
              ← 参加区分・出席
            </AppLink>
            <AppLink className={uiLinkChip} href={`/practices/${session.id}/lineup`}>
              チーム編成
            </AppLink>
            <AppLink className={uiLinkChip} href="/practices">
              一覧へ
            </AppLink>
          </div>
          <h1 className="mt-2 text-2xl font-bold">{formatPracticeDate(session.practiceDate)}</h1>
          <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-600">メモ: {session.memo || "—"}</p>
        </div>
      </div>

      {isAdmin && marksDirty ? (
        <div
          role="status"
          className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950"
        >
          未保存の的中があります。離れる前に「記録を保存」を押してください。
        </div>
      ) : null}

      <section className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold">的中（1立ち＝4射・〇×）</h2>
          {isAdmin ? (
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <button
                type="button"
                disabled={isBusy}
                className={`${uiBtnSecondary} w-full shrink-0 justify-center sm:w-auto`}
                onClick={openSubstitutionDialog}
              >
                交代
              </button>
              <button
                type="button"
                disabled={isBusy}
                className={`${uiBtnPrimary} w-full shrink-0 justify-center sm:w-auto`}
                onClick={() => void saveMarks()}
              >
                記録を保存
              </button>
            </div>
          ) : null}
        </div>
        {marksMsg ? <p className="text-sm text-red-700">{marksMsg}</p> : null}
        <p className="text-sm text-zinc-600">
          {useLineupPreviewLayout
            ? isSyntheticLineupPreview
              ? `チーム編成が未保存のため、出席者を「チーム人数（${session.teamSize}人）」と「最大的数（${session.maxMato}的）」に沿った仮の立ち・チームで区切っています。チーム編成を保存すると保存どおりの並びに切り替わります。各マスは「・ → 〇 → × → ・」の順で切り替わります。「・」は中抜けとして分母から除外されます。`
              : lineupFullyValid
                ? "並びと区切りはチーム編成の部員プレビューと同じです。各マスは「・ → 〇 → × → ・」の順で切り替わります。「・」は中抜けとして分母から除外されます。"
                : "チーム編成に一部の出席者のみが入っています。チームに入っている人は第〇立ち・チーム順で、その他は下の「チーム未割当」に続きます。各マスは「・ → 〇 → × → ・」の順で切り替わります。「・」は中抜けとして分母から除外されます。"
            : "チームに対象外の ID が含まれるなど、区切り表示に使えないチームデータのときは、出席者を学年・男女・名前順の1列で表示します。各マスは「・ → 〇 → × → ・」の順で切り替わります。「・」は中抜けとして分母から除外されます。"}
        </p>

        <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm">
          {orderedMembers.length === 0 ? (
            <p className="px-4 py-6 text-sm text-zinc-500">出席者がいません。参加区分・出席を確認してください。</p>
          ) : useLineupPreviewLayout && roundSections ? (
            <div className="w-max min-w-full space-y-6 p-2 text-sm sm:p-3">
              {roundSections.map((sec, si) => (
                <div
                  key={`round-sec-${sec.roundLabel}-${si}`}
                  className="w-max min-w-full rounded-xl border-2 border-indigo-300/80 bg-gradient-to-b from-indigo-50/50 to-white p-3 shadow-sm ring-1 ring-indigo-100/80"
                >
                  <div className="mb-3 border-b-2 border-indigo-200/90 pb-2 text-center text-sm font-bold tracking-wide text-indigo-950">
                    第{sec.roundLabel}立ち
                  </div>
                  <div className="space-y-3">
                    {sec.teams.map((team, ti) => (
                      <div
                        key={`team-${team.teamOrdinal}-${si}-${ti}`}
                        className="w-max min-w-full overflow-hidden rounded-lg border border-zinc-300 bg-zinc-50 shadow-sm"
                      >
                        <div className="flex w-max min-w-full gap-0 border-b border-zinc-300 bg-zinc-200/90 px-1 py-1.5 text-xs font-bold text-zinc-900">
                          <div
                            className={`${MARKS_NAME_COL_CLASS} flex items-center border-zinc-300/90 bg-zinc-200/90 py-0.5 font-bold text-zinc-900`}
                          >
                            チーム {team.teamOrdinal}
                            {lineupTeamInfos[team.teamOrdinal - 1] ? (
                              <span className="ml-1 text-[0.68rem] font-semibold text-indigo-800">
                                {lineupTeamInfos[team.teamOrdinal - 1]}
                              </span>
                            ) : null}
                          </div>
                          <MarksRoundLabelsStrip rounds={rounds} />
                          <MarksTotalsHeaderSpacer tone="zinc" />
                        </div>
                        {team.memberIds.map((mid) => {
                          const m = memberById.get(mid);
                          if (!m) return null;
                          return (
                            <MarksMemberMarksRow
                              key={mid}
                              memberId={m.id}
                              label={memberLabel(m)}
                              rounds={rounds}
                              grid={grid}
                              isAdmin={isAdmin}
                              cycle={cycle}
                              variant="zinc"
                              substitutionMarkerNameForRound={substitutionMarkerNameForRound}
                              shouldShowGivenInitial={shouldShowGivenInitial}
                            />
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {membersNotInLineupTeams.length > 0 ? (
                <div className="rounded-xl border-2 border-amber-300/70 bg-amber-50/30 p-3 shadow-sm ring-1 ring-amber-100/80">
                  <div className="mb-3 border-b-2 border-amber-200/80 pb-2 text-center text-sm font-bold text-amber-950">
                    チーム未割当（出席）
                  </div>
                  <div className="w-max min-w-full space-y-0 overflow-hidden rounded-lg border border-amber-200/80 bg-white">
                    <div className="flex w-max min-w-full gap-0 border-b border-amber-200/80 bg-amber-100/50 px-1 py-1.5 text-xs font-bold text-amber-950">
                      <div
                        className={`${MARKS_NAME_COL_CLASS} flex items-center border-amber-300/80 bg-amber-100/50 py-0.5`}
                      >
                        未割当
                      </div>
                      <MarksRoundLabelsStrip rounds={rounds} />
                      <MarksTotalsHeaderSpacer tone="amber" />
                    </div>
                    {membersNotInLineupTeams.map((m, mi) => (
                      <MarksMemberMarksRow
                        key={m.id}
                        memberId={m.id}
                        label={memberLabel(m)}
                        rounds={rounds}
                        grid={grid}
                        isAdmin={isAdmin}
                        cycle={cycle}
                        variant="amber"
                        substitutionMarkerNameForRound={substitutionMarkerNameForRound}
                        shouldShowGivenInitial={shouldShowGivenInitial}
                        hideTopBorder={mi === 0}
                      />
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="w-max min-w-full text-sm">
              <div className="flex w-max min-w-full gap-0 border-b border-zinc-200 bg-zinc-50 px-1 py-1.5">
                <div
                  className={`${MARKS_NAME_COL_CLASS} border-zinc-300 bg-zinc-50 py-0.5 text-xs font-medium text-zinc-500`}
                  aria-hidden
                >
                  {"\u00a0"}
                </div>
                <MarksRoundLabelsStrip rounds={rounds} />
                <MarksTotalsHeaderSpacer tone="zinc" />
              </div>
              {orderedMembers.map((m, mi) => (
                <MarksMemberMarksRow
                  key={m.id}
                  memberId={m.id}
                  label={memberLabel(m)}
                  rounds={rounds}
                  grid={grid}
                  isAdmin={isAdmin}
                  cycle={cycle}
                  variant="zinc"
                  substitutionMarkerNameForRound={substitutionMarkerNameForRound}
                  shouldShowGivenInitial={shouldShowGivenInitial}
                  hideTopBorder={mi === 0}
                />
              ))}
            </div>
          )}
        </div>
        {substitutions.length > 0 ? (
          <div className="rounded-lg border border-indigo-100 bg-indigo-50/50 px-3 py-2 text-xs text-indigo-950">
            <p className="font-semibold">交代一覧</p>
            <ul className="mt-1 space-y-1">
              {substitutions.map((s) => (
                <li
                  key={`${s.roundIndex}-${s.outMemberId}-${s.inMemberId}`}
                  className="flex items-center justify-between gap-3"
                >
                  <span className="min-w-0">
                    {s.roundIndex}立目〜{" "}
                    {memberById.get(effectiveMemberIdForRound(s.outMemberId, s.roundIndex - 1))?.name ??
                      effectiveMemberIdForRound(s.outMemberId, s.roundIndex - 1)}{" "}
                    →{" "}
                    {memberById.get(effectiveMemberIdForRound(s.inMemberId, s.roundIndex - 1))?.name ??
                      effectiveMemberIdForRound(s.inMemberId, s.roundIndex - 1)}
                  </span>
                  {isAdmin ? (
                    <button
                      type="button"
                      className={`${uiBtnSmDanger} shrink-0`}
                      disabled={isBusy}
                      onClick={() => void removeSubstitution(s)}
                    >
                      削除
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>
      {substitutionDialogOpen ? (
        <div
          className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/40 p-4"
          role="presentation"
          onClick={() => setSubstitutionDialogOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="substitution-dialog-title"
            className="w-full max-w-lg rounded-xl border border-zinc-200 bg-white p-5 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="substitution-dialog-title" className="text-base font-bold text-zinc-900">
              メンバー交代
            </h3>
            <p className="mt-2 text-xs text-zinc-500">
              指定した立目以降で、交代元の枠に交代後メンバーを表示し、的中も交代後メンバーに保存します。
              {session.sessionKind === "match"
                ? " 試合では、交代先はチーム未割当の出席者から選びます。"
                : " 正規練習では、交代先は出席者全員から選べます。"}
            </p>

            <div className="mt-4 space-y-3">
              <label className="block text-sm font-medium text-zinc-800">
                何立目から
                <select
                  className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
                  value={subRoundIndex}
                  onChange={(e) => setSubRoundIndex(Number(e.target.value))}
                >
                  {rounds.map((r) => (
                    <option key={r} value={r}>
                      {r}立目
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-medium text-zinc-800">
                交代元
                <select
                  className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
                  value={subOutMemberId}
                  onChange={(e) => {
                    const nextOut = e.target.value;
                    setSubOutMemberId(nextOut);
                    if (subInMemberId === nextOut) {
                      setSubInMemberId(replacementCandidates.find((m) => m.id !== nextOut)?.id ?? "");
                    }
                  }}
                >
                  {substitutionOutCandidates.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-medium text-zinc-800">
                交代先
                <select
                  className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
                  value={subInMemberId}
                  onChange={(e) => setSubInMemberId(e.target.value)}
                >
                  {replacementCandidates
                    .filter((m) => m.id !== subOutMemberId)
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                </select>
              </label>
            </div>

            {substitutionMsg ? <p className="mt-3 text-sm text-red-700">{substitutionMsg}</p> : null}

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
              <button
                type="button"
                className={`${uiBtnSecondary} w-full sm:w-auto`}
                onClick={() => setSubstitutionDialogOpen(false)}
              >
                キャンセル
              </button>
              <button
                type="button"
                disabled={isBusy || !subOutMemberId || !subInMemberId}
                className={`${uiBtnPrimary} w-full sm:w-auto`}
                onClick={() => void addSubstitution()}
              >
                交代を保存
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
