import { describe, expect, it } from 'vitest';
import { Rng } from '../../core/random';
import { START_DECK_G1 } from '../../data/run';
import type { CardId } from '../../data/types';
import { drawHand } from './deck';

const count = (arr: readonly CardId[], id: CardId): number => arr.filter((c) => c === id).length;

describe('drawHand', () => {
  it('draws 3 cards without exceeding deck multiplicity', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const hand = drawHand(START_DECK_G1, new Rng(seed), 3);
      expect(hand).toHaveLength(3);
      for (const id of hand) {
        expect(count(hand, id)).toBeLessThanOrEqual(count(START_DECK_G1, id));
      }
    }
  });

  it('returns the whole small deck', () => {
    const deck: CardId[] = ['neutral_barracks', 'neutral_move'];
    const hand = drawHand(deck, new Rng(5), 3);
    expect(hand).toHaveLength(2);
    expect([...hand].sort()).toEqual([...deck].sort());
  });

  it('returns [] for an empty deck', () => {
    expect(drawHand([], new Rng(1), 3)).toEqual([]);
  });

  it('is deterministic per seed', () => {
    expect(drawHand(START_DECK_G1, new Rng(42), 3)).toEqual(drawHand(START_DECK_G1, new Rng(42), 3));
  });

  it('does not mutate the deck', () => {
    const before = structuredClone(START_DECK_G1);
    drawHand(START_DECK_G1, new Rng(7), 3);
    expect(START_DECK_G1).toEqual(before);
  });
});
