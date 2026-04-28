/** marks 文字列を正規化する（o/x/- の4文字。- は中抜け） */
export function normalizeMarks(raw: string | undefined | null): string | null {
  if (raw == null) return null;
  const s = raw.trim().toLowerCase().replace(/[.・]/g, "-");
  if (!/^[ox-]{4}$/.test(s)) return null;
  if (!/[ox]/.test(s)) return null;
  return s;
}
