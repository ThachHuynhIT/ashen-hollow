import type { CardId } from './types';

export const RUN = { startLives: 3, handSize: 3, maxLevel: 5 } as const;

/** `autoStart`: trận tự bắt đầu sau khi chơi/bán thẻ (spec §3.2); từ G2 tắt để còn đổi bài, mua ô. */
export const RULES_G1 = { years: 10, calendar: 'raiders', autoStart: true } as const;

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
