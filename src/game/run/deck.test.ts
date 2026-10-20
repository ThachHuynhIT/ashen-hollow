import { describe, expect, it } from 'vitest';
import { Rng } from '../../core/random';
import { START_DECK_G1 } from '../../data/run';
import type { CardId } from '../../data/types';
import { refillHand } from './deck';

const sorted = (arr: readonly CardId[]): CardId[] => [...arr].sort();

describe('refillHand', () => {
  it('keeps the cards already in hand and draws only the missing ones', () => {
    const hand: CardId[] = ['wheat_militia', 'neutral_move'];
    const pile: CardId[] = ['neutral_barracks', 'wheat_scarecrow', 'wheat_reapers'];
    const r = refillHand(hand, pile, [], new Rng(3), 3);
    expect(r.hand.slice(0, 2)).toEqual(hand);
    expect(r.hand).toHaveLength(3);
    expect(pile).toContain(r.hand[2]);
    expect(r.drawPile).toHaveLength(2);
    expect(r.discardPile).toEqual([]);
  });

  it('does nothing when the hand is already full', () => {
    const hand: CardId[] = ['wheat_militia', 'neutral_move', 'neutral_barracks'];
    const r = refillHand(hand, ['wheat_reapers'], ['wheat_scarecrow'], new Rng(3), 3);
    expect(r.hand).toEqual(hand);
    expect(r.drawPile).toEqual(['wheat_reapers']);
    expect(r.discardPile).toEqual(['wheat_scarecrow']);
  });

  it('reshuffles the discard pile when the draw pile runs out', () => {
    const discard: CardId[] = ['neutral_move', 'neutral_barracks', 'wheat_reapers'];
    const r = refillHand([], ['wheat_militia'], discard, new Rng(9), 3);
    expect(r.hand).toHaveLength(3);
    expect(r.hand[0]).toBe('wheat_militia');
    expect(r.discardPile).toEqual([]);
    expect(r.drawPile).toHaveLength(1);
    expect(sorted([...r.hand, ...r.drawPile])).toEqual(
      sorted(['wheat_militia', 'neutral_move', 'neutral_barracks', 'wheat_reapers']),
    );
  });

  it('draws a short hand without throwing when the whole deck is smaller than the hand size', () => {
    const r = refillHand([], [], ['neutral_barracks', 'neutral_move'], new Rng(5), 3);
    expect(r.hand).toHaveLength(2);
    expect(sorted(r.hand)).toEqual(sorted(['neutral_barracks', 'neutral_move']));
    expect(r.drawPile).toEqual([]);
    expect(r.discardPile).toEqual([]);
  });

  it('returns the hand unchanged when both piles are empty', () => {
    const r = refillHand(['wheat_militia'], [], [], new Rng(1), 3);
    expect(r).toEqual({ hand: ['wheat_militia'], drawPile: [], discardPile: [] });
  });

  it('is deterministic per seed', () => {
    const a = refillHand([], [], START_DECK_G1, new Rng(42), 3);
    const b = refillHand([], [], START_DECK_G1, new Rng(42), 3);
    expect(a).toEqual(b);
  });

  it('never mutates its inputs and conserves every card', () => {
    const hand: CardId[] = ['wheat_militia'];
    const draw: CardId[] = ['neutral_move'];
    const discard: CardId[] = ['neutral_barracks', 'wheat_reapers'];
    const before = structuredClone({ hand, draw, discard });
    const r = refillHand(hand, draw, discard, new Rng(2), 3);
    expect({ hand, draw, discard }).toEqual(before);
    expect(sorted([...r.hand, ...r.drawPile, ...r.discardPile])).toEqual(
      sorted([...hand, ...draw, ...discard]),
    );
  });
});
