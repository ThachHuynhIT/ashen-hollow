/** Deterministic cho trận G2 thật (spec §13.2): băm từng tick, không phụ thuộc thứ tự công trình. */
import { describe, expect, it } from 'vitest';
import { RULES_G2 } from '../../data/rules';
import type { CardId, Level } from '../../data/types';
import { CONTENT } from '../cards/registry';
import { buildBattleSetup } from '../run/battleSetup';
import type { BuildingState } from '../run/state';
import { newRun, startYear } from '../run/yearFlow';
import { hashWorld } from './hash';
import { battleResult, simulateBattle, stepBattle } from './step';
import type { BattleSetup } from './types';
import { createBattle, drainEvents } from './world';

const bld = (uid: number, cardId: string, level: Level, enchants: BuildingState['enchants'] = []): BuildingState => ({
  uid,
  cardId: cardId as CardId,
  level,
  enchants,
  placedYear: 1,
  permanent: {},
});

/** A busy year-12 board mixing pulses, splash, chains, shields, taunt and death spawns. */
const setup = (): BattleSetup => {
  const base = newRun(5, 'stone', CONTENT, RULES_G2);
  let s = { ...base, year: 11 };
  s = startYear(s, CONTENT); // year 12: K2's third attack
  const plots = s.plots.map((p) => ({ ...p, unlocked: true }));
  const put = (plot: number, b: BuildingState): void => {
    plots[plot] = { unlocked: true, building: b };
  };
  const sharp = [{ cardId: 'neutral_sharpen' as CardId, stacks: 2 }];
  put(6, bld(1, 'stone_mountain_heart', 3));
  put(7, bld(2, 'stone_wall', 3));
  put(8, bld(3, 'stone_catapult', 2, sharp));
  put(11, bld(4, 'stone_miners', 3));
  put(13, bld(5, 'stone_golem_forge', 3));
  put(16, bld(6, 'stone_crystal', 2));
  put(17, bld(7, 'arcane_ward', 3));
  put(18, bld(8, 'arcane_mage_tower', 2, sharp));
  put(1, bld(9, 'arcane_apprentices', 4));
  put(3, bld(10, 'arcane_archmage', 2));
  put(21, bld(11, 'neutral_barracks', 4));
  return buildBattleSetup({ ...s, plots, autoFire: true }, CONTENT);
};

describe('real G2 battle determinism', () => {
  it('two worlds of the same setup hash equal at every tick until the end', () => {
    const a = createBattle(setup());
    const b = createBattle(setup());
    let ticks = 0;
    while (battleResult(a) === null) {
      stepBattle(a, []);
      stepBattle(b, []);
      drainEvents(a);
      drainEvents(b);
      expect(hashWorld(a), `tick ${ticks}`).toBe(hashWorld(b));
      ticks += 1;
      expect(ticks).toBeLessThanOrEqual(1000);
    }
    expect(battleResult(b)).toEqual(battleResult(a));
    expect(ticks).toBeGreaterThan(30);
  });

  it('does not depend on the order of the structures in the setup', () => {
    const s = setup();
    const reversed: BattleSetup = { ...s, structures: [...s.structures].reverse() };
    expect(simulateBattle(reversed)).toEqual(simulateBattle(s));
  });

  it('actually uses the new mechanics (pulse, shield pulse, taunt, death spawn, chain, splash)', () => {
    const s = setup();
    expect(s.structures.some((x) => x.pulse !== null)).toBe(true);
    expect(s.structures.some((x) => x.shieldPulse !== null)).toBe(true);
    expect(s.structures.some((x) => x.taunt > 0)).toBe(true);
    expect(s.structures.some((x) => x.spawn?.stats.deathSpawn)).toBe(true);
    expect(s.structures.some((x) => (x.attack?.chain ?? null) !== null)).toBe(true);
    expect(s.structures.some((x) => (x.attack?.splash ?? 0) > 0)).toBe(true);
  });
});
