import { describe, expect, it } from 'vitest';
import type { Level } from '../../data/types';
import { describeCard, resolvePlaceholders } from './describe';
import { CONTENT } from './registry';

const LEVELS: readonly Level[] = [1, 2, 3, 4, 5];

describe('describeCard', () => {
  it('describes every card at every level without leftover placeholders', () => {
    for (const def of CONTENT.allCards()) {
      for (const level of LEVELS) {
        const d = describeCard(def, level);
        expect(d.title.length).toBeGreaterThan(0);
        expect(d.lines.length).toBeGreaterThan(0);
        for (const line of d.lines) expect(line).not.toContain('{');
      }
    }
  });

  it('fills troop counts per level', () => {
    const def = CONTENT.card('wheat_militia');
    expect(describeCard(def, 1).lines[0]).toBe('Sinh 4 Dân Quân khi ra trận.');
    expect(describeCard(def, 2).lines[0]).toBe('Sinh 6 Dân Quân khi ra trận.');
  });

  it('fills tower stats and slow', () => {
    expect(describeCard(CONTENT.card('wheat_scarecrow'), 1).lines[0]).toBe(
      'Bắn 6 sát thương, tầm 72; trúng: chậm 20%.',
    );
  });
});

describe('resolvePlaceholders', () => {
  it('replaces known keys', () => {
    expect(resolvePlaceholders('a {x} {x}', { x: 3 })).toBe('a 3 3');
  });
  it('throws on missing keys', () => {
    expect(() => resolvePlaceholders('a {x}', {})).toThrow();
  });
});
