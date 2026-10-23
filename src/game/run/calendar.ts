/** Lịch kẻ địch và bộ bài khởi đầu (spec §3.4, §3.5, §14 G2). Thuần, deterministic. */
import { Rng, hashSeed } from '../../core/random';
import { SLOT_MULT } from '../../data/battle';
import { FULL_CALENDAR, type CalendarSlotDef } from '../../data/calendar';
import type { Rules } from '../../data/rules';
import type { CardId, KingDef, KingId } from '../../data/types';

/** Một năm của lịch: Thổ Phỉ, vua địch `K1..K6` ở lần tấn công thứ `attack`, Liên Quân hoặc boss. */
export type CalendarSlot = CalendarSlotDef;

const N: CalendarSlot = { kind: 'raiders' };
const K = (king: 1 | 2, attack: 1 | 2 | 3): CalendarSlot => ({ kind: 'king', king, attack });

/** Lịch 15 năm của G2 (spec §14): hai vua, mỗi vua ba lần cách nhau ≥ 3 năm. */
const SHORT: readonly CalendarSlot[] = [
  N,
  N,
  K(1, 1),
  K(2, 1),
  N,
  K(1, 2),
  N,
  K(2, 2),
  K(1, 3),
  N,
  N,
  K(2, 3),
  N,
  N,
  N,
];

/** Hệ số ngân sách của một năm: Thổ Phỉ `raiders`, vua theo lần tấn công 1..3 (spec §3.6). */
export function slotMultFor(slot: CalendarSlot): number {
  switch (slot.kind) {
    case 'raiders':
      return SLOT_MULT.raiders;
    case 'king':
      return SLOT_MULT.kingAttack[slot.attack - 1]!;
    case 'coalition':
      return SLOT_MULT.coalition;
    case 'boss':
      return SLOT_MULT.boss[slot.ordinal - 1]!;
  }
}

/** Kẻ tấn công từng năm 1..`rules.years`. */
export function calendarFor(rules: Rules): readonly CalendarSlot[] {
  if (rules.calendar === 'short') return SHORT.slice(0, rules.years);
  if (rules.calendar === 'full') return FULL_CALENDAR.slice(0, rules.years);
  return Array.from({ length: rules.years }, () => N);
}

/**
 * Hai vua địch: các vua trong `pool` trừ vua người chơi, xáo bằng `Rng(stream 'calendar')`
 * (Fisher–Yates), lấy tối đa 2. Pool nhỏ hơn thì trả ít hơn, không lỗi.
 */
export function pickEnemyKings(seed: number, playerKing: KingId, pool: readonly KingId[]): KingId[] {
  return pickEnemyKingsWithState(seed, playerKing, pool, 2).kings;
}

/** Như `pickEnemyKings` nhưng lấy `count` vua và trả thêm trạng thái RNG `calendar` sau khi xáo (để lưu vào ván). */
export function pickEnemyKingsWithState(
  seed: number,
  playerKing: KingId,
  pool: readonly KingId[],
  count: number,
): { kings: KingId[]; rngState: number } {
  const others = pool.filter((k) => k !== playerKing);
  const rng = new Rng(hashSeed(`${seed}:calendar`));
  for (let i = others.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    const tmp = others[i]!;
    others[i] = others[j]!;
    others[j] = tmp;
  }
  return { kings: others.slice(0, count), rngState: rng.getState() };
}

/** Bộ bài khởi đầu của vua: mỗi thẻ thường ×2 + mỗi thẻ vừa ×1, không thẻ hiếm, không Ngai (§3.4). */
export function startDeck(king: KingDef): CardId[] {
  const deck: CardId[] = [];
  for (const card of king.cards) {
    if (card.rarity === 'common') deck.push(card.id, card.id);
    else if (card.rarity === 'uncommon') deck.push(card.id);
  }
  return deck;
}
