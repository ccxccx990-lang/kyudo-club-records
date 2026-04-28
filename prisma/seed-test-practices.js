/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * テスト用の正規練習・〇×記録を一括投入する。
 * - 3/1〜4/11（UTC 日付）まで「一日おき」の各日に、全員／男子のみ／女子のみの 3 練習
 * - 各練習: 立目数 5（20 射）、的中はランダム、チーム人数・最大的数・チーム編成順はセッションごとにばらつき
 *
 * 前提: 部員が既に存在すること（例: npm run db:seed）
 * 実行: npm run db:seed:test-practices
 *
 * 既存の同タグデータは削除してから再投入する（memo に [テスト練習データ] を含む行）。
 */
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const MEMO_TAG = "[テスト練習データ]";
const START = "2026-03-01";
const END = "2026-04-11";

const GRADE_ORDER = ["1年", "2年", "3年", "4年"];

function gradeRank(g) {
  const i = GRADE_ORDER.indexOf(g);
  return i === -1 ? 99 : i;
}

function genderRank(g) {
  if (g === "男") return 0;
  if (g === "女") return 1;
  return 2;
}

function memberSortReading(m) {
  const k = (m.nameKana ?? "").trim();
  return k.length > 0 ? k : m.name.trim();
}

/** アプリの sortMembers と同じ並び */
function sortMembersLike(members) {
  return [...members].sort((a, b) => {
    const g = gradeRank(a.gradeYear) - gradeRank(b.gradeYear);
    if (g !== 0) return g;
    const s = genderRank(a.gender) - genderRank(b.gender);
    if (s !== 0) return s;
    return memberSortReading(a).localeCompare(memberSortReading(b), "ja");
  });
}

function membersInGenderScope(members, scope) {
  if (scope === "男") return members.filter((m) => m.gender === "男");
  if (scope === "女") return members.filter((m) => m.gender === "女");
  return members;
}

function tailMemberCountForLineup(teams) {
  let start = 0;
  for (let i = teams.length - 1; i >= 0; i--) {
    if (teams[i].length === 0) {
      start = i + 1;
      break;
    }
  }
  let n = 0;
  for (let i = start; i < teams.length; i++) n += teams[i].length;
  return n;
}

function addMemberToLineupTeams(prev, memberId, teamSize, maxMato) {
  const copy = prev.map((t) => [...t]);
  const tailCount = tailMemberCountForLineup(copy);
  const lastTeam = copy.length > 0 ? copy[copy.length - 1] : null;
  if (tailCount >= maxMato && lastTeam && lastTeam.length > 0) copy.push([]);
  if (copy.length === 0) return [[memberId]];
  const li = copy.length - 1;
  if (copy[li].length === 0) {
    copy.push([memberId]);
    return copy;
  }
  if (copy[li].length >= teamSize) {
    copy.push([memberId]);
    return copy;
  }
  copy[li] = [...copy[li], memberId];
  return copy;
}

/** 出席者 ID 列（並びは呼び出し側でシャッフル済み想定）からチーム＋立ち区切り */
function buildLineupFromOrder(ids, teamSize, maxMato) {
  const ts = Math.min(6, Math.max(1, Math.floor(teamSize) || 4));
  const cap = Math.max(4, Math.min(24, Math.floor(maxMato) || 8));
  let teams = [];
  for (const id of ids) {
    teams = addMemberToLineupTeams(teams, id, ts, cap);
  }
  return teams;
}

function validateLineupTeams(teams, attendingIds) {
  const flat = teams.flat();
  if (flat.length === 0) return "empty";
  if (flat.length !== attendingIds.size) return "size";
  const seen = new Set();
  for (const id of flat) {
    if (!attendingIds.has(id)) return "foreign";
    if (seen.has(id)) return "dup";
    seen.add(id);
  }
  if (seen.size !== attendingIds.size) return "missing";
  return null;
}

/** 決定的だがセッションごとに変わる乱数（0〜1） */
function rng01(seedStr) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seedStr.length; i++) {
    h ^= seedStr.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296;
}

function shuffleInPlace(arr, seedStr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const r = rng01(`${seedStr}:${i}`);
    const j = Math.floor(r * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function randomMarks(seedStr, ri) {
  let s = "";
  for (let k = 0; k < 4; k++) {
    const r = rng01(`${seedStr}:marks:${ri}:${k}`);
    s += r < 0.42 ? "o" : "x";
  }
  return s;
}

function addDaysIso(iso, deltaDays) {
  const [y, m, dd] = iso.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1, dd));
  d.setUTCDate(d.getUTCDate() + deltaDays);
  const y2 = d.getUTCFullYear();
  const m2 = String(d.getUTCMonth() + 1).padStart(2, "0");
  const d2 = String(d.getUTCDate()).padStart(2, "0");
  return `${y2}-${m2}-${d2}`;
}

function* everyOtherDay(from, to) {
  let cur = from;
  while (cur <= to) {
    yield cur;
    cur = addDaysIso(cur, 2);
  }
}

async function main() {
  const members = await prisma.member.findMany({
    select: { id: true, name: true, gradeYear: true, gender: true },
  });
  if (members.length === 0) {
    throw new Error("部員が0件です。先に npm run db:seed を実行してください。");
  }

  const del = await prisma.practiceSession.deleteMany({
    where: { memo: { contains: MEMO_TAG } },
  });
  console.log(`削除: テスト練習（memo に ${MEMO_TAG} を含む件） ${del.count} 件`);

  const scopes = [
    { genderScope: "all", label: "全員" },
    { genderScope: "男", label: "男子のみ" },
    { genderScope: "女", label: "女子のみ" },
  ];

  let createdSessions = 0;
  let createdRecords = 0;

  for (const practiceDate of everyOtherDay(START, END)) {
    for (const { genderScope, label } of scopes) {
      const inScope = membersInGenderScope(members, genderScope);
      if (inScope.length === 0) {
        console.warn(`スキップ（対象0人）: ${practiceDate} ${label}`);
        continue;
      }

      const seedBase = `${practiceDate}:${genderScope}`;
      const teamSize = 3 + Math.floor(rng01(`${seedBase}:ts`) * 3);
      const maxMato = 6 + Math.floor(rng01(`${seedBase}:mm`) * 5);

      const sorted = sortMembersLike(inScope);
      const ids = sorted.map((m) => m.id);
      shuffleInPlace(ids, `${seedBase}:order1`);

      const absentCount = Math.min(
        Math.floor(rng01(`${seedBase}:abs`) * 3),
        Math.max(0, ids.length - 4),
      );
      // slice(-0) は slice(0) と同じで全件になるため、0 件のときは空 Set にする
      const absentIds =
        absentCount === 0 ? new Set() : new Set(ids.slice(-absentCount));
      const presentIds = ids.filter((id) => !absentIds.has(id));

      const attendance = {};
      for (const m of inScope) {
        attendance[m.id] = absentIds.has(m.id) ? "absent" : "present";
      }

      let lineupTeams = buildLineupFromOrder([...presentIds], teamSize, maxMato);
      const attendingSet = new Set(presentIds);
      if (validateLineupTeams(lineupTeams, attendingSet) !== null) {
        lineupTeams = buildLineupFromOrder(sortMembersLike(inScope.filter((m) => presentIds.includes(m.id))).map((m) => m.id), teamSize, maxMato);
      }
      if (validateLineupTeams(lineupTeams, attendingSet) !== null) {
        throw new Error(`チーム編成が検証に失敗: ${practiceDate} ${label}`);
      }

      const memo = `${MEMO_TAG} ${practiceDate} ${label}（1日おき・20射・チーム${teamSize}人・最大的数${maxMato}）`;

      const session = await prisma.practiceSession.create({
        data: {
          practiceDate,
          memo,
          roundCount: 5,
          genderScope,
          attendanceJson: JSON.stringify(attendance),
          lineupTeamsJson: JSON.stringify(lineupTeams),
          teamSize,
          maxMato,
        },
      });
      createdSessions++;

      const records = [];
      for (const mid of presentIds) {
        for (let ri = 1; ri <= 5; ri++) {
          records.push({
            sessionId: session.id,
            memberId: mid,
            roundIndex: ri,
            marks: randomMarks(`${seedBase}:${mid}`, ri),
          });
        }
      }
      if (records.length) {
        const batch = await prisma.roundRecord.createMany({ data: records });
        createdRecords += batch.count;
      }
    }
  }

  console.log(`作成: PracticeSession ${createdSessions} 件, RoundRecord ${createdRecords} 件`);
  console.log(`期間: ${START} 〜 ${END}（2日おき）× 3 参加区分`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
