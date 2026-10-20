import { describe, expect, it } from 'vitest';
import type { CardId, KingId } from '../../data/types';
import { CONTENT } from './registry';

describe('CONTENT registry', () => {
  it('looks up cards, units and kings', () => {
    expect(CONTENT.card('wheat_militia').kind).toBe('troop');
    expect(CONTENT.unit('bandit').enemyCost).toBe(1);
    expect(CONTENT.king('wheat').throne.id).toBe('wheat_throne');
  });

  it('throws on unknown ids', () => {
    expect(() => CONTENT.card('nope_x' as CardId)).toThrow(/Unknown card id/);
    expect(() => CONTENT.unit('nope')).toThrow(/Unknown unit id/);
    expect(() => CONTENT.king('nope' as KingId)).toThrow(/Unknown king id/);
  });

  it('exposes the raider roster and neutral pool', () => {
    const roster = CONTENT.raiderRoster();
    expect(roster).toHaveLength(4);
    expect(roster.reduce((s, r) => s + r.weight, 0)).toBe(100);
    expect(roster[0]?.unit.id).toBe('bandit');
    expect(CONTENT.neutralPool()).toHaveLength(4);
  });

  it('lists all cards sorted by id without duplicates', () => {
    const ids = CONTENT.allCards().map((c) => c.id);
    expect(ids).toHaveLength(8);
    expect(ids).toEqual([...ids].sort());
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain('wheat_throne');
  });

  it('lists all units sorted by id without duplicates', () => {
    const ids = CONTENT.allUnits().map((u) => u.id);
    expect(ids).toHaveLength(7);
    expect(ids).toEqual([...ids].sort());
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(['bandit', 'bandit_archer', 'boar_rider', 'footman', 'militia', 'ogre', 'reaper']);
  });
});
