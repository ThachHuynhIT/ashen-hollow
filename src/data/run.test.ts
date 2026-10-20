import { describe, expect, it } from 'vitest';
import { REWARD, RULES_G1, RUN, START_DECK_G1, rewardRarityWeights } from './run';

describe('run constants', () => {
  it('has G1 rules and run basics', () => {
    expect(RULES_G1.years).toBe(10);
    expect(RUN.startLives).toBe(3);
    expect(RUN.handSize).toBe(3);
    expect(REWARD.choices).toBe(3);
  });

  it('start deck has 11 cards with the right counts', () => {
    expect(START_DECK_G1.length).toBe(11);
    const count = (id: string): number => START_DECK_G1.filter((c) => c === id).length;
    expect(count('wheat_militia')).toBe(2);
    expect(count('wheat_scarecrow')).toBe(2);
    expect(count('wheat_reapers')).toBe(1);
    expect(count('neutral_barracks')).toBe(2);
    expect(count('neutral_archer_tower')).toBe(2);
    expect(count('neutral_clear_land')).toBe(1);
    expect(count('neutral_move')).toBe(1);
  });

  it('reward rarity weights by year band', () => {
    for (const y of [1, 9]) expect(rewardRarityWeights(y)).toEqual([60, 30, 10]);
    for (const y of [10, 19]) expect(rewardRarityWeights(y)).toEqual([45, 35, 20]);
    for (const y of [20, 30]) expect(rewardRarityWeights(y)).toEqual([30, 40, 30]);
    for (const y of [1, 10, 20]) {
      const [a, b, c] = rewardRarityWeights(y);
      expect(a + b + c).toBe(100);
    }
  });
});
