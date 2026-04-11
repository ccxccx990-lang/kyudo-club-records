/** DB の `Member.name`（表示名）: 苗字 + 半角空白 + 名前 */
export const MEMBER_DISPLAY_NAME_SEPARATOR = " ";

/** 苗字・名前から表示名を組み立てる（半角空白 1 つで連結） */
export function buildMemberDisplayName(familyName: string, givenName: string): string {
  return `${familyName.trim()}${MEMBER_DISPLAY_NAME_SEPARATOR}${givenName.trim()}`;
}

/** 表示名を苗字・名前に分解する（先頭の半角空白のみ区切り。無ければ全体を苗字とみなす） */
export function splitMemberDisplayName(stored: string): { familyName: string; givenName: string } {
  const t = stored.trim();
  const i = t.indexOf(MEMBER_DISPLAY_NAME_SEPARATOR);
  if (i === -1) return { familyName: t, givenName: "" };
  return {
    familyName: t.slice(0, i).trim(),
    givenName: t.slice(i + 1).trim(),
  };
}

/** 苗字・名前の両方が入った表示名か（新規・保存時の検証用） */
export function isCompleteMemberDisplayName(stored: string): boolean {
  const { familyName, givenName } = splitMemberDisplayName(stored);
  return familyName.length > 0 && givenName.length > 0;
}
