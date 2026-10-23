import { describe, expect, it } from 'vitest';
import type { DamageType, UnitBehaviourDef, UnitTag } from '../../data/types';
import { behaviourLabel, damageTypeLabel, unitTagLabel } from './labels';

const TAGS: Record<UnitTag, true> = {
  melee: true, ranged: true, flying: true, siege: true, boss: true,
  summon: true, human: true, beast: true, undead: true, clockwork: true,
  golem: true, mage: true, pirate: true, cavalry: true, construct: true,
};

const DAMAGE_TYPES: Record<DamageType, string> = {
  physical: 'vật lý', fire: 'lửa', magic: 'phép',
};

const BEHAVIOURS: Record<UnitBehaviourDef['type'], UnitBehaviourDef> = {
  reviveOnce: { type: 'reviveOnce', hpPct: 37 },
  enrage: { type: 'enrage', belowHpPct: 43, dmgPct: 61 },
  rampDmg: { type: 'rampDmg', pctPerSecond: 7, cap: 83 },
  rampAttackSpeed: { type: 'rampAttackSpeed', pctPerSecond: 9, cap: 91 },
  stepBuff: { type: 'stepBuff', everyTicks: 13, dmgPct: 17, speedPct: 23, maxStacks: 5 },
  charge: { type: 'charge', dmgMult: 2.5, knockback: 47, stunTicks: 19 },
  kite: { type: 'kite', distance: 73 },
  healAura: { type: 'healAura', radius: 127, hpPerSec: 11 },
  deathSpawn: { type: 'deathSpawn', unit: 'test_minion', count: 3 },
  killHeal: { type: 'killHeal', hp: 29 },
  soulScaling: { type: 'soulScaling', pctPerSoul: 6 },
  boss: { type: 'boss', id: 'boss_bog_ogre' },
};

const expectValidLabel = (label: string): void => {
  expect(typeof label).toBe('string');
  expect(label.trim().length).toBeGreaterThan(0);
  expect(label).not.toMatch(/undefined|NaN/);
};

describe('nhãn thông tin', () => {
  it.each(Object.keys(TAGS) as UnitTag[])('dịch tag %s', (tag) => {
    expectValidLabel(unitTagLabel(tag));
  });

  it('dùng nhãn tag đôi một khác nhau', () => {
    const labels = (Object.keys(TAGS) as UnitTag[]).map(unitTagLabel);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it.each(Object.keys(DAMAGE_TYPES) as DamageType[])('dịch sát thương %s', (type) => {
    const label = damageTypeLabel(type);
    expectValidLabel(label);
    expect(label).toBe(DAMAGE_TYPES[type]);
  });

  it.each(Object.entries(BEHAVIOURS))('mô tả hành vi %s với các số được truyền vào', (type, b) => {
    expect(b.type).toBe(type);
    const label = behaviourLabel(b);
    expectValidLabel(label);
    for (const value of Object.values(b)) {
      if (typeof value === 'number') expect(label).toContain(String(value));
    }
  });

  it('lấy máu hồi sinh và ngưỡng nổi giận từ đối tượng mới', () => {
    expect(behaviourLabel({ type: 'reviveOnce', hpPct: 68 }))
      .toBe('Sống lại một lần với 68% máu');
    const enrage = behaviourLabel({ type: 'enrage', belowHpPct: 26, dmgPct: 79 });
    expect(enrage).toContain('26%');
    expect(enrage).toContain('79%');
  });
});
