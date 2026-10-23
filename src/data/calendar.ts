import type { BossId } from './types';

/** Một năm của lịch: Thổ Phỉ, vua địch thứ `king` (1..6) ở lần tấn công `attack`, Liên Quân hai vua, hoặc boss. */
export type CalendarSlotDef =
  | { kind: 'raiders' }
  | { kind: 'king'; king: 1 | 2 | 3 | 4 | 5 | 6; attack: 1 | 2 | 3 }
  | { kind: 'coalition'; kings: readonly [number, number] }
  | { kind: 'boss'; boss: BossId; ordinal: 1 | 2 | 3 };

const N: CalendarSlotDef = { kind: 'raiders' };
const K = (king: 1 | 2 | 3 | 4 | 5 | 6, attack: 1 | 2 | 3): CalendarSlotDef => ({ kind: 'king', king, attack });
const C = (a: number, b: number): CalendarSlotDef => ({ kind: 'coalition', kings: [a, b] });
const B = (ordinal: 1 | 2 | 3, boss: BossId): CalendarSlotDef => ({ kind: 'boss', boss, ordinal });

/** Lịch 30 năm cố định (spec §3.5): mỗi vua đúng 3 lần cách nhau ≥ 3 năm. */
export const FULL_CALENDAR: readonly CalendarSlotDef[] = [
  N, // 1
  N, // 2
  K(1, 1), // 3
  K(2, 1), // 4
  N, // 5
  K(1, 2), // 6
  K(3, 1), // 7
  K(2, 2), // 8
  K(1, 3), // 9
  B(1, 'boss_bog_ogre'), // 10
  K(3, 2), // 11
  K(4, 1), // 12
  K(2, 3), // 13
  N, // 14
  K(5, 1), // 15
  K(3, 3), // 16
  K(4, 2), // 17
  K(6, 1), // 18
  K(5, 2), // 19
  B(2, 'boss_hornet_queen'), // 20
  K(4, 3), // 21
  K(6, 2), // 22
  C(1, 2), // 23
  K(5, 3), // 24
  C(3, 4), // 25
  K(6, 3), // 26
  C(5, 6), // 27
  C(1, 4), // 28
  C(2, 5), // 29
  B(3, 'boss_crownless_king'), // 30
];
