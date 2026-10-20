import { describe, expect, it } from 'vitest';
import { RULES_G1, RULES_G2 } from './rules';
import {
  REWARD,
  RUN,
  START_DECK_G1,
  battleGold,
  rerollCost,
  rewardRarityWeights,
  unlockCost,
} from './run';

describe('G2 run constants and formulas (spec §3.1)', () => {
  it('has the full RUN table', () => {
    expect(RUN).toMatchObject({
      startLives: 3,
      maxLives: 4,
      startGold: 5,
      taxPerYear: 3,
      handSize: 3,
      skipPlayGold: 2,
      skipRewardGold: 3,
      conquestGold: 5,
      maxLevel: 5,
      maxEnchantStacks: 4,
    });
  });

  it('battleGold(year) = 2 + ceil(year / 3)', () => {
    expect([1, 10, 30].map(battleGold)).toEqual([3, 6, 12]);
  });

  it('rerollCost(n) doubles from 1', () => {
    expect([1, 2, 3, 4].map(rerollCost)).toEqual([1, 2, 4, 8]);
  });

  it('unlockCost(k) = 4 + 2k', () => {
    expect(unlockCost(0)).toBe(4);
    expect(unlockCost(1)).toBe(6);
    expect(unlockCost(15)).toBe(34);
  });

  it('keeps G1 rules with auto-start and defines G2 rules without it', () => {
    expect(RULES_G1).toEqual({ years: 10, calendar: 'raiders', autoStart: true });
    expect(RULES_G2).toEqual({ years: 15, calendar: 'short', autoStart: false });
  });
});

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
