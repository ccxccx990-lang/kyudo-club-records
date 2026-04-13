/** アプリ共通: ボタン・ボタン風リンク（色の役割とタップ領域を揃える） */

const focus =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2";

/** フォーム・ツールバー用（最小高さ 44px 前後） */
export const uiBtnBase =
  `inline-flex items-center justify-center gap-2 rounded-lg border font-semibold shadow-sm ` +
  `transition-colors ${focus} disabled:pointer-events-none disabled:opacity-50 ` +
  `min-h-11 px-4 py-2.5 text-sm`;

export const uiBtnPrimary = `${uiBtnBase} border-indigo-700 bg-indigo-700 text-white hover:bg-indigo-800`;

export const uiBtnSecondary = `${uiBtnBase} border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-100`;

export const uiBtnMuted = `${uiBtnBase} border-indigo-200 bg-indigo-50 text-indigo-900 hover:bg-indigo-100`;

export const uiBtnAccent = `${uiBtnBase} border-emerald-700 bg-emerald-700 text-white hover:bg-emerald-800 focus-visible:ring-emerald-600`;

export const uiBtnDangerOutline = `${uiBtnBase} border-red-300 bg-white text-red-800 hover:bg-red-50 focus-visible:ring-red-500`;

export const uiBtnDangerSolid = `${uiBtnBase} border-red-700 bg-red-700 text-white hover:bg-red-800 focus-visible:ring-red-500`;

/** 補助・表内・狭い列 */
export const uiBtnSm =
  `inline-flex items-center justify-center gap-1 rounded-lg border font-semibold text-xs ` +
  `transition-colors ${focus} disabled:pointer-events-none disabled:opacity-50 ` +
  `min-h-9 px-3 py-2`;

export const uiBtnSmSecondary = `${uiBtnSm} border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-100`;

export const uiBtnSmDanger = `${uiBtnSm} border-red-200 bg-white text-red-800 hover:bg-red-50 focus-visible:ring-red-500`;

export const uiBtnSmMuted = `${uiBtnSm} border-indigo-200 bg-indigo-50 text-indigo-900 hover:bg-indigo-100`;

/** 数値 ±（正方形で押しやすく） */
export const uiBtnStepper = `${uiBtnSecondary} min-h-11 min-w-11 shrink-0 px-0 text-lg font-bold leading-none`;

/** ヘッダー右側 */
export const uiBtnHeader = `${uiBtnSecondary} min-h-10 px-3 py-2 text-sm font-medium`;

export const uiBtnHeaderPrimary = `${uiBtnPrimary} min-h-10 px-3.5 py-2`;

/** セグメント・単一選択（練習の対象など） */
export function uiToggleChoice(active: boolean): string {
  return active
    ? `${uiBtnBase} border-indigo-600 bg-indigo-50 text-indigo-950 shadow-inner ring-1 ring-inset ring-indigo-200`
    : `${uiBtnBase} border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50`;
}

/** 丸型トグル（チーム人数・候補フィルタ） */
const pillFocus = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2";

export function uiPill(active: boolean): string {
  return active
    ? `inline-flex min-h-9 items-center justify-center rounded-full border-2 border-indigo-600 bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors ${pillFocus}`
    : `inline-flex min-h-9 items-center justify-center rounded-full border border-zinc-300 bg-white px-3.5 py-1.5 text-xs font-medium text-zinc-700 shadow-sm transition-colors hover:bg-zinc-100 ${pillFocus}`;
}

export function uiPillSm(active: boolean): string {
  return active
    ? `inline-flex min-h-8 items-center justify-center rounded-full border-2 border-indigo-600 bg-indigo-600 px-2.5 py-1 text-xs font-semibold text-white transition-colors ${pillFocus}`
    : `inline-flex min-h-8 items-center justify-center rounded-full border border-zinc-300 bg-white px-2.5 py-1 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-100 ${pillFocus}`;
}

/** 一覧テーブル内のボタン風リンク */
export const uiLinkChip =
  `inline-flex min-h-9 items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50 ` +
  `px-2.5 py-1.5 text-xs font-semibold text-indigo-900 shadow-sm transition-colors hover:border-indigo-200 hover:bg-indigo-50`;

export const uiLinkChipAccent =
  `inline-flex min-h-9 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 ` +
  `px-2.5 py-1.5 text-xs font-semibold text-emerald-900 shadow-sm transition-colors hover:border-emerald-300 hover:bg-emerald-100`;
