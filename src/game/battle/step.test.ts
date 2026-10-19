import { describe, expect, it } from 'vitest';
import { BATTLE } from '../../data/battle';
import { attackStats, battleSetup, structure, throneSetup, unitStats } from '../testing/fixtures';
import { hashWorld } from './hash';
import { battleResult, simulateBattle, stepBattle } from './step';
import type { BattleEvent, BattleSetup, UnitStats, WaveSetup } from './types';
import { TEAM_FOE, createBattle, drainEvents, spawnWave, type BattleWorld } from './world';

const wave = (n: number, spawnTick: number, over: Partial<UnitStats> = {}): WaveSetup => ({
  spawnTick,
  spawns: Array.from({ length: n }, () => ({
    stats: unitStats({ unit: 'bandit', ...over }),
    edge: 'N' as const,
  })),
});

/** Chạy tới khi kết thúc (tối đa hardLimitTick + 1 bước), gom mọi sự kiện. */
const runToEnd = (w: BattleWorld): BattleEvent[] => {
  const events: BattleEvent[] = [];
  for (let i = 0; i <= BATTLE.hardLimitTick && battleResult(w) === null; i++) {
    stepBattle(w, []);
    events.push(...drainEvents(w));
  }
  return events;
};

/** Ngai bắn tức thời, tầm 72. */
const instantThrone = (dmg: number, hp = 300) =>
  throneSetup({ hp, attack: attackStats({ dmg, range: 72, interval: 10, projectileSpeed: 0 }) });

describe('stepBattle', () => {
  it('spawns wave 0 inside the first step and later waves on their spawnTick', () => {
    const w = createBattle(
      battleSetup({ throne: throneSetup({ attack: null }), waves: [wave(2, 0), wave(3, 4)] }),
    );
    expect(w.spawnedWaves).toBe(0);
    expect(w.count).toBe(1);
    stepBattle(w, []);
    expect(w.spawnedWaves).toBe(1);
    expect(w.count).toBe(3);
    expect(w.tick).toBe(1);
    for (let i = 0; i < 3; i++) stepBattle(w, []);
    expect(w.spawnedWaves).toBe(1);
    stepBattle(w, []); // tick 4
    expect(w.spawnedWaves).toBe(2);
    expect(w.count).toBe(6);
    stepBattle(w, []);
    expect(w.spawnedWaves).toBe(2);
  });

  it('ignores inputs for now and stays deterministic', () => {
    const setup = battleSetup({ waves: [wave(5, 0), wave(5, 30)] });
    const a = createBattle(setup);
    const b = createBattle(setup);
    for (let i = 0; i < 80; i++) {
      stepBattle(a, []);
      stepBattle(b, [{ tick: b.tick, x: 100, y: 100 }]);
    }
    expect(hashWorld(a)).toBe(hashWorld(b));
  });

  it('does nothing once the battle has ended', () => {
    const w = createBattle(battleSetup());
    stepBattle(w, []);
    expect(battleResult(w)).not.toBeNull();
    const h = hashWorld(w);
    stepBattle(w, []);
    expect(hashWorld(w)).toBe(h);
  });
});

describe('end of battle', () => {
  it('returns null until ended', () => {
    const w = createBattle(battleSetup({ waves: [wave(1, 0)] }));
    expect(battleResult(w)).toBeNull();
    stepBattle(w, []);
    expect(battleResult(w)).toBeNull();
  });

  it('wins when every wave has spawned and no foe is alive', () => {
    const setup = battleSetup({ throne: instantThrone(100), waves: [wave(1, 0)] });
    const w = createBattle(setup);
    spawnWave(w, 0); // đặt sẵn địch trong tầm Ngai
    w.x[1] = 192;
    w.y[1] = 130;
    stepBattle(w, []);
    const r = battleResult(w);
    expect(r).not.toBeNull();
    expect(r!.won).toBe(true);
    expect(r!.ticks).toBe(0);
    expect(r!.kills).toBe(1);
    expect(r!.killsBySource).toEqual({ 0: 1 });
    expect(r!.throneHpLostPct).toBe(0);
  });

  it('does not win while a wave is still to come', () => {
    const w = createBattle(
      battleSetup({ throne: instantThrone(100), waves: [wave(1, 0), wave(1, 50)] }),
    );
    spawnWave(w, 0);
    w.x[1] = 192;
    w.y[1] = 130;
    stepBattle(w, []);
    expect(battleResult(w)).toBeNull();
  });

  it('a throne at 0 HP in the same tick as the last foe dies → lost', () => {
    const setup = battleSetup({ throne: instantThrone(100, 5), waves: [wave(1, 0, { dmg: 5 })] });
    const w = createBattle(setup);
    spawnWave(w, 0);
    w.x[1] = 192;
    w.y[1] = 192 - 14 - 4 - 1; // mép–mép 1 ≤ tầm 2
    const events: BattleEvent[] = [];
    stepBattle(w, []);
    events.push(...drainEvents(w));
    expect(w.alive[1]).toBe(0);
    expect(w.hp[0]).toBeLessThanOrEqual(0);
    const r = battleResult(w)!;
    expect(r.won).toBe(false);
    expect(r.throneHpLostPct).toBe(100);
    expect(events.filter((e) => e.type === 'ended')).toEqual([{ type: 'ended', won: false }]);
  });

  it('at hardLimitTick with the throne alive and foes left → won; rage once at rageTick', () => {
    const setup = battleSetup({
      throne: throneSetup({ attack: null }),
      waves: [wave(2, 0, { speed: 0 })],
    });
    const w = createBattle(setup);
    let rageAt = -1;
    const events: BattleEvent[] = [];
    for (let i = 0; i <= BATTLE.hardLimitTick && battleResult(w) === null; i++) {
      const tick = w.tick;
      stepBattle(w, []);
      const ev = drainEvents(w);
      if (ev.some((e) => e.type === 'rage')) rageAt = tick;
      events.push(...ev);
    }
    expect(rageAt).toBe(BATTLE.rageTick);
    expect(events.filter((e) => e.type === 'rage')).toHaveLength(1);
    expect(events.filter((e) => e.type === 'ended')).toEqual([{ type: 'ended', won: true }]);
    const r = battleResult(w)!;
    expect(r.won).toBe(true);
    expect(r.ticks).toBe(BATTLE.hardLimitTick);
    expect(w.alive[1]).toBe(1);
  });

  it('reports throneHpLostPct, unitsLost and capped from the world', () => {
    const setup = battleSetup({
      throne: throneSetup({ attack: null }),
      structures: [structure(7, { spawn: { stats: unitStats({ hp: 1, dmg: 0 }), count: 1 } })],
      waves: [wave(1, 0, { speed: 0, dmg: 50 })],
    });
    const w = createBattle(setup);
    spawnWave(w, 0);
    const ally = 2;
    const foe = 3;
    expect(w.team[foe]).toBe(TEAM_FOE);
    // xa mọi công trình: địch chỉ thấy lính, mép–mép 1
    w.x[ally] = 300;
    w.y[ally] = 300;
    w.x[foe] = 300;
    w.y[foe] = 291;
    w.hp[0] = 225;
    w.capped = 3;
    stepBattle(w, []);
    expect(w.unitsLost).toBe(1);
    w.hp[foe] = 0; // kết thúc gọn ở tick sau
    stepBattle(w, []);
    const r = battleResult(w)!;
    expect(r.won).toBe(true);
    expect(r.ticks).toBe(1);
    expect(r.throneHpLostPct).toBe(25);
    expect(r.unitsLost).toBe(1);
    expect(r.capped).toBe(3);
    expect(r.interventionsUsed).toBe(0);
    expect(r.inputs).toEqual([]);
  });

  it('emits ended exactly once', () => {
    const w = createBattle(battleSetup({ throne: instantThrone(100), waves: [wave(3, 0)] }));
    const events = runToEnd(w);
    stepBattle(w, []);
    events.push(...drainEvents(w));
    expect(events.filter((e) => e.type === 'ended')).toHaveLength(1);
  });
});

describe('simulateBattle', () => {
  const militia = unitStats({ unit: 'militia', hp: 32, dmg: 5, speed: 1 });
  const bandit = unitStats({ unit: 'bandit', hp: 30, dmg: 5, speed: 0.9 });
  const setup: BattleSetup = battleSetup({
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

  it('throne + 4 militia + archer tower beat 6 bandits from N before tick 900', () => {
    const r = simulateBattle(setup);
    expect(r.won).toBe(true);
    expect(r.ticks).toBeLessThan(900);
    expect(r.kills).toBe(6);
  });

  it('is deterministic', () => {
    expect(simulateBattle(setup)).toEqual(simulateBattle(setup));
  });
});
