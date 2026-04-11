/** 的場人数の上限で「第何立ち」に何人入るかをまとめる（参考: kyudo-app_2.jsx の computeRoundPacking） */

export type RoundPack = { teams: string[][]; count: number; rem: number };

export function computeRoundPacking(lineupTeams: string[][], maxMato: number): RoundPack[] {
  const rounds: RoundPack[] = [];
  let ct: string[][] = [];
  let cc = 0;
  for (const team of lineupTeams) {
    // 空チーム [] = 立ちの区切り（手動「次の立ちへ」または最大的数到達で自動挿入）→ ここまでを 1 立ちとして確定する
    if (team.length === 0) {
      if (ct.length > 0) {
        rounds.push({ teams: [...ct], count: cc, rem: maxMato - cc });
        ct = [];
        cc = 0;
      }
      continue;
    }
    if (cc + team.length > maxMato && ct.length > 0) {
      rounds.push({ teams: ct, count: cc, rem: maxMato - cc });
      ct = [];
      cc = 0;
    }
    ct.push(team);
    cc += team.length;
  }
  if (ct.length > 0 || rounds.length === 0) {
    rounds.push({ teams: ct, count: cc, rem: maxMato - cc });
  }
  return rounds;
}
