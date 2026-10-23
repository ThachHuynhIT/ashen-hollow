import { describe, expect, it } from 'vitest';
import { ENEMY_LEVEL_STAT, WAVES } from '../../data/battle';
import { RULES_FULL } from '../../data/rules';
import { CONTENT } from '../cards/registry';
import { buildBattleSetup } from '../run/battleSetup';
import type { RunState } from '../run/state';
import { newRun, startYear } from '../run/yearFlow';
import { battleSetup, throneSetup, unitStats, withBuilding } from '../testing/fixtures';
import { stepBattle } from './step';
import type { BattleSetup, BossSetup, Edge } from './types';
import { createBattle, edgePositions, type BattleWorld } from './world';

/** The year-`year` battle setup of a full run (boss years: 10, 20, 30). */
const bossYear = (year: number, over: Partial<RunState> = {}): { state: RunState; setup: BattleSetup } => {
  const base = newRun(5, 'wheat', CONTENT, RULES_FULL);
  const state: RunState = { ...startYear({ ...base, year: year - 1 }, CONTENT), ...over };
  return { state, setup: buildBattleSetup({ ...state, phase: 'battle' }, CONTENT) };
};

const bossOf = (w: BattleWorld): number[] => [...Array(w.count).keys()].filter((i) => w.boss[i] === 1);
const run = (w: BattleWorld, to: number): void => {
  while (w.tick <= to) stepBattle(w, []);
};

describe('the boss in the battle setup', () => {
  it('is absent in an ordinary year and present in 10, 20 and 30', () => {
    expect(bossYear(9).setup.boss).toBeUndefined();
    expect(bossYear(11).setup.boss).toBeUndefined();
    expect([10, 20, 30].map((y) => bossYear(y).setup.boss?.id)).toEqual([
      'boss_bog_ogre',
      'boss_hornet_queen',
      'boss_crownless_king',
    ]);
  });

  it('carries the table stats unscaled by the foe level, spawn tick 120 and the first edge of wave 2', () => {
    const { state, setup } = bossYear(10);
    const boss = setup.boss!;
    expect(boss.stats.hp).toBe(2500);
    expect(boss.stats).toMatchObject({ armor: 0.2, speed: 0.5, radius: 14, dmg: 40, cleave: 3, range: 4, interval: 20, unit: 'boss_bog_ogre' });
    expect(boss.spawnTick).toBe(WAVES.spawnTick[1]);
    expect(boss.edge).toBe(state.army!.waves[1]!.units[0]!.edge);
    expect(Object.keys(boss.summons).sort()).toEqual(['frog', 'hornet']);
    expect(boss.summons.frog).toMatchObject({ hp: 20, dmg: 4, speed: 1.2, radius: 3 });
    expect(boss.summons.hornet).toMatchObject({ hp: 25, dmg: 6, speed: 1.6 });
    // the foe-level multiplier of the entourage is never applied to the boss
    expect(ENEMY_LEVEL_STAT[state.army!.level - 1]! * state.army!.statMult).toBeGreaterThanOrEqual(1);
    expect(boss.mirror).toBeNull(); // only boss 3 has a mirror
  });

  it('multiplies HP by 1 + 0.1 x thorn difficulty (difficulty 5 -> x1.5)', () => {
    expect(bossYear(10, { difficulty: 5 }).setup.boss!.stats.hp).toBe(3750);
    expect(bossYear(20, { difficulty: 5 }).setup.boss!.stats.hp).toBe(13500);
    expect(bossYear(10, { difficulty: 0 }).setup.boss!.stats.hp).toBe(2500);
  });
});

describe('spawn_at120_once', () => {
  const boss = (edge: Edge = 'W'): BossSetup => ({
    ...bossYear(10).setup.boss!,
    edge,
  });
  const world = (edge: Edge = 'W') =>
    createBattle(
      battleSetup({
        throne: throneSetup({ attack: null }),
        boss: boss(edge),
        waves: [{ spawnTick: 0, spawns: [{ stats: unitStats({ hp: 100000, speed: 0, dmg: 0, interval: 0 }), edge: 'N' }] }],
      }),
    );

  it('nothing at tick 119, one boss at tick 120 on the chosen edge, still one at 121', () => {
    const w = world('W');
    run(w, 118);
    expect(w.tick).toBe(119);
    expect(bossOf(w)).toEqual([]);
    expect(w.bossSpawned).toBe(false);
    stepBattle(w, []); // tick 119 -> 120
    expect(bossOf(w)).toEqual([]);
    stepBattle(w, []); // tick 120 runs the spawn
    const [id] = bossOf(w);
    expect(bossOf(w)).toHaveLength(1);
    expect(w.bossId).toBe(id);
    expect(w.bossSpawnTick).toBe(120);
    // it already took its first step in the tick it appeared (speed 0.5)
    expect(Math.abs(w.x[id!]! - edgePositions('W', 1)[0]!.x)).toBeLessThanOrEqual(0.5);
    expect(w.y[id!]).toBe(edgePositions('W', 1)[0]!.y);
    run(w, 130);
    expect(bossOf(w)).toHaveLength(1);
    expect(w.hp[id!]).toBe(2500);
  });

  it('spawns on each edge where asked', () => {
    for (const edge of ['N', 'E', 'S', 'W'] as const) {
      const w = world(edge);
      run(w, 120);
      const id = w.bossId;
      const p = edgePositions(edge, 1)[0]!;
      expect([w.x[id]! === p.x || Math.abs(w.x[id]! - p.x) < 5, w.y[id]! === p.y || Math.abs(w.y[id]! - p.y) < 5]).toEqual([true, true]);
    }
  });

  it('the boss is an ordinary foe unit: it moves, is hit, and is not capped as a normal foe', () => {
    const w = world('N');
    run(w, 140);
    const id = w.bossId;
    expect(w.team[id]).toBe(1);
    expect(w.boss[id]).toBe(1);
    expect(w.y[id]).toBeGreaterThan(edgePositions('N', 1)[0]!.y); // walking towards the throne
  });
});

describe('no_win_before_pending_boss', () => {
  const emptyWave = [{ spawnTick: 0, spawns: [] }];

  it('without a boss an empty entourage wins at once', () => {
    const w = createBattle(battleSetup({ throne: throneSetup({ attack: null }), waves: emptyWave }));
    stepBattle(w, []);
    expect(w.ended).toBe(true);
    expect(w.won).toBe(true);
  });

  it('with a boss due at 120 the battle stays open until it has spawned and died', () => {
    const w = createBattle(battleSetup({ throne: throneSetup({ attack: null }), boss: bossYear(10).setup.boss!, waves: emptyWave }));
    run(w, 119);
    expect(w.ended).toBe(false);
    run(w, 121);
    expect(w.bossSpawned).toBe(true);
    expect(w.ended).toBe(false); // the boss is alive
    w.hp[w.bossId] = 0;
    w.alive[w.bossId] = 0;
    stepBattle(w, []);
    expect(w.ended).toBe(true);
    expect(w.won).toBe(true);
  });
});

describe('setup_mirror', () => {
  const thirty = (build: (s: RunState) => RunState) => {
    const base = newRun(5, 'wheat', CONTENT, RULES_FULL);
    const s = build({ ...startYear({ ...base, year: 29 }, CONTENT) });
    return { s, setup: buildBattleSetup({ ...s, phase: 'battle' }, CONTENT) };
  };

  it('is null when the player has no troop building', () => {
    expect(thirty((s) => withBuilding(s, 7, 'neutral_archer_tower', 3)).setup.boss!.mirror).toBeNull();
  });

  it('copies the troop of the highest-level building at the foe level, half as many, at least one', () => {
    const { s, setup } = thirty((x) => withBuilding(withBuilding(x, 6, 'neutral_barracks', 2), 8, 'wheat_militia', 4));
    const m = setup.boss!.mirror!;
    expect(m.stats.unit).toBe('militia'); // level 4 beats level 2
    const count = setup.structures.find((x) => x.plot === 8)!.spawn!.count;
    expect(m.count).toBe(Math.max(1, Math.floor(count / 2)));
    const mult = ENEMY_LEVEL_STAT[s.army!.level - 1]! * s.army!.statMult;
    expect(m.stats.hp).toBeCloseTo(CONTENT.unit('militia').hp * mult);
  });

  it('breaks a level tie with the lowest plot', () => {
    const { setup } = thirty((x) => withBuilding(withBuilding(x, 8, 'wheat_militia', 3), 6, 'neutral_barracks', 3));
    expect(setup.boss!.mirror!.stats.unit).toBe(CONTENT.unit(setup.structures.find((x) => x.plot === 6)!.spawn!.stats.unit).id);
  });

  it('a camp with a single soldier still mirrors one', () => {
    const { setup } = thirty((x) => withBuilding(x, 6, 'wheat_militia', 1));
    const spawn = setup.structures.find((s) => s.plot === 6)!.spawn!;
    expect(spawn.count).toBeGreaterThanOrEqual(1);
    expect(setup.boss!.mirror!.count).toBe(Math.max(1, Math.floor(spawn.count / 2)));
  });

  it('is never used by boss 1 or boss 2', () => {
    expect(bossYear(10).setup.boss!.mirror).toBeNull();
    expect(bossYear(20).setup.boss!.mirror).toBeNull();
  });
});
