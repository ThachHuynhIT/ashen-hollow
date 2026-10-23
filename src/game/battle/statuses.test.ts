import { describe, expect, it } from 'vitest';
import { applyDamagePhase, attackPhase, deathPhase, statusPhase } from './combat';
import { battleSetup, throneSetup, unitStats } from '../testing/fixtures';
import { addDot, tickStatuses } from './statuses';
import { TEAM_ALLY, TEAM_FOE, addUnit, createBattle, type BattleWorld } from './world';
import type { UnitStats } from './types';

/** Throne without an attack so nothing but the scene under test deals damage. */
const arena = (): BattleWorld => createBattle(battleSetup({ throne: throneSetup({ attack: null }) }));

const unit = (w: BattleWorld, team: number, x: number, over: Partial<UnitStats> = {}, uid = -1): number =>
  addUnit(w, unitStats({ hp: 100, dmg: 0, interval: 0, speed: 0, ...over }), team, x, 20, x, 20, uid);

const runTo = (w: BattleWorld, last: number): void => {
  for (; w.tick <= last; w.tick++) {
    statusPhase(w);
    tickStatuses(w);
    deathPhase(w);
  }
};

describe('burn', () => {
  it('same source refreshes the time and keeps one 2/s entry', () => {
    const w = arena();
    const v = unit(w, TEAM_FOE, 40);
    w.tick = 0;
    addDot(w, v, 'burn', 7, 2, 30, 0);
    w.tick = 5;
    addDot(w, v, 'burn', 7, 2, 30, 0);
    expect(w.dots).toHaveLength(1);
    expect(w.dots[0]).toMatchObject({ dps: 2, ticks: 30 });
    w.tick = 10;
    tickStatuses(w);
    expect(w.hp[v]).toBeCloseTo(98); // fire vs armor 0
  });

  it('a different source stacks on top: 4 per second', () => {
    const w = arena();
    const v = unit(w, TEAM_FOE, 40);
    addDot(w, v, 'burn', 7, 2, 30, 0);
    addDot(w, v, 'burn', 8, 2, 30, 0);
    w.tick = 10;
    tickStatuses(w);
    expect(w.hp[v]).toBeCloseTo(96);
  });

  it('keeps the stronger dps of the same source', () => {
    const w = arena();
    const v = unit(w, TEAM_FOE, 40);
    addDot(w, v, 'burn', 7, 2, 30, 0);
    addDot(w, v, 'burn', 7, 5, 30, 0);
    addDot(w, v, 'burn', 7, 1, 30, 0);
    expect(w.dots[0]!.dps).toBe(5);
  });

  it.each([0, 3, 7, 9])('status_tick_order: 30 ticks starting at tick %i deal exactly 3 pulses', (start) => {
    const w = arena();
    const v = unit(w, TEAM_FOE, 40, { hp: 1000 });
    w.tick = start;
    addDot(w, v, 'burn', 1, 2, 30, 0);
    runTo(w, start + 40);
    expect(w.hp[v]).toBeCloseTo(1000 - 3 * 2);
    expect(w.dots).toHaveLength(0);
  });

  it('is fire damage: armor counts for half', () => {
    const w = arena();
    const v = unit(w, TEAM_FOE, 40, { armor: 0.5 });
    addDot(w, v, 'burn', 1, 8, 10, 0);
    w.tick = 10;
    tickStatuses(w);
    expect(w.hp[v]).toBeCloseTo(100 - 8 * 0.75);
  });
});

describe('poison', () => {
  it('stacks up to maxStacks per source: 2/s x3 = 6/s, a 4th hit adds nothing', () => {
    const w = arena();
    const v = unit(w, TEAM_FOE, 40);
    for (let i = 0; i < 3; i++) addDot(w, v, 'poison', 7, 2, 30, 3);
    w.tick = 10;
    tickStatuses(w);
    expect(w.hp[v]).toBeCloseTo(94);
    w.tick = 20;
    addDot(w, v, 'poison', 7, 2, 30, 3);
    tickStatuses(w);
    expect(w.hp[v]).toBeCloseTo(88); // still 6, not 8
    expect(w.dots).toHaveLength(1);
    expect(w.dots[0]!.stacks).toBe(3);
  });

  it('is magic damage: armor is ignored; each source has its own stacks', () => {
    const w = arena();
    const v = unit(w, TEAM_FOE, 40, { armor: 0.5 });
    addDot(w, v, 'poison', 7, 2, 30, 1);
    addDot(w, v, 'poison', 8, 2, 30, 1);
    w.tick = 10;
    tickStatuses(w);
    expect(w.hp[v]).toBeCloseTo(96);
  });
});

describe('who gets credit', () => {
  it('a building burn that kills counts as a kill of that building uid', () => {
    const w = arena();
    const v = unit(w, TEAM_FOE, 40, { hp: 2 });
    addDot(w, v, 'burn', 7, 2, 30, 0); // key = building uid 7
    w.tick = 10;
    tickStatuses(w);
    deathPhase(w);
    expect(w.alive[v]).toBe(0);
    expect(w.kills).toBe(1);
    expect(w.killsBySource).toEqual({ 7: 1 });
  });

  it('drops the entries of a dead victim', () => {
    const w = arena();
    const v = unit(w, TEAM_FOE, 40, { hp: 1 });
    addDot(w, v, 'burn', 7, 5, 100, 0);
    w.tick = 10;
    tickStatuses(w);
    deathPhase(w);
    w.tick = 11;
    tickStatuses(w);
    expect(w.dots).toHaveLength(0);
  });
});

describe('healAura (regen)', () => {
  it('heals injured allies of its team inside the radius each second, never above maxHp', () => {
    const w = arena();
    const treant = unit(w, TEAM_ALLY, 100, { behaviours: [{ type: 'healAura', radius: 48, hpPerSec: 3 }] });
    const near = unit(w, TEAM_ALLY, 130);
    const full = unit(w, TEAM_ALLY, 110);
    const far = unit(w, TEAM_ALLY, 200);
    const foe = unit(w, TEAM_FOE, 105);
    for (const id of [near, far, foe]) w.hp[id] = 50;
    w.hp[full] = w.maxHp[full]! - 1;
    w.tick = 9;
    tickStatuses(w);
    expect(w.hp[near]).toBe(50); // not a pulse tick
    w.tick = 10;
    tickStatuses(w);
    expect(w.hp[near]).toBe(53);
    expect(w.hp[full]).toBe(w.maxHp[full]); // clamped
    expect(w.hp[far]).toBe(50);
    expect(w.hp[foe]).toBe(50);
    expect(w.hp[treant]).toBe(w.maxHp[treant]);
  });

  it('keeps working when the damage phase and attack phase run around it', () => {
    const w = arena();
    unit(w, TEAM_ALLY, 100, { behaviours: [{ type: 'healAura', radius: 48, hpPerSec: 3 }] });
    attackPhase(w);
    applyDamagePhase(w);
    expect(w.damageQueue).toHaveLength(0);
  });
});
