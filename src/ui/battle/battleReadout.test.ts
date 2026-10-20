import { describe, expect, it } from 'vitest';
import { INTERVENTION } from '../../data/battle';
import { tryIntervene } from '../../game/battle/intervention';
import { createBattle, spawnWave } from '../../game/battle/world';
import { battleSetup, unitStats } from '../../game/testing/fixtures';
import { foesRemaining, interventionCooldown, throneHpFraction } from './battleReadout';

const threeWaves = () =>
  battleSetup({
    waves: [
      {
        spawnTick: 0,
        spawns: [
          { stats: unitStats(), edge: 'N' },
          { stats: unitStats(), edge: 'E' },
        ],
      },
      { spawnTick: 120, spawns: [{ stats: unitStats(), edge: 'S' }] },
      {
        spawnTick: 240,
        spawns: [
          { stats: unitStats(), edge: 'W' },
          { stats: unitStats(), edge: 'W' },
        ],
      },
    ],
  });

describe('foesRemaining', () => {
  it('counts unspawned waves and living foes', () => {
    const w = createBattle(threeWaves());
    expect(foesRemaining(w)).toBe(5);
    spawnWave(w, 0);
    expect(foesRemaining(w)).toBe(5);
    w.alive[w.count - 1] = 0;
    expect(foesRemaining(w)).toBe(4);
  });
});

describe('throneHpFraction', () => {
  it('is hp / maxHp clamped to 0..1', () => {
    const w = createBattle(threeWaves());
    expect(throneHpFraction(w)).toBe(1);
    w.hp[w.throneId] = w.maxHp[w.throneId]! / 4;
    expect(throneHpFraction(w)).toBe(0.25);
    w.hp[w.throneId] = -5;
    expect(throneHpFraction(w)).toBe(0);
  });
});

describe('interventionCooldown', () => {
  it('waits for firstReadyTick, then cooldownTicks after a drop', () => {
    const w = createBattle(threeWaves());
    expect(interventionCooldown(w)).toEqual({ ready: false, fraction: 1, seconds: 3 });
    w.tick = 15;
    expect(interventionCooldown(w)).toEqual({ ready: false, fraction: 0.5, seconds: 2 });
    w.tick = INTERVENTION.firstReadyTick;
    expect(interventionCooldown(w)).toEqual({ ready: true, fraction: 0, seconds: 0 });
    expect(tryIntervene(w, { tick: w.tick, x: 100, y: 100 })).toBe(true);
    expect(interventionCooldown(w)).toEqual({ ready: false, fraction: 1, seconds: 15 });
    w.tick += INTERVENTION.cooldownTicks - 1;
    expect(interventionCooldown(w)).toEqual({ ready: false, fraction: 1 / 150, seconds: 1 });
    w.tick += 1;
    expect(interventionCooldown(w).ready).toBe(true);
  });
});
