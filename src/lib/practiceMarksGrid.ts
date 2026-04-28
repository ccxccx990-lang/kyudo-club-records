export type MarksMember = { id: string; name: string; gradeYear: string; gender: string };
export type MarksRecord = { memberId: string; roundIndex: number; marks: string };

export type Shot = "o" | "x" | null;

export function cellKey(memberId: string, roundIndex: number) {
  return `${memberId}-${roundIndex}`;
}

export function slotsFromMarks(marks: string): Shot[] {
  const out: Shot[] = [null, null, null, null];
  for (let i = 0; i < 4; i++) {
    const ch = marks[i];
    if (ch === "o" || ch === "O") out[i] = "o";
    else if (ch === "x" || ch === "X") out[i] = "x";
    else out[i] = null;
  }
  return out;
}

export function slotsToMarks(slots: Shot[]): string | null {
  if (slots.every((s) => s === null)) return null;
  return slots.map((s) => s ?? "-").join("");
}

export function gridsEqual(a: Record<string, Shot[]>, b: Record<string, Shot[]>) {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) {
    const ra = a[k] ?? [null, null, null, null];
    const rb = b[k] ?? [null, null, null, null];
    for (let i = 0; i < 4; i++) {
      if (ra[i] !== rb[i]) return false;
    }
  }
  return true;
}

export function buildGridFromOrdered(
  ordered: MarksMember[],
  roundCount: number,
  records: MarksRecord[],
): Record<string, Shot[]> {
  const grid: Record<string, Shot[]> = {};
  for (const m of ordered) {
    for (let r = 1; r <= roundCount; r++) {
      grid[cellKey(m.id, r)] = [null, null, null, null];
    }
  }
  for (const rec of records) {
    if (!ordered.some((m) => m.id === rec.memberId)) continue;
    const k = cellKey(rec.memberId, rec.roundIndex);
    grid[k] = slotsFromMarks(rec.marks);
  }
  return grid;
}

export function initialSavedKeys(records: MarksRecord[]): Set<string> {
  const s = new Set<string>();
  for (const rec of records) s.add(cellKey(rec.memberId, rec.roundIndex));
  return s;
}

/** 〇の個数と、実際に記録した射数（・は中抜けとして分母から除外） */
export function memberMarksHitsOverTotalSlots(
  memberId: string,
  roundCount: number,
  grid: Record<string, Shot[]>,
): { hits: number; totalSlots: number } {
  let hits = 0;
  let totalSlots = 0;
  for (let r = 1; r <= roundCount; r++) {
    const slots = grid[cellKey(memberId, r)] ?? [null, null, null, null];
    for (const s of slots) {
      if (s === "o") hits++;
      if (s === "o" || s === "x") totalSlots++;
    }
  }
  return { hits, totalSlots };
}
