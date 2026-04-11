/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * 部員サンプル（50名・男子は男向け・女子は女向けの名前／学年×男女は偏りなく近い人数）
 * 実行: npm run db:seed
 *
 * 部員が1人以上いるときは何もしない（的中 RoundRecord は Member 削除で CASCADE 消滅するため）。
 * DB を空にしてから入れ直すときだけ: SEED_RESET_MEMBERS=1 npm run db:seed
 *   （PowerShell: $env:SEED_RESET_MEMBERS="1"; npm run db:seed）（cmd: set SEED_RESET_MEMBERS=1&& npm run db:seed）
 * 的中のサンプル再投入: npm run db:seed:test-practices
 */
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

/** 表示名は「苗字 + 半角空白 + 名前」。苗字は50種固定、名前は男女で別リストから25件ずつ */
const SAMPLE_FAMILY = [
  "佐藤",
  "鈴木",
  "高橋",
  "田中",
  "渡辺",
  "伊藤",
  "山本",
  "中村",
  "小林",
  "加藤",
  "吉田",
  "山田",
  "佐々木",
  "山口",
  "松本",
  "井上",
  "木村",
  "林",
  "斎藤",
  "清水",
  "山崎",
  "森",
  "池田",
  "橋本",
  "阿部",
  "石川",
  "山下",
  "中島",
  "石井",
  "小川",
  "前田",
  "岡田",
  "長谷川",
  "藤田",
  "近藤",
  "坂本",
  "福田",
  "太田",
  "三浦",
  "藤原",
  "宮崎",
  "上田",
  "遠藤",
  "後藤",
  "田村",
  "青木",
  "野口",
  "原田",
  "中川",
  "藤井",
];

/** 男子向けの名前（25件・スロットの「男」が25人） */
const GIVEN_MALE = [
  "翔太",
  "大輔",
  "健一",
  "直樹",
  "拓也",
  "海斗",
  "慎太郎",
  "悠真",
  "颯太",
  "蓮",
  "湊",
  "樹",
  "奏",
  "陸",
  "蒼",
  "悠斗",
  "和也",
  "亮介",
  "隼人",
  "大智",
  "翼",
  "孝",
  "拓海",
  "昴",
  "陽向",
];

/** 女子向けの名前（25件・スロットの「女」が25人） */
const GIVEN_FEMALE = [
  "美咲",
  "咲良",
  "愛子",
  "結衣",
  "さくら",
  "陽菜",
  "凛",
  "心優",
  "美月",
  "美羽",
  "莉子",
  "七海",
  "柚子",
  "佳奈",
  "真由",
  "紗季",
  "結菜",
  "純",
  "芽衣",
  "千里",
  "明日香",
  "光",
  "澄",
  "暖",
  "彩花",
];

if (GIVEN_MALE.length !== 25 || GIVEN_FEMALE.length !== 25) {
  throw new Error("seed: 男女の名前行は25件ずつ必要です");
}

const GRADES = ["1年", "2年", "3年", "4年"];
const GENDERS = ["男", "女"];
const ROLES = [
  "主将",
  "女子責任者",
  "副将",
  "主務",
  "女子主務",
  "幹事",
  "副務",
  "広報",
  "学連",
  "体連",
];

/** 50件を 学年×男女 の8通りに近い件数で割り振る（7,7,6,6,6,6,6,6） */
function buildSlots() {
  const slots = [];
  const counts = [7, 7, 6, 6, 6, 6, 6, 6];
  let gi = 0;
  for (let g = 0; g < GRADES.length; g++) {
    for (let s = 0; s < GENDERS.length; s++) {
      const n = counts[gi++];
      for (let k = 0; k < n; k++) {
        slots.push({ gradeYear: GRADES[g], gender: GENDERS[s] });
      }
    }
  }
  return slots;
}

async function main() {
  const reset =
    process.env.SEED_RESET_MEMBERS === "1" ||
    process.env.SEED_RESET_MEMBERS === "true";

  const existingCount = await prisma.member.count();
  if (existingCount > 0 && !reset) {
    console.log(
      "部員が既に存在するためシードをスキップしました（的中データを守るため）。",
    );
    console.log(
      "部員を消して最初から入れ直すときは環境変数 SEED_RESET_MEMBERS=1 を付けてから npm run db:seed を実行してください。",
    );
    return;
  }

  if (reset) {
    const deleted = await prisma.member.deleteMany({});
    console.log(
      `SEED_RESET_MEMBERS: 削除した部員数（関連する的中も CASCADE で削除）: ${deleted.count}`,
    );
  }

  const slots = buildSlots();
  if (slots.length !== 50) {
    throw new Error(`expected 50 slots, got ${slots.length}`);
  }

  let maleGivenIndex = 0;
  let femaleGivenIndex = 0;
  const data = slots.map((slot, i) => {
    const isMale = slot.gender === "男";
    const given = isMale ? GIVEN_MALE[maleGivenIndex++] : GIVEN_FEMALE[femaleGivenIndex++];
    const name = `${SAMPLE_FAMILY[i]} ${given}`;
    const role = i % 4 === 0 ? "" : ROLES[i % ROLES.length];
    return {
      name,
      gradeYear: slot.gradeYear,
      gender: slot.gender,
      role,
    };
  });

  if (maleGivenIndex !== 25 || femaleGivenIndex !== 25) {
    throw new Error(
      `seed: 男女の人数想定外です（男=${maleGivenIndex} 女=${femaleGivenIndex}）`,
    );
  }
  const displayNames = data.map((d) => d.name);
  if (new Set(displayNames).size !== displayNames.length) {
    throw new Error("seed: 部員の表示名（苗字+半角空白+名前）に重複があります");
  }

  await prisma.member.createMany({ data });
  console.log("追加: 苗字バラエティ＋男女別の名前サンプル 50名");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
