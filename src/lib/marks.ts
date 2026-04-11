/** marks 文字列を正規化する（o/x の4文字以外は null） */
export function normalizeMarks(raw: string | undefined | null): string | null {
  if (raw == null) return null;
  const s = raw.trim().toLowerCase();
  if (!/^[ox]{4}$/.test(s)) return null;
  return s;
}
