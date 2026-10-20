import { describe, expect, it } from 'vitest';
import { runHeadless } from './headless';

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
