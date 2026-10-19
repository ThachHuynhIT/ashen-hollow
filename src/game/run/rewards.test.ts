import { describe, expect, it } from 'vitest';
import { Rng } from '../../core/random';
import type { CardDef } from '../../data/types';
import { CONTENT } from '../cards/registry';
import { rollOffers, type RewardPools } from './rewards';

const king = CONTENT.king('wheat').cards;
const neutral = CONTENT.neutralPool();
const g1: RewardPools = { king, neutral };
const allIds = [...king, ...neutral].map((c) => c.id);

const fake = (id: string, rarity: CardDef['rarity']): CardDef =>
  ({ ...CONTENT.card('neutral_barracks'), id: id as CardDef['id'], rarity }) as CardDef;

describe('rollOffers', () => {
  it('returns 3 distinct ids from the 7 G1 cards for seeds 1..200', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const offers = rollOffers(new Rng(seed), 1, g1);
      expect(offers).toHaveLength(3);
      expect(new Set(offers).size).toBe(3);
      for (const id of offers) expect(allIds).toContain(id);
    }
  });

  it('is deterministic and advances the rng', () => {
    expect(rollOffers(new Rng(9), 1, g1)).toEqual(rollOffers(new Rng(9), 1, g1));
    const rng = new Rng(9);
    const before = rng.getState();
    rollOffers(rng, 1, g1);
    expect(rng.getState()).not.toBe(before);
  });

  it('honours an explicit count', () => {
    expect(rollOffers(new Rng(3), 1, g1, 4)).toHaveLength(4);
  });

  it('returns only what exists (1 rare card, empty neutral)', () => {
    const pools: RewardPools = { king: [fake('wheat_a', 'rare')], neutral: [] };
    for (let seed = 1; seed <= 50; seed++) {
      expect(rollOffers(new Rng(seed), 1, pools, 3)).toEqual(['wheat_a']);
    }
  });

  it('still returns cards when both pools only hold rares', () => {
    const pools: RewardPools = {
      king: [fake('wheat_a', 'rare')],
      neutral: [fake('neutral_b', 'rare')],
    };
    for (let seed = 1; seed <= 50; seed++) {
      const offers = rollOffers(new Rng(seed), 1, pools, 2);
      expect([...offers].sort()).toEqual(['neutral_b', 'wheat_a']);
    }
  });

  it('draws king cards about 65% of the time', () => {
    const kingIds = new Set(king.map((c) => c.id));
    let kingCount = 0;
    let total = 0;
    for (let seed = 1; seed <= 2000; seed++) {
      for (const id of rollOffers(new Rng(seed), 1, g1)) {
        total++;
        if (kingIds.has(id)) kingCount++;
      }
    }
    const share = kingCount / total;
    expect(share).toBeGreaterThan(0.55);
    expect(share).toBeLessThan(0.75);
  });
});
