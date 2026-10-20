import { describe, expect, it } from 'vitest';
import {
  STRUCT_HP,
  STRUCT_STD,
  THRONE_STD,
  TOWER_RANGE,
  TOWER_STD,
  TROOP_STD,
  levelMult,
} from './scaling';

describe('level scaling profiles (spec §5.2)', () => {
  it('has the standard tables, one value per level', () => {
    expect([...TROOP_STD]).toEqual([1, 1.25, 1.5, 1.75, 2]);
    expect([...TOWER_STD]).toEqual([1, 1.35, 1.7, 2.05, 2.4]);
    expect([...STRUCT_STD]).toEqual([1, 1.25, 1.5, 1.75, 2]);
    expect([...THRONE_STD]).toEqual([1, 1.25, 1.5, 1.75, 2]);
    expect([...TOWER_RANGE]).toEqual([0, 4, 8, 12, 16]);
  });

  it('levelMult picks the value of the level', () => {
    expect(levelMult(TROOP_STD, 1)).toBe(1);
    expect(levelMult(TROOP_STD, 3)).toBe(1.5);
    expect(levelMult(TOWER_STD, 5)).toBe(2.4);
    expect(TOWER_RANGE[4]).toBe(16);
  });

  it('keeps the default structure HP per kind', () => {
    expect(STRUCT_HP).toEqual({ troop: 150, tower: 220, economy: 120, support: 160 });
  });
});
