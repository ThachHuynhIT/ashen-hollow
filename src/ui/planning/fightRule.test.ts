import { describe, expect, it } from 'vitest';
import { RULES_G1, RULES_G2 } from '../../data/rules';
import { runState } from '../../game/testing/fixtures';
import { canFight } from './fightRule';

describe('canFight', () => {
  it('shows Ra trận once the year action is done (manual start)', () => {
    expect(canFight(runState({ rules: RULES_G2, played: true }))).toBe(true);
  });

  it('does not cover a hand the player can still act on', () => {
    const s = runState({ rules: RULES_G2, played: false });
    expect(s.hand.length).toBeGreaterThan(0);
    expect(canFight(s)).toBe(false); // even when no card is playable: it can still be sold
  });

  it('shows Ra trận when the hand is empty and nothing was played', () => {
    expect(canFight(runState({ rules: RULES_G2, played: false, hand: [] }))).toBe(true);
  });

  it('never shows it when battles start automatically, or outside planning', () => {
    expect(canFight(runState({ rules: RULES_G1, played: true }))).toBe(false);
    expect(canFight(runState({ rules: RULES_G2, played: true, phase: 'battle' }))).toBe(false);
  });
});
