"use client";

import { NewPracticeForm } from "./NewPracticeForm";

/** 入力ページ本体（新規作成フォームと案内） */
export function PracticesInputPanel() {
  return (
    <div className="space-y-6">
      <section className="space-y-2 rounded-xl border border-indigo-100 bg-indigo-50/40 p-4 text-sm text-zinc-800 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-900">参加区分・出席・チーム（管理者）</h2>
        <p className="leading-relaxed text-zinc-700">
          まず下の「的中入力を追加」で入力日を登録し、作成後に開く練習ページで
          <strong className="text-zinc-900">参加区分・出席</strong>
          を確定させてください。続けて
          <strong className="text-zinc-900">チーム編成（1チーム1〜6人）</strong>
          のページで並びを組み、最後に的中ページで記録します。一覧の確認は上部ナビの「的中記録」から行えます。
        </p>
      </section>

      <NewPracticeForm />
    </div>
  );
}
