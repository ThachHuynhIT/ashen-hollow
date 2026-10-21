import { describe, expect, it } from 'vitest';
import { battleSetup, structure, throneSetup, unitStats } from '../testing/fixtures';
import { pulsePhase, shieldPulsePhase } from './structures';
import type { StructureSetup, UnitStats } from './types';
import { TEAM_ALLY, TEAM_FOE, addUnit, createBattle, drainEvents, type BattleWorld } from './world';

const world = (structures: StructureSetup[]): BattleWorld =>
  createBattle(battleSetup({ throne: throneSetup({ attack: null }), structures }));

const unit = (w: BattleWorld, team: number, x: number, y: number, over: Partial<UnitStats> = {}): number =>
  addUnit(w, unitStats(over), team, x, y, x, y, -1);

/** Plot 6 centre is (160, 160). */
const PULSE = { everyTicks: 40, radius: 48, dmg: 30, dmgType: 'physical' as const, stunTicks: 10 };

describe('pulsePhase', () => {
  const setup = () => {
    const w = world([structure(6, { uid: 60, pulse: PULSE })]);
    const inside = unit(w, TEAM_FOE, 180, 160); // 20 px away
    const outside = unit(w, TEAM_FOE, 220, 160); // 60 px away
    const friend = unit(w, TEAM_ALLY, 166, 160);
    drainEvents(w);
    return { w, inside, outside, friend };
  };

  it('fires every 40 ticks starting at tick 40, never at 0, 39 or 41', () => {
    const { w } = setup();
    const fired: number[] = [];
    for (let tick = 0; tick <= 120; tick++) {
      w.tick = tick;
      w.damageQueue = [];
      pulsePhase(w);
      if (w.damageQueue.length > 0) fired.push(tick);
    }
    expect(fired).toEqual([40, 80, 120]);
  });

  it('queues the pulse damage and stun on foes inside the radius only', () => {
    const { w, inside } = setup();
    w.tick = 40;
    pulsePhase(w);
    expect(w.damageQueue).toHaveLength(1);
    expect(w.damageQueue[0]).toMatchObject({
      victim: inside,
      raw: 30,
      type: 0,
      sourceUid: 60,
      sourceId: 1,
      stunTicks: 10,
    });
    expect(drainEvents(w)).toContainEqual({ type: 'pulse', id: 1 });
  });

  it('does not fire from a destroyed structure', () => {
    const { w } = setup();
    w.alive[1] = 0;
    w.tick = 40;
    pulsePhase(w);
    expect(w.damageQueue).toEqual([]);
  });

  it('does nothing for structures without a pulse', () => {
    const w = world([structure(6)]);
    unit(w, TEAM_FOE, 166, 160);
    w.tick = 40;
    pulsePhase(w);
    expect(w.damageQueue).toEqual([]);
  });
});

describe('shieldPulsePhase', () => {
  const SHIELD = { everyTicks: 50, radius: 64, amount: 20 };
  const setup = () => {
    const w = world([structure(6, { shieldPulse: SHIELD })]);
    const a = unit(w, TEAM_ALLY, 166, 160);
    const far = unit(w, TEAM_ALLY, 260, 160); // 100 px away
    const foe = unit(w, TEAM_FOE, 166, 166);
    drainEvents(w);
    return { w, a, far, foe };
  };

  it('gives allied units in range the shield every 50 ticks, capped at twice the amount', () => {
    const { w, a, far, foe } = setup();
    for (const tick of [49, 51]) {
      w.tick = tick;
      shieldPulsePhase(w);
    }
    expect(w.shield[a]).toBe(0);
    const seen: number[] = [];
    for (const tick of [50, 100, 150]) {
      w.tick = tick;
      shieldPulsePhase(w);
      seen.push(w.shield[a]!);
    }
    expect(seen).toEqual([20, 40, 40]);
    expect(w.shield[far]).toBe(0);
    expect(w.shield[foe]).toBe(0);
  });

  it('a weaker ward never shrinks a shield a stronger ward gave', () => {
    const w = world([
      structure(6, { shieldPulse: { everyTicks: 50, radius: 64, amount: 40 } }),
      structure(7, { shieldPulse: { everyTicks: 50, radius: 64, amount: 20 } }),
    ]);
    const a = unit(w, TEAM_ALLY, 180, 160);
    w.shield[a] = 80; // the strong ward's cap
    w.tick = 50;
    shieldPulsePhase(w);
    expect(w.shield[a]).toBe(80);
  });

  it('emits a shield event per shielded unit and nothing from a destroyed structure', () => {
    const { w, a } = setup();
    w.tick = 50;
    shieldPulsePhase(w);
    expect(drainEvents(w)).toContainEqual({ type: 'shield', id: a });
    w.alive[1] = 0;
    w.tick = 100;
    const before = w.shield[a];
    shieldPulsePhase(w);
    expect(w.shield[a]).toBe(before);
  });
});
