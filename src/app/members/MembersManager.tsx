"use client";

import {
  buildMemberDisplayName,
  isCompleteMemberDisplayName,
  splitMemberDisplayName,
} from "@/lib/memberDisplayName";
import {
  GENDER_OPTIONS,
  GRADE_OPTIONS,
  ROLE_OPTIONS,
  joinRoleSlots,
  sortMembers,
  splitRoleSlots,
} from "@/lib/memberFields";
import { uiBtnMuted, uiBtnPrimary, uiBtnSmDanger, uiBtnSmSecondary } from "@/lib/uiButtons";
import { useRouter } from "next/navigation";
import { useMemo, useState, useEffect } from "react";

export type MemberRow = {
  id: string;
  name: string;
  /** ひらがな（読み）。並び順に使う */
  nameKana: string;
  gradeYear: string;
  gender: string;
  role: string;
};

type Props = {
  initialMembers: MemberRow[];
  isAdmin: boolean;
  /** true のとき DB 読み込み失敗などで編集 UI を出さない（閲覧のみ） */
  readOnlyDb?: boolean;
};

type RoleSlotPickerProps = {
  slots: string[];
  onSlotsChange: (next: string[]) => void;
  /** 先頭 select の id（ラベル htmlFor 用） */
  idPrefix: string;
  selectClassName: string;
};

/** 兼務用: 行ごとに独立した役職プルダウン（index を key にして選択が混線しないようにする） */
function RoleSlotPicker({ slots, onSlotsChange, idPrefix, selectClassName }: RoleSlotPickerProps) {
  const setSlot = (index: number, value: string) => {
    const next = [...slots];
    next[index] = value;
    onSlotsChange(next);
  };

  const removeSlot = (index: number) => {
    const next = slots.filter((_, j) => j !== index);
    onSlotsChange(next.length > 0 ? next : [""]);
  };

  const addSlot = () => {
    onSlotsChange([...slots, ""]);
  };

  return (
    <div className="space-y-2">
      {slots.map((slot, index) => (
        <div key={`${idPrefix}-${index}`} className="flex flex-wrap items-center gap-2">
          <select
            id={index === 0 ? `${idPrefix}-0` : undefined}
            className={`${selectClassName} min-w-[7rem] flex-1`}
            value={slot}
            onChange={(e) => setSlot(index, e.target.value)}
          >
            <option value="">なし</option>
            {slot && !ROLE_OPTIONS.includes(slot as (typeof ROLE_OPTIONS)[number]) ? (
              <option value={slot}>{slot}</option>
            ) : null}
            {ROLE_OPTIONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          {slots.length > 1 ? (
            <button type="button" className={`${uiBtnSmSecondary} shrink-0`} onClick={() => removeSlot(index)}>
              この役職を削除
            </button>
          ) : null}
        </div>
      ))}
      <button type="button" className={uiBtnSmSecondary} onClick={() => addSlot()}>
        役職追加
      </button>
    </div>
  );
}

/** 部員一覧と追加・保存（管理者のみ操作可） */
export function MembersManager({ initialMembers, isAdmin, readOnlyDb = false }: Props) {
  const canEdit = isAdmin && !readOnlyDb;
  const router = useRouter();
  const [rows, setRows] = useState<MemberRow[]>(initialMembers);
  const [newFamily, setNewFamily] = useState("");
  const [newGiven, setNewGiven] = useState("");
  const [newNameKana, setNewNameKana] = useState("");
  const [newGradeYear, setNewGradeYear] = useState("");
  const [newGender, setNewGender] = useState("");
  const [newRoleSlots, setNewRoleSlots] = useState<string[]>([""]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [filterGrade, setFilterGrade] = useState("");
  const [filterGender, setFilterGender] = useState("");
  const [nameSearch, setNameSearch] = useState("");

  useEffect(() => {
    setRows(initialMembers);
  }, [initialMembers]);

  const displayRows = useMemo(() => {
    let list = sortMembers(rows);
    if (filterGrade) list = list.filter((r) => r.gradeYear === filterGrade);
    if (filterGender) list = list.filter((r) => r.gender === filterGender);
    const q = nameSearch.trim().toLowerCase();
    if (q) {
      list = list.filter((r) => {
        const k = (r.nameKana ?? "").toLowerCase();
        return r.name.toLowerCase().includes(q) || k.includes(q);
      });
    }
    return list;
  }, [rows, filterGrade, filterGender, nameSearch]);

  const refresh = () => router.refresh();

  const patchRow = (id: string, patch: Partial<Omit<MemberRow, "id">>) => {
    if (!canEdit) return;
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const add = async () => {
    if (!canEdit) return;
    if (!newFamily.trim() || !newGiven.trim()) {
      setMsg("苗字と名前を入力してください");
      return;
    }
    if (!newGradeYear || !newGender) {
      setMsg("学年と男女を選んでください");
      return;
    }
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        familyName: newFamily.trim(),
        givenName: newGiven.trim(),
        nameKana: newNameKana.trim(),
        gradeYear: newGradeYear,
        gender: newGender,
        role: joinRoleSlots(newRoleSlots),
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setMsg(data.error ?? "追加に失敗しました");
      return;
    }
    setNewFamily("");
    setNewGiven("");
    setNewNameKana("");
    setNewGradeYear("");
    setNewGender("");
    setNewRoleSlots([""]);
    refresh();
  };

  const saveAll = async () => {
    if (!canEdit) return;
    for (const r of rows) {
      if (!isCompleteMemberDisplayName(r.name)) {
        setMsg("苗字と名前の両方が入っていない行があります。半角空白で区切った表示名に直してください。");
        return;
      }
    }
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/members/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ members: rows }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setMsg(data.error ?? "保存に失敗しました");
      return;
    }
    refresh();
  };

  const remove = async (id: string) => {
    if (!canEdit) return;
    if (!confirm("この部員を削除しますか？関連する記録も消えます。")) return;
    setBusy(true);
    setMsg(null);
    const res = await fetch(`/api/members/${id}`, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setMsg(data.error ?? "削除に失敗しました");
      return;
    }
    refresh();
  };

  /** 表内プルダウン: 学年と男女で高さを揃える */
  const rowSelectClass =
    "w-full min-h-[2.5rem] min-w-0 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm";

  const gradeSelect = (value: string, onChange: (v: string) => void, id?: string) => (
    <select
      id={id}
      className={`${rowSelectClass} min-w-[5rem]`}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">—</option>
      {GRADE_OPTIONS.map((g) => (
        <option key={g} value={g}>
          {g}
        </option>
      ))}
    </select>
  );

  const genderSelect = (value: string, onChange: (v: string) => void, id?: string) => (
    <select
      id={id}
      className={`${rowSelectClass} min-w-[4rem]`}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">—</option>
      {GENDER_OPTIONS.map((g) => (
        <option key={g} value={g}>
          {g}
        </option>
      ))}
    </select>
  );

  return (
    <div className="space-y-6">
      {msg ? <p className="text-sm text-red-700">{msg}</p> : null}

      {canEdit ? (
        <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-zinc-900">部員を追加</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block text-sm text-zinc-700">
              苗字 <span className="text-red-600">*</span>
              <input
                className="mt-1 w-full min-h-[2.5rem] rounded-md border border-zinc-300 px-3 py-2"
                value={newFamily}
                onChange={(e) => setNewFamily(e.target.value)}
                placeholder="例: 山田"
                autoComplete="family-name"
              />
            </label>
            <label className="block text-sm text-zinc-700">
              名前 <span className="text-red-600">*</span>
              <input
                className="mt-1 w-full min-h-[2.5rem] rounded-md border border-zinc-300 px-3 py-2"
                value={newGiven}
                onChange={(e) => setNewGiven(e.target.value)}
                placeholder="例: 太郎"
                autoComplete="given-name"
              />
            </label>
            <label className="block text-sm text-zinc-700 sm:col-span-2">
              ひらがな（読み・任意）
              <input
                className="mt-1 w-full min-h-[2.5rem] rounded-md border border-zinc-300 px-3 py-2"
                value={newNameKana}
                onChange={(e) => setNewNameKana(e.target.value)}
                placeholder="並び順に使います（例: やまだ たろう）"
                autoComplete="off"
              />
            </label>
            <label className="block text-sm text-zinc-700" htmlFor="new-grade">
              学年 <span className="text-red-600">*</span>
              <span className="mt-1 block">{gradeSelect(newGradeYear, setNewGradeYear, "new-grade")}</span>
            </label>
            <label className="block text-sm text-zinc-700" htmlFor="new-gender">
              男女 <span className="text-red-600">*</span>
              <span className="mt-1 block">{genderSelect(newGender, setNewGender, "new-gender")}</span>
            </label>
            <label className="block text-sm text-zinc-700 sm:col-span-2" htmlFor="new-role-0">
              役職
              <span className="mt-1 block">
                <RoleSlotPicker
                  slots={newRoleSlots}
                  onSlotsChange={setNewRoleSlots}
                  idPrefix="new-role"
                  selectClassName="w-full min-h-[2.5rem] rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
                />
              </span>
            </label>
          </div>
          <div className="mt-3 flex flex-wrap justify-end gap-2">
            <button
              type="button"
              disabled={busy || !newFamily.trim() || !newGiven.trim() || !newGradeYear || !newGender}
              className={uiBtnPrimary}
              onClick={() => void add()}
            >
              追加
            </button>
          </div>

          <div className="mt-6 border-t border-zinc-100 pt-4">
            <div className="flex justify-end">
              <button
                type="button"
                disabled={busy || rows.length === 0}
                className={uiBtnMuted}
                onClick={() => void saveAll()}
              >
                一覧を保存
              </button>
            </div>
            <p className="mt-2 text-xs text-zinc-500">
              下の表で変更した内容をサーバーに反映します。
            </p>
          </div>
        </section>
      ) : null}

      <section className="space-y-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-900">絞り込み・検索</h2>
        <div className="flex flex-wrap gap-3">
          <label className="block text-sm text-zinc-700">
            学年
            <select
              className="mt-1 block min-w-[8rem] rounded-md border border-zinc-300 px-3 py-2"
              value={filterGrade}
              onChange={(e) => setFilterGrade(e.target.value)}
            >
              <option value="">すべて</option>
              {GRADE_OPTIONS.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm text-zinc-700">
            男女
            <select
              className="mt-1 block min-w-[8rem] rounded-md border border-zinc-300 px-3 py-2"
              value={filterGender}
              onChange={(e) => setFilterGender(e.target.value)}
            >
              <option value="">すべて</option>
              {GENDER_OPTIONS.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </label>
          <label className="block min-w-[12rem] flex-1 text-sm text-zinc-700">
            名前検索
            <input
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2"
              value={nameSearch}
              onChange={(e) => setNameSearch(e.target.value)}
              placeholder="部分一致"
            />
          </label>
        </div>
      </section>

      <section className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm">
        <table className="w-full min-w-[960px] text-left text-sm">
          <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-4 py-3">学年</th>
              <th className="px-4 py-3">男女</th>
              <th className="px-4 py-3">苗字</th>
              <th className="px-4 py-3">名前</th>
              <th className="px-4 py-3">ひらがな</th>
              <th className="px-4 py-3">役職</th>
              {canEdit ? <th className="px-4 py-3">操作</th> : null}
            </tr>
          </thead>
          <tbody>
            {displayRows.map((m) =>
              canEdit ? (
                <tr key={m.id} className="border-t border-zinc-100">
                  <td className="px-4 py-2">{gradeSelect(m.gradeYear, (v) => patchRow(m.id, { gradeYear: v }))}</td>
                  <td className="px-4 py-2">{genderSelect(m.gender, (v) => patchRow(m.id, { gender: v }))}</td>
                  <td className="px-4 py-2">
                    <input
                      className="w-full min-w-[6rem] min-h-[2.5rem] rounded-md border border-zinc-300 px-3 py-2"
                      value={splitMemberDisplayName(m.name).familyName}
                      onChange={(e) => {
                        const { givenName } = splitMemberDisplayName(m.name);
                        patchRow(m.id, {
                          name: buildMemberDisplayName(e.target.value, givenName),
                        });
                      }}
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      className="w-full min-w-[6rem] min-h-[2.5rem] rounded-md border border-zinc-300 px-3 py-2"
                      value={splitMemberDisplayName(m.name).givenName}
                      onChange={(e) => {
                        const { familyName } = splitMemberDisplayName(m.name);
                        patchRow(m.id, {
                          name: buildMemberDisplayName(familyName, e.target.value),
                        });
                      }}
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      className="w-full min-w-[7rem] min-h-[2.5rem] rounded-md border border-zinc-300 px-3 py-2"
                      value={m.nameKana ?? ""}
                      onChange={(e) => patchRow(m.id, { nameKana: e.target.value })}
                      placeholder="読み"
                    />
                  </td>
                  <td className="px-4 py-2 align-top">
                    <RoleSlotPicker
                      slots={splitRoleSlots(m.role)}
                      onSlotsChange={(next) => patchRow(m.id, { role: joinRoleSlots(next) })}
                      idPrefix={`row-${m.id}-role`}
                      selectClassName={rowSelectClass}
                    />
                  </td>
                  <td className="px-4 py-2">
                    <button type="button" className={uiBtnSmDanger} onClick={() => void remove(m.id)}>
                      削除
                    </button>
                  </td>
                </tr>
              ) : (
                <tr key={m.id} className="border-t border-zinc-100">
                  <td className="px-4 py-3 text-zinc-700">{m.gradeYear || "—"}</td>
                  <td className="px-4 py-3 text-zinc-700">{m.gender || "—"}</td>
                  <td className="px-4 py-3 font-medium text-zinc-900">
                    {splitMemberDisplayName(m.name).familyName || "—"}
                  </td>
                  <td className="px-4 py-3 font-medium text-zinc-900">
                    {splitMemberDisplayName(m.name).givenName || "—"}
                  </td>
                  <td className="px-4 py-3 text-zinc-600">{m.nameKana?.trim() ? m.nameKana : "—"}</td>
                  <td className="px-4 py-3 text-zinc-700">{m.role || "—"}</td>
                </tr>
              ),
            )}
            {displayRows.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-zinc-500" colSpan={canEdit ? 7 : 6}>
                  {rows.length === 0
                    ? readOnlyDb
                      ? "一覧を読み込めませんでした。画面の上の案内を確認してください。"
                      : "部員がまだいません。管理者が追加してください。"
                    : "条件に一致する部員がありません。"}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </div>
  );
}
