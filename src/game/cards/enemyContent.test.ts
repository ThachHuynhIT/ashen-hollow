import { describe, expect, it } from 'vitest';
import { CONTENT } from './registry';

/** [id, hp, dmg, type, range, interval, speed, radius, armor, EP, tags] — literals from spec 6.6-6.11. */
const UNITS: [string, number, number, string, number, number, number, number, number, number, string[]][] = [
  ['wolf', 36, 7, 'physical', 2, 9, 1.6, 4, 0, 1.3, ['melee', 'beast']],
  ['bear', 160, 16, 'physical', 3, 14, 1.0, 7, 0.1, 5.0, ['melee', 'beast']],
  ['stag', 60, 9, 'physical', 2, 11, 1.4, 5, 0, 2.2, ['melee', 'beast']],
  ['treant', 400, 20, 'physical', 4, 16, 0.5, 9, 0.2, 12.0, ['melee']],
  ['dryad', 26, 6, 'magic', 56, 14, 0.9, 4, 0, 1.6, ['ranged']],
  ['pirate', 30, 6, 'physical', 2, 10, 1.1, 4, 0, 1.0, ['melee', 'pirate']],
  ['hookman', 45, 8, 'physical', 40, 14, 0.9, 4, 0.05, 1.8, ['ranged', 'pirate']],
  ['musketeer', 28, 12, 'physical', 72, 24, 0.8, 4, 0, 2.0, ['ranged', 'pirate']],
  ['swordsman', 55, 9, 'physical', 2, 10, 0.9, 4, 0.15, 2.0, ['melee', 'human']],
  ['bombardier', 32, 10, 'fire', 64, 18, 0.8, 4, 0, 2.2, ['ranged', 'human']],
  ['iron_drake', 180, 12, 'fire', 32, 10, 1.2, 7, 0.2, 9.0, ['ranged', 'flying']],
  ['shieldbearer', 90, 5, 'physical', 2, 12, 0.7, 5, 0.35, 2.5, ['melee', 'human']],
  ['tin_soldier', 34, 5, 'physical', 2, 10, 0.9, 4, 0.1, 1.2, ['melee', 'clockwork']],
  ['spider', 28, 6, 'physical', 2, 8, 1.5, 4, 0.1, 1.1, ['melee', 'clockwork']],
  ['colossus', 300, 10, 'physical', 4, 14, 0.5, 9, 0.3, 10.0, ['melee', 'clockwork']],
  ['gear_gunner', 30, 6, 'physical', 64, 12, 0.8, 4, 0.1, 1.6, ['ranged', 'clockwork']],
  ['skeleton', 26, 6, 'physical', 2, 10, 0.9, 4, 0, 1.1, ['melee', 'undead']],
  ['wraith', 30, 8, 'magic', 2, 10, 1.3, 4, 0, 1.0, ['melee', 'undead']],
  ['vampire', 60, 10, 'physical', 2, 10, 1.2, 4, 0, 2.4, ['melee', 'undead']],
  ['moon_reaper', 150, 25, 'physical', 3, 14, 1.0, 6, 0.1, 9.0, ['melee', 'undead']],
  ['rider', 50, 9, 'physical', 2, 10, 2.0, 5, 0.05, 2.0, ['melee', 'cavalry']],
  ['horse_archer', 34, 6, 'physical', 56, 12, 1.8, 5, 0, 1.8, ['ranged', 'cavalry']],
  ['khan_guard', 110, 14, 'physical', 2, 12, 1.6, 6, 0.2, 4.5, ['melee', 'cavalry']],
];

const BEHAVIOURS: Record<string, unknown[]> = {
  bear: [{ type: 'enrage', belowHpPct: 50, dmgPct: 50 }],
  treant: [{ type: 'healAura', radius: 48, hpPerSec: 3 }],
  tin_soldier: [{ type: 'rampDmg', pctPerSecond: 2, cap: 80 }],
  colossus: [{ type: 'stepBuff', everyTicks: 100, dmgPct: 20, speedPct: 10, maxStacks: 6 }],
  gear_gunner: [{ type: 'rampAttackSpeed', pctPerSecond: 1, cap: 60 }],
  skeleton: [{ type: 'reviveOnce', hpPct: 50 }],
  moon_reaper: [
    { type: 'killHeal', hp: 10 },
    { type: 'soulScaling', pctPerSoul: 2 },
  ],
  rider: [{ type: 'charge', dmgMult: 2, knockback: 8, stunTicks: 0 }],
  horse_archer: [{ type: 'kite', distance: 24 }],
  khan_guard: [{ type: 'charge', dmgMult: 2, knockback: 0, stunTicks: 10 }],
};

const ROSTERS: Record<string, [string, number][]> = {
  wheat: [['militia', 50], ['reaper', 25], ['peasant', 25]],
  stone: [['miner', 50], ['slinger', 35], ['golem', 15]],
  arcane: [['apprentice', 50], ['frost_mage', 25], ['construct', 25]],
  grove: [['wolf', 50], ['stag', 25], ['bear', 15], ['dryad', 10]],
  tide: [['pirate', 55], ['hookman', 25], ['musketeer', 20]],
  forge: [['swordsman', 55], ['bombardier', 30], ['shieldbearer', 15]],
  clock: [['tin_soldier', 55], ['spider', 30], ['gear_gunner', 15]],
  moon: [['skeleton', 55], ['wraith', 25], ['vampire', 20]],
  nomad: [['rider', 45], ['horse_archer', 40], ['khan_guard', 15]],
};

describe('enemy_catalog_9_playable_3', () => {
  it('knows all nine kings as enemies but only three are playable', () => {
    expect(CONTENT.enemyKings().map((k) => k.id)).toEqual([
      'arcane', 'clock', 'forge', 'grove', 'moon', 'nomad', 'stone', 'tide', 'wheat',
    ]);
    expect(CONTENT.kings().map((k) => k.id).sort()).toEqual(['arcane', 'stone', 'wheat']);
    expect(() => CONTENT.king('grove')).toThrow();
    expect(CONTENT.enemyKing('grove').nameVi).toBe('Vua Rừng Xanh');
  });

  it.each(UNITS)('%s matches the spec table', (id, hp, dmg, type, range, interval, speed, radius, armor, ep, tags) => {
    const u = CONTENT.unit(id);
    expect(u.hp).toBe(hp);
    expect(u.attack).toMatchObject({ dmg, type, range, interval });
    expect([u.speed, u.radius, u.armor, u.enemyCost]).toEqual([speed, radius, armor, ep]);
    expect([...u.tags].sort()).toEqual([...tags].sort());
    expect(u.behaviours ?? []).toEqual(BEHAVIOURS[id] ?? []);
  });

  it('keeps the special attacks of the table (projectiles, on-hit effects, cone)', () => {
    const a = (id: string) => CONTENT.unit(id).attack;
    expect(a('stag').onHit).toEqual([{ type: 'healAlly', hp: 4, radius: 40 }]);
    expect(a('dryad')).toMatchObject({ projectileSpeed: 7, onHit: [{ type: 'healAlly', hp: 3, radius: 56 }] });
    expect(a('hookman')).toMatchObject({ projectileSpeed: 6, onHit: [{ type: 'pull', px: 16, every: 4 }] });
    expect(a('musketeer').projectileSpeed).toBe(10);
    expect(a('bombardier')).toMatchObject({ splash: 14, projectileSpeed: 5, onHit: [{ type: 'burn', dps: 2, ticks: 30 }] });
    expect(a('iron_drake')).toMatchObject({ cone: { range: 32 }, onHit: [{ type: 'burn', dps: 4, ticks: 30 }] });
    expect(a('iron_drake').cone!.halfAngleCos).toBeCloseTo(0.7071, 4);
    expect(a('gear_gunner').projectileSpeed).toBe(8);
    expect(a('vampire').onHit).toEqual([{ type: 'lifesteal', pct: 40 }]);
    expect(a('moon_reaper').cleave).toBe(3);
    expect(a('horse_archer').projectileSpeed).toBe(8);
  });

  it('every sprite is one of the allowed sizes and the units are sorted into the registry', () => {
    for (const [id] of UNITS) {
      const s = CONTENT.unit(id).sprite;
      expect([16, 24]).toContain(s.w);
      expect([16, 24, 32]).toContain(s.h);
    }
    const ids = CONTENT.allUnits().map((u) => u.id);
    expect(ids).toEqual([...ids].sort());
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has no missing child summon and every roster entry resolves to a unit', () => {
    for (const k of CONTENT.enemyKings()) {
      for (const r of k.enemyRoster) expect(() => CONTENT.unit(r.unit), `${k.id}:${r.unit}`).not.toThrow();
      for (const u of k.units) {
        for (const b of u.behaviours ?? []) if (b.type === 'deathSpawn') expect(() => CONTENT.unit(b.unit)).not.toThrow();
      }
    }
  });
});

describe('roster_weights', () => {
  it.each(Object.entries(ROSTERS))('%s roster is exactly the spec weights', (id, expected) => {
    expect(CONTENT.enemyKing(id as never).enemyRoster.map((r) => [r.unit, r.weight])).toEqual(expected);
    expect(CONTENT.enemyRoster(id as never).map((r) => [r.unit.id, r.weight])).toEqual(expected);
  });
});

describe('banners and conquest pools', () => {
  it('the six new kings carry their banner; conquest cards come later (B3-B5)', () => {
    const banners = Object.fromEntries(CONTENT.enemyKings().map((k) => [k.id, k.banner.id]));
    expect(banners).toMatchObject({
      grove: 'grove_banner',
      tide: 'tide_banner',
      forge: 'forge_banner',
      clock: 'clock_banner',
      moon: 'moon_banner',
      nomad: 'nomad_banner',
    });
    for (const id of ['grove', 'tide', 'forge', 'clock', 'moon', 'nomad'] as const) {
      expect(CONTENT.conquestCards(id)).toEqual([]);
    }
  });

  it('a playable king conquered as an enemy offers its nine cards, never its throne', () => {
    for (const id of ['wheat', 'stone', 'arcane'] as const) {
      const cards = CONTENT.conquestCards(id);
      expect(cards).toHaveLength(9);
      expect(cards.some((c) => c.kind === 'throne')).toBe(false);
    }
  });

  it('keeps the three playable banners unchanged', () => {
    expect(CONTENT.enemyKing('wheat').banner.effects).toEqual([{ type: 'enemyCostPct', pct: -20 }]);
  });
});
