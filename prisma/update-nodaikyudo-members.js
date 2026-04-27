/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * 東京農業大学弓道部公式サイト（2026年4月）の部員一覧表に合わせて、
 * 既存の部員IDをできるだけ残したまま部員情報を更新する。
 * ページ本文の「49名」に対し、表の掲載氏名は50名あるため表を正とする。
 *
 * 実行: node prisma/update-nodaikyudo-members.js
 */
const fs = require("node:fs");
const path = require("node:path");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const SOURCE_URL = "https://nodaikyudo.fc2.page/about/";

const members = [
  { gradeYear: "4年", gender: "男", role: "主将", name: "松本 達樹" },
  { gradeYear: "4年", gender: "男", role: "副将", name: "田中 孝治" },
  { gradeYear: "4年", gender: "男", role: "主務", name: "水島 正博" },
  { gradeYear: "4年", gender: "男", role: "", name: "近藤 佑一郎" },
  { gradeYear: "4年", gender: "男", role: "", name: "神保 耕汰" },
  { gradeYear: "4年", gender: "女", role: "女子責任者", name: "蝦名 優花" },
  { gradeYear: "4年", gender: "女", role: "", name: "竹下 百音" },
  { gradeYear: "3年", gender: "男", role: "副務、幹事", name: "和田 創太" },
  { gradeYear: "3年", gender: "男", role: "会計", name: "島倉 一樹" },
  { gradeYear: "3年", gender: "男", role: "広報", name: "寺川 奏真" },
  { gradeYear: "3年", gender: "女", role: "女子主務、広報", name: "吉池 莉唯" },
  { gradeYear: "3年", gender: "女", role: "弓友会連絡委員", name: "稲垣 木乃香" },
  { gradeYear: "3年", gender: "女", role: "学生弓道連盟専任委員", name: "永田 真菜" },
  { gradeYear: "3年", gender: "女", role: "", name: "石黒 葵" },
  { gradeYear: "3年", gender: "女", role: "", name: "王丸 惺那" },
  { gradeYear: "3年", gender: "女", role: "", name: "關口 真幸香" },
  { gradeYear: "3年", gender: "女", role: "", name: "田ノ下 莉菜" },
  { gradeYear: "3年", gender: "女", role: "", name: "塚原 美心" },
  { gradeYear: "3年", gender: "女", role: "", name: "山口 椛" },
  { gradeYear: "2年", gender: "男", role: "弓友会連絡委員", name: "矢ケ﨑 悠輔" },
  { gradeYear: "2年", gender: "男", role: "広報", name: "藤井 渓伍" },
  { gradeYear: "2年", gender: "男", role: "", name: "青木 一真" },
  { gradeYear: "2年", gender: "男", role: "", name: "片山 哲" },
  { gradeYear: "2年", gender: "男", role: "", name: "斎藤 健太" },
  { gradeYear: "2年", gender: "男", role: "", name: "諏訪 双滝" },
  { gradeYear: "2年", gender: "男", role: "", name: "松本 白虎" },
  { gradeYear: "2年", gender: "女", role: "副会計", name: "橋本 美咲" },
  { gradeYear: "2年", gender: "女", role: "広報", name: "小出 由理" },
  { gradeYear: "2年", gender: "女", role: "学生弓道連盟専任委員", name: "村田 朋香" },
  { gradeYear: "2年", gender: "女", role: "", name: "佐藤 琴心" },
  { gradeYear: "2年", gender: "女", role: "", name: "髙橋 小夏" },
  { gradeYear: "2年", gender: "女", role: "", name: "東 優希" },
  { gradeYear: "2年", gender: "女", role: "", name: "二木 秋音" },
  { gradeYear: "2年", gender: "女", role: "", name: "舟木 ほのか" },
  { gradeYear: "2年", gender: "女", role: "", name: "松田 悠里" },
  { gradeYear: "1年", gender: "男", role: "", name: "赤瀬 崇太" },
  { gradeYear: "1年", gender: "男", role: "", name: "阿部 晄英" },
  { gradeYear: "1年", gender: "男", role: "", name: "伊藤 遼成" },
  { gradeYear: "1年", gender: "男", role: "", name: "大垣 正仁" },
  { gradeYear: "1年", gender: "男", role: "", name: "菊池 倖平" },
  { gradeYear: "1年", gender: "男", role: "", name: "島田 陸" },
  { gradeYear: "1年", gender: "男", role: "", name: "田室 成埜" },
  { gradeYear: "1年", gender: "男", role: "", name: "松本 悠久" },
  { gradeYear: "1年", gender: "男", role: "", name: "緑川 遼司" },
  { gradeYear: "1年", gender: "女", role: "", name: "菊田 千世" },
  { gradeYear: "1年", gender: "女", role: "", name: "小林 美愛" },
  { gradeYear: "1年", gender: "女", role: "", name: "西村 香音" },
  { gradeYear: "1年", gender: "女", role: "", name: "牧 咲来" },
  { gradeYear: "1年", gender: "女", role: "", name: "松村 璃々香" },
  { gradeYear: "1年", gender: "女", role: "", name: "山田 玲奈" },
];

const gradeRank = new Map([
  ["1年", 0],
  ["2年", 1],
  ["3年", 2],
  ["4年", 3],
]);

function genderRank(gender) {
  if (gender === "男") return 0;
  if (gender === "女") return 1;
  return 2;
}

function sortMembers(rows) {
  return [...rows].sort((a, b) => {
    const grade = (gradeRank.get(a.gradeYear) ?? 99) - (gradeRank.get(b.gradeYear) ?? 99);
    if (grade !== 0) return grade;
    const gender = genderRank(a.gender) - genderRank(b.gender);
    if (gender !== 0) return gender;
    return a.name.localeCompare(b.name, "ja");
  });
}

function assertOfficialCounts() {
  if (members.length !== 50) {
    throw new Error(`公式ページの表は50名の想定です: ${members.length}`);
  }

  const expected = new Map([
    ["4年:男", 5],
    ["4年:女", 2],
    ["3年:男", 3],
    ["3年:女", 9],
    ["2年:男", 7],
    ["2年:女", 9],
    ["1年:男", 9],
    ["1年:女", 6],
  ]);

  for (const [key, count] of expected) {
    const actual = members.filter((m) => `${m.gradeYear}:${m.gender}` === key).length;
    if (actual !== count) {
      throw new Error(`${key} の人数が想定外です: ${actual}`);
    }
  }
}

async function main() {
  assertOfficialCounts();

  const existingMembers = sortMembers(await prisma.member.findMany());
  if (existingMembers.length < members.length) {
    throw new Error(
      `既存部員が足りません: existing=${existingMembers.length}, official=${members.length}`,
    );
  }

  const allRecords = await prisma.roundRecord.findMany({
    select: { id: true, sessionId: true, memberId: true, roundIndex: true, marks: true },
  });
  const backup = {
    sourceUrl: SOURCE_URL,
    createdAt: new Date().toISOString(),
    existingMembers,
    allRecords,
  };
  const backupPath = path.join(
    __dirname,
    `member-update-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
  );
  fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2));

  const sortedOfficial = sortMembers(members);
  const updates = sortedOfficial.map((member, index) =>
    prisma.member.update({
      where: { id: existingMembers[index].id },
      data: member,
    }),
  );

  const extraMembers = existingMembers.slice(sortedOfficial.length);
  const extraMemberIds = extraMembers.map((m) => m.id);
  const extraRecordCount = extraMemberIds.length
    ? await prisma.roundRecord.count({ where: { memberId: { in: extraMemberIds } } })
    : 0;

  await prisma.$transaction([
    ...updates,
    ...(extraMemberIds.length
      ? [prisma.member.deleteMany({ where: { id: { in: extraMemberIds } } })]
      : []),
  ]);

  console.log(
    JSON.stringify(
      {
        sourceUrl: SOURCE_URL,
        updated: sortedOfficial.length,
        deletedExtraMembers: extraMembers.map((m) => ({ id: m.id, name: m.name })),
        deletedExtraRecordCount: extraRecordCount,
        backupPath,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
