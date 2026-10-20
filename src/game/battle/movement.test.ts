import { describe, expect, it } from 'vitest';
import { BATTLE } from '../../data/battle';
import { battleSetup, structure, unitStats } from '../testing/fixtures';
import { moveEntities } from './movement';
import { edgeDistance } from './targeting';
import type { StructureSetup, UnitStats } from './types';
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

const EPS = 1e-9;

/** Footman (range 2, r 4, speed 1) at (20, 20) aimed at a stationary foe (r 4) 100 px east. */
const approach = (over: Partial<UnitStats> = {}) => {
  const w = world();
  const a = unit(w, TEAM_ALLY, 20, 20, over);
  const f = unit(w, TEAM_FOE, 120, 20, { speed: 0 });
  w.target[a] = f;
  return { w, a, f };
};

describe('moveEntities — walking to a target', () => {
  it('closes to exactly edge distance = range, never more than speed per tick', () => {
    const { w, a, f } = approach();
    for (let t = 0; t < 120; t++) {
      const x0 = w.x[a]!;
      moveEntities(w);
      w.tick += 1;
      const step = w.x[a]! - x0;
      expect(step).toBeGreaterThanOrEqual(0);
      expect(step).toBeLessThanOrEqual(1 + EPS);
      expect(edgeDistance(w, a, f)).toBeGreaterThanOrEqual(2 - EPS);
    }
    expect(edgeDistance(w, a, f)).toBeCloseTo(2, 9);
    expect(w.y[a]).toBe(20);
  });

  it('slowPct 50 halves the step', () => {
    const { w, a } = approach();
    w.slowPct[a] = 50;
    moveEntities(w);
    expect(w.x[a]).toBeCloseTo(20.5, 12);
  });

  it('stands still when already in range', () => {
    const w = world();
    const a = unit(w, TEAM_ALLY, 20, 20);
    const f = unit(w, TEAM_FOE, 29, 20, { speed: 0 }); // edge 1 ≤ range 2
    w.target[a] = f;
    moveEntities(w);
    expect(w.x[a]).toBe(20);
    expect(w.y[a]).toBe(20);
  });

  it('records the start-of-tick position in prevX/prevY', () => {
    const { w, a } = approach();
    moveEntities(w);
    expect(w.prevX[a]).toBe(20);
    moveEntities(w);
    expect(w.prevX[a]).toBe(21);
    expect(w.x[a]).toBe(22);
    expect(w.prevY[a]).toBe(20);
  });

  it('uses start-of-tick positions: a later id sees the earlier id where it was', () => {
    const w = world();
    const a = unit(w, TEAM_ALLY, 20, 20); // walks south towards g
    const f = unit(w, TEAM_FOE, 40, 20); // walks west towards a
    const g = unit(w, TEAM_FOE, 20, 120, { speed: 0 });
    w.target[a] = g;
    w.target[f] = a;
    moveEntities(w);
    expect(w.x[a]).toBe(20);
    expect(w.y[a]).toBe(21);
    expect(w.x[f]).toBe(39);
    expect(w.y[f]).toBe(20); // aimed at a's start-of-tick position (20, 20)
  });

  it('foes move 1.5× during rage, not before', () => {
    const w = world();
    const f = unit(w, TEAM_FOE, 20, 20);
    const a = unit(w, TEAM_ALLY, 120, 20, { speed: 0 });
    w.target[f] = a;
    w.tick = BATTLE.rageTick - 1;
    moveEntities(w);
    expect(w.x[f]).toBeCloseTo(21, 12);
    w.tick = BATTLE.rageTick;
    moveEntities(w);
    expect(w.x[f]).toBeCloseTo(22.5, 12);
  });

  it('allies are not sped up by rage', () => {
    const { w, a } = approach();
    w.tick = BATTLE.rageTick;
    moveEntities(w);
    expect(w.x[a]).toBeCloseTo(21, 12);
  });

  it('ignores a dead target and heads home instead', () => {
    const w = world();
    const a = addUnit(w, unitStats(), TEAM_ALLY, 60, 300, 50, 300, 1);
    const f = unit(w, TEAM_FOE, 100, 300, { speed: 0 });
    w.target[a] = f;
    w.alive[f] = 0;
    moveEntities(w);
    expect(w.x[a]).toBe(59);
  });
});

describe('moveEntities — idle units', () => {
  it('walk back to their home point, then stay exactly there', () => {
    const w = world();
    const a = addUnit(w, unitStats(), TEAM_ALLY, 60, 300, 50, 300, 1);
    for (let t = 0; t < 10; t++) moveEntities(w);
    expect(w.x[a]).toBe(50);
    expect(w.y[a]).toBe(300);
    moveEntities(w);
    expect(w.x[a]).toBe(50);
    expect(w.y[a]).toBe(300);
  });

  it('snap onto home when closer than 0.5 px (no jitter)', () => {
    const w = world();
    const a = addUnit(w, unitStats({ speed: 0.2 }), TEAM_ALLY, 50.3, 300, 50, 300, 1);
    moveEntities(w);
    expect(w.x[a]).toBe(50);
    expect(w.y[a]).toBe(300);
  });
});

describe('moveEntities — separation, knockback, clamp', () => {
  it('splits two coincident units along x, each by at most separationPushMax', () => {
    const w = world();
    const a = unit(w, TEAM_ALLY, 50, 300);
    const b = unit(w, TEAM_ALLY, 50, 300);
    moveEntities(w);
    expect(w.x[a]).toBe(50 - BATTLE.separationPushMax);
    expect(w.x[b]).toBe(50 + BATTLE.separationPushMax);
    expect(w.y[a]).toBe(300);
    expect(w.y[b]).toBe(300);
    expect(Number.isNaN(w.x[a])).toBe(false);
  });

  it('never moves structures or the throne; they push units out fully', () => {
    const w = world([structure(0)]); // (128, 128), id 1
    const u = unit(w, TEAM_ALLY, 130, 128, { speed: 0 });
    const v = unit(w, TEAM_FOE, 192, 180, { speed: 0 }); // overlaps throne (r 14)
    moveEntities(w);
    expect(w.x[1]).toBe(128);
    expect(w.y[1]).toBe(128);
    expect(w.x[0]).toBe(192);
    expect(w.y[0]).toBe(192);
    expect(w.x[u]).toBeCloseTo(128 + 16, 12);
    expect(w.y[v]).toBeCloseTo(192 - 18, 12);
  });

  it('dead entities neither move nor push', () => {
    const w = world();
    const a = unit(w, TEAM_ALLY, 50, 300);
    const b = unit(w, TEAM_ALLY, 50, 300);
    w.alive[b] = 0;
    moveEntities(w);
    expect(w.x[a]).toBe(50);
    expect(w.x[b]).toBe(50);
  });

  it('applies knockback kbX per tick for kbTicks ticks, then stops', () => {
    const w = world();
    const a = unit(w, TEAM_ALLY, 100, 300, { speed: 0 });
    w.kbTicks[a] = 3;
    w.kbX[a] = 4;
    for (let t = 0; t < 3; t++) moveEntities(w);
    expect(w.x[a]).toBe(112);
    expect(w.kbTicks[a]).toBe(0);
    moveEntities(w);
    expect(w.x[a]).toBe(112);
    expect(w.y[a]).toBe(300);
  });

  it('does not knock back structures', () => {
    const w = world([structure(0)]);
    w.kbTicks[1] = 3;
    w.kbX[1] = 4;
    moveEntities(w);
    expect(w.x[1]).toBe(128);
  });

  it('clamps units to [−fieldClampMargin, field + fieldClampMargin]', () => {
    const w = world();
    const a = unit(w, TEAM_FOE, -50, 100, { speed: 0 });
    const b = unit(w, TEAM_FOE, 500, 450, { speed: 0 });
    const lo = -BATTLE.fieldClampMargin;
    const hi = BATTLE.field + BATTLE.fieldClampMargin;
    moveEntities(w);
    expect(lo).toBe(-32);
    expect(hi).toBe(416);
    expect(w.x[a]).toBe(lo);
    expect(w.y[a]).toBe(100);
    expect(w.x[b]).toBe(hi);
    expect(w.y[b]).toBe(hi);
  });
});

describe('moveEntities — holding ground against a crowd', () => {
  it('a soldier in contact with its target is not shoved away by the enemies crowding it', () => {
    const w = world();
    const a = unit(w, TEAM_ALLY, 100, 100);
    const target = unit(w, TEAM_FOE, 110, 100, { speed: 0 }); // edge gap 2 = range: in contact
    w.target[a] = target;
    unit(w, TEAM_FOE, 104, 103, { speed: 0 });
    unit(w, TEAM_FOE, 96, 97, { speed: 0 });
    unit(w, TEAM_FOE, 101, 106, { speed: 0 });
    moveEntities(w);
    // Anchored by its target in range: the three overlapping enemies do not move it at all.
    expect(w.x[a]).toBe(100);
    expect(w.y[a]).toBe(100);
  });

  it('a lone enemy overlapping a soldier is eased away slowly, not thrown', () => {
    const w = world();
    const a = unit(w, TEAM_ALLY, 100, 100, { speed: 0 });
    const f = unit(w, TEAM_FOE, 102, 100, { speed: 0 });
    moveEntities(w);
    expect(Math.abs(w.x[a]! - 100)).toBeLessThanOrEqual(BATTLE.separationPushCross + EPS);
    expect(Math.abs(w.x[f]! - 102)).toBeLessThanOrEqual(BATTLE.separationPushCross + EPS);
  });
});

describe('moveEntities — stun', () => {
  it('a stunned unit does not walk', () => {
    const { w, a } = approach();
    w.stunTicks[a] = 3;
    moveEntities(w);
    expect(w.x[a]).toBe(20);
    w.stunTicks[a] = 0;
    moveEntities(w);
    expect(w.x[a]).toBeCloseTo(21, 12);
  });
});
