import { describe, expect, it } from 'vitest';
import { INTERVENTION } from '../../data/battle';
import { createGameBus } from '../events';
import { attackStats, battleSetup, structure, unitStats } from '../testing/fixtures';
import { BattleRunner } from './BattleRunner';
import { simulateBattle } from './step';
import type { BattleResult, BattleSetup } from './types';

const militia = unitStats({ unit: 'militia', hp: 32, dmg: 5, speed: 1 });
const bandit = unitStats({ unit: 'bandit', hp: 30, dmg: 5, speed: 0.9 });
const endingSetup: BattleSetup = battleSetup({
  structures: [
    structure(7, { uid: 1, cardId: 'wheat_militia', spawn: { stats: militia, count: 4 } }),
    structure(11, {
      uid: 2,
      cardId: 'neutral_archer_tower',
      kind: 'tower',
      attack: attackStats({ dmg: 7, range: 88, interval: 12, projectileSpeed: 8 }),
      targeting: 'closestToThrone',
    }),
  ],
  waves: [
    {
      spawnTick: 0,
      spawns: Array.from({ length: 6 }, () => ({ stats: bandit, edge: 'N' as const })),
    },
  ],
});
/** Địch rất trâu, ở xa: trận không kết thúc sớm. */
const longSetup: BattleSetup = battleSetup({
  waves: [
    {
      spawnTick: 0,
      spawns: [{ stats: unitStats({ unit: 'tank', hp: 1e9, speed: 0.1 }), edge: 'N' as const }],
    },
  ],
});

const make = (setup: BattleSetup = longSetup) => {
  const bus = createGameBus();
  const runner = new BattleRunner(setup, bus);
  return { bus, runner };
};

describe('BattleRunner', () => {
  it('runs exactly one tick for 100 ms at 1x', () => {
    const { runner } = make();
    runner.update(100);
    expect(runner.world.tick).toBe(1);
  });

  it('pause runs 0 ticks and emits clock:speed 0', () => {
    const { bus, runner } = make();
    const speeds: number[] = [];
    bus.on('clock:speed', (p) => speeds.push(p.speed));
    bus.emit('ui:toggle-pause', {});
    runner.update(1000);
    expect(runner.world.tick).toBe(0);
    expect(speeds).toEqual([0]);
    bus.emit('ui:toggle-pause', {});
    expect(speeds).toEqual([0, 1]);
  });

  it('3x runs 3 ticks for 100 ms and ui:set-speed emits clock:speed', () => {
    const { bus, runner } = make();
    const speeds: number[] = [];
    bus.on('clock:speed', (p) => speeds.push(p.speed));
    bus.emit('ui:set-speed', { speed: 3 });
    runner.update(100);
    expect(runner.world.tick).toBe(3);
    expect(speeds).toEqual([3]);
  });

  it('emits battle:tick only on multiples of 10', () => {
    const { bus, runner } = make();
    const ticks: number[] = [];
    bus.on('battle:tick', (p) => ticks.push(p.tick));
    for (let i = 0; i < 25; i++) runner.update(100);
    expect(runner.world.tick).toBe(25);
    expect(ticks.length).toBeGreaterThan(0);
    for (const t of ticks) expect(t % 10).toBe(0);
  });

  it('emits battle:ended once with the simulateBattle result, then stops stepping', () => {
    const { bus, runner } = make(endingSetup);
    const ended: BattleResult[] = [];
    bus.on('battle:ended', (p) => ended.push(p.result));
    for (let i = 0; i < 2000 && ended.length === 0; i++) runner.update(100);
    const stoppedAt = runner.world.tick;
    for (let i = 0; i < 20; i++) runner.update(100);
    expect(ended).toHaveLength(1);
    expect(runner.world.tick).toBe(stoppedAt);
    expect(runner.result).toEqual(ended[0]);
    expect(ended[0]).toEqual(simulateBattle(endingSetup, ended[0]!.inputs));
  });

  it('matches simulateBattle with the same interventions', () => {
    const { bus, runner } = make(endingSetup);
    const ended: BattleResult[] = [];
    bus.on('battle:ended', (p) => ended.push(p.result));
    for (let i = 0; i < 2000 && ended.length === 0; i++) {
      if (runner.world.tick === INTERVENTION.firstReadyTick) runner.intervene(150, 40);
      runner.update(100);
    }
    expect(ended[0]!.inputs).toHaveLength(1);
    expect(ended[0]).toEqual(simulateBattle(endingSetup, ended[0]!.inputs));
  });

  it('intervene while paused at tick 40 records tick 40; ui:intervene is equivalent', () => {
    for (const viaBus of [false, true]) {
      const { bus, runner } = make();
      for (let i = 0; i < 40; i++) runner.update(100);
      expect(runner.world.tick).toBe(40);
      bus.emit('ui:toggle-pause', {});
      if (viaBus) bus.emit('ui:intervene', { x: 100, y: 100 });
      else runner.intervene(100, 100);
      runner.update(1000);
      expect(runner.world.tick).toBe(40);
      bus.emit('ui:toggle-pause', {});
      runner.update(100);
      expect(runner.world.inputs[0]).toEqual({ tick: 40, x: 100, y: 100 });
    }
  });

  it('stops listening to the bus after dispose', () => {
    const { bus, runner } = make();
    runner.dispose();
    bus.emit('ui:set-speed', { speed: 3 });
    bus.emit('ui:toggle-pause', {});
    bus.emit('ui:intervene', { x: 1, y: 1 });
    expect(runner.clock.speed).toBe(1);
  });

  it('is inert after dispose: update does nothing and intervene is ignored', () => {
    const { runner } = make();
    runner.dispose();
    runner.intervene(1, 1);
    runner.update(100);
    expect(runner.world.tick).toBe(0);
    expect(runner.world.inputs).toHaveLength(0);
  });
});
