import { describe, expect, it } from 'vitest';
import { BATTLE, INTERVENTION } from '../../data/battle';
import { battleSetup, structure, throneSetup, unitStats } from '../testing/fixtures';
import { boulderPhase, tryIntervene } from './intervention';
import { stepBattle } from './step';
import type { BattleEvent, BattleInput } from './types';
import {
  TEAM_ALLY,
  TEAM_FOE,
  createBattle,
  drainEvents,
  spawnWave,
  type BattleWorld,
} from './world';

const at = (w: BattleWorld, tick: number, x = 192, y = 100): BattleInput => {
  w.tick = tick;
  return { tick, x, y };
};

describe('tryIntervene', () => {
  it('is ready only from firstReadyTick (30)', () => {
    const w = createBattle(battleSetup());
    expect(tryIntervene(w, at(w, 29))).toBe(false);
    expect(w.inputs).toEqual([]);
    expect(w.interventionsUsed).toBe(0);
    expect(w.boulders).toEqual([]);
    drainEvents(w);

    expect(tryIntervene(w, at(w, 30, 150, 160))).toBe(true);
    expect(w.inputs).toEqual([{ tick: 30, x: 150, y: 160 }]);
    expect(w.interventionsUsed).toBe(1);
    expect(w.readyTick).toBe(30 + INTERVENTION.cooldownTicks);
    expect(w.boulders).toEqual([{ x: 150, y: 160, dropTick: 30, impactTick: 36 }]);
    expect(drainEvents(w)).toEqual([{ type: 'boulder', phase: 'drop', x: 150, y: 160 }]);
  });

  it('cools down 150 ticks from the drop', () => {
    const w = createBattle(battleSetup());
    expect(tryIntervene(w, at(w, 30))).toBe(true);
    expect(tryIntervene(w, at(w, 179))).toBe(false);
    expect(w.interventionsUsed).toBe(1);
    expect(w.inputs).toHaveLength(1);
    expect(tryIntervene(w, at(w, 180))).toBe(true);
    expect(w.interventionsUsed).toBe(2);
    expect(w.inputs.map((i) => i.tick)).toEqual([30, 180]);
    expect(w.readyTick).toBe(330);
  });

  it.each([
    ['x NaN', Number.NaN, 100],
    ['y −1', 100, -1],
    ['x 385', 385, 100],
    ['x Infinity', Number.POSITIVE_INFINITY, 100],
  ])('rejects an invalid point (%s)', (_name, x, y) => {
    const w = createBattle(battleSetup());
    w.tick = 30;
    expect(tryIntervene(w, { tick: 30, x, y })).toBe(false);
    expect(w.inputs).toEqual([]);
    expect(w.interventionsUsed).toBe(0);
    expect(w.readyTick).toBe(INTERVENTION.firstReadyTick);
  });

  it('accepts the field corners 0 and 384', () => {
    const w = createBattle(battleSetup());
    expect(tryIntervene(w, at(w, 30, 0, BATTLE.field))).toBe(true);
  });

  it('rejects an input whose tick is not the current tick', () => {
    const w = createBattle(battleSetup());
    w.tick = 40;
    expect(tryIntervene(w, { tick: 39, x: 100, y: 100 })).toBe(false);
    expect(tryIntervene(w, { tick: 41, x: 100, y: 100 })).toBe(false);
    expect(w.inputs).toEqual([]);
  });
});

/**
 * Ô 0 (tâm 128,128) có công trình; tảng đá rơi ở (128,148): công trình cách 20 px (trong 24).
 * Địch A cách tâm 18 px (trong), địch B cách 30 px (ngoài), lính phe mình cách 10 px (trong).
 * Mọi thứ đứng yên (speed 0, không đòn) và không chồng nhau, để chỉ tảng đá tác động.
 */
const BX = 128;
const BY = 148;
const A = 3; // id: Ngai 0, công trình 1, lính 2, địch 3, 4

const scene = (year: number, foeHp = 1000, foeArmor = 0.5): BattleWorld => {
  const still = { speed: 0, dmg: 0 };
  const w = createBattle(
    battleSetup({
      year,
      throne: throneSetup({ attack: null }),
      structures: [structure(0, { spawn: { stats: unitStats(still), count: 1 } })],
      waves: [
        {
          spawnTick: 0,
          spawns: [0, 1].map(() => ({
            stats: unitStats({ unit: 'bandit', ...still, hp: foeHp, armor: foeArmor }),
            edge: 'N' as const,
          })),
        },
      ],
    }),
  );
  spawnWave(w, 0);
  expect(w.team[2]).toBe(TEAM_ALLY);
  expect(w.team[A]).toBe(TEAM_FOE);
  const put = (id: number, x: number, y: number): void => {
    w.x[id] = x;
    w.y[id] = y;
  };
  put(2, BX, BY + 10);
  put(A, BX + 18, BY);
  put(4, BX - 30, BY);
  drainEvents(w);
  return w;
};

/** Lần đầu nhảy tới tick 30 và thả bằng stepBattle; chạy tiếp tới hết tick `last`; trả sự kiện theo tick. */
const dropAndRun = (w: BattleWorld, last: number): Map<number, BattleEvent[]> => {
  const byTick = new Map<number, BattleEvent[]>();
  if (w.tick < 30) w.tick = 30;
  while (w.tick <= last) {
    const tick = w.tick;
    stepBattle(w, tick === 30 ? [{ tick: 30, x: BX, y: BY }] : []);
    byTick.set(tick, drainEvents(w));
  }
  return byTick;
};

describe('boulder impact', () => {
  it('lands delayTicks (6) after the drop', () => {
    const w = scene(1);
    const ev = dropAndRun(w, 40);
    const boulders: { tick: number; e: BattleEvent }[] = [];
    for (let t = 30; t <= 40; t++) {
      for (const e of ev.get(t)!) if (e.type === 'boulder') boulders.push({ tick: t, e });
    }
    expect(boulders).toEqual([
      { tick: 30, e: { type: 'boulder', phase: 'drop', x: BX, y: BY } },
      { tick: 36, e: { type: 'boulder', phase: 'impact', x: BX, y: BY } },
    ]);
    expect(w.boulders).toEqual([]);
  });

  it('deals 40 magic damage in year 1, ignoring armor 0.5, only to foes inside the radius', () => {
    const w = scene(1);
    const hp0 = Array.from(w.hp.subarray(0, w.count));
    dropAndRun(w, 35);
    expect(Array.from(w.hp.subarray(0, w.count))).toEqual(hp0);
    dropAndRun(w, 36);
    expect(w.hp[A]).toBe(1000 - 40);
    expect(w.hp[4]).toBe(1000); // ngoài 24 px
    expect(w.hp[2]).toBe(hp0[2]); // lính phe mình
    expect(w.hp[1]).toBe(hp0[1]); // công trình
    expect(w.hp[0]).toBe(hp0[0]); // Ngai
  });

  it('scales with the year: year 5 → 80', () => {
    const w = scene(5);
    dropAndRun(w, 36);
    expect(w.hp[A]).toBe(1000 - 80);
  });

  it('knocks foes 12 px away from the centre over 3 ticks; allies stay put', () => {
    const w = scene(1);
    dropAndRun(w, 35);
    expect([w.x[A], w.y[A]]).toEqual([BX + 18, BY]);
    dropAndRun(w, 36);
    expect(w.x[A]).toBeCloseTo(BX + 18 + 4, 10);
    dropAndRun(w, 38);
    expect(w.x[A]).toBeCloseTo(BX + 18 + INTERVENTION.knockback, 10);
    expect(w.y[A]).toBeCloseTo(BY, 10);
    expect(w.kbTicks[A]).toBe(0);
    dropAndRun(w, 40);
    expect(w.x[A]).toBeCloseTo(BX + 18 + INTERVENTION.knockback, 10);
    expect([w.x[2], w.y[2]]).toEqual([BX, BY + 10]);
    expect([w.x[4], w.y[4]]).toEqual([BX - 30, BY]);
  });

  it('counts foes killed by the boulder in kills (not in killsBySource)', () => {
    const w = scene(1, 30, 0);
    dropAndRun(w, 36);
    expect(w.alive[A]).toBe(0);
    expect(w.alive[4]).toBe(1);
    expect(w.kills).toBe(1);
    expect(w.killsBySource).toEqual({});
  });

  it('boulderPhase leaves boulders that are not due yet', () => {
    const w = scene(1);
    w.tick = 30;
    expect(tryIntervene(w, { tick: 30, x: BX, y: BY })).toBe(true);
    w.tick = 35;
    boulderPhase(w);
    expect(w.boulders).toHaveLength(1);
    expect(w.damageQueue).toEqual([]);
    w.tick = 36;
    boulderPhase(w);
    expect(w.boulders).toEqual([]);
    expect(w.damageQueue.map((q) => q.victim)).toEqual([A]);
    expect(w.damageQueue[0]!.sourceUid).toBe(-2);
  });
});
