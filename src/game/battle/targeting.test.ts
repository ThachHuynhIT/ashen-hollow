import { describe, expect, it } from 'vitest';
import { BATTLE } from '../../data/battle';
import { attackStats, battleSetup, structure, unitStats } from '../testing/fixtures';
import type { StructureSetup, UnitStats } from './types';
import { edgeDistance, inRange, pickShotTarget, retarget } from './targeting';
import { TEAM_ALLY, TEAM_FOE, addUnit, createBattle, type BattleWorld } from './world';

const world = (structures: StructureSetup[] = []): BattleWorld =>
  createBattle(battleSetup({ structures }));

const unit = (
  w: BattleWorld,
  team: number,
  x: number,
  y: number,
  over: Partial<UnitStats> = {},
): number => addUnit(w, unitStats(over), team, x, y, x, y, -1);

/** Tháp ở plot 2 = (192, 128), tầm 60, closestToThrone. */
const tower = (over: Partial<StructureSetup> = {}): StructureSetup =>
  structure(2, {
    kind: 'tower',
    attack: attackStats({ range: 60 }),
    targeting: 'closestToThrone',
    ...over,
  });

describe('edgeDistance / inRange', () => {
  it('measures centre distance minus both radii', () => {
    const w = world();
    const a = unit(w, TEAM_ALLY, 0, 0, { range: 2 });
    const b = unit(w, TEAM_FOE, 10, 0);
    expect(edgeDistance(w, a, b)).toBe(2);
    expect(inRange(w, a, b)).toBe(true);
    w.range[a] = 1.9;
    expect(inRange(w, a, b)).toBe(false);
    w.range[a] = 5;
    w.minRange[a] = 3;
    expect(inRange(w, a, b)).toBe(false);
    w.minRange[a] = 2;
    expect(inRange(w, a, b)).toBe(true);
  });
});

describe('retarget — allies', () => {
  it('picks the nearest foe', () => {
    const w = world();
    const a = unit(w, TEAM_ALLY, 50, 50);
    const far = unit(w, TEAM_FOE, 50, 90);
    const near = unit(w, TEAM_FOE, 80, 50);
    retarget(w);
    expect(w.target[a]).toBe(near);
    expect(far).toBeGreaterThan(0);
  });

  it('breaks distance ties by the smaller id', () => {
    const w = world();
    const a = unit(w, TEAM_ALLY, 50, 50);
    const first = unit(w, TEAM_FOE, 70, 50);
    unit(w, TEAM_FOE, 30, 50);
    retarget(w);
    expect(w.target[a]).toBe(first);
  });

  it('has no target when no foe is alive', () => {
    const w = world();
    const a = unit(w, TEAM_ALLY, 50, 50);
    const f = unit(w, TEAM_FOE, 70, 50);
    w.alive[f] = 0;
    retarget(w);
    expect(w.target[a]).toBe(-1);
  });

  it('does not retarget structures or the throne', () => {
    const w = world([tower()]);
    unit(w, TEAM_FOE, 192, 100);
    retarget(w);
    expect(w.target[0]).toBe(-1);
    expect(w.target[1]).toBe(-1);
  });
});

describe('retarget — foes', () => {
  it('picks the nearest ally unit within enemyAggro, else the throne', () => {
    const w = world();
    const f = unit(w, TEAM_FOE, 300, 50);
    const a = unit(w, TEAM_ALLY, 300, 90); // edge 32
    retarget(w);
    expect(w.target[f]).toBe(a);

    const w2 = world();
    const f2 = unit(w2, TEAM_FOE, 300, 50);
    unit(w2, TEAM_ALLY, 300, 110); // edge 52 > 48
    retarget(w2);
    expect(w2.target[f2]).toBe(w2.throneId);
  });

  it('picks the nearer of two allies, structures included (edge distance)', () => {
    const w = world([structure(4)]); // plot 4 = (256, 128), id 1
    const f = unit(w, TEAM_FOE, 256, 70); // structure edge 58 − 4 − 12 = 42
    const a = unit(w, TEAM_ALLY, 256, 20); // edge 42 too, larger id
    retarget(w);
    expect(w.target[f]).toBe(1);
    w.y[a] = 25; // edge 37
    w.tick = BATTLE.retargetTicks;
    retarget(w);
    expect(w.target[f]).toBe(a);
  });

  it('siege units ignore ally units and pick structures within siegeAggro, then the throne', () => {
    const w = world([structure(4)]); // (256, 128)
    const f = unit(w, TEAM_FOE, 300, 90, { siege: true }); // structure edge ≈ 42.1
    unit(w, TEAM_ALLY, 300, 98);
    retarget(w);
    expect(w.target[f]).toBe(1);

    const w2 = world([structure(4)]);
    const f2 = unit(w2, TEAM_FOE, 20, 380, { siege: true });
    unit(w2, TEAM_ALLY, 20, 388);
    retarget(w2);
    expect(w2.target[f2]).toBe(w2.throneId);
  });

  it('during rage targets only the throne', () => {
    const w = world();
    const f = unit(w, TEAM_FOE, 300, 90);
    unit(w, TEAM_ALLY, 300, 98);
    w.tick = BATTLE.rageTick;
    retarget(w);
    expect(w.target[f]).toBe(w.throneId);

    const w2 = world();
    const f2 = unit(w2, TEAM_FOE, 300, 90);
    const a2 = unit(w2, TEAM_ALLY, 300, 98);
    w2.tick = BATTLE.rageTick - 1;
    retarget(w2);
    expect(w2.target[f2]).toBe(a2);
  });

  it('switches to the throne at rageTick even with a living target', () => {
    const w = world();
    const f = unit(w, TEAM_FOE, 300, 90);
    const a = unit(w, TEAM_ALLY, 300, 98);
    w.tick = BATTLE.rageTick - 1;
    retarget(w);
    expect(w.target[f]).toBe(a);
    w.tick = BATTLE.rageTick;
    retarget(w);
    expect(w.target[f]).toBe(w.throneId);
  });
});

describe('retarget cadence', () => {
  it('only re-picks every retargetTicks ticks unless the target died', () => {
    const w = world();
    const a = unit(w, TEAM_ALLY, 50, 50);
    const f1 = unit(w, TEAM_FOE, 80, 50);
    w.tick = 0;
    retarget(w);
    expect(w.target[a]).toBe(f1);

    const f2 = unit(w, TEAM_FOE, 60, 50); // nearer, appears later
    w.tick = 1;
    retarget(w);
    expect(w.target[a]).toBe(f1);
    w.tick = BATTLE.retargetTicks - 1;
    retarget(w);
    expect(w.target[a]).toBe(f1);

    w.tick = BATTLE.retargetTicks;
    retarget(w);
    expect(w.target[a]).toBe(f2);

    w.tick = BATTLE.retargetTicks + 1;
    w.alive[f2] = 0;
    retarget(w);
    expect(w.target[a]).toBe(f1);
  });

  it('skips dead units', () => {
    const w = world();
    const a = unit(w, TEAM_ALLY, 50, 50);
    unit(w, TEAM_FOE, 80, 50);
    w.alive[a] = 0;
    retarget(w);
    expect(w.target[a]).toBe(-1);
  });
});

describe('pickShotTarget', () => {
  it('closestToThrone tower picks the in-range foe nearest the throne', () => {
    const w = world([tower()]);
    const nearTower = unit(w, TEAM_FOE, 192, 100); // tower 28, throne 92
    const nearThrone = unit(w, TEAM_FOE, 240, 160); // tower ≈ 57.7 (edge ≈ 41.7), throne ≈ 57.7
    expect(nearTower).toBeLessThan(nearThrone);
    expect(pickShotTarget(w, 1)).toBe(nearThrone);
  });

  it('nearest throne picks the in-range foe nearest itself, ignoring allies', () => {
    const w = world();
    unit(w, TEAM_ALLY, 192, 180);
    unit(w, TEAM_FOE, 192, 250); // 58
    const d = unit(w, TEAM_FOE, 192, 140); // 52
    unit(w, TEAM_FOE, 192, 300); // edge 90 > 72
    expect(pickShotTarget(w, w.throneId)).toBe(d);
  });

  it('breaks ties by the smaller id', () => {
    const w = world();
    const first = unit(w, TEAM_FOE, 150, 192);
    unit(w, TEAM_FOE, 234, 192);
    expect(pickShotTarget(w, w.throneId)).toBe(first);

    const w2 = world([tower()]);
    const t1 = unit(w2, TEAM_FOE, 172, 160); // throne: (−20, −32)
    unit(w2, TEAM_FOE, 212, 160); // throne: (20, −32)
    expect(pickShotTarget(w2, 1)).toBe(t1);
  });

  it('lowestHp / highestHp pick by hp, ties by id', () => {
    const w = world([tower({ targeting: 'lowestHp' })]);
    const a = unit(w, TEAM_FOE, 192, 100);
    const b = unit(w, TEAM_FOE, 200, 100);
    const c = unit(w, TEAM_FOE, 184, 100);
    w.hp[a] = 30;
    w.hp[b] = 10;
    w.hp[c] = 10;
    expect(pickShotTarget(w, 1)).toBe(b);
    w.targeting[1] = 3;
    w.hp[c] = 30;
    expect(pickShotTarget(w, 1)).toBe(a);
  });

  it('returns −1 with no foe in range, for dead shooters and for structures without attack', () => {
    const w = world([tower(), structure(22)]);
    unit(w, TEAM_FOE, 20, 20);
    expect(pickShotTarget(w, 1)).toBe(-1);
    expect(pickShotTarget(w, w.throneId)).toBe(-1);

    // ids by plot: structure(1) at (160, 128) → id 1 (attack null), tower (plot 2) → id 2
    const w2 = world([tower(), structure(1)]);
    const f = unit(w2, TEAM_FOE, 165, 128);
    expect(pickShotTarget(w2, 2)).toBe(f);
    expect(pickShotTarget(w2, 1)).toBe(-1);
    w2.alive[2] = 0;
    expect(pickShotTarget(w2, 2)).toBe(-1);
  });

  it('ignores dead foes', () => {
    const w = world();
    const d = unit(w, TEAM_FOE, 192, 140);
    const e = unit(w, TEAM_FOE, 192, 250);
    w.alive[d] = 0;
    expect(pickShotTarget(w, w.throneId)).toBe(e);
  });
});
