import { describe, expect, it } from 'vitest';
import { PALETTE } from './palette';
import { NEUTRAL_CARDS, NEUTRAL_UNITS } from './neutral';
import { RAIDER_ROSTER, RAIDER_UNITS } from './raiders';
import { WHEAT } from './kings/wheat';
import { KINGS_G1 } from './kings';
import type { CardDef, UnitDef } from './types';

const allCards: readonly CardDef[] = [WHEAT.throne, ...WHEAT.cards, ...NEUTRAL_CARDS];
const allUnits: readonly UnitDef[] = [...WHEAT.units, ...NEUTRAL_UNITS, ...RAIDER_UNITS];
const unit = (id: string): UnitDef => {
  const u = allUnits.find((x) => x.id === id);
  if (!u) throw new Error(`missing unit ${id}`);
  return u;
};
const card = (id: string): CardDef => {
  const c = allCards.find((x) => x.id === id);
  if (!c) throw new Error(`missing card ${id}`);
  return c;
};

describe('G1 content integrity', () => {
  it('has unique card and unit ids', () => {
    expect(new Set(allCards.map((c) => c.id)).size).toBe(allCards.length);
    expect(new Set(allUnits.map((u) => u.id)).size).toBe(allUnits.length);
  });

  it('prefixes every card id with its owner', () => {
    for (const c of allCards) expect(c.id.startsWith(`${c.owner}_`)).toBe(true);
  });

  it('references only existing units', () => {
    const ids = new Set(allUnits.map((u) => u.id));
    for (const c of allCards) {
      if (c.kind === 'troop' || c.kind === 'tower') {
        for (const e of c.effects) if (e.type === 'spawn') expect(ids.has(e.unit)).toBe(true);
      }
    }
    for (const r of WHEAT.enemyRoster) expect(ids.has(r.unit)).toBe(true);
    for (const r of RAIDER_ROSTER) expect(ids.has(r.unit)).toBe(true);
  });

  it('has non-empty names and texts', () => {
    for (const c of allCards) {
      expect(c.nameVi.length).toBeGreaterThan(0);
      expect(c.textVi.length).toBeGreaterThan(0);
    }
    for (const u of allUnits) expect(u.nameVi.length).toBeGreaterThan(0);
  });

  it('keeps all PerLevel arrays at length 5', () => {
    for (const c of allCards) {
      if (c.kind === 'troop' || c.kind === 'tower') {
        if (c.structureHp) expect(c.structureHp).toHaveLength(5);
        for (const e of c.effects) if (e.type === 'spawn') expect(e.count).toHaveLength(5);
      }
    }
  });

  it('defines the wheat king (full card set is checked in cards.effects.test)', () => {
    expect(KINGS_G1).toEqual([WHEAT]);
    expect(WHEAT.cards).toHaveLength(9);
    for (const id of ['wheat_militia', 'wheat_reapers', 'wheat_scarecrow']) {
      expect(WHEAT.cards.map((c) => c.id)).toContain(id);
    }
    expect(Object.keys(PALETTE)).toContain(WHEAT.color);
    expect(WHEAT.units.map((u) => u.id)).toEqual(['militia', 'reaper', 'peasant']);
    expect(WHEAT.enemyRoster).toEqual([
      { unit: 'militia', weight: 50 },
      { unit: 'reaper', weight: 25 },
      { unit: 'peasant', weight: 25 },
    ]);
  });

  it('matches the throne stats', () => {
    expect(WHEAT.throne.id).toBe('wheat_throne');
    expect(WHEAT.throne.hp).toBe(300);
    expect(WHEAT.throne.armor).toBe(0);
    expect(WHEAT.throne.attack).toEqual({
      dmg: 8,
      type: 'physical',
      range: 72,
      interval: 10,
      projectileSpeed: 8,
    });
  });

  it('matches unit stats', () => {
    const m = unit('militia');
    expect([m.hp, m.attack.dmg, m.attack.range, m.attack.interval, m.speed, m.radius, m.enemyCost]).toEqual([
      32, 5, 2, 10, 1, 4, 0.8,
    ]);
    const r = unit('reaper');
    expect([r.hp, r.attack.dmg, r.attack.cleave, r.attack.interval, r.speed, r.armor, r.enemyCost]).toEqual([
      45, 9, 2, 12, 0.9, 0.05, 1.6,
    ]);
    const f = unit('footman');
    expect([f.hp, f.attack.dmg, f.speed, f.armor]).toEqual([45, 7, 0.9, 0.1]);
    const o = unit('ogre');
    expect([o.hp, o.attack.dmg, o.attack.range, o.attack.interval, o.speed, o.radius, o.armor]).toEqual([
      180, 16, 4, 18, 0.6, 9, 0.2,
    ]);
    expect(o.tags).toContain('siege');
    expect(unit('bandit').enemyCost).toBe(1);
    expect(unit('bandit_archer').attack.projectileSpeed).toBe(7);
    expect(unit('boar_rider').speed).toBe(1.5);
  });

  it('gives units the right sprite sizes', () => {
    expect(unit('reaper').sprite).toEqual({ w: 16, h: 24 });
    expect(unit('boar_rider').sprite).toEqual({ w: 24, h: 24 });
    expect(unit('ogre').sprite).toEqual({ w: 24, h: 32 });
    for (const id of ['militia', 'footman', 'bandit', 'bandit_archer'])
      expect(unit(id).sprite).toEqual({ w: 16, h: 16 });
  });

  it('declares every unit sprite as a positive integer size', () => {
    for (const def of [...NEUTRAL_UNITS, ...RAIDER_UNITS]) {
      expect(Number.isInteger(def.sprite.w) && def.sprite.w > 0, def.id).toBe(true);
      expect(Number.isInteger(def.sprite.h) && def.sprite.h > 0, def.id).toBe(true);
    }
  });

  it('accepts an open sprite size such as 32x40 in the type', () => {
    const sprite: UnitDef['sprite'] = { w: 32, h: 40 };
    expect(sprite.w * sprite.h).toBe(1280);
  });

  it('weights raiders 50/25/15/10', () => {
    expect(RAIDER_ROSTER.map((r) => [r.unit, r.weight])).toEqual([
      ['bandit', 50],
      ['bandit_archer', 25],
      ['boar_rider', 15],
      ['ogre', 10],
    ]);
  });

  it('matches card effects', () => {
    const spawn = (id: string) => {
      const c = card(id);
      if (c.kind !== 'troop') throw new Error('not troop');
      return c.effects[0];
    };
    expect(spawn('wheat_militia')).toEqual({ type: 'spawn', unit: 'militia', count: [4, 6, 8, 10, 12] });
    expect(spawn('wheat_reapers')).toEqual({ type: 'spawn', unit: 'reaper', count: [3, 4, 5, 6, 7] });
    expect(spawn('neutral_barracks')).toEqual({ type: 'spawn', unit: 'footman', count: [3, 4, 5, 6, 7] });

    const sc = card('wheat_scarecrow');
    if (sc.kind !== 'tower') throw new Error('not tower');
    expect(sc.effects[0]).toMatchObject({
      type: 'tower',
      attack: {
        dmg: 6,
        range: 72,
        interval: 12,
        projectileSpeed: 6,
        onHit: [{ type: 'slow', pct: 20, ticks: 20 }],
      },
    });

    const at = card('neutral_archer_tower');
    if (at.kind !== 'tower') throw new Error('not tower');
    expect(at.effects[0]).toMatchObject({
      type: 'tower',
      targeting: 'closestToThrone',
      attack: { dmg: 7, range: 88, interval: 12, projectileSpeed: 8 },
    });

    expect(card('neutral_clear_land')).toMatchObject({
      kind: 'tome',
      target: 'lockedPlot',
      actions: [{ type: 'unlockPlot', gold: 0 }],
    });
    expect(card('neutral_move')).toMatchObject({
      kind: 'tome',
      target: 'buildingThenPlot',
      actions: [{ type: 'move', levelIfFar: 0 }],
    });
  });
});
