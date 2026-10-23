import { describe, expect, it } from 'vitest';
import { describeCard } from '../../game/cards/describe';
import { CONTENT } from '../../game/cards/registry';
import { THRONE_PLOT, initialPlots, placeBuilding } from '../../game/run/board';
import type { BuildingState } from '../../game/run/state';
import { cardBadge, clampLines, nextLevelLine, willLevelUpTo } from './cardText';

/** Bold UI font is about 6.5 px per character at 12 px. */
const measure = (s: string): number => Math.ceil(s.length * 6.5);

describe('cardBadge', () => {
  const tower = CONTENT.card('wheat_scarecrow');
  it('says which level a duplicate will reach', () => {
    expect(cardBadge(tower, 2)).toBe('Lên cấp 2');
    expect(cardBadge(tower, 5)).toBe('Lên cấp 5');
  });
  it('is null when the card will not level anything up', () => {
    expect(cardBadge(tower, null)).toBeNull();
  });
});

describe('nextLevelLine', () => {
  it('shows what the next level does for a leveled card', () => {
    const militia = CONTENT.card('wheat_militia');
    const line = nextLevelLine(militia, 1);
    expect(line).toBe(`Cấp sau: ${describeCard(militia, 2).lines[0]}`);
    expect(line).toContain('6');
  });
  it('is null at the top level and for cards without levels', () => {
    expect(nextLevelLine(CONTENT.card('wheat_militia'), 5)).toBeNull();
    expect(nextLevelLine(CONTENT.card('neutral_sharpen'), 1)).toBeNull();
    expect(nextLevelLine(CONTENT.card('neutral_clear_land'), 1)).toBeNull();
  });
});

describe('willLevelUpTo', () => {
  const bld = (uid: number, cardId: BuildingState['cardId'], level: BuildingState['level']): BuildingState => ({
    uid,
    cardId,
    level,
    enchants: [],
    placedYear: 1,
    permanent: {}, ageBonus: 0, counters: {}, movedYear: null,
  });
  const board = (a: BuildingState['level'], b?: BuildingState['level']) => {
    let plots = placeBuilding(initialPlots(), THRONE_PLOT, bld(0, CONTENT.king('wheat').throne.id, 1));
    plots = placeBuilding(plots, 7, bld(1, 'wheat_militia', a));
    if (b !== undefined) plots = placeBuilding(plots, 11, bld(2, 'wheat_militia', b));
    return plots;
  };

  it('is the next level of the lowest copy on the board', () => {
    expect(willLevelUpTo(board(1), CONTENT.card('wheat_militia'))).toBe(2);
    expect(willLevelUpTo(board(3, 2), CONTENT.card('wheat_militia'))).toBe(3);
  });
  it('ignores copies already at the top level, other cards and non-building cards', () => {
    expect(willLevelUpTo(board(5), CONTENT.card('wheat_militia'))).toBeNull();
    expect(willLevelUpTo(board(5, 4), CONTENT.card('wheat_militia'))).toBe(5);
    expect(willLevelUpTo(board(1), CONTENT.card('wheat_scarecrow'))).toBeNull();
    expect(willLevelUpTo(board(1), CONTENT.card('neutral_sharpen'))).toBeNull();
  });
});

describe('clampLines', () => {
  it('wraps greedily and cuts the last allowed line with an ellipsis', () => {
    const lines = clampLines('Nhận vàng bằng tổng cấp mọi công trình lân cận ngai vàng', 90, 2, measure);
    expect(lines).toHaveLength(2);
    expect(lines.every((l) => measure(l) <= 90)).toBe(true);
    expect(lines[1]!.endsWith('…')).toBe(true);
  });
  it('keeps short text on one line', () => {
    expect(clampLines('Sinh 4 Dân Quân', 120, 2, measure)).toEqual(['Sinh 4 Dân Quân']);
  });

  it('fits every card name in two lines without cutting, and every description in two lines', () => {
    // Desktop hand card (120 px, 12/11 px fonts) and phone card (108 px, 10 px fonts):
    // name column, description column and px per character of each.
    const sizes = [
      { name: 78, nameChar: 6.5, text: 96, textChar: 6 },
      { name: 66, nameChar: 5.4, text: 84, textChar: 5.4 },
    ];
    for (const card of CONTENT.allCards()) {
      for (const s of sizes) {
        const nameMeasure = (t: string): number => Math.ceil(t.length * s.nameChar);
        const name = clampLines(card.nameVi, s.name, 2, nameMeasure);
        expect(name.length, card.nameVi).toBeLessThanOrEqual(2);
        expect(name.some((l) => l.endsWith('…')), `${card.nameVi} @${s.name}`).toBe(false);
        const textMeasure = (t: string): number => Math.ceil(t.length * s.textChar);
        const text = clampLines(describeCard(card).lines[0] ?? '', s.text, 2, textMeasure);
        expect(text.length, card.id).toBeLessThanOrEqual(2);
        expect(text.every((l) => textMeasure(l) <= s.text), card.id).toBe(true);
      }
    }
  });
});
