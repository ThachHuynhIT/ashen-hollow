import { describe, expect, it } from 'vitest';
import { ENEMY_CAP, ENEMY_LEVEL_COST, SLOT_MULT } from '../../data/battle';
import { armyBudget, composeArmy, type ComposeEntry } from './compose';

const ROSTER: readonly ComposeEntry[] = [
  { unit: 'bandit', enemyCost: 1.0, weight: 50 },
  { unit: 'bandit_archer', enemyCost: 1.2, weight: 25 },
  { unit: 'boar_rider', enemyCost: 2.0, weight: 15 },
  { unit: 'ogre', enemyCost: 5.0, weight: 10 },
];
const cost = (u: string): number => ROSTER.find((e) => e.unit === u)!.enemyCost;
const all = (p: ReturnType<typeof composeArmy>) => p.waves.flatMap((w) => w.units);
const spentOf = (p: ReturnType<typeof composeArmy>): number =>
  all(p).reduce((s, u) => s + cost(u.unit) * ENEMY_LEVEL_COST[p.level - 1]!, 0);

describe('armyBudget', () => {
  it('rounds base budget times slot multiplier', () => {
    expect(armyBudget(1, SLOT_MULT.raiders)).toBe(10);
    expect(armyBudget(10, 0.8)).toBe(34);
  });
});

describe('composeArmy attacker metadata', () => {
  it('stays a plain raiders plan without metadata', () => {
    const p = composeArmy(ROSTER, 10, 1, 7);
    expect(p.attacker).toBe('raiders');
    expect(p.attackNo).toBeUndefined();
    expect(p.banner).toBeUndefined();
  });

  it('records a king attacker, its attack number and banner without changing the units', () => {
    const plain = composeArmy(ROSTER, 30, 5, 3);
    const king = composeArmy(ROSTER, 30, 5, 3, { attacker: 'stone', attackNo: 2, banner: 'stone_banner' });
    expect(king).toMatchObject({ attacker: 'stone', attackNo: 2, banner: 'stone_banner' });
    expect(king.waves).toEqual(plain.waves);
    expect(king.budget).toBe(plain.budget);
  });
});

describe('composeArmy', () => {
  it('never exceeds budget and leaves less than the cheapest unit', () => {
    for (let year = 1; year <= 10; year++) {
      for (let seed = 1; seed <= 20; seed++) {
        const budget = armyBudget(year, SLOT_MULT.raiders);
        const p = composeArmy(ROSTER, budget, year, seed);
        const spent = spentOf(p);
        expect(spent).toBeLessThanOrEqual(budget + 1e-9);
        expect(budget - spent).toBeLessThan(1.0 * ENEMY_LEVEL_COST[p.level - 1]!);
      }
    }
  });

  it('selects the level from the budget', () => {
    expect(composeArmy(ROSTER, 34, 1, 1).level).toBe(1);
    expect(composeArmy(ROSTER, 1000, 1, 1).level).toBe(4);
    expect(composeArmy(ROSTER, 1e7, 1, 1).level).toBe(5);
  });

  it('applies surplus statMult when capped', () => {
    const p = composeArmy(ROSTER, 1e7, 1, 1);
    expect(all(p).length).toBe(ENEMY_CAP);
    expect(p.statMult).toBeGreaterThan(1);
    expect(p.statMult).toBe(Math.sqrt(1e7 / spentOf(p)));
    expect(composeArmy(ROSTER, 34, 1, 1).statMult).toBe(1);
  });

  it('splits into 8/7/5 waves at 120-tick spacing', () => {
    const one: readonly ComposeEntry[] = [{ unit: 'bandit', enemyCost: 1, weight: 1 }];
    const p = composeArmy(one, 20, 1, 1);
    expect(p.waves.map((w) => w.units.length)).toEqual([8, 7, 5]);
    expect(p.waves.map((w) => w.spawnTick)).toEqual([0, 120, 240]);
  });

  it('keeps creation order across waves', () => {
    const a = composeArmy(ROSTER, 34, 1, 7);
    const b = composeArmy(ROSTER, 34, 1, 7);
    expect(all(a).map((u) => u.unit)).toEqual(all(b).map((u) => u.unit));
  });

  it('uses one edge per wave before year 10 and two alternating from year 10', () => {
    for (let seed = 1; seed <= 20; seed++) {
      for (const w of composeArmy(ROSTER, 34, 9, seed).waves) {
        expect(new Set(w.units.map((u) => u.edge)).size).toBeLessThanOrEqual(1);
      }
      for (const w of composeArmy(ROSTER, 34, 10, seed).waves) {
        if (w.units.length < 2) continue;
        const edges = new Set(w.units.map((u) => u.edge));
        expect(edges.size).toBe(2);
        const [a, b] = [w.units[0]!.edge, w.units[1]!.edge];
        w.units.forEach((u, i) => expect(u.edge).toBe(i % 2 === 0 ? a : b));
      }
    }
  });

  it('is deterministic and varies with seed and year', () => {
    expect(composeArmy(ROSTER, 34, 5, 3)).toEqual(composeArmy(ROSTER, 34, 5, 3));
    const base = composeArmy(ROSTER, 34, 5, 1);
    let seedDiff = false;
    let yearDiff = false;
    for (let s = 2; s <= 20; s++) {
      if (JSON.stringify(composeArmy(ROSTER, 34, 5, s)) !== JSON.stringify(base)) seedDiff = true;
      if (JSON.stringify(composeArmy(ROSTER, 34, 6, s)) !== JSON.stringify(composeArmy(ROSTER, 34, 5, s))) yearDiff = true;
    }
    expect(seedDiff).toBe(true);
    expect(yearDiff).toBe(true);
  });

  it('does not mutate a frozen roster', () => {
    const frozen = Object.freeze(ROSTER.map((e) => Object.freeze({ ...e })));
    expect(() => composeArmy(frozen, 34, 3, 1)).not.toThrow();
  });
});
