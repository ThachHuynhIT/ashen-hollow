import { describe, expect, it } from 'vitest';
import { CONTENT } from './registry';

/** The text of every other test under `src/game/cards` and `src/game/run`, as one string. */
const sources = import.meta.glob<string>(['./*.test.ts', '../run/*.test.ts', '!./cardCoverage.test.ts'], {
  query: '?raw',
  import: 'default',
  eager: true,
});
const effectTests = (): string => Object.values(sources).join('\n');

describe('G2 card coverage (spec §14 "Done khi")', () => {
  const text = effectTests();

  it('has an effect test mentioning every card of the content', () => {
    const missing = CONTENT.allCards()
      .map((c) => c.id)
      .filter((id) => !text.includes(`'${id}'`));
    expect(missing).toEqual([]);
  });

  it('has the 6 G2 neutral cards, 9 cards per king and a throne for each of the 3 kings', () => {
    const neutral = CONTENT.neutralPool().map((c) => c.id);
    for (const id of [
      'neutral_well',
      'neutral_mercenary_camp',
      'neutral_sharpen',
      'neutral_fortify',
      'neutral_promote',
      'neutral_demolish',
    ])
      expect(neutral, id).toContain(id);
    expect(CONTENT.kings()).toHaveLength(3);
    for (const king of CONTENT.kings()) {
      expect(king.cards, king.id).toHaveLength(9);
      expect(king.throne.kind).toBe('throne');
    }
  });
});
