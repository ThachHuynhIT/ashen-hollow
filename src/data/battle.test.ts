import { describe, expect, it } from 'vitest';
import {
  BATTLE,
  ENEMY_BUDGET,
  ENEMY_CAP,
  ENEMY_LEVEL_STAT,
  INTERVENTION,
  SLOT_MULT,
  SPAWN_OFFSETS,
  WAVES,
} from './battle';

describe('battle constants', () => {
  it('ENEMY_BUDGET matches round(12 * 1.15^(y-1))', () => {
    expect(ENEMY_BUDGET.length).toBe(30);
    expect(ENEMY_BUDGET[0]).toBe(12);
    expect(ENEMY_BUDGET[29]).toBe(691);
    let v = 12;
    for (let y = 0; y < 30; y++) {
      expect(ENEMY_BUDGET[y]).toBe(Math.round(v));
      v *= 1.15;
    }
    expect(Math.round(ENEMY_BUDGET[0]! * SLOT_MULT.raiders)).toBe(10);
  });

  it('waves', () => {
    const [a, b, c] = WAVES.share;
    expect(a + b + c).toBeCloseTo(1, 10);
    expect(WAVES.spawnTick).toEqual([0, 120, 240]);
  });

  it('ENEMY_LEVEL_STAT strictly increases over 5 levels', () => {
    expect(ENEMY_LEVEL_STAT.length).toBe(5);
    for (let i = 1; i < 5; i++) expect(ENEMY_LEVEL_STAT[i]!).toBeGreaterThan(ENEMY_LEVEL_STAT[i - 1]!);
  });

  it('SPAWN_OFFSETS', () => {
    expect(SPAWN_OFFSETS.length).toBe(16);
    for (const [x, y] of SPAWN_OFFSETS) expect(Math.max(Math.abs(x), Math.abs(y))).toBeLessThanOrEqual(14);
    expect(SPAWN_OFFSETS[0]).toEqual([0, -8]);
  });

  it('entity cap fits all sources', () => {
    expect(BATTLE.entityCap).toBeGreaterThanOrEqual(ENEMY_CAP + BATTLE.playerUnitCap + 25 + 1);
  });

  it('intervention timing', () => {
    expect(INTERVENTION.cooldownTicks).toBe(150);
    expect(INTERVENTION.firstReadyTick).toBe(30);
  });
});
