/** 部員画面・API で共有する選択肢と並び順 */

export const GRADE_OPTIONS = ["1年", "2年", "3年", "4年"] as const;
export type GradeYear = (typeof GRADE_OPTIONS)[number];

export const ROLE_OPTIONS = [
  "主将",
  "女子責任者",
  "副将",
  "主務",
  "女子主務",
  "幹事",
  "副務",
  "会計",
  "副会計",
  "広報",
  "学連",
  "体連",
  "弓友会連絡委員",
  "学生弓道連盟専任委員",
] as const;
export type RoleOption = (typeof ROLE_OPTIONS)[number];

export const GENDER_OPTIONS = ["男", "女"] as const;
export type Gender = (typeof GENDER_OPTIONS)[number];

const GRADE_SORT_ORDER = ["4年", "3年", "2年", "1年"] as const;

const GRADE_RANK = new Map<string, number>(
  GRADE_SORT_ORDER.map((g, i) => [g, i]),
);

function gradeRank(gradeYear: string): number {
  return GRADE_RANK.has(gradeYear) ? GRADE_RANK.get(gradeYear)! : 99;
}

function genderRank(gender: string): number {
  if (gender === "男") return 0;
  if (gender === "女") return 1;
  return 2;
}

/** 並び用の読み。ひらがながあればそれ、なければ表示名 */
export function memberSortReading(m: { name: string; nameKana?: string }): string {
  const k = (m.nameKana ?? "").trim();
  return k.length > 0 ? k : m.name.trim();
}

/** 表示・記録表の並び: 高学年 → 男女 → ひらがな（なければ名前） */
export function sortMembers<T extends { gradeYear: string; gender: string; name: string; nameKana?: string }>(
  members: T[],
): T[] {
  return [...members].sort((a, b) => {
    const g = gradeRank(a.gradeYear) - gradeRank(b.gradeYear);
    if (g !== 0) return g;
    const s = genderRank(a.gender) - genderRank(b.gender);
    if (s !== 0) return s;
    return memberSortReading(a).localeCompare(memberSortReading(b), "ja");
  });
}

export function isAllowedGrade(gradeYear: string): boolean {
  return gradeYear === "" || GRADE_OPTIONS.includes(gradeYear as GradeYear);
}

/** 役職欄（兼務）。DB は「、」で連結した1文字列 */
export function splitRoleSlots(role: string): string[] {
  const t = role.trim();
  if (!t) return [""];
  const parts = t.split("、").map((p) => p.trim()).filter((p) => p.length > 0);
  return parts.length === 0 ? [""] : parts;
}

export function joinRoleSlots(slots: readonly string[]): string {
  return slots.map((s) => s.trim()).filter((s) => s.length > 0).join("、");
}

export function isAllowedRole(role: string): boolean {
  const t = role.trim();
  if (!t) return true;
  const parts = t.split("、").map((p) => p.trim()).filter((p) => p.length > 0);
  if (parts.length === 0) return true;
  if (new Set(parts).size !== parts.length) return false;
  return parts.every((p) => ROLE_OPTIONS.includes(p as RoleOption));
}

export function isAllowedGender(gender: string): boolean {
  return gender === "" || GENDER_OPTIONS.includes(gender as Gender);
}
