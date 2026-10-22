import { describe, expect, it } from 'vitest';
import { SLOT_MULT } from '../../data/battle';
import { RULES_G1, RULES_G2 } from '../../data/rules';
import { armyBudget } from '../battle/compose';
import { CONTENT } from '../cards/registry';
import { contentWith, fakeKing } from '../testing/fixtures';
import { slotMultFor } from './calendar';
import { newRun, startYear } from './yearFlow';

const content = contentWith({ kings: [fakeKing('stone'), fakeKing('arcane')] });

/** Run state at the end of year `year - 1`, ready to start `year`. */
const before = (year: number, c = content) => ({
  ...newRun(7, 'wheat', c, RULES_G2),
  year: year - 1,
});

const unitIds = (state: ReturnType<typeof before>): string[] =>
  startYear(state, content).army!.waves.flatMap((w) => w.units.map((u) => u.unit));

describe('slotMultFor', () => {
  it('maps raiders and king attacks to the spec multipliers', () => {
    expect(slotMultFor({ kind: 'raiders' })).toBe(SLOT_MULT.raiders);
    expect([1, 2, 3].map((n) => slotMultFor({ kind: 'king', king: 1, attack: n as 1 | 2 | 3 }))).toEqual([
      0.9, 1.0, 1.2,
    ]);
  });
});

describe('startYear follows the calendar', () => {
  it('year 1 is raiders at 0.8 of the base budget', () => {
    const next = startYear(before(1), content);
    expect(next.year).toBe(1);
    expect(next.army).toMatchObject({ attacker: 'raiders', budget: armyBudget(1, 0.8) });
  });

  it('year 3 is the first attack of K1 at 0.9 with that king\'s units and banner', () => {
    const s = before(3);
    const next = startYear(s, content);
    const king = s.enemyKings[0]!;
    expect(next.army).toMatchObject({
      attacker: king,
      attackNo: 1,
      banner: `${king}_banner`,
      budget: armyBudget(3, 0.9),
    });
    for (const u of unitIds(s)) expect(u).toBe(`${king}_grunt`);
  });

  it('year 4 is K2 and year 9 is the third attack of K1 at 1.2', () => {
    const s4 = before(4);
    expect(startYear(s4, content).army).toMatchObject({ attacker: s4.enemyKings[1], attackNo: 1 });
    const s9 = before(9);
    expect(startYear(s9, content).army).toMatchObject({
      attacker: s9.enemyKings[0],
      attackNo: 3,
      budget: armyBudget(9, 1.2),
    });
  });

  it('a banner with enemyCostPct -20 buys more units for the same budget', () => {
    const cheap = contentWith({
      kings: [
        fakeKing('stone', { banner: { id: 'b', nameVi: 'b', textVi: 'b', effects: [{ type: 'enemyCostPct', pct: -20 }] } }),
        fakeKing('arcane', { banner: { id: 'b', nameVi: 'b', textVi: 'b', effects: [{ type: 'enemyCostPct', pct: -20 }] } }),
      ],
    });
    const base = before(3);
    const count = (c: typeof content) => startYear({ ...base }, c).army!.waves.flatMap((w) => w.units).length;
    expect(count(cheap)).toBeGreaterThan(count(content));
  });

  it('is deterministic for the same state', () => {
    expect(startYear(before(6), content)).toEqual(startYear(before(6), content));
  });

  it('keeps every G1 year raiders', () => {
    for (let year = 1; year <= RULES_G1.years; year++) {
      const s = { ...newRun(7, 'wheat', CONTENT), year: year - 1 };
      expect(startYear(s, CONTENT).army!.attacker).toBe('raiders');
    }
  });
});

describe('startYear draws within the same call (no held-back draw outside the quest step)', () => {
  it('leaves yearStartPendingDraw false and a full hand', () => {
    const next = startYear(before(2), content);
    expect(next.yearStartPendingDraw).toBe(false);
    expect(next.phase).toBe('planning');
    expect(next.hand).toHaveLength(3);
  });
});
