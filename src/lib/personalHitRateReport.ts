import { sortMembers } from "@/lib/memberFields";

/** 月の前半（1〜15日）か月全体 */
export type MonthPeriod = "firstHalf" | "full";

/** レポートの練習区分 */
export type SessionKindFilter = "all" | "joint" | "match";

export type PersonalHitRateRow = {
  memberId: string;
  name: string;
  gradeYear: string;
  totalArrows: number;
  totalHits: number;
  /** 一立の1本目。分母0なら null */
  firstRatePct: number | null;
  /** 一立の4本目。分母0なら null */
  lastRatePct: number | null;
  /** 総的中率（表示名は「的中率」）。分母0なら null */
  overallRatePct: number | null;
};

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** 指定年月の ISO 日付範囲（YYYY-MM-DD、両端含む） */
export function monthDateRangeIso(year: number, month1to12: number, period: MonthPeriod): { from: string; to: string } {
  const from = `${year}-${pad2(month1to12)}-01`;
  if (period === "firstHalf") {
    return { from, to: `${year}-${pad2(month1to12)}-15` };
  }
  const last = new Date(Date.UTC(year, month1to12, 0)).getUTCDate();
  return { from, to: `${year}-${pad2(month1to12)}-${pad2(last)}` };
}

/** 4文字 o/x/- の記録のみ集計対象（- は中抜け） */
function normalizeMarks4(marks: string): string | null {
  const normalized = marks.trim().toLowerCase().replace(/[.・]/g, "-");
  return /^[ox-]{4}$/.test(normalized) ? normalized : null;
}

function countOInMarks(marks: string): number {
  let n = 0;
  for (let i = 0; i < marks.length; i++) {
    const c = marks[i]?.toLowerCase();
    if (c === "o") n++;
  }
  return n;
}

/**
 * 初矢率・止め矢率・的中率を集計する。
 * - 初矢率: 各「立目」1本目の的中数 / 1本目の総本数（o+x）×100 を四捨五入
 * - 止め矢率: 各立目4本目について同様
 * - 的中率: 総的中数 / 総本数 ×100 を四捨五入
 */
export function aggregatePersonalHitRates(params: {
  members: { id: string; name: string; gradeYear: string; gender: string }[];
  gender: "男" | "女";
  sessions: {
    practiceDate: string;
    sessionKind: string;
    records: { memberId: string; marks: string }[];
  }[];
  dateFrom: string;
  dateTo: string;
  sessionKindFilter: SessionKindFilter;
}): PersonalHitRateRow[] {
  const inGender = params.members.filter((m) => m.gender === params.gender);
  const ordered = sortMembers(inGender);

  const sessions = params.sessions.filter((s) => {
    if (s.practiceDate < params.dateFrom || s.practiceDate > params.dateTo) return false;
    if (params.sessionKindFilter === "all") return true;
    if (params.sessionKindFilter === "joint") return s.sessionKind === "joint";
    return s.sessionKind === "match";
  });

  type Acc = { ta: number; th: number; fHit: number; fTot: number; lHit: number; lTot: number };
  const acc = new Map<string, Acc>();
  for (const m of ordered) {
    acc.set(m.id, { ta: 0, th: 0, fHit: 0, fTot: 0, lHit: 0, lTot: 0 });
  }

  for (const s of sessions) {
    for (const r of s.records) {
      const a = acc.get(r.memberId);
      if (!a) continue;
      const m = normalizeMarks4(r.marks);
      if (!m) continue;
      a.ta += Array.from(m).filter((c) => c === "o" || c === "x").length;
      a.th += countOInMarks(m);
      const c0 = m[0];
      const c3 = m[3];
      if (c0 === "o" || c0 === "x") {
        a.fTot++;
        if (c0 === "o") a.fHit++;
      }
      if (c3 === "o" || c3 === "x") {
        a.lTot++;
        if (c3 === "o") a.lHit++;
      }
    }
  }

  return ordered.map((m) => {
    const a = acc.get(m.id)!;
    const overallRatePct = a.ta === 0 ? null : Math.round((a.th / a.ta) * 100);
    const firstRatePct = a.fTot === 0 ? null : Math.round((a.fHit / a.fTot) * 100);
    const lastRatePct = a.lTot === 0 ? null : Math.round((a.lHit / a.lTot) * 100);
    return {
      memberId: m.id,
      name: m.name,
      gradeYear: m.gradeYear,
      totalArrows: a.ta,
      totalHits: a.th,
      firstRatePct,
      lastRatePct,
      overallRatePct,
    };
  });
}
