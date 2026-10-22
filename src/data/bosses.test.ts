import { describe, expect, it } from 'vitest';
import { BOSSES, BOSS_RULES } from './bosses';
import { BOSS_SUMMON_UNITS, RAIDER_ROSTER } from './raiders';

/** [id, ordinal, hp, armor, dmg, cleave, range, interval, speed, radius, tags] — spec 7.3 literals. */
const TABLE: [string, 1 | 2 | 3, number, number, number, number | undefined, number, number, number, number, string[]][] = [
  ['boss_bog_ogre', 1, 2500, 0.2, 40, 3, 4, 20, 0.5, 14, ['boss', 'melee', 'siege']],
  ['boss_hornet_queen', 2, 9000, 0.1, 50, undefined, 64, 15, 0.8, 12, ['boss', 'ranged', 'flying']],
  ['boss_crownless_king', 3, 30000, 0.3, 120, 4, 6, 18, 0.6, 16, ['boss', 'melee']],
];

describe('the three bosses (spec 7.3)', () => {
  it('lists them in order with the table numbers', () => {
    expect(BOSSES.map((b) => b.id)).toEqual(TABLE.map((t) => t[0]));
    for (const [id, ordinal, hp, armor, dmg, cleave, range, interval, speed, radius, tags] of TABLE) {
      const boss = BOSSES.find((b) => b.id === id)!;
      expect(boss.ordinal).toBe(ordinal);
      const u = boss.unit;
      expect([u.hp, u.armor, u.speed, u.radius]).toEqual([hp, armor, speed, radius]);
      expect(u.attack).toMatchObject({ dmg, type: 'physical', range, interval });
      expect(u.attack.cleave).toBe(cleave);
      expect([...u.tags].sort()).toEqual([...tags].sort());
      expect(u.sprite).toEqual({ w: 48, h: 48 });
      expect(u.enemyCost).toBe(0);
      expect(u.behaviours).toEqual([{ type: 'boss', id }]);
    }
  });

  it('the hornet queen shoots shells of speed 9', () => {
    expect(BOSSES[1]!.unit.attack.projectileSpeed).toBe(9);
  });

  it('keeps every skill number of the table in BOSS_RULES', () => {
    expect(BOSS_RULES.bog).toEqual({
      mudEveryTicks: 80,
      mudRange: 160,
      mudDmg: 60,
      mudDisableTicks: 30,
      frogBelowHpPct: 50,
      frogCount: 10,
    });
    expect(BOSS_RULES.hornet).toEqual({
      swarmEveryTicks: 50,
      swarmCount: 4,
      landEveryTicks: 150,
      landTicks: 40,
      landDmgTakenPct: 25,
    });
    expect(BOSS_RULES.crownless).toMatchObject({
      mirrorEveryTicks: 100,
      shield: 3000,
      shieldWindowTicks: 100,
      rageSpeedPct: 50,
      rageAttackSpeedPct: 50,
      boulderMult: 3,
    });
  });
});

describe('boss summons (spec 6.2)', () => {
  it('frog and hornet match the table and cost 0 EP', () => {
    const [frog, hornet] = BOSS_SUMMON_UNITS;
    expect([frog!.id, frog!.hp, frog!.attack.dmg, frog!.attack.range, frog!.attack.interval, frog!.speed, frog!.radius]).toEqual(['frog', 20, 4, 2, 10, 1.2, 3]);
    expect([...frog!.tags].sort()).toEqual(['melee', 'summon']);
    expect([hornet!.id, hornet!.hp, hornet!.attack.dmg, hornet!.attack.range, hornet!.attack.interval, hornet!.speed, hornet!.radius]).toEqual(['hornet', 25, 6, 2, 8, 1.6, 3]);
    expect([...hornet!.tags].sort()).toEqual(['flying', 'melee', 'summon']);
    expect([frog!.enemyCost, hornet!.enemyCost]).toEqual([0, 0]);
  });

  it('neither is in the raiders roster, so no army is ever composed of them', () => {
    const ids = RAIDER_ROSTER.map((r) => r.unit);
    expect(ids).not.toContain('frog');
    expect(ids).not.toContain('hornet');
  });
});
