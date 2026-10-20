import { describe, expect, it } from 'vitest';
import { RULES_G1, RULES_G2 } from '../../data/rules';
import type { KingDef, KingId } from '../../data/types';
import { CONTENT } from '../cards/registry';
import { calendarFor, pickEnemyKings, startDeck, type CalendarSlot } from './calendar';

const N: CalendarSlot = { kind: 'raiders' };
const K = (king: 1 | 2, attack: 1 | 2 | 3): CalendarSlot => ({ kind: 'king', king, attack });

describe('calendarFor', () => {
  it("lays out the 15-year 'short' calendar of spec §14 (G2)", () => {
    expect(calendarFor(RULES_G2)).toEqual([
      N, // 1
      N, // 2
      K(1, 1), // 3
      K(2, 1), // 4
      N, // 5
      K(1, 2), // 6
      N, // 7
      K(2, 2), // 8
      K(1, 3), // 9
      N, // 10
      N, // 11
      K(2, 3), // 12
      N, // 13
      N, // 14
      N, // 15
    ]);
  });

  it('attacks each king exactly three times, at least three years apart', () => {
    const slots = calendarFor(RULES_G2);
    for (const king of [1, 2] as const) {
      const years = slots.flatMap((s, i) => (s.kind === 'king' && s.king === king ? [i + 1] : []));
      expect(years).toHaveLength(3);
      for (let i = 1; i < years.length; i++) expect(years[i]! - years[i - 1]!).toBeGreaterThanOrEqual(3);
      const attacks = slots.flatMap((s) => (s.kind === 'king' && s.king === king ? [s.attack] : []));
      expect(attacks).toEqual([1, 2, 3]);
    }
  });

  it("is all raiders for the 'raiders' calendar, one slot per year", () => {
    const slots = calendarFor(RULES_G1);
    expect(slots).toHaveLength(RULES_G1.years);
    expect(slots.every((s) => s.kind === 'raiders')).toBe(true);
  });
});

describe('pickEnemyKings', () => {
  const pool: readonly KingId[] = ['wheat', 'stone', 'arcane'];

  it('picks the two other kings, never the player king', () => {
    for (const player of pool) {
      for (let seed = 1; seed <= 20; seed++) {
        const picked = pickEnemyKings(seed, player, pool);
        expect(picked).toHaveLength(2);
        expect(picked).not.toContain(player);
        expect(new Set(picked).size).toBe(2);
      }
    }
  });

  it('is deterministic per seed and varies the order across seeds', () => {
    expect(pickEnemyKings(7, 'wheat', pool)).toEqual(pickEnemyKings(7, 'wheat', pool));
    const orders = new Set<string>();
    for (let seed = 1; seed <= 30; seed++) orders.add(pickEnemyKings(seed, 'wheat', pool).join());
    expect(orders.size).toBe(2);
  });

  it('returns fewer kings when the pool is small and never throws', () => {
    expect(pickEnemyKings(1, 'wheat', ['wheat'])).toEqual([]);
    expect(pickEnemyKings(1, 'wheat', ['wheat', 'stone'])).toEqual(['stone']);
  });
});

describe('startDeck', () => {
  const card = (id: string, rarity: 'common' | 'uncommon' | 'rare') => ({
    id,
    owner: 'wheat',
    nameVi: id,
    name: id,
    kind: 'troop',
    rarity,
    tags: [],
    textVi: '',
    effects: [],
  });
  const king = {
    id: 'wheat',
    cards: [card('wheat_a', 'common'), card('wheat_b', 'uncommon'), card('wheat_c', 'rare')],
  } as unknown as KingDef;

  it('gives each common card twice and each uncommon once, never a rare', () => {
    expect(startDeck(king)).toEqual(['wheat_a', 'wheat_a', 'wheat_b']);
  });

  it('works for the real wheat king', () => {
    const deck = startDeck(CONTENT.king('wheat'));
    expect(deck.length).toBeGreaterThan(0);
    for (const id of deck) expect(CONTENT.card(id).owner).toBe('wheat');
  });
});
