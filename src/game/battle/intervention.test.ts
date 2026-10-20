import { describe, expect, it } from 'vitest';
import { BATTLE, INTERVENTION } from '../../data/battle';
import { battleSetup, structure, throneSetup, unitStats } from '../testing/fixtures';
import {
  autoFirePhase,
  boulderPhase,
  pickAutoTarget,
  setAutoFire,
  tryIntervene,
} from './intervention';
import { stepBattle } from './step';
import type { AutoFireInput, BattleEvent, BattleInput } from './types';
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

/** Thế giới với các địch đứng yên (tốc 0, nhiều máu) đặt tại `points`, id 1..n. */
const worldWithFoes = (points: readonly [number, number][], autoFire = true): BattleWorld => {
  const foe = unitStats({ unit: 'dummy', hp: 5000, speed: 0 });
  const w = createBattle(
    battleSetup({
      autoFire,
      waves: [{ spawnTick: 0, spawns: points.map(() => ({ stats: foe, edge: 'N' as const })) }],
    }),
  );
  spawnWave(w, 0);
  points.forEach(([x, y], i) => {
    w.x[i + 1] = x;
    w.y[i + 1] = y;
  });
  drainEvents(w);
  return w;
};

const auto = (w: BattleWorld, tick: number, on: boolean): AutoFireInput => {
  w.tick = tick;
  return { tick, auto: on };
};

describe('pickAutoTarget', () => {
  it('picks the centre of the densest cluster within the boulder radius', () => {
    const w = worldWithFoes([
      [50, 50],
      [300, 300],
      [310, 300],
    ]);
    expect(pickAutoTarget(w)).toEqual({ x: 300, y: 300 });
  });

  it('breaks ties by the lowest enemy id', () => {
    const w = worldWithFoes([
      [100, 100],
      [105, 100],
      [300, 300],
      [305, 300],
    ]);
    expect(pickAutoTarget(w)).toEqual({ x: 100, y: 100 });
  });

  it('returns null when no foe is alive', () => {
    const w = worldWithFoes([[100, 100]]);
    w.alive[1] = 0;
    expect(pickAutoTarget(w)).toBeNull();
  });

  it('ignores allied entities', () => {
    const w = createBattle(battleSetup({ structures: [structure(6)] }));
    expect(pickAutoTarget(w)).toBeNull();
  });

  it('clamps the aim point into the field', () => {
    const w = worldWithFoes([[-20, 500]]);
    expect(pickAutoTarget(w)).toEqual({ x: 0, y: BATTLE.field });
  });

  it('uses world.boulderRadius for both the cluster count and the blast', () => {
    const pts: [number, number][] = [
      [100, 100],
      [135, 100],
    ];
    const narrow = worldWithFoes(pts);
    expect(pickAutoTarget(narrow)).toEqual({ x: 100, y: 100 });
    const chain: [number, number][] = [...pts, [170, 100]];
    expect(pickAutoTarget(worldWithFoes(chain))).toEqual({ x: 100, y: 100 }); // default radius 24: all tie at 1
    const wide = worldWithFoes(chain);
    wide.boulderRadius = 40;
    expect(pickAutoTarget(wide)).toEqual({ x: 135, y: 100 }); // the middle foe has both others within 40

    const hit = worldWithFoes([[100, 100], [135, 100]], false);
    hit.boulderRadius = 40;
    hit.tick = 30;
    expect(tryIntervene(hit, { tick: 30, x: 100, y: 100 })).toBe(true);
    hit.tick = 36;
    boulderPhase(hit);
    expect(hit.damageQueue.map((q) => q.victim)).toEqual([1, 2]);
  });
});

describe('setAutoFire', () => {
  it('toggles the flag, records the input and rejects a wrong tick or an ended battle', () => {
    const w = worldWithFoes([[100, 100]], false);
    expect(setAutoFire(w, { tick: 5, auto: true })).toBe(false);
    expect(w.autoFire).toBe(false);
    expect(setAutoFire(w, auto(w, 5, true))).toBe(true);
    expect(w.autoFire).toBe(true);
    expect(w.inputs).toEqual([{ tick: 5, auto: true }]);
    w.ended = true;
    expect(setAutoFire(w, auto(w, 6, false))).toBe(false);
    expect(w.autoFire).toBe(true);
  });
});

describe('autoFirePhase', () => {
  it('does nothing while auto-fire is off', () => {
    const w = worldWithFoes([[100, 100]], false);
    w.tick = INTERVENTION.firstReadyTick;
    autoFirePhase(w);
    expect(w.boulders).toEqual([]);
    expect(w.interventionsUsed).toBe(0);
  });

  it('is not ready before firstReadyTick and fires exactly on it', () => {
    const w = worldWithFoes([[100, 100]]);
    w.tick = INTERVENTION.firstReadyTick - 1;
    autoFirePhase(w);
    expect(w.interventionsUsed).toBe(0);
    w.tick = INTERVENTION.firstReadyTick;
    autoFirePhase(w);
    expect(w.interventionsUsed).toBe(1);
    expect(w.readyTick).toBe(INTERVENTION.firstReadyTick + INTERVENTION.cooldownTicks);
    expect(w.boulders).toEqual([
      { x: 100, y: 100, dropTick: 30, impactTick: 30 + INTERVENTION.delayTicks },
    ]);
    expect(drainEvents(w)).toContainEqual({ type: 'boulder', phase: 'drop', x: 100, y: 100 });
    expect(w.inputs).toEqual([]); // automatic drops are re-derived on replay, never recorded
  });

  it('shares the cooldown with manual drops in both directions', () => {
    const w = worldWithFoes([[100, 100]]);
    expect(tryIntervene(w, at(w, 30, 100, 100))).toBe(true);
    w.tick = 31;
    autoFirePhase(w);
    expect(w.interventionsUsed).toBe(1);
    w.tick = 30 + INTERVENTION.cooldownTicks;
    autoFirePhase(w);
    expect(w.interventionsUsed).toBe(2);
    expect(tryIntervene(w, at(w, 30 + INTERVENTION.cooldownTicks + 1, 100, 100))).toBe(false);
  });

  it('does not drop and does not spend the cooldown when no foe is alive', () => {
    const w = worldWithFoes([[100, 100]]);
    w.alive[1] = 0;
    w.tick = 40;
    autoFirePhase(w);
    expect(w.interventionsUsed).toBe(0);
    expect(w.readyTick).toBe(INTERVENTION.firstReadyTick);
  });
});

describe('auto-fire inside stepBattle', () => {
  it('lets a manual drop on the ready tick win, then auto-fires after the cooldown', () => {
    const w = worldWithFoes([[100, 100]]);
    const run = (until: number, inputs: readonly (BattleInput | AutoFireInput)[] = []): void => {
      while (w.tick < until) {
        const tick = w.tick;
        stepBattle(
          w,
          inputs.filter((i) => i.tick === tick),
        );
        drainEvents(w);
      }
    };
    run(31, [{ tick: 30, x: 100, y: 100 }]);
    expect(w.interventionsUsed).toBe(1);
    expect(w.inputs).toEqual([{ tick: 30, x: 100, y: 100 }]);
    run(30 + INTERVENTION.cooldownTicks + 1);
    expect(w.interventionsUsed).toBe(2);
    expect(w.inputs).toHaveLength(1);
  });

  it('records a mid-battle toggle in the result inputs', () => {
    const w = worldWithFoes([[100, 100]], false);
    while (w.tick < 20) stepBattle(w, []);
    stepBattle(w, [{ tick: 20, auto: true }]);
    expect(w.autoFire).toBe(true);
    expect(w.inputs).toEqual([{ tick: 20, auto: true }]);
  });
});
