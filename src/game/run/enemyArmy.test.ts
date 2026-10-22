import { describe, expect, it } from 'vitest';
import { ENEMY_CAP } from '../../data/battle';
import { RULES_FULL } from '../../data/rules';
import type { KingId } from '../../data/types';
import { armyBudget, composeArmy } from '../battle/compose';
import { CONTENT } from '../cards/registry';
import { buildYearArmy, mergeRosters, normalizeRosters } from './enemyArmy';
import type { RunState } from './state';
import { newRun } from './yearFlow';

const at = (year: number, over: Partial<RunState> = {}): RunState => ({
  ...newRun(9, 'wheat', CONTENT, RULES_FULL),
  year,
  ...over,
});
/** The unit ids of an army, over all its waves. */
const units = (a: { waves: readonly { units: readonly { unit: string }[] }[] }): string[] =>
  a.waves.flatMap((w) => w.units.map((u) => u.unit));
const rosterIds = (k: KingId): string[] => CONTENT.enemyRoster(k).map((r) => r.unit.id);

describe('army_budgets', () => {
  it('year 1 raiders have 10 EP, bosses 63, 299 and 1382', () => {
    expect(buildYearArmy(at(1), CONTENT).budget).toBe(10);
    expect(buildYearArmy(at(10), CONTENT).budget).toBe(63); // round(42 x 1.5)
    expect(buildYearArmy(at(20), CONTENT).budget).toBe(299); // round(171 x 1.75)
    expect(buildYearArmy(at(30), CONTENT).budget).toBe(1382); // round(691 x 2.0)
  });

  it('scales with the thorn difficulty: x(1 + 0.1 d)', () => {
    expect([0, 1, 3, 5].map((d) => armyBudget(10, 1.5, d))).toEqual([63, 69, 82, 95]);
    expect(buildYearArmy(at(10, { difficulty: 5 }), CONTENT).budget).toBe(95);
    expect(armyBudget(10, 1.5)).toBe(63);
  });

  it('a coalition is 1.1 of the year budget, a king attack uses its attack multiplier', () => {
    expect(buildYearArmy(at(23), CONTENT).budget).toBe(Math.round(260 * 1.1));
    expect(buildYearArmy(at(3), CONTENT).budget).toBe(Math.round(16 * 0.9));
    expect(buildYearArmy(at(9), CONTENT).budget).toBe(Math.round(37 * 1.2));
  });
});

describe('who attacks and who they bring', () => {
  it('a king brings his own units, his banner and nobody else', () => {
    const s = at(3);
    const plan = buildYearArmy(s, CONTENT);
    const king = s.enemyKings[0]!;
    expect(plan).toMatchObject({ attacker: king, attackNo: 1, banner: CONTENT.enemyKing(king).banner.id });
    for (const u of units(plan)) expect(rosterIds(king)).toContain(u);
  });

  it('a coalition merges the two rosters and has no banner', () => {
    const s = at(23);
    const plan = buildYearArmy(s, CONTENT);
    expect(plan.attacker).toBe('coalition');
    expect(plan.kings).toEqual([s.enemyKings[0], s.enemyKings[1]]);
    expect(plan.banner).toBeUndefined();
    const allowed = new Set([...rosterIds(s.enemyKings[0]!), ...rosterIds(s.enemyKings[1]!)]);
    for (const u of units(plan)) expect(allowed.has(u)).toBe(true);
  });

  it('boss 1 brings raiders; boss 2 the roster of K3 and K4; boss 3 all six kings', () => {
    const b1 = buildYearArmy(at(10), CONTENT);
    expect(b1).toMatchObject({ attacker: 'boss', boss: 'boss_bog_ogre', bossOrdinal: 1 });
    const raiders = CONTENT.raiderRoster().map((r) => r.unit.id);
    for (const u of units(b1)) expect(raiders).toContain(u);

    const s2 = at(20);
    const b2 = buildYearArmy(s2, CONTENT);
    expect(b2).toMatchObject({ attacker: 'boss', boss: 'boss_hornet_queen', bossOrdinal: 2, kings: [s2.enemyKings[2], s2.enemyKings[3]] });
    const allowed2 = new Set([...rosterIds(s2.enemyKings[2]!), ...rosterIds(s2.enemyKings[3]!)]);
    for (const u of units(b2)) expect(allowed2.has(u)).toBe(true);

    const s3 = at(30);
    const b3 = buildYearArmy(s3, CONTENT);
    expect(b3).toMatchObject({ attacker: 'boss', boss: 'boss_crownless_king', bossOrdinal: 3 });
    const allowed3 = new Set(s3.enemyKings.flatMap(rosterIds));
    for (const u of units(b3)) expect(allowed3.has(u)).toBe(true);
    expect(b3.banner).toBeUndefined();
  });

  it('never exceeds the 120 foe cap and never picks a zero-cost unit', () => {
    for (let year = 1; year <= 30; year++) {
      const plan = buildYearArmy(at(year), CONTENT);
      expect(units(plan).length, `year ${year}`).toBeLessThanOrEqual(ENEMY_CAP);
      for (const u of units(plan)) expect(CONTENT.unit(u).enemyCost).toBeGreaterThan(0);
    }
  });
});

describe('roster merging', () => {
  const a = [{ unit: 'x', weight: 30, enemyCost: 2 }, { unit: 'shared', weight: 20, enemyCost: 1 }];
  const b = [{ unit: 'shared', weight: 5, enemyCost: 1 }, { unit: 'y', weight: 45, enemyCost: 3 }];

  it('adds the weights of a unit both kings have, keeping the others', () => {
    expect(mergeRosters([a, b])).toEqual([
      { unit: 'x', weight: 30, enemyCost: 2 },
      { unit: 'shared', weight: 25, enemyCost: 1 },
      { unit: 'y', weight: 45, enemyCost: 3 },
    ]);
    expect(a[1]!.weight).toBe(20); // inputs are not changed
  });

  it('normalising gives every king the same total weight and keeps the proportions inside a king', () => {
    const [na, nb] = normalizeRosters([a, [{ unit: 'z', weight: 1, enemyCost: 1 }, ...b]]);
    const total = (r: typeof na): number => r!.reduce((s, e) => s + e.weight, 0);
    expect(total(na)).toBeCloseTo(100);
    expect(total(nb)).toBeCloseTo(100);
    expect(na![0]!.weight / na![1]!.weight).toBeCloseTo(30 / 20);
  });

  it('boss 3 weights every king equally even when the rosters have different totals', () => {
    const s = at(30);
    const per = s.enemyKings.map((k) => normalizeRosters([CONTENT.enemyRoster(k).map((r) => ({ unit: r.unit.id, weight: r.weight, enemyCost: r.unit.enemyCost }))])[0]!);
    for (const roster of per) expect(roster.reduce((sum, e) => sum + e.weight, 0)).toBeCloseTo(100);
  });
});

describe('edges', () => {
  const roster = [{ unit: 'u', weight: 1, enemyCost: 1 }];
  const edgesOf = (plan: ReturnType<typeof composeArmy>): string[][] => plan.waves.map((w) => [...new Set(w.units.map((u) => u.edge))]);

  it('one edge before year 10, two from year 10', () => {
    for (const w of edgesOf(composeArmy(roster, 60, 5, 1, {}))) expect(w).toHaveLength(1);
    for (const w of edgesOf(composeArmy(roster, 80, 12, 1, {}))) expect(w).toHaveLength(2);
  });

  it('an extra edge (Nomad banner) adds one distinct edge to every wave', () => {
    for (const w of edgesOf(composeArmy(roster, 60, 5, 1, { extraEdges: 1 }))) expect(w).toHaveLength(2);
    for (const w of edgesOf(composeArmy(roster, 80, 12, 1, { extraEdges: 1 }))) expect(w).toHaveLength(3);
    for (const w of edgesOf(composeArmy(roster, 80, 12, 1, { extraEdges: 9 }))) expect(w).toHaveLength(4);
  });

  it('the Nomad king army carries the extra edge, the others do not', () => {
    const nomadYear = (s: RunState): number => s.enemyKings.indexOf('nomad');
    let found = false;
    for (let seed = 1; seed <= 12 && !found; seed++) {
      const base = newRun(seed, 'wheat', CONTENT, RULES_FULL);
      const idx = nomadYear(base);
      if (idx < 0) continue;
      const firstAttackYear = [3, 4, 7, 12, 15, 18][idx]!;
      const plan = buildYearArmy({ ...base, year: firstAttackYear }, CONTENT);
      const perWave = plan.waves.map((w) => new Set(w.units.map((u) => u.edge)).size);
      for (const n of perWave) expect(n).toBe(firstAttackYear >= 10 ? 3 : 2);
      found = true;
    }
    expect(found).toBe(true);
  });

  it('keeps raiders and the older king banners as they were (one edge early)', () => {
    const plan = composeArmy(roster, 40, 3, 4, { attacker: 'raiders' });
    expect(edgesOf(plan).every((w) => w.length === 1)).toBe(true);
  });
});
