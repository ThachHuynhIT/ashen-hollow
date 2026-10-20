import { describe, expect, it } from 'vitest';
import { RULES_G2 } from '../../data/rules';
import { contentWith, fakeKing, fakeKingCards } from '../testing/fixtures';
import { runHeadless } from './headless';

const g2content = contentWith({
  kings: [
    fakeKing('stone', { cards: fakeKingCards('stone') }),
    fakeKing('arcane', { cards: fakeKingCards('arcane') }),
  ],
});

describe('runHeadless', () => {
  for (const seed of [1, 2, 3]) {
    it(`finishes a run for seed ${seed}`, () => {
      const { state, commands } = runHeadless({ seed, kingId: 'wheat' });
      expect(state.phase).toBe('ended');
      expect(state.year).toBeLessThanOrEqual(10);
      expect(state.stats.battlesWon + state.stats.battlesLost).toBe(state.year);
      expect(state.lives).toBeGreaterThanOrEqual(0);
      expect(commands).toBeGreaterThan(0);
    });
  }

  it('is deterministic for the same seed', () => {
    const a = runHeadless({ seed: 7, kingId: 'wheat' });
    const b = runHeadless({ seed: 7, kingId: 'wheat' });
    expect(JSON.stringify(a.state)).toBe(JSON.stringify(b.state));
  });

  it('varies across seeds', () => {
    const outcomes = new Set<string>();
    for (let seed = 1; seed <= 10; seed++) {
      const { state } = runHeadless({ seed, kingId: 'wheat' });
      outcomes.add(`${state.won}:${state.stats.kills}`);
    }
    expect(outcomes.size).toBeGreaterThan(1);
  });

  it('keeps hand, drawPile and discardPile equal to the deck at the end of a run', () => {
    for (const seed of [1, 2, 3]) {
      const { state } = runHeadless({ seed, kingId: 'wheat' });
      const all = [...state.hand, ...state.drawPile, ...state.discardPile].sort();
      expect(all).toEqual([...state.deck].sort());
    }
  });

  it('randomBot never emits an illegal command', () => {
    for (let seed = 100; seed < 120; seed++) {
      expect(() => runHeadless({ seed, kingId: 'wheat' })).not.toThrow();
    }
  });

  it('throws when a bot emits an illegal command', () => {
    expect(() => runHeadless({ seed: 1, kingId: 'wheat', bot: () => ({ type: 'advance' }) })).toThrow(
      /advance/,
    );
  });
});

describe('runHeadless under the G2 rules', () => {
  const play = (seed: number, kingId: 'wheat' | 'stone') =>
    runHeadless({ seed, kingId, rules: RULES_G2 }, g2content);

  for (const kingId of ['wheat', 'stone'] as const) {
    for (const seed of [1, 2, 3]) {
      it(`finishes a 15-year run for ${kingId}, seed ${seed}, without an illegal command`, () => {
        const { state } = play(seed, kingId);
        expect(state.phase).toBe('ended');
        expect(state.year).toBeLessThanOrEqual(RULES_G2.years);
        expect(state.stats.battlesWon + state.stats.battlesLost).toBe(state.year);
        expect(state.gold).toBeGreaterThanOrEqual(0);
        const all = [...state.hand, ...state.drawPile, ...state.discardPile].sort();
        expect(all).toEqual([...state.deck].sort());
        expect(state.stats.conquered).toBeLessThanOrEqual(2);
        for (const k of state.enemyKings) {
          expect(state.enemies[k]!.attacks).toBeLessThanOrEqual(3);
        }
      });
    }
  }

  it('is deterministic for the same seed', () => {
    expect(JSON.stringify(play(5, 'wheat').state)).toBe(JSON.stringify(play(5, 'wheat').state));
  });

  it('exercises gold, rerolls and plot purchases across seeds', () => {
    let earned = 0;
    let bought = 0;
    for (let seed = 1; seed <= 12; seed++) {
      const { state } = play(seed, 'wheat');
      earned += state.stats.goldEarned;
      bought += state.purchasedPlots;
    }
    expect(earned).toBeGreaterThan(0);
    expect(bought).toBeGreaterThan(0);
  });
});
