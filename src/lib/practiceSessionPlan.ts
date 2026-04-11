import { sortMembers } from "@/lib/memberFields";

export type GenderScope = "all" | "男" | "女";
export type AttendanceState = "present" | "absent";

export type MemberForPractice = {
  id: string;
  name: string;
  gradeYear: string;
  gender: string;
};

export const GENDER_SCOPE_OPTIONS: { value: GenderScope; label: string }[] = [
  { value: "all", label: "男女合同" },
  { value: "男", label: "男子のみ" },
  { value: "女", label: "女子のみ" },
];

export function isGenderScope(s: string): s is GenderScope {
  return s === "all" || s === "男" || s === "女";
}

export function membersInGenderScope(members: MemberForPractice[], scope: GenderScope): MemberForPractice[] {
  if (scope === "男") return members.filter((m) => m.gender === "男");
  if (scope === "女") return members.filter((m) => m.gender === "女");
  return members;
}

export function parseAttendanceJson(raw: string): Record<string, AttendanceState> {
  try {
    const o = JSON.parse(raw) as unknown;
    if (typeof o !== "object" || o === null) return {};
    const out: Record<string, AttendanceState> = {};
    for (const [k, v] of Object.entries(o)) {
      if (v === "present" || v === "absent") out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

export function parseLineupTeamsJson(raw: string): string[][] {
  try {
    const o = JSON.parse(raw) as unknown;
    if (!Array.isArray(o)) return [];
    const teams: string[][] = [];
    for (const t of o) {
      if (!Array.isArray(t)) continue;
      const ids = t.filter((x): x is string => typeof x === "string" && x.length > 0);
      // 空配列 [] は「次の立ちへ」の区切りとして保持する
      teams.push(ids.length > 0 ? ids : []);
    }
    return teams;
  } catch {
    return [];
  }
}

/**
 * [] 行の直後から始まる立ちの番号（部員プレビュー見出し用）
 * 先頭の []（未入力時の [[]] など）は「第1立ち」の目印であり、立ち番号の桁を進めない。
 */
export function roundNumberAfterMarker(teams: string[][], emptyIndex: number): number {
  let emptiesBefore = teams.slice(0, emptyIndex).filter((t) => t.length === 0).length;
  const leadingIsEmpty = teams.length > 0 && teams[0]!.length === 0;
  if (leadingIsEmpty && emptyIndex > 0) {
    emptiesBefore -= 1;
  }
  const hasNonEmptyBefore = teams.slice(0, emptyIndex).some((t) => t.length > 0);
  return 1 + emptiesBefore + (hasNonEmptyBefore ? 1 : 0);
}

/** 的中入力などでチーム編成部員プレビューに揃えたブロック列 */
export type LineupMarksBlock =
  | { kind: "round"; lineupIndex: number }
  | { kind: "team"; teamOrdinal: number; memberIds: string[] };

export function lineupToMarksLayoutBlocks(lineupTeams: string[][]): LineupMarksBlock[] {
  const blocks: LineupMarksBlock[] = [];
  let teamOrdinal = 0;
  for (let ti = 0; ti < lineupTeams.length; ti++) {
    const team = lineupTeams[ti]!;
    if (team.length === 0) {
      blocks.push({ kind: "round", lineupIndex: ti });
    } else {
      teamOrdinal += 1;
      blocks.push({ kind: "team", teamOrdinal, memberIds: [...team] });
    }
  }
  return blocks;
}

/** 的中表用: 立ち番号ごとにチームブロックをまとめる */
export type MarksRoundSection = {
  roundLabel: number;
  teams: Extract<LineupMarksBlock, { kind: "team" }>[];
};

export function layoutBlocksToRoundSections(
  blocks: LineupMarksBlock[],
  lineupRaw: string[][],
): MarksRoundSection[] {
  type TeamBlk = Extract<LineupMarksBlock, { kind: "team" }>;
  const sections: MarksRoundSection[] = [];
  const pending: TeamBlk[] = [];
  let nextRoundLabel = 1;

  const flush = () => {
    if (pending.length === 0) return;
    sections.push({ roundLabel: nextRoundLabel, teams: [...pending] });
    pending.length = 0;
  };

  for (const b of blocks) {
    if (b.kind === "round") {
      flush();
      nextRoundLabel = roundNumberAfterMarker(lineupRaw, b.lineupIndex);
    } else {
      pending.push(b);
    }
  }
  flush();
  return sections;
}

/** 先頭・末尾の無意味な空チーム（立ち区切りの余白）だけ取り除く。保存直前に使う */
export function trimLineupSentinels(teams: string[][]): string[][] {
  const out = [...teams];
  while (out.length > 0 && out[0].length === 0) out.shift();
  while (out.length > 0 && out[out.length - 1].length === 0) out.pop();
  return out.length > 0 ? out : [[]];
}

/**
 * チームに現れる ID が、すべて出席対象に含まれ、重複がないか（全員配置済みは不要）。
 * 的中入力の「チーム編成プレビュー」表示判定に使う。
 */
export function lineupMemberIdsSelfConsistent(teams: string[][], attendingIds: Set<string>): boolean {
  const flat = teams.flat();
  if (flat.length === 0) return false;
  const seen = new Set<string>();
  for (const id of flat) {
    if (!attendingIds.has(id)) return false;
    if (seen.has(id)) return false;
    seen.add(id);
  }
  return true;
}

/** PracticeLineupBuilder.addToLineup と同じ「末尾セグメント人数」 */
function tailMemberCountForLineup(teams: string[][]): number {
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

/** 1人追加したときの lineupTeams（チーム編成と同じルール） */
function addMemberToLineupTeams(
  prev: string[][],
  memberId: string,
  teamSize: number,
  maxMato: number,
): string[][] {
  const copy = prev.map((t) => [...t]);
  const tailCount = tailMemberCountForLineup(copy);
  const lastTeam = copy.length > 0 ? copy[copy.length - 1] : null;
  if (tailCount >= maxMato && lastTeam && lastTeam.length > 0) {
    copy.push([]);
  }
  if (copy.length === 0) return [[memberId]];
  const li = copy.length - 1;
  if (copy[li]!.length === 0) {
    copy.push([memberId]);
    return copy;
  }
  if (copy[li]!.length >= teamSize) {
    copy.push([memberId]);
    return copy;
  }
  copy[li] = [...copy[li]!, memberId];
  return copy;
}

/**
 * チーム編成未保存時の仮 lineupTeams。
 * 出席者を学年・男女・名前順に並べ、teamSize と最大的数でチーム／立ち区切り（[]）を入れる。
 */
export function buildSyntheticLineupWithRounds(
  participating: MemberForPractice[],
  teamSize: number,
  maxMato: number,
): string[][] {
  const ts = Math.min(6, Math.max(1, Math.floor(teamSize) || 4));
  const cap = Math.max(1, Math.min(24, Math.floor(maxMato) || 8));
  const ids = sortMembers(participating).map((m) => m.id);
  let teams: string[][] = [];
  for (const id of ids) {
    teams = addMemberToLineupTeams(teams, id, ts, cap);
  }
  return teams;
}

/** 出席者が全員ちょうど一度ずつ並ぶか。空配列は立ち区切り（部員 ID は含まない） */
export function validateLineupTeams(
  teams: string[][],
  attendingIds: Set<string>,
): string | null {
  if (teams.length === 0) return null;
  const flat = teams.flat();
  if (flat.length !== attendingIds.size) {
    return "チームに出席者全員をちょうど一度ずつ配置してください";
  }
  const seen = new Set<string>();
  for (const id of flat) {
    if (!attendingIds.has(id)) return "対象外の部員がチームに含まれています";
    if (seen.has(id)) return "同じ部員が複数チームに入っています";
    seen.add(id);
  }
  if (seen.size !== attendingIds.size) return "出席者の配置が足りません";
  return null;
}

/** 〇×表の行順。チーム編成が有効ならその順、なければ出席者を学年・男女・名前順 */
export function orderedMemberIdsForMarks(params: {
  members: MemberForPractice[];
  genderScope: GenderScope;
  attendance: Record<string, AttendanceState>;
  lineupTeams: string[][];
}): string[] {
  const inScope = membersInGenderScope(params.members, params.genderScope);
  const attending = inScope.filter((m) => params.attendance[m.id] !== "absent");
  const attendingSet = new Set(attending.map((m) => m.id));

  if (params.lineupTeams.length > 0) {
    const err = validateLineupTeams(params.lineupTeams, attendingSet);
    if (!err) return params.lineupTeams.flat();
    if (lineupMemberIdsSelfConsistent(params.lineupTeams, attendingSet)) {
      const inLineup = new Set(params.lineupTeams.flat());
      const fromLineup = params.lineupTeams.flat();
      const rest = sortMembers(attending.filter((m) => !inLineup.has(m.id))).map((m) => m.id);
      return [...fromLineup, ...rest];
    }
  }
  return sortMembers(attending).map((m) => m.id);
}

export function stringifyAttendance(att: Record<string, AttendanceState>): string {
  return JSON.stringify(att);
}

export function stableAttendanceJson(att: Record<string, AttendanceState>): string {
  const keys = Object.keys(att).sort();
  const o: Record<string, AttendanceState> = {};
  for (const k of keys) o[k] = att[k];
  return JSON.stringify(o);
}

export function stringifyLineupTeams(teams: string[][]): string {
  return JSON.stringify(teams);
}
