import { describe, expect, it } from 'vitest';
import { RULES_G1, RULES_G2 } from '../../data/rules';
import type { KingId } from '../../data/types';
import type { IllegalReason } from '../../game/run/state';
import { calendarCells, fullCalendar, illegalText, lockedPlotPrice } from './calendarModel';

const KINGS: KingId[] = ['stone', 'arcane'];
const g2 = (year: number) => ({ year, rules: RULES_G2, enemyKings: KINGS, enemies: {} });

describe('calendarCells', () => {
  it('shows this year and the next four, the first marked current', () => {
    const cells = calendarCells(g2(3), 5);
    expect(cells.map((c) => c.year)).toEqual([3, 4, 5, 6, 7]);
    expect(cells.map((c) => c.current)).toEqual([true, false, false, false, false]);
  });

  it('puts the king badge and attack number on the king years (K1 year 3 → attack 1)', () => {
    const cells = calendarCells(g2(3), 5);
    expect(cells[0]).toMatchObject({ attacker: 'stone', attack: 1 });
    expect(cells[1]).toMatchObject({ attacker: 'arcane', attack: 1 });
    expect(cells[2]).toMatchObject({ attacker: 'raiders', attack: null });
    expect(cells[3]).toMatchObject({ attacker: 'stone', attack: 2 });
  });

  it('never goes past the last year of the rules', () => {
    expect(calendarCells(g2(14), 5).map((c) => c.year)).toEqual([14, 15]);
    expect(calendarCells(g2(15), 5)).toHaveLength(1);
  });

  it('is all raiders under the G1 rules', () => {
    const cells = calendarCells({ year: 1, rules: RULES_G1, enemyKings: [], enemies: {} }, 5);
    expect(cells.every((c) => c.attacker === 'raiders' && c.attack === null)).toBe(true);
    expect(calendarCells({ year: 9, rules: RULES_G1, enemyKings: [], enemies: {} }, 5)).toHaveLength(2);
  });

  it('falls back to raiders when a king slot has no king picked', () => {
    const cells = calendarCells({ year: 3, rules: RULES_G2, enemyKings: [], enemies: {} }, 1);
    expect(cells[0]).toMatchObject({ attacker: 'raiders', attack: null });
  });
});

describe('fullCalendar', () => {
  it('has one cell per year with each king attacking exactly three times', () => {
    const cells = fullCalendar(RULES_G2, KINGS);
    expect(cells).toHaveLength(15);
    expect(cells.map((c) => c.year)).toEqual(Array.from({ length: 15 }, (_, i) => i + 1));
    expect(cells.filter((c) => c.attacker === 'stone').map((c) => [c.year, c.attack])).toEqual([
      [3, 1],
      [6, 2],
      [9, 3],
    ]);
    expect(cells.filter((c) => c.attacker === 'arcane').map((c) => [c.year, c.attack])).toEqual([
      [4, 1],
      [8, 2],
      [12, 3],
    ]);
    expect(cells.some((c) => c.current)).toBe(false);
  });
});

describe('lockedPlotPrice and illegalText', () => {
  it('prices a locked plot by the plots bought so far', () => {
    expect([0, 1, 2].map((k) => lockedPlotPrice({ purchasedPlots: k }))).toEqual([4, 6, 8]);
  });

  it('has Vietnamese text for every illegal reason', () => {
    const all: Record<IllegalReason, true> = {
      locked: true,
      throne: true,
      occupied: true,
      noBuilding: true,
      noTarget: true,
      notAdjacent: true,
      wrongPhase: true,
      alreadyPlayed: true,
      notPlayed: true,
      notEnoughGold: true,
      maxLevel: true,
      wrongKind: true,
      stacksFull: true,
      badTarget: true,
    };
    for (const reason of Object.keys(all) as IllegalReason[])
      expect(illegalText(reason).trim().length, reason).toBeGreaterThan(0);
    expect(illegalText('notEnoughGold')).toBe('Không đủ vàng.');
  });
});
