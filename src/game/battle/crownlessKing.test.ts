import { describe, expect, it } from 'vitest';
import type { BossSetup } from './types';
import { bossWorld, realBoss } from './bossKit';
import { bossPhase, tickBosses } from './bosses';
import { applyDamagePhase } from './combat';
import { boulderPhase } from './intervention';
import { unitStats } from '../testing/fixtures';
import { TEAM_FOE, addUnit, type BattleWorld } from './world';

const at = (w: BattleWorld, tick: number): void => {
  w.tick = tick;
  tickBosses(w);
};
const hpAt = (w: BattleWorld, hp: number): void => {
  w.hp[w.bossId] = hp;
};
const mirrors = (w: BattleWorld): number =>
  [...Array(w.count).keys()].filter((i) => w.alive[i] === 1 && w.isBossSummon[i] === 1).length;
const hit = (w: BattleWorld, raw: number, extra: Partial<{ stunTicks: number; slowPct: number; slowTicks: number }> = {}): void => {
  w.damageQueue.push({ victim: w.bossId, raw, type: 2, sourceUid: 1, slowPct: 0, slowTicks: 0, sourceId: -1, stunTicks: 0, knock: 0, ...extra });
  applyDamagePhase(w);
};

/** Boss 3 with a mirror unit of its own so the test does not depend on the board. */
const withMirror = (count: number): BossSetup => {
  const real = realBoss(3);
  return { ...real, mirror: { stats: unitStats({ unit: 'militia', hp: 50, dmg: 3 }), count } };
};

describe('bossPhase thresholds (integers, 30000 HP)', () => {
  it.each([
    [30000, 'mirror'],
    [19801, 'mirror'],
    [19800, 'shield'],
    [9900, 'shield'],
    [9899, 'rage'],
    [1, 'rage'],
  ] as const)('HP %i is the %s phase', (hp, phase) => {
    const w = bossWorld(3);
    hpAt(w, hp);
    expect(bossPhase(w)).toBe(phase);
  });

  it('is null for the other bosses, before the boss appears and after it dies', () => {
    expect(bossPhase(bossWorld(1))).toBeNull();
    expect(bossPhase(bossWorld(2))).toBeNull();
    const w = bossWorld(3);
    w.alive[w.bossId] = 0;
    expect(bossPhase(w)).toBeNull();
  });
});

describe('Bóng Gương', () => {
  it('first mirrors at tick 220 (age 100), every 100 ticks, only while above 66%', () => {
    const w = bossWorld(3, [], undefined, withMirror(3));
    for (const t of [120, 150, 219]) at(w, t);
    expect(mirrors(w)).toBe(0);
    at(w, 220);
    expect(mirrors(w)).toBe(3);
    at(w, 221);
    expect(mirrors(w)).toBe(3);
    at(w, 320);
    expect(mirrors(w)).toBe(6);
    hpAt(w, 19800); // shield phase: no more mirrors
    at(w, 420);
    expect(mirrors(w)).toBe(6);
  });

  it('is foe-side units of the setup stats, and never more than 40 summons alive', () => {
    const w = bossWorld(3, [], undefined, withMirror(15));
    at(w, 220);
    at(w, 320);
    at(w, 420);
    expect(mirrors(w)).toBe(40);
    const id = [...Array(w.count).keys()].find((i) => w.isBossSummon[i] === 1)!;
    expect([w.team[id], w.hp[id], w.label[id]]).toEqual([TEAM_FOE, 50, 'militia']);
  });

  it('a player without troop camps gets no mirror', () => {
    const w = bossWorld(3, [], undefined, { ...realBoss(3), mirror: null });
    at(w, 220);
    at(w, 320);
    expect(mirrors(w)).toBe(0);
  });
});

describe('Khiên Ngai Vỡ', () => {
  const inShield = (): BattleWorld => {
    const w = bossWorld(3);
    hpAt(w, 15000);
    at(w, 300); // enters the shield phase
    return w;
  };

  it('grants 3000 once when the middle phase begins', () => {
    const w = inShield();
    expect(w.shield[w.bossId]).toBe(3000);
    expect(w.bossShieldDeadline).toBe(400);
    w.shield[w.bossId] = 2000;
    at(w, 301);
    expect(w.shield[w.bossId]).toBe(2000); // not granted a second time
  });

  it('refills to 3000 if it survives 100 ticks, and repeats', () => {
    const w = inShield();
    w.shield[w.bossId] = 1200;
    at(w, 399);
    expect(w.shield[w.bossId]).toBe(1200);
    at(w, 400);
    expect(w.shield[w.bossId]).toBe(3000);
    w.shield[w.bossId] = 5;
    at(w, 499);
    expect(w.shield[w.bossId]).toBe(5);
    at(w, 500);
    expect(w.shield[w.bossId]).toBe(3000);
  });

  it('is not refilled once broken in time', () => {
    const w = inShield();
    hit(w, 3000); // magic: the whole shield goes
    expect(w.shield[w.bossId]).toBe(0);
    at(w, 350);
    expect(w.bossShieldBroken).toBe(true);
    at(w, 400);
    at(w, 500);
    expect(w.shield[w.bossId]).toBe(0);
  });

  it('falling into rage clears what is left and never brings it back', () => {
    const w = inShield();
    w.shield[w.bossId] = 800;
    hpAt(w, 9899);
    at(w, 310);
    expect(w.shield[w.bossId]).toBe(0);
    at(w, 400);
    at(w, 500);
    expect(w.shield[w.bossId]).toBe(0);
  });

  it('the shield soaks damage before health', () => {
    const w = inShield();
    const hp = w.hp[w.bossId]!;
    hit(w, 1000);
    expect(w.hp[w.bossId]).toBe(hp);
    expect(w.shield[w.bossId]).toBe(2000);
  });
});

describe('Cuồng Vương', () => {
  it('is +50% speed (0.6 -> 0.9) and +50% attack speed (18 -> 12) below 33%, and does not stack on repeat', () => {
    const w = bossWorld(3);
    at(w, 200);
    expect([w.speed[w.bossId], w.interval[w.bossId]]).toEqual([0.6, 18]);
    hpAt(w, 9000);
    at(w, 201);
    at(w, 202);
    at(w, 203);
    expect(w.speed[w.bossId]).toBeCloseTo(0.9);
    expect(w.interval[w.bossId]).toBeCloseTo(12);
  });
});

describe('boss 3 is immune to slow, stun, knockback and pull', () => {
  it('takes none of them', () => {
    const w = bossWorld(3);
    hit(w, 1, { stunTicks: 10, slowPct: 50, slowTicks: 30 });
    expect([w.stunTicks[w.bossId], w.slowPct[w.bossId], w.slowTicks[w.bossId]]).toEqual([0, 0, 0]);
    const a = addUnit(w, unitStats({ hp: 10 }), 0, 110, 192, 110, 192, 4);
    w.damageQueue.push({ victim: w.bossId, raw: 1, type: 0, sourceUid: 4, slowPct: 0, slowTicks: 0, sourceId: a, stunTicks: 0, knock: 16 });
    applyDamagePhase(w);
    expect(w.kbTicks[w.bossId]).toBe(0);
  });
});

describe('Đá Tảng Hoàng Gia on the Crownless King', () => {
  const boulderAt = (w: BattleWorld): void => {
    w.boulders.push({ x: w.x[w.bossId]!, y: w.y[w.bossId]!, dropTick: w.tick, impactTick: w.tick });
    boulderPhase(w);
    applyDamagePhase(w);
  };
  const scene = (over: { intervention?: { dmgPct: number; radius: number; cooldownTicks: number } }) =>
    bossWorld(3, [], undefined, realBoss(3), { year: 30, ...over });

  it('hits for x3: year 30 base 330 -> 990', () => {
    const w = scene({});
    const hp = w.hp[w.bossId]!;
    boulderAt(w);
    expect(hp - w.hp[w.bossId]!).toBe(990);
  });

  it('adds the decree and quest percentages before the x3: 330 x 1.7 x 3 = 1683', () => {
    const w = scene({ intervention: { dmgPct: 70, radius: 24, cooldownTicks: 150 } });
    const hp = w.hp[w.bossId]!;
    boulderAt(w);
    expect(hp - w.hp[w.bossId]!).toBeCloseTo(1683);
  });

  it('never multiplies the blast on ordinary foes or on the other bosses', () => {
    const w = scene({});
    const foe = addUnit(w, unitStats({ hp: 5000, speed: 0, dmg: 0, interval: 0 }), TEAM_FOE, w.x[w.bossId]! + 5, w.y[w.bossId]!, 0, 0, -1);
    boulderAt(w);
    expect(5000 - w.hp[foe]!).toBe(330);
    const b2 = bossWorld(2, [], undefined, realBoss(2), { year: 30 });
    const hp2 = b2.hp[b2.bossId]!;
    boulderAt(b2);
    expect(hp2 - b2.hp[b2.bossId]!).toBe(330);
  });

  it('does not push any boss back', () => {
    const w = scene({});
    boulderAt(w);
    expect(w.kbTicks[w.bossId]).toBe(0);
  });
});
