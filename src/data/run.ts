import type { CardId } from './types';

/** Hằng số ván (spec §3.1); giá trị tinh chỉnh ban đầu. */
export const RUN = {
  startLives: 3,
  maxLives: 4, // chỉ vượt 3 nhờ sắc lệnh/perk
  startGold: 5,
  taxPerYear: 3, // thu nhập cố định đầu mỗi năm
  handSize: 3,
  skipPlayGold: 2, // bán/bỏ một thẻ thay cho việc chơi thẻ
  skipRewardGold: 3, // bỏ qua thẻ thưởng
  conquestGold: 5,
  maxLevel: 5,
  maxEnchantStacks: 4,
} as const;

/** Vàng khi thắng trận năm y (trước nhân boss). */
export const battleGold = (year: number): number => 2 + Math.ceil(year / 3);
/** Giá lần đổi bài thứ n (n = 1, 2, …) trong cùng một năm: 1, 2, 4, 8, … (không dùng `**`). */
export const rerollCost = (n: number): number => {
  let cost = 1;
  for (let i = 1; i < n; i++) cost *= 2;
  return cost;
};
/** Giá mở ô thứ k+1 bằng vàng (k = số ô đã MUA bằng vàng trước đó): 4, 6, 8, … 34. */
export const unlockCost = (k: number): number => 4 + 2 * k;

/** Bộ bài khởi đầu cố định G1 (11 bản). */
export const START_DECK_G1: readonly CardId[] = [
  'wheat_militia',
  'wheat_militia',
  'wheat_scarecrow',
  'wheat_scarecrow',
  'wheat_reapers',
  'neutral_barracks',
  'neutral_barracks',
  'neutral_archer_tower',
  'neutral_archer_tower',
  'neutral_clear_land',
  'neutral_move',
];

export const REWARD = { choices: 3, kingShare: 0.65 } as const;

/** Trọng số độ hiếm (thường, vừa, hiếm) theo năm (§3.8); mỗi bộ cộng 100. */
export function rewardRarityWeights(year: number): readonly [number, number, number] {
  if (year < 10) return [60, 30, 10];
  if (year < 20) return [45, 35, 20];
  return [30, 40, 30];
}
