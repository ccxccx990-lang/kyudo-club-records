"use client";

import { uiBtnPrimary, uiBtnSmSecondary, uiBtnStepper } from "@/lib/uiButtons";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

/** ネイティブ日付ピッカーを開く（透明オーバーレイより確実） */
function openNativeDatePicker(input: HTMLInputElement | null) {
  if (!input) return;
  try {
    const maybePromise = (input as HTMLInputElement & { showPicker?: () => void | Promise<void> }).showPicker?.();
    if (maybePromise != null && typeof (maybePromise as Promise<unknown>).then === "function") {
      void (maybePromise as Promise<unknown>).catch(() => {
        input.focus();
        input.click();
      });
      return;
    }
  } catch {
    // 非対応・非セキュアコンテキスト等
  }
  input.focus();
  input.click();
}

/** YYYY-MM-DD を yyyy/MM/dd 表記にする（表示用） */
function isoDateToYmdSlash(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return iso;
  return `${m[1]}/${m[2]}/${m[3]}`;
}

/** yyyy/MM/dd または YYYY-MM-DD を検証し、YYYY-MM-DD に正規化する */
function ymdSlashOrIsoToIso(s: string): string | null {
  const t = s.trim();
  const mSlash = /^(\d{4})\/(\d{2})\/(\d{2})$/.exec(t);
  const mDash = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  const m = mSlash ?? mDash;
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return null;
  const dt = new Date(y, mo - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

/** 正規練習の新規作成フォーム（管理者のみ表示） */
export function NewPracticeForm() {
  const router = useRouter();
  const today = new Date();
  const yyyyMmDd = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const [practiceDate, setPracticeDate] = useState(yyyyMmDd);
  const [dateDisplay, setDateDisplay] = useState(() => isoDateToYmdSlash(yyyyMmDd));
  const [memo, setMemo] = useState("");
  const [maxMato, setMaxMato] = useState(8);
  const [roundCount, setRoundCount] = useState(5);
  const [sessionKind, setSessionKind] = useState<"joint" | "match">("joint");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hiddenDateRef = useRef<HTMLInputElement>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = ymdSlashOrIsoToIso(dateDisplay);
    if (!parsed) {
      setError("日付は yyyy/MM/dd（例: 2026/04/11）で入力してください");
      return;
    }
    setPracticeDate(parsed);
    setDateDisplay(isoDateToYmdSlash(parsed));
    setBusy(true);
    setError(null);
    const res = await fetch("/api/practices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ practiceDate: parsed, memo, maxMato, roundCount, sessionKind }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? "作成に失敗しました");
      return;
    }
    const data = (await res.json()) as { session?: { id: string } };
    if (data.session?.id) {
      router.push(`/practices/${data.session.id}`);
      router.refresh();
    }
  };

  const fieldHalf = "block w-full sm:w-1/2 min-w-0 text-sm text-zinc-700";

  return (
    <form
      onSubmit={(e) => void submit(e)}
      className="space-y-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm"
    >
      <h2 className="text-sm font-semibold text-zinc-900">的中入力を追加</h2>
      <div className="space-y-3">
        <div className={fieldHalf}>
          <span className="block">入力日</span>
          <div className="mt-1 flex gap-2">
            <input
              id="new-practice-date"
              type="text"
              className="min-w-0 flex-1 rounded-md border border-zinc-300 px-3 py-2 tabular-nums"
              value={dateDisplay}
              placeholder="2026/04/11"
              autoComplete="off"
              inputMode="numeric"
              onChange={(e) => {
                const v = e.target.value;
                setDateDisplay(v);
                const iso = ymdSlashOrIsoToIso(v);
                if (iso) setPracticeDate(iso);
              }}
              onBlur={() => {
                const iso = ymdSlashOrIsoToIso(dateDisplay);
                if (iso) {
                  setPracticeDate(iso);
                  setDateDisplay(isoDateToYmdSlash(iso));
                } else {
                  setDateDisplay(isoDateToYmdSlash(practiceDate));
                }
              }}
            />
            <input
              ref={hiddenDateRef}
              type="date"
              tabIndex={-1}
              className="sr-only"
              value={practiceDate}
              onChange={(e) => {
                const v = e.target.value;
                if (!v) return;
                setPracticeDate(v);
                setDateDisplay(isoDateToYmdSlash(v));
                e.currentTarget.blur();
              }}
            />
            <button
              type="button"
              className={`${uiBtnSmSecondary} shrink-0`}
              title="カレンダーから選ぶ"
              onClick={() => openNativeDatePicker(hiddenDateRef.current)}
            >
              カレンダー
            </button>
          </div>
        </div>
        <label className={fieldHalf}>
          種別（個人的中率レポートの「区分」に反映）
          <select
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2"
            value={sessionKind}
            onChange={(e) => setSessionKind(e.target.value === "match" ? "match" : "joint")}
          >
            <option value="joint">正規練習</option>
            <option value="match">試合</option>
          </select>
        </label>
        <label className={fieldHalf}>
          メモ（場所など。任意）
          <textarea
            className="mt-1 w-full min-h-[5.5rem] resize-y rounded-md border border-zinc-300 px-3 py-2"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="例: 第1グラウンド"
            rows={4}
          />
        </label>
        <div className="block text-sm text-zinc-700">
          <span className="block">最大的数（1立ちあたりの的の数の上限・4〜24）</span>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <button type="button" className={uiBtnStepper} onClick={() => setMaxMato((n) => Math.max(4, n - 1))}>
              −
            </button>
            <span className="min-w-[2.5rem] text-center font-semibold text-zinc-900">{maxMato}</span>
            <button type="button" className={uiBtnStepper} onClick={() => setMaxMato((n) => Math.min(24, n + 1))}>
              +
            </button>
            <span className="text-xs text-zinc-500">チーム編成の立ち構成プレビューに使います</span>
          </div>
        </div>
        <div className="block text-sm text-zinc-700">
          <span className="block">立ち数（1〜30）</span>
          <div className="mt-1 flex items-center gap-2">
            <button type="button" className={uiBtnStepper} onClick={() => setRoundCount((n) => Math.max(1, n - 1))}>
              −
            </button>
            <span className="min-w-[2.5rem] text-center font-semibold text-zinc-900">{roundCount}</span>
            <button type="button" className={uiBtnStepper} onClick={() => setRoundCount((n) => Math.min(30, n + 1))}>
              +
            </button>
          </div>
        </div>
      </div>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <div className="flex justify-end">
        <button type="submit" disabled={busy} className={`${uiBtnPrimary} w-full max-w-md justify-center sm:w-auto`}>
          {busy ? "作成中…" : "作成して記録へ"}
        </button>
      </div>
    </form>
  );
}
