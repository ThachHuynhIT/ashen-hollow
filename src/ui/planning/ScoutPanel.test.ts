import { describe, expect, it } from 'vitest';
import { RULES_FULL } from '../../data/rules';
import type { ArmyPlan } from '../../game/battle/types';
import { CONTENT } from '../../game/cards/registry';
import { buildYearArmy } from '../../game/run/enemyArmy';
import type { RunState } from '../../game/run/state';
import { newRun } from '../../game/run/yearFlow';
import { attackerBanner, attackerName, bossLine, tickClock, waveEdges, waveGroups } from './ScoutPanel';

const at = (year: number): { state: RunState; plan: ArmyPlan } => {
  const state = { ...newRun(3, 'wheat', CONTENT, RULES_FULL), year };
  return { state, plan: buildYearArmy(state, CONTENT) };
};

describe('scout heading', () => {
  it('names a king, raiders, a coalition and a boss', () => {
    const { state, plan } = at(3);
    expect(attackerName(plan, CONTENT)).toBe(CONTENT.enemyKing(state.enemyKings[0]!).nameVi);
    expect(attackerName(at(1).plan, CONTENT)).toBe('Thổ Phỉ');
    const coalition = at(23).plan;
    expect(coalition.attacker).toBe('coalition');
    expect(attackerName(coalition, CONTENT)).toBe(
      `Liên Quân ${coalition.kings!.map((k) => CONTENT.enemyKing(k).nameVi).join(' + ')}`,
    );
    expect(attackerName(at(10).plan, CONTENT)).toBe('Boss Ông Kẹ Đầm Lầy');
  });

  it('shows a banner only for a king, never a made-up one for raiders, coalitions or bosses', () => {
    expect(attackerBanner(at(3).plan, CONTENT)).toContain('Cờ hiệu');
    for (const year of [1, 10, 20, 23, 30]) expect(attackerBanner(at(year).plan, CONTENT), `year ${year}`).toBeNull();
  });
});

describe('boss line', () => {
  it('says when and where the boss joins: tick 120 = 0:12, on the second wave edge', () => {
    for (const year of [10, 20, 30]) {
      const { plan } = at(year);
      const line = bossLine(plan)!;
      expect(line).toContain('xuất hiện 0:12');
      const edge = plan.waves[1]?.units[0]?.edge ?? plan.waves.find((w) => w.units[0])?.units[0]?.edge ?? 'N';
      expect(line).toContain({ N: 'Bắc', E: 'Đông', S: 'Nam', W: 'Tây' }[edge]);
    }
    expect(bossLine(at(10).plan)).toContain('Ông Kẹ Đầm Lầy');
    expect(bossLine(at(30).plan)).toContain('Vua Không Ngai');
  });

  it('is absent on other years', () => {
    for (const year of [1, 3, 23]) expect(bossLine(at(year).plan)).toBeNull();
  });
});

describe('waves', () => {
  it('counts units per id in id order and lists the entry edges in N, E, S, W order', () => {
    const wave = {
      spawnTick: 0,
      units: [
        { unit: 'bandit', edge: 'W' },
        { unit: 'archer', edge: 'N' },
        { unit: 'bandit', edge: 'N' },
      ],
    } as unknown as ArmyPlan['waves'][number];
    expect(waveGroups(wave)).toEqual([
      { unit: 'archer', count: 1 },
      { unit: 'bandit', count: 2 },
    ]);
    expect(waveEdges(wave)).toEqual(['N', 'W']);
  });

  it('every wave of a real plan lists exactly its units', () => {
    const { plan } = at(23);
    for (const wave of plan.waves) {
      expect(waveGroups(wave).reduce((n, g) => n + g.count, 0)).toBe(wave.units.length);
    }
    expect(tickClock(plan.waves[1]!.spawnTick)).toMatch(/^\d+:\d\d$/);
  });
});
