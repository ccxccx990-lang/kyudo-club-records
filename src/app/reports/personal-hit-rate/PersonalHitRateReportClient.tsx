"use client";

import type { PersonalHitRateRow } from "@/lib/personalHitRateReport";
import { uiBtnAccent, uiToggleChoice } from "@/lib/uiButtons";
import { useCallback, useEffect, useMemo, useState } from "react";

const MONTH_OPTIONS = [
  { value: 1, label: "1月" },
  { value: 2, label: "2月" },
  { value: 3, label: "3月" },
  { value: 4, label: "4月" },
  { value: 5, label: "5月" },
  { value: 6, label: "6月" },
  { value: 7, label: "7月" },
  { value: 8, label: "8月" },
  { value: 9, label: "9月" },
  { value: 10, label: "10月" },
  { value: 11, label: "11月" },
  { value: 12, label: "12月" },
];

type Period = "full" | "firstHalf";
type Gender = "男" | "女";
type Kind = "all" | "joint" | "match";

const KIND_OPTIONS: { value: Kind; label: string }[] = [
  { value: "all", label: "全て" },
  { value: "joint", label: "正規練習のみ" },
  { value: "match", label: "試合のみ" },
];

/** プルダウン幅の基準（最大文字数のラベル） */
const MONTH_WIDEST_LABEL = MONTH_OPTIONS.reduce(
  (widest, m) => (m.label.length > widest.length ? m.label : widest),
  "",
);
const KIND_WIDEST_LABEL = KIND_OPTIONS.reduce(
  (widest, k) => (k.label.length > widest.length ? k.label : widest),
  "",
);
/** 年入力は 2000〜2100 の最大表示幅 */
const YEAR_WIDTH_SAMPLE = "2100";

/** select と不可視スパンで矢印分の右余白を揃える */
const SELECT_SIZER_PAD = "px-3 py-2 pr-9 text-sm leading-normal";

function pctCell(v: number | null): string {
  if (v === null) return "—";
  return `${v}%`;
}

function defaultYearMonth(): { year: number; month: number } {
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

const GRADE_ORDER = ["1年", "2年", "3年", "4年"] as const;

/** Playwright で PDF 化するブロックは lab()/oklch() を避け、hex のみ（Tailwind 色ユーティリティは使わない） */
const PDF_PALETTE = {
  bg: "#ffffff",
  ink: "#18181b",
  muted: "#52525b",
  border: "#d4d4d8",
  /** 見出し行・タイトル帯の薄い背景 */
  bandBg: "#f4f4f5",
  /** 明細の交互行 */
  rowAlt: "#fafafa",
} as const;

const PDF_PAD_TH = "5px 5px";
const PDF_PAD_TD = "4px 5px";
/** スプレッドシート風のセル格子 */
const PDF_CELL_BORDER = `1px solid ${PDF_PALETTE.border}`;

/** A4 縦・余白約 10mm 想定の内側幅（190mm）— PDF ブロック幅の基準 */
const PDF_A4_INNER_WIDTH_MM = 210 - 20;
/** A4 内側幅（mm）→ CSS px。PDF はさらに狭め、右欠けを防ぐ */
const PDF_BASE_INNER_WIDTH_PX = Math.round((PDF_A4_INNER_WIDTH_MM * 96) / 25.4);
const PDF_CAPTURE_WIDTH_PX = Math.round(PDF_BASE_INNER_WIDTH_PX * 0.7);
/** PDF ブロック内の表: section 左右 1px 枠 + 表ラッパ左右 10px padding を除いたレイアウト幅 */
const PDF_TABLE_LAYOUT_WIDTH_PX = PDF_CAPTURE_WIDTH_PX - 2 - 10 - 10;

/**
 * PDF 用テーブルの列幅（px）。旧％配分をこの幅に合わせ、端数は最終列に吸収する。
 * 順: 名前・学年・総的中・総本数・初矢率・止め矢率・的中率
 */
const PDF_COLUMN_WIDTHS_PX: readonly number[] = (() => {
  const W = PDF_TABLE_LAYOUT_WIDTH_PX;
  const ratiosPct = [23, 7, 14, 14, 14, 14, 14] as const;
  const out: number[] = [];
  let used = 0;
  for (let i = 0; i < ratiosPct.length - 1; i++) {
    const w = Math.round((ratiosPct[i] / 100) * W);
    out.push(w);
    used += w;
  }
  out.push(W - used);
  return out;
})();

function gradeRankForSort(gradeYear: string): number {
  const i = GRADE_ORDER.indexOf(gradeYear as (typeof GRADE_ORDER)[number]);
  return i === -1 ? 99 : i;
}

/** 降順。null（—）は常に末尾 */
function cmpDescNullLast(a: number | null, b: number | null): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return b - a;
}

/**
 * 的中率 → 総的中 → 初矢率 → 止め矢率（いずれも高い順、率は null 最後）
 * → 学年（1年→4年）→ 名前
 */
function sortHitRateRows(rows: PersonalHitRateRow[]): PersonalHitRateRow[] {
  return [...rows].sort((a, b) => {
    let c = cmpDescNullLast(a.overallRatePct, b.overallRatePct);
    if (c !== 0) return c;
    c = b.totalHits - a.totalHits;
    if (c !== 0) return c;
    c = cmpDescNullLast(a.firstRatePct, b.firstRatePct);
    if (c !== 0) return c;
    c = cmpDescNullLast(a.lastRatePct, b.lastRatePct);
    if (c !== 0) return c;
    c = gradeRankForSort(a.gradeYear) - gradeRankForSort(b.gradeYear);
    if (c !== 0) return c;
    return a.name.localeCompare(b.name, "ja");
  });
}

export function PersonalHitRateReportClient() {
  const def = useMemo(() => defaultYearMonth(), []);
  const [year, setYear] = useState(String(def.year));
  const [month, setMonth] = useState(def.month);
  const [period, setPeriod] = useState<Period>("full");
  const [gender, setGender] = useState<Gender>("男");
  const [kind, setKind] = useState<Kind>("all");
  const [rows, setRows] = useState<PersonalHitRateRow[]>([]);
  const [meta, setMeta] = useState<{ dateFrom: string; dateTo: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    const y = Number(year);
    if (!Number.isInteger(y) || y < 2000 || y > 2100) {
      setError("年は 2000〜2100 の整数で入力してください");
      return;
    }
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({
      year: String(y),
      month: String(month),
      period,
      gender,
      kind,
    });
    const res = await fetch(`/api/reports/personal-hit-rate?${params}`, { cache: "no-store" });
    setLoading(false);
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      let detail = "";
      try {
        const data = JSON.parse(text) as { error?: string };
        detail = data.error ?? "";
      } catch {
        detail = text.slice(0, 200);
      }
      setError(
        detail
          ? `取得に失敗しました（${res.status}）: ${detail}`
          : `取得に失敗しました（${res.status}）。DB のマイグレーション（sessionKind 列）を実行してください。`,
      );
      setRows([]);
      setMeta(null);
      return;
    }
    const data = (await res.json()) as {
      meta: { dateFrom: string; dateTo: string };
      rows: PersonalHitRateRow[];
    };
    setRows(data.rows);
    setMeta(data.meta);
  }, [year, month, period, gender, kind]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  /** 表・PDF 見出し（月全てのときは年月のみ、月前半のときは「〇月」の直後に「前半」） */
  const reportHeading = useMemo(() => {
    const y = Number(year) || def.year;
    const mo = MONTH_OPTIONS.find((m) => m.value === month)?.label ?? `${month}月`;
    const g = gender === "男" ? "男子" : "女子";
    if (period === "firstHalf") {
      return `${g} ${y}年${mo}前半`;
    }
    return `${g} ${y}年${mo}`;
  }, [year, month, period, gender, def.year]);

  const sortedRows = useMemo(() => sortHitRateRows(rows), [rows]);

  /**
   * 票用: 出力設定で絞った部員の合算から総的中率のみ算出。
   * (Σ総的中 ÷ Σ総本数) × 100 を小数点以下四捨五入（総本数 0 のときは null → 表示は —）。
   */
  const aggregateRatePct = useMemo(() => {
    let totalHits = 0;
    let totalArrows = 0;
    for (const r of rows) {
      totalHits += r.totalHits;
      totalArrows += r.totalArrows;
    }
    if (totalArrows === 0) return null;
    return Math.round((totalHits / totalArrows) * 100);
  }, [rows]);

  const downloadPdf = async () => {
    const el = document.getElementById("hit-rate-pdf-vertical-wrap");
    if (!el) {
      setPdfError("PDF 用のブロックが見つかりません。");
      return;
    }
    setPdfError(null);
    setPdfBusy(true);
    try {
      const y = Number(year);
      const safeYear = Number.isInteger(y) && y >= 2000 && y <= 2100 ? y : def.year;
      const filename = `個人的中率_${safeYear}年${month}月.pdf`;

      const res = await fetch("/api/reports/personal-hit-rate/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ html: el.outerHTML }),
      });

      if (!res.ok) {
        let detail = await res.text();
        try {
          const j = JSON.parse(detail) as { error?: string };
          if (j.error) detail = j.error;
        } catch {
          /* そのまま */
        }
        throw new Error(detail || `HTTP ${res.status}`);
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e);
      console.error("personal-hit-rate pdf failed", e);
      setPdfError(
        detail
          ? `PDF の生成に失敗しました: ${detail}`
          : "PDF の生成に失敗しました。サーバーで Playwright（Chromium）が使えるか確認してください。",
      );
    } finally {
      setPdfBusy(false);
    }
  };

  return (
    <main className="mx-auto max-w-5xl space-y-4 px-4 py-10">

      <section className="no-print mx-auto w-full space-y-4 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm md:w-1/2">
        <h2 className="text-sm font-semibold text-zinc-900">出力設定</h2>
        {/* 男女区分の直下に期間。年・月・区分は見出し＋エディット（横一列・幅は最長ラベル基準） */}
        <div className="flex max-w-md flex-col gap-4">
          <div>
            <p className="mb-2 text-xs font-medium text-zinc-600">男女区分</p>
            <div className="flex w-full gap-0.5 rounded-lg border border-zinc-300 bg-zinc-50/80 p-0.5">
              {(["男", "女"] as const).map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGender(g)}
                  className={`flex-1 justify-center ${uiToggleChoice(gender === g)}`}
                >
                  {g === "男" ? "男子" : "女子"}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-medium text-zinc-600">期間</p>
            <div className="flex w-full gap-0.5 rounded-lg border border-zinc-300 bg-zinc-50/80 p-0.5">
              <button
                type="button"
                onClick={() => setPeriod("firstHalf")}
                className={`flex-1 justify-center ${uiToggleChoice(period === "firstHalf")}`}
              >
                月前半
              </button>
              <button
                type="button"
                onClick={() => setPeriod("full")}
                className={`flex-1 justify-center ${uiToggleChoice(period === "full")}`}
              >
                月全て
              </button>
            </div>
          </div>
        </div>
        <div className="flex max-w-full flex-nowrap items-start gap-5 overflow-x-auto pb-0.5">
          <div className="shrink-0">
            <p className="mb-2 text-xs font-medium text-zinc-600">年</p>
            <div className="inline-grid w-max max-w-full">
              <input
                type="number"
                min={2000}
                max={2100}
                value={year}
                onChange={(e) => setYear(e.target.value)}
                aria-label="年"
                className="col-start-1 row-start-1 w-full min-w-0 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
              <span
                aria-hidden
                className="col-start-1 row-start-1 invisible select-none whitespace-nowrap px-3 py-2 text-sm tabular-nums leading-normal"
              >
                {YEAR_WIDTH_SAMPLE}
              </span>
            </div>
          </div>
          <div className="shrink-0">
            <p className="mb-2 text-xs font-medium text-zinc-600">月</p>
            <div className="flex items-end gap-2">
              <div className="inline-grid w-max max-w-full">
                <select
                  className={`col-start-1 row-start-1 h-full w-full min-w-0 cursor-pointer rounded-md border border-zinc-300 bg-white ${SELECT_SIZER_PAD}`}
                  value={month}
                  onChange={(e) => setMonth(Number(e.target.value))}
                  aria-label="月"
                >
                  {MONTH_OPTIONS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
                <span
                  aria-hidden
                  className={`col-start-1 row-start-1 invisible select-none whitespace-nowrap ${SELECT_SIZER_PAD}`}
                >
                  {MONTH_WIDEST_LABEL}
                </span>
              </div>
              {period === "firstHalf" ? (
                <span className="shrink-0 text-sm font-semibold text-zinc-900 tabular-nums">前半</span>
              ) : null}
            </div>
          </div>
          <div className="min-w-0 shrink-0">
            <p className="mb-2 text-xs font-medium text-zinc-600">区分</p>
            <div className="inline-grid w-max max-w-full">
              <select
                className={`col-start-1 row-start-1 h-full w-full min-w-0 cursor-pointer rounded-md border border-zinc-300 bg-white ${SELECT_SIZER_PAD}`}
                value={kind}
                onChange={(e) => setKind(e.target.value as Kind)}
                aria-label="区分"
              >
                {KIND_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <span
                aria-hidden
                className={`col-start-1 row-start-1 invisible select-none whitespace-nowrap ${SELECT_SIZER_PAD}`}
              >
                {KIND_WIDEST_LABEL}
              </span>
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-3 border-t border-zinc-100 pt-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div className="min-w-0 flex-1 space-y-1">
            {pdfError ? <p className="text-sm text-red-700">{pdfError}</p> : null}
            {error ? <p className="text-sm text-red-700">{error}</p> : null}
            {loading ? <p className="text-sm text-zinc-500">読み込み中…</p> : null}
          </div>
          <button
            type="button"
            disabled={pdfBusy || loading}
            onClick={() => void downloadPdf()}
            className={`${uiBtnAccent} w-full shrink-0 justify-center sm:w-auto sm:min-w-[11rem]`}
          >
            {pdfBusy ? "PDF を作成中…" : "PDFをダウンロード"}
          </button>
        </div>
      </section>

      <div
        id="hit-rate-pdf-vertical-wrap"
        className="hit-rate-pdf-vertical-wrap"
        style={{
          width: PDF_CAPTURE_WIDTH_PX,
          maxWidth: "100%",
          marginLeft: "auto",
          marginRight: "auto",
          boxSizing: "border-box",
          overflow: "hidden",
        }}
      >
      <section
        id="hit-rate-print-root"
        style={{
          width: "100%",
          boxSizing: "border-box",
          overflow: "hidden",
          borderRadius: 8,
          border: `1px solid ${PDF_PALETTE.border}`,
          backgroundColor: PDF_PALETTE.bg,
          color: PDF_PALETTE.ink,
          fontFamily: "Arial, Helvetica, sans-serif",
        }}
      >
        <div
          style={{
            borderBottom: `1px solid ${PDF_PALETTE.border}`,
            backgroundColor: PDF_PALETTE.bandBg,
            padding: "8px 12px",
            color: PDF_PALETTE.ink,
            textAlign: "left",
          }}
        >
          <div
            style={{
              fontSize: "1.25rem",
              lineHeight: 1.4,
              fontWeight: 700,
              color: PDF_PALETTE.ink,
              letterSpacing: "0.02em",
            }}
          >
            {reportHeading}
          </div>
          {meta ? (
            <div
              style={{
                marginTop: 8,
                fontSize: "0.8125rem",
                fontWeight: 400,
                color: PDF_PALETTE.muted,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {meta.dateFrom} 〜 {meta.dateTo}
            </div>
          ) : null}
        </div>
        <div
          style={{
            backgroundColor: PDF_PALETTE.bg,
            padding: "8px 10px 10px",
            color: PDF_PALETTE.ink,
          }}
        >
          <table
            style={{
              width: "100%",
              maxWidth: "100%",
              minWidth: 0,
              tableLayout: "fixed",
              borderCollapse: "collapse",
              fontSize: "0.75rem",
              lineHeight: 1.35,
              color: PDF_PALETTE.ink,
            }}
          >
            <colgroup>
              {PDF_COLUMN_WIDTHS_PX.map((w, i) => (
                <col key={i} style={{ width: `${w}px` }} />
              ))}
            </colgroup>
            <thead>
              <tr
                style={{
                  backgroundColor: PDF_PALETTE.bandBg,
                  fontSize: "0.75rem",
                  color: PDF_PALETTE.ink,
                }}
              >
                <th
                  style={{
                    padding: PDF_PAD_TH,
                    fontWeight: 600,
                    color: PDF_PALETTE.ink,
                    textAlign: "left",
                    whiteSpace: "normal",
                    overflowWrap: "anywhere",
                    lineHeight: 1.25,
                    verticalAlign: "top",
                    border: PDF_CELL_BORDER,
                    backgroundColor: PDF_PALETTE.bandBg,
                  }}
                >
                  名前
                </th>
                <th
                  style={{
                    padding: PDF_PAD_TH,
                    fontWeight: 600,
                    color: PDF_PALETTE.ink,
                    textAlign: "center",
                    whiteSpace: "nowrap",
                    lineHeight: 1.25,
                    verticalAlign: "top",
                    border: PDF_CELL_BORDER,
                    backgroundColor: PDF_PALETTE.bandBg,
                  }}
                >
                  学年
                </th>
                <th
                  style={{
                    padding: PDF_PAD_TH,
                    fontWeight: 600,
                    color: PDF_PALETTE.ink,
                    textAlign: "right",
                    whiteSpace: "nowrap",
                    lineHeight: 1.25,
                    verticalAlign: "top",
                    border: PDF_CELL_BORDER,
                    backgroundColor: PDF_PALETTE.bandBg,
                  }}
                >
                  総的中
                </th>
                <th
                  style={{
                    padding: PDF_PAD_TH,
                    fontWeight: 600,
                    color: PDF_PALETTE.ink,
                    textAlign: "right",
                    whiteSpace: "nowrap",
                    lineHeight: 1.25,
                    verticalAlign: "top",
                    border: PDF_CELL_BORDER,
                    backgroundColor: PDF_PALETTE.bandBg,
                  }}
                >
                  総本数
                </th>
                <th
                  style={{
                    padding: PDF_PAD_TH,
                    fontWeight: 600,
                    color: PDF_PALETTE.ink,
                    textAlign: "right",
                    whiteSpace: "nowrap",
                    lineHeight: 1.25,
                    verticalAlign: "top",
                    border: PDF_CELL_BORDER,
                    backgroundColor: PDF_PALETTE.bandBg,
                  }}
                >
                  初矢率
                </th>
                <th
                  style={{
                    padding: PDF_PAD_TH,
                    fontWeight: 600,
                    color: PDF_PALETTE.ink,
                    textAlign: "right",
                    whiteSpace: "nowrap",
                    lineHeight: 1.25,
                    verticalAlign: "top",
                    border: PDF_CELL_BORDER,
                    backgroundColor: PDF_PALETTE.bandBg,
                  }}
                >
                  止め矢率
                </th>
                <th
                  style={{
                    padding: PDF_PAD_TH,
                    fontWeight: 600,
                    color: PDF_PALETTE.ink,
                    textAlign: "right",
                    whiteSpace: "nowrap",
                    lineHeight: 1.25,
                    verticalAlign: "top",
                    border: PDF_CELL_BORDER,
                    backgroundColor: PDF_PALETTE.bandBg,
                  }}
                >
                  的中率
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((r, i) => (
                <tr
                  key={r.memberId}
                  style={{
                    backgroundColor: i % 2 === 1 ? PDF_PALETTE.rowAlt : PDF_PALETTE.bg,
                  }}
                >
                  <td
                    style={{
                      padding: PDF_PAD_TD,
                      fontWeight: 500,
                      color: PDF_PALETTE.ink,
                      textAlign: "left",
                      overflowWrap: "anywhere",
                      wordBreak: "break-word",
                      verticalAlign: "top",
                      border: PDF_CELL_BORDER,
                    }}
                  >
                    {r.name}
                  </td>
                  <td
                    style={{
                      padding: PDF_PAD_TD,
                      fontVariantNumeric: "tabular-nums",
                      color: PDF_PALETTE.ink,
                      textAlign: "center",
                      verticalAlign: "top",
                      border: PDF_CELL_BORDER,
                    }}
                  >
                    {r.gradeYear || "—"}
                  </td>
                  <td
                    style={{
                      padding: PDF_PAD_TD,
                      fontVariantNumeric: "tabular-nums",
                      color: PDF_PALETTE.ink,
                      textAlign: "right",
                      verticalAlign: "top",
                      border: PDF_CELL_BORDER,
                    }}
                  >
                    {r.totalHits}
                  </td>
                  <td
                    style={{
                      padding: PDF_PAD_TD,
                      fontVariantNumeric: "tabular-nums",
                      color: PDF_PALETTE.ink,
                      textAlign: "right",
                      verticalAlign: "top",
                      border: PDF_CELL_BORDER,
                    }}
                  >
                    {r.totalArrows}
                  </td>
                  <td
                    style={{
                      padding: PDF_PAD_TD,
                      fontVariantNumeric: "tabular-nums",
                      color: PDF_PALETTE.ink,
                      textAlign: "right",
                      verticalAlign: "top",
                      border: PDF_CELL_BORDER,
                    }}
                  >
                    {pctCell(r.firstRatePct)}
                  </td>
                  <td
                    style={{
                      padding: PDF_PAD_TD,
                      fontVariantNumeric: "tabular-nums",
                      color: PDF_PALETTE.ink,
                      textAlign: "right",
                      verticalAlign: "middle",
                      border: PDF_CELL_BORDER,
                    }}
                  >
                    {pctCell(r.lastRatePct)}
                  </td>
                  <td
                    style={{
                      padding: PDF_PAD_TD,
                      fontVariantNumeric: "tabular-nums",
                      color: PDF_PALETTE.ink,
                      textAlign: "right",
                      verticalAlign: "top",
                      border: PDF_CELL_BORDER,
                    }}
                  >
                    {pctCell(r.overallRatePct)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div
            style={{
              marginTop: 10,
              display: "flex",
              justifyContent: "flex-end",
            }}
          >
            <div
              style={{
                border: PDF_CELL_BORDER,
                padding: "8px 12px",
                textAlign: "right",
                fontSize: "0.8125rem",
                lineHeight: 1.45,
                color: PDF_PALETTE.ink,
                backgroundColor: PDF_PALETTE.bg,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              <span style={{ fontWeight: 600 }}>総的中率</span>
              <span style={{ marginLeft: 8, fontSize: "0.9375rem" }}>
                {aggregateRatePct !== null ? `${aggregateRatePct}%` : "—"}
              </span>
            </div>
          </div>
        </div>
      </section>
      </div>
    </main>
  );
}
