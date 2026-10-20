import { describe, expect, it } from 'vitest';
import { CONTENT } from '../cards/registry';
import { runState } from '../testing/fixtures';
import { hasPlayableCard } from './playable';

describe('hasPlayableCard', () => {
  it('is true when some card in hand has a legal target', () => {
    expect(hasPlayableCard(runState({ hand: ['neutral_clear_land', 'wheat_militia'] }), CONTENT)).toBe(true);
  });

  it('is false for an empty hand', () => {
    expect(hasPlayableCard(runState({ hand: [] }), CONTENT)).toBe(false);
  });

  it('is false when every card in hand lacks a target', () => {
    const s = runState({ hand: ['neutral_clear_land'] });
    const open = { ...s, plots: s.plots.map((p) => ({ ...p, unlocked: true })) };
    expect(hasPlayableCard(open, CONTENT)).toBe(false);
  });

  it('is false for building cards when no unlocked plot is free', () => {
    const s = runState({ hand: ['wheat_militia'] });
    const full = {
      ...s,
      plots: s.plots.map((p, i) =>
        p.unlocked && i !== 12
          ? { ...p, building: { uid: i + 10, cardId: 'wheat_militia' as const, level: 1 as const, placedYear: 1 } }
          : p,
      ),
    };
    expect(hasPlayableCard(full, CONTENT)).toBe(false);
  });
});
