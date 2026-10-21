import { describe, expect, it } from 'vitest';
import { BATTLE } from '../../data/battle';
import { attackStats, battleSetup, structure, throneSetup, unitStats } from '../testing/fixtures';
import {
  applyDamagePhase,
  attackPhase,
  deathPhase,
  mitigate,
  projectilePhase,
  queueDamage,
  statusPhase,
} from './combat';
import { retarget } from './targeting';
import type { StructureSetup, UnitStats } from './types';
import {
  DMG_PHYSICAL,
  TEAM_ALLY,
  TEAM_FOE,
  addUnit,
  createBattle,
  drainEvents,
  type BattleWorld,
} from './world';

/** Thế giới có Ngai không đánh (để Ngai không chen vào các phép đo). */
const world = (structures: StructureSetup[] = []): BattleWorld =>
  createBattle(battleSetup({ throne: throneSetup({ attack: null }), structures }));

const unit = (
  w: BattleWorld,
  team: number,
  x: number,
  y: number,
  over: Partial<UnitStats> = {},
  sourceUid = -1,
): number => addUnit(w, unitStats(over), team, x, y, x, y, sourceUid);

/** Một tick chiến đấu thuần (không di chuyển/chọn mục tiêu). */
const fight = (w: BattleWorld): void => {
  attackPhase(w);
  projectilePhase(w);
  applyDamagePhase(w);
  statusPhase(w);
  deathPhase(w);
};

/** Tháp Cung ở plot 7 = (192, 160), r 12: dmg 7, tầm 88, đạn 8 px/tick. */
const archerTower = (over: Partial<StructureSetup> = {}): StructureSetup =>
  structure(7, {
    uid: 70,
    kind: 'tower',
    attack: attackStats({ dmg: 7, range: 88, interval: 100, projectileSpeed: 8 }),
    targeting: 'closestToThrone',
    ...over,
  });

describe('mitigate', () => {
  it('applies armor by damage type (§8.5)', () => {
    expect(mitigate(10, 'physical', 0.1)).toBe(9);
    expect(mitigate(10, 'fire', 0.2)).toBe(9);
    expect(mitigate(10, 'magic', 0.5)).toBe(10);
  });
});

describe('attack cadence', () => {
  it('a unit with interval 10 hits at T and T+10, never T+9 or T+11', () => {
    const w = world();
    const a = unit(w, TEAM_ALLY, 100, 100, { interval: 10 });
    const f = unit(w, TEAM_FOE, 110, 100, { hp: 1000, dmg: 0 });
    w.target[a] = f;
    const hits: number[] = [];
    for (let t = 0; t < 25; t++) {
      const before = w.hp[f]!;
      fight(w);
      if (w.hp[f]! < before) hits.push(t);
    }
    expect(hits).toEqual([0, 10, 20]);
  });

  it('an idle unit strikes once on contact, then waits a full interval (no stored hits)', () => {
    const w = world();
    const a = unit(w, TEAM_ALLY, 100, 100, { interval: 10 });
    const f = unit(w, TEAM_FOE, 300, 100, { hp: 1000, dmg: 0 });
    w.target[a] = f;
    for (let t = 0; t < 30; t++) fight(w);
    expect(w.hp[f]).toBe(1000);
    w.x[f] = 110;
    const hits: number[] = [];
    for (let t = 0; t < 15; t++) {
      const before = w.hp[f]!;
      fight(w);
      if (w.hp[f]! < before) hits.push(t);
    }
    expect(hits).toEqual([0, 10]);
  });

  it('structures without an attack never attack', () => {
    const w = world([structure(7)]);
    unit(w, TEAM_FOE, 192, 140, { hp: 100, dmg: 0 });
    for (let t = 0; t < 5; t++) attackPhase(w);
    expect(w.damageQueue).toEqual([]);
    expect(w.projectileCount).toBe(0);
    expect(w.cooldown[1]).toBe(0);
  });
});

describe('instant melee damage', () => {
  it('footman dmg 7 removes 7 HP at armor 0 and 6.3 at armor 0.1', () => {
    const w = world();
    const a = unit(w, TEAM_ALLY, 100, 100, { dmg: 7 });
    const f = unit(w, TEAM_FOE, 110, 100, { hp: 45, dmg: 0 });
    const g = unit(w, TEAM_FOE, 100, 110, { hp: 45, dmg: 0, armor: 0.1 });
    const b = unit(w, TEAM_ALLY, 100, 120, { dmg: 7 });
    w.target[a] = f;
    w.target[b] = g;
    attackPhase(w);
    expect(w.hp[f]).toBe(45); // chưa trừ ở bước 6
    applyDamagePhase(w);
    expect(w.hp[f]).toBe(38);
    expect(w.hp[g]).toBeCloseTo(45 - 6.3, 10);
    expect(w.damageQueue).toEqual([]);
    const hits = drainEvents(w).filter((e) => e.type === 'hit');
    expect(hits).toContainEqual({ type: 'hit', id: f, dmg: 7 });
  });

  it('does not attack a target out of range', () => {
    const w = world();
    const a = unit(w, TEAM_ALLY, 100, 100, { dmg: 7 });
    const f = unit(w, TEAM_FOE, 111, 100, { dmg: 0 }); // edge distance 3 > range 2
    w.target[a] = f;
    attackPhase(w);
    expect(w.damageQueue).toEqual([]);
  });

  it('cleave 2: primary −9, nearest other −4.5, third untouched', () => {
    const w = world();
    const r = unit(w, TEAM_ALLY, 100, 100, { dmg: 9, cleave: 2, range: 20 });
    const main = unit(w, TEAM_FOE, 120, 100, { hp: 50, dmg: 0 });
    const far = unit(w, TEAM_FOE, 100, 125, { hp: 50, dmg: 0 });
    const near = unit(w, TEAM_FOE, 100, 112, { hp: 50, dmg: 0 });
    w.target[r] = main;
    attackPhase(w);
    applyDamagePhase(w);
    expect(w.hp[main]).toBe(41);
    expect(w.hp[near]).toBe(45.5);
    expect(w.hp[far]).toBe(50);
  });
});

describe('projectiles', () => {
  /** Tháp id 1 ở (192,160) r12; địch r4 cách mép–mép 80 px → tâm (192, 64). */
  const setupShot = () => {
    const w = world([archerTower()]);
    const f = unit(w, TEAM_FOE, 192, 64, { hp: 100, dmg: 0, speed: 0 });
    return { w, f, tower: 1 };
  };

  it('flies 8 px per tick and hits exactly once on arrival', () => {
    const { w, f } = setupShot();
    attackPhase(w);
    expect(w.projectileCount).toBe(1);
    expect(w.damageQueue).toEqual([]);
    const hits: number[] = [];
    for (let t = 0; t < 30; t++) {
      if (t > 0) attackPhase(w);
      const py = w.projectiles.py[0]!;
      projectilePhase(w);
      if (t === 0) {
        expect(w.projectiles.py[0]).toBe(152);
        expect(py).toBe(160);
      }
      const before = w.hp[f]!;
      applyDamagePhase(w);
      if (w.hp[f]! < before) hits.push(t);
    }
    // tâm cách 96 px → 12 lần bay
    expect(hits).toEqual([11]);
    expect(w.hp[f]).toBe(93);
    expect(w.projectileCount).toBe(0);
  });

  it('homes on the current position of a moving target', () => {
    const { w, f } = setupShot();
    attackPhase(w);
    projectilePhase(w);
    expect([w.projectiles.px[0], w.projectiles.py[0]]).toEqual([192, 152]);
    w.x[f] = 192 + 88; // mục tiêu sang ngang: (280, 64) → hướng (88, −88)/√2·88
    projectilePhase(w);
    const s = 8 / Math.sqrt(2);
    expect(w.projectiles.px[0]).toBeCloseTo(192 + s, 10);
    expect(w.projectiles.py[0]).toBeCloseTo(152 - s, 10);
  });

  it('vanishes without damage when its target dies first', () => {
    const { w, f } = setupShot();
    const other = unit(w, TEAM_FOE, 200, 56, { hp: 100, dmg: 0, speed: 0 }); // ngoài tầm tháp, gần đường đạn
    attackPhase(w);
    w.interval[1] = 0; // tháp không bắn thêm
    projectilePhase(w);
    w.hp[f] = 0;
    deathPhase(w);
    expect(w.alive[f]).toBe(0);
    projectilePhase(w);
    expect(w.projectileCount).toBe(0);
    expect(w.damageQueue).toEqual([]);
    for (let t = 0; t < 20; t++) fight(w);
    expect(w.hp[other]).toBe(100);
  });

  it('hits instantly when the pool is full', () => {
    const { w, f } = setupShot();
    w.projectileCount = BATTLE.projectileCap;
    attackPhase(w);
    expect(w.projectileCount).toBe(BATTLE.projectileCap);
    expect(w.damageQueue).toHaveLength(1);
    applyDamagePhase(w);
    expect(w.hp[f]).toBe(93);
  });

  it('records sourceId and sourceUid on the projectile', () => {
    const { w, f } = setupShot();
    attackPhase(w);
    expect(w.projectiles.sourceId[0]).toBe(1);
    expect(w.projectiles.sourceUid[0]).toBe(70);
    expect(w.projectiles.targetId[0]).toBe(f);
    expect(w.projectiles.alive[0]).toBe(1);
  });
});

describe('slow (onHit)', () => {
  const slowed = () => {
    const w = world();
    const f = unit(w, TEAM_FOE, 100, 100, { hp: 1000 });
    return { w, f };
  };

  it('applies slowPct/slowTicks and refreshes without stacking', () => {
    const { w, f } = slowed();
    queueDamage(w, f, 1, DMG_PHYSICAL, 5, { pct: 20, ticks: 20 });
    applyDamagePhase(w);
    expect([w.slowPct[f], w.slowTicks[f]]).toEqual([20, 20]);
    for (let t = 0; t < 5; t++) statusPhase(w);
    expect(w.slowTicks[f]).toBe(15);
    queueDamage(w, f, 1, DMG_PHYSICAL, 5, { pct: 20, ticks: 20 });
    applyDamagePhase(w);
    expect([w.slowPct[f], w.slowTicks[f]]).toEqual([20, 20]);
  });

  it('keeps the strongest of two sources', () => {
    const { w, f } = slowed();
    queueDamage(w, f, 1, DMG_PHYSICAL, 5, { pct: 20, ticks: 20 });
    queueDamage(w, f, 1, DMG_PHYSICAL, 6, { pct: 50, ticks: 20 });
    applyDamagePhase(w);
    expect(w.slowPct[f]).toBe(50);
    queueDamage(w, f, 1, DMG_PHYSICAL, 5, { pct: 20, ticks: 20 });
    applyDamagePhase(w);
    expect(w.slowPct[f]).toBe(50);
  });

  it('clamps to maxSlowPct', () => {
    const { w, f } = slowed();
    queueDamage(w, f, 1, DMG_PHYSICAL, 5, { pct: 80, ticks: 20 });
    applyDamagePhase(w);
    expect(w.slowPct[f]).toBe(BATTLE.maxSlowPct);
  });

  it('expires back to 0', () => {
    const { w, f } = slowed();
    queueDamage(w, f, 1, DMG_PHYSICAL, 5, { pct: 20, ticks: 20 });
    applyDamagePhase(w);
    for (let t = 0; t < 19; t++) statusPhase(w);
    expect(w.slowPct[f]).toBe(20);
    statusPhase(w);
    expect([w.slowPct[f], w.slowTicks[f]]).toEqual([0, 0]);
  });

  it('an attacker with onHit slow slows its target', () => {
    const w = world();
    const a = unit(w, TEAM_ALLY, 100, 100, { slowPct: 20, slowTicks: 20 });
    const f = unit(w, TEAM_FOE, 110, 100, { hp: 1000, dmg: 0 });
    w.target[a] = f;
    attackPhase(w);
    applyDamagePhase(w);
    expect([w.slowPct[f], w.slowTicks[f]]).toEqual([20, 20]);
    // chỉ số đòn của người đánh không đổi
    statusPhase(w);
    expect([w.onHitSlowPct[a], w.onHitSlowTicks[a]]).toEqual([20, 20]);
  });
});

describe('damage queue order', () => {
  it('applies by (source id, victim id, creation order)', () => {
    const w = world();
    const f = unit(w, TEAM_FOE, 100, 100, { hp: 100 });
    const g = unit(w, TEAM_FOE, 120, 100, { hp: 100 });
    queueDamage(w, g, 1, DMG_PHYSICAL, 9, undefined, 7);
    queueDamage(w, f, 2, DMG_PHYSICAL, 9, undefined, 7);
    queueDamage(w, g, 3, DMG_PHYSICAL, 9, undefined, 3);
    queueDamage(w, f, 4, DMG_PHYSICAL, 9, undefined, 7);
    applyDamagePhase(w);
    const hits = drainEvents(w).filter((e) => e.type === 'hit');
    expect(hits).toEqual([
      { type: 'hit', id: g, dmg: 3 },
      { type: 'hit', id: f, dmg: 2 },
      { type: 'hit', id: f, dmg: 4 },
      { type: 'hit', id: g, dmg: 1 },
    ]);
  });
});

describe('deaths', () => {
  it('two units killing one foe in a tick: one death, kill to the smaller source id', () => {
    const w = world([
      structure(6, { uid: 60, spawn: { stats: unitStats({ dmg: 7 }), count: 1 } }),
      structure(8, { uid: 80, spawn: { stats: unitStats({ dmg: 7 }), count: 1 } }),
    ]);
    // ids: 0 Ngai, 1 plot 6, 2 plot 8, 3 lính uid 60, 4 lính uid 80
    expect([w.sourceUid[3], w.sourceUid[4]]).toEqual([60, 80]);
    const f = unit(w, TEAM_FOE, 300, 300, { hp: 5, dmg: 0 });
    w.x[3] = 290;
    w.y[3] = 300;
    w.x[4] = 310;
    w.y[4] = 300;
    w.target[3] = f;
    w.target[4] = f;
    drainEvents(w);
    fight(w);
    expect(w.alive[f]).toBe(0);
    expect(w.kills).toBe(1);
    expect(w.killsBySource).toEqual({ 60: 1 });
    expect(drainEvents(w).filter((e) => e.type === 'death')).toEqual([{ type: 'death', id: f }]);
    fight(w);
    expect(w.kills).toBe(1);
  });

  it('counts ally unit deaths in unitsLost, not structure deaths', () => {
    const w = world([structure(7, { spawn: { stats: unitStats(), count: 1 } })]);
    const ally = 2;
    w.hp[ally] = 0;
    w.hp[1] = -3;
    deathPhase(w);
    expect([w.alive[1], w.alive[ally]]).toEqual([0, 0]);
    expect(w.unitsLost).toBe(1);
    expect(w.kills).toBe(0);
  });

  it('a destroyed structure stops shooting; its troops keep fighting; foes retarget', () => {
    const w = world([
      archerTower({ attack: attackStats({ dmg: 7, range: 88, interval: 10 }) }),
      structure(6, { uid: 60, spawn: { stats: unitStats(), count: 1 } }),
    ]);
    // ids: 0 Ngai, 1 plot 6 trại, 2 plot 7 tháp, 3 lính
    const towerId = 2;
    const soldier = 3;
    const f = unit(w, TEAM_FOE, 192, 141, { hp: 1000, dmg: 0, speed: 0 });
    retarget(w);
    expect(w.target[f]).toBe(towerId);
    w.hp[towerId] = 0;
    deathPhase(w);
    expect(w.alive[towerId]).toBe(0);
    for (let t = 0; t < 30; t++) attackPhase(w);
    expect(w.damageQueue.every((d) => d.sourceId !== towerId)).toBe(true);
    expect(w.projectileCount).toBe(0);
    retarget(w);
    expect(w.target[f]).not.toBe(towerId);
    expect(w.alive[w.target[f]!]).toBe(1);
    // lính của trại vẫn đánh
    w.damageQueue = [];
    w.x[soldier] = 192;
    w.y[soldier] = 151;
    w.target[soldier] = f;
    w.cooldown[soldier] = 0;
    attackPhase(w);
    expect(w.damageQueue.map((d) => d.sourceId)).toEqual([soldier]);
  });
});

/** HP lost by `id` in each of `ticks` fight ticks. */
const damageTaken = (w: BattleWorld, id: number, ticks: number): number[] => {
  const out: number[] = [];
  for (let t = 0; t < ticks; t++) {
    const before = w.hp[id]!;
    fight(w);
    out.push(before - w.hp[id]!);
  }
  return out;
};

describe('splash', () => {
  const setup = (over: Partial<UnitStats> = {}) => {
    const w = world();
    const a = unit(w, TEAM_ALLY, 100, 100, { dmg: 20, range: 60, splash: 16, ...over });
    const main = unit(w, TEAM_FOE, 130, 100, { hp: 1000 });
    const near = unit(w, TEAM_FOE, 140, 100, { hp: 1000 }); // 10 px from the main target
    const far = unit(w, TEAM_FOE, 160, 100, { hp: 1000 }); // 30 px
    const friend = unit(w, TEAM_ALLY, 131, 100, { hp: 1000 });
    w.target[a] = main;
    return { w, a, main, near, far, friend };
  };

  it('hits the target for 100% and foes within the radius for 50%, nobody else', () => {
    const { w, main, near, far, friend } = setup();
    fight(w);
    expect(w.hp[main]).toBe(980);
    expect(w.hp[near]).toBe(990);
    expect(w.hp[far]).toBe(1000);
    expect(w.hp[friend]).toBe(1000);
  });

  it('does nothing extra when splash is 0', () => {
    const { w, near } = setup({ splash: 0 });
    fight(w);
    expect(w.hp[near]).toBe(1000);
  });

  it('splashes where a projectile lands, and still explodes when the target died first', () => {
    const { w, a, main, near } = setup({ projectileSpeed: 100, interval: 1000 });
    attackPhase(w); // fires
    w.hp[main] = 0; // the target dies before the shell arrives
    w.alive[main] = 0;
    projectilePhase(w);
    applyDamagePhase(w);
    expect(w.hp[main]).toBe(0);
    // the shell fell where the target had stood; `near` is 10 px away from that spot
    expect(w.hp[near]).toBe(990);
    expect(a).toBeGreaterThan(0);
  });
});

describe('chain', () => {
  const setup = (count: number) => {
    const w = world();
    const a = unit(w, TEAM_ALLY, 100, 100, {
      dmg: 10,
      range: 60,
      chain: { count, radius: 32, falloff: 0.6 },
    });
    const first = unit(w, TEAM_FOE, 130, 100, { hp: 1000 });
    const second = unit(w, TEAM_FOE, 150, 100, { hp: 1000 }); // 20 px from the first
    const third = unit(w, TEAM_FOE, 175, 100, { hp: 1000 }); // 25 px from the second, 45 from the first
    const outside = unit(w, TEAM_FOE, 130, 160, { hp: 1000 });
    w.target[a] = first;
    return { w, first, second, third, outside };
  };

  it('jumps once to the nearest other foe in range with the falloff', () => {
    const { w, first, second, third, outside } = setup(1);
    fight(w);
    expect(w.hp[first]).toBe(990);
    expect(w.hp[second]).toBeCloseTo(1000 - 10 * 0.6, 9);
    expect(w.hp[third]).toBe(1000);
    expect(w.hp[outside]).toBe(1000);
  });

  it('keeps jumping count times, multiplying the falloff each time, never hitting a foe twice', () => {
    const { w, first, second, third } = setup(2);
    fight(w);
    expect(w.hp[first]).toBe(990);
    expect(w.hp[second]).toBeCloseTo(1000 - 6, 9);
    expect(w.hp[third]).toBeCloseTo(1000 - 3.6, 9);
  });

  it('does not jump when there is no other foe in range', () => {
    const w = world();
    const a = unit(w, TEAM_ALLY, 100, 100, { dmg: 10, range: 60, chain: { count: 1, radius: 32, falloff: 0.6 } });
    const only = unit(w, TEAM_FOE, 130, 100, { hp: 1000 });
    w.target[a] = only;
    fight(w);
    expect(w.hp[only]).toBe(990);
  });

  it('breaks ties by the lowest id', () => {
    const w = world();
    const a = unit(w, TEAM_ALLY, 100, 100, { dmg: 10, range: 60, chain: { count: 1, radius: 40, falloff: 0.5 } });
    const first = unit(w, TEAM_FOE, 130, 100, { hp: 1000 });
    const up = unit(w, TEAM_FOE, 130, 80, { hp: 1000 }); // 20 px from the first
    const down = unit(w, TEAM_FOE, 130, 120, { hp: 1000 }); // 20 px from the first
    w.target[a] = first;
    fight(w);
    expect(w.hp[up]).toBe(995);
    expect(w.hp[down]).toBe(1000);
  });
});

describe('same-target ramp', () => {
  const crystal = () => {
    const w = world();
    const a = unit(w, TEAM_ALLY, 100, 100, {
      dmg: 4,
      range: 60,
      interval: 1,
      rampPctPerHit: 20,
      rampCapPct: 200,
    });
    const f = unit(w, TEAM_FOE, 130, 100, { hp: 100000 });
    w.target[a] = f;
    return { w, a, f };
  };

  it('adds 20% per consecutive hit on the same target up to +200%', () => {
    const { w, f } = crystal();
    const dmg = damageTaken(w, f, 13);
    const expected = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 10].map((n) => 4 * (1 + Math.min(n * 0.2, 2)));
    dmg.forEach((d, i) => expect(d).toBeCloseTo(expected[i]!, 9));
  });

  it('starts over when the shooter switches target', () => {
    const { w, a, f } = crystal();
    damageTaken(w, f, 4);
    const g = unit(w, TEAM_FOE, 140, 100, { hp: 100000 });
    w.target[a] = g;
    expect(damageTaken(w, g, 2)).toEqual([4, 4 * 1.2].map((d) => expect.closeTo(d, 9)));
  });

  it('starts over after the target died', () => {
    const { w, a, f } = crystal();
    damageTaken(w, f, 3);
    w.hp[f] = 0;
    deathPhase(w);
    const g = unit(w, TEAM_FOE, 140, 100, { hp: 100000 });
    w.target[a] = g;
    expect(damageTaken(w, g, 1)[0]).toBeCloseTo(4, 9);
  });

  it('never ramps when rampPctPerHit is 0', () => {
    const w = world();
    const a = unit(w, TEAM_ALLY, 100, 100, { dmg: 4, range: 60, interval: 1 });
    const f = unit(w, TEAM_FOE, 130, 100, { hp: 100000 });
    w.target[a] = f;
    expect(damageTaken(w, f, 4)).toEqual([4, 4, 4, 4]);
  });
});

describe('shields', () => {
  const hitFor = (shield: number, raw: number, armor = 0) => {
    const w = world();
    const f = unit(w, TEAM_FOE, 100, 100, { hp: 100, shield, armor });
    queueDamage(w, f, raw, DMG_PHYSICAL, -1);
    applyDamagePhase(w);
    return { w, f };
  };

  it('absorbs a smaller hit completely, but still reports the hit', () => {
    const { w, f } = hitFor(30, 20);
    expect(w.hp[f]).toBe(100);
    expect(w.shield[f]).toBe(10);
    expect(drainEvents(w)).toContainEqual({ type: 'hit', id: f, dmg: 20 });
  });

  it('lets only the excess through a bigger hit', () => {
    const { w, f } = hitFor(30, 50);
    expect(w.shield[f]).toBe(0);
    expect(w.hp[f]).toBe(80);
  });

  it('applies armor before the shield', () => {
    const { w, f } = hitFor(30, 40, 0.5); // 40 × 0.5 = 20 absorbed
    expect(w.shield[f]).toBe(10);
    expect(w.hp[f]).toBe(100);
  });

  it('lets a unit with a shield die only after the shield is gone', () => {
    const w = world();
    const f = unit(w, TEAM_FOE, 100, 100, { hp: 10, shield: 10 });
    queueDamage(w, f, 15, DMG_PHYSICAL, -1);
    applyDamagePhase(w);
    deathPhase(w);
    expect(w.alive[f]).toBe(1);
    queueDamage(w, f, 6, DMG_PHYSICAL, -1);
    applyDamagePhase(w);
    deathPhase(w);
    expect(w.alive[f]).toBe(0);
  });
});

describe('stun', () => {
  it('is applied by a damage event, keeps the longest, and wears off one tick at a time', () => {
    const w = world();
    const f = unit(w, TEAM_FOE, 100, 100, { hp: 100 });
    queueDamage(w, f, 1, DMG_PHYSICAL, -1, undefined, -1, 10);
    queueDamage(w, f, 1, DMG_PHYSICAL, -1, undefined, -1, 5);
    applyDamagePhase(w);
    expect(w.stunTicks[f]).toBe(11); // 10 ticks + the rest of the tick it landed
    for (let i = 0; i < 11; i++) statusPhase(w);
    expect(w.stunTicks[f]).toBe(0);
  });

  it('keeps the victim locked for exactly the stun ticks that follow the hit', () => {
    const w = world();
    const f = unit(w, TEAM_FOE, 100, 100, { hp: 100 });
    queueDamage(w, f, 1, DMG_PHYSICAL, -1, undefined, -1, 10);
    applyDamagePhase(w); // tick T: the stun lands after the action steps
    statusPhase(w); // …and step 9 of the same tick runs
    let locked = 0;
    while (w.stunTicks[f]! > 0 && locked < 50) {
      locked++; // a following tick whose action steps see the stun
      statusPhase(w);
    }
    expect(locked).toBe(10);
  });

  it('is gained from the onHit stun of the attacker, on the primary target only', () => {
    const w = world();
    const a = unit(w, TEAM_ALLY, 100, 100, { dmg: 5, range: 60, stunTicks: 10, splash: 16 });
    const main = unit(w, TEAM_FOE, 130, 100, { hp: 100 });
    const other = unit(w, TEAM_FOE, 140, 100, { hp: 100 });
    w.target[a] = main;
    attackPhase(w);
    applyDamagePhase(w);
    expect(w.stunTicks[main]).toBe(11);
    expect(w.stunTicks[other]).toBe(0);
  });

  it('a stunned unit does not attack, but its cooldown keeps running', () => {
    const w = world();
    const a = unit(w, TEAM_ALLY, 100, 100, { dmg: 5, interval: 10 });
    const f = unit(w, TEAM_FOE, 110, 100, { hp: 1000 });
    w.target[a] = f;
    w.stunTicks[a] = 5;
    const hits: number[] = [];
    for (let t = 0; t < 8; t++) {
      const before = w.hp[f]!;
      fight(w);
      if (w.hp[f]! < before) hits.push(t);
    }
    expect(hits).toEqual([5]); // the first strike lands the tick the stun is gone
  });
});

describe('death spawns', () => {
  const rubble = unitStats({ unit: 'rubble', hp: 40 });
  const miner = (count = 1) => ({ deathSpawn: { stats: rubble, count } });

  it('a dying unit leaves its spawn on the same team near where it fell, after all deaths', () => {
    const w = world();
    const m = unit(w, TEAM_FOE, 100, 100, { hp: 10, ...miner() });
    const before = w.count;
    w.hp[m] = 0;
    deathPhase(w);
    expect(w.alive[m]).toBe(0);
    expect(w.count).toBe(before + 1);
    const child = before;
    expect(w.team[child]).toBe(TEAM_FOE);
    expect(w.label[child]).toBe('rubble');
    expect(w.alive[child]).toBe(1);
    expect(Math.abs(w.x[child]! - 100)).toBeLessThanOrEqual(14);
    expect(Math.abs(w.y[child]! - 100)).toBeLessThanOrEqual(14);
    expect(w.kills).toBe(1); // only the miner counted
    deathPhase(w); // the child does not die in the same tick it was born
    expect(w.alive[child]).toBe(1);
  });

  it('spawns `count` children on distinct offsets and inherits the parent source uid and home', () => {
    const w = world();
    const m = addUnit(w, unitStats({ hp: 10, ...miner(3) }), TEAM_ALLY, 120, 120, 90, 90, 7);
    const before = w.count;
    w.playerUnits = 1;
    w.hp[m] = 0;
    deathPhase(w);
    expect(w.count).toBe(before + 3);
    const spots = new Set<string>();
    for (let c = before; c < before + 3; c++) {
      spots.add(`${w.x[c]},${w.y[c]}`);
      expect(w.sourceUid[c]).toBe(7);
      expect(w.homeX[c]).toBe(90);
      expect(w.homeY[c]).toBe(90);
    }
    expect(spots.size).toBe(3);
    expect(w.playerUnits).toBe(4);
  });

  it('allied spawns respect playerUnitCap and count what was refused in capped', () => {
    const w = world();
    const m = unit(w, TEAM_ALLY, 100, 100, { hp: 10, ...miner(2) });
    w.playerUnits = BATTLE.playerUnitCap;
    const before = w.count;
    w.hp[m] = 0;
    deathPhase(w);
    expect(w.count).toBe(before);
    expect(w.capped).toBe(2);
  });

  it('never overflows the entity arrays', () => {
    const w = world();
    const m = unit(w, TEAM_FOE, 100, 100, { hp: 10, ...miner(5) });
    while (w.count < BATTLE.entityCap - 1) unit(w, TEAM_FOE, 300, 300, { hp: 1000 });
    w.hp[m] = 0;
    expect(() => deathPhase(w)).not.toThrow();
    expect(w.count).toBe(BATTLE.entityCap);
  });

  it('does nothing for a unit without a death spawn', () => {
    const w = world();
    const f = unit(w, TEAM_FOE, 100, 100, { hp: 10 });
    const before = w.count;
    w.hp[f] = 0;
    deathPhase(w);
    expect(w.count).toBe(before);
  });
});
