import { describe, expect, it } from 'vitest';
import { CONE } from '../../data/battle';
import type { UnitBehaviourDef } from '../../data/types';
import { battleSetup, throneSetup, unitStats } from '../testing/fixtures';
import { tickBehaviours } from './behaviours';
import { applyDamagePhase, attackPhase, deathPhase, projectilePhase } from './combat';
import { hashWorld } from './hash';
import { moveEntities } from './movement';
import { battleResult } from './step';
import { addDot } from './statuses';
import { pickShotTarget, retarget } from './targeting';
import type { UnitStats } from './types';
import { TEAM_ALLY, TEAM_FOE, addUnit, createBattle, drainEvents, type BattleWorld } from './world';

const arena = (): BattleWorld => createBattle(battleSetup({ throne: throneSetup({ attack: null }) }));

const spawn = (w: BattleWorld, team: number, x: number, y: number, over: Partial<UnitStats> = {}, uid = -1): number =>
  addUnit(w, unitStats({ hp: 100, dmg: 10, range: 2, interval: 10, speed: 1, ...over }), team, x, y, x, y, uid);

/** One strike of `a` on `v` right now: set the target, clear the cooldown, attack, apply. */
const strike = (w: BattleWorld, a: number, v: number): void => {
  w.target[a] = v;
  w.cooldown[a] = 0;
  attackPhase(w);
  applyDamagePhase(w);
};

describe('lifesteal and healAlly', () => {
  it('lifesteal 40% heals 3 from a raw 10 against armor 0.25 (heal is on damage after armor)', () => {
    const w = arena();
    const a = spawn(w, TEAM_ALLY, 100, 20, { onHit: [{ type: 'lifesteal', pct: 40 }] });
    const v = spawn(w, TEAM_FOE, 109, 20, { armor: 0.25 });
    w.hp[a] = 50;
    strike(w, a, v);
    expect(w.hp[v]).toBeCloseTo(100 - 7.5);
    expect(w.hp[a]).toBeCloseTo(53);
  });

  it('lifesteal never heals above maxHp', () => {
    const w = arena();
    const a = spawn(w, TEAM_ALLY, 100, 20, { onHit: [{ type: 'lifesteal', pct: 100 }] });
    const v = spawn(w, TEAM_FOE, 109, 20);
    w.hp[a] = 95;
    strike(w, a, v);
    expect(w.hp[a]).toBe(100);
  });

  it('healAlly 4 HP / 40 px heals the lowest-HP ally in range (ties: lowest id), never a foe or itself', () => {
    const w = arena();
    const a = spawn(w, TEAM_ALLY, 100, 20, { onHit: [{ type: 'healAlly', hp: 4, radius: 40 }] });
    const b = spawn(w, TEAM_ALLY, 110, 20);
    const c = spawn(w, TEAM_ALLY, 120, 20);
    const far = spawn(w, TEAM_ALLY, 300, 20);
    const v = spawn(w, TEAM_FOE, 109, 20);
    const foeHurt = spawn(w, TEAM_FOE, 105, 60);
    w.hp[a] = 1;
    w.hp[b] = 5;
    w.hp[c] = 5;
    w.hp[far] = 1;
    w.hp[foeHurt] = 2;
    strike(w, a, v);
    expect(w.hp[b]).toBe(9); // tie with c, lower id wins
    expect(w.hp[c]).toBe(5);
    expect(w.hp[far]).toBe(1);
    expect(w.hp[a]).toBe(1);
    expect(w.hp[foeHurt]).toBe(2);
  });
});

describe('flying', () => {
  it('is immune to short melee but not to reach 56, towers or the throne', () => {
    const w = arena();
    const melee = spawn(w, TEAM_ALLY, 100, 20);
    const archer = spawn(w, TEAM_ALLY, 100, 60, { range: 56, interval: 10 });
    const bat = spawn(w, TEAM_FOE, 108, 20, { tags: ['flying'] });
    const ground = spawn(w, TEAM_FOE, 150, 20);
    retarget(w);
    expect(w.target[melee]).toBe(ground); // the nearer bat cannot be hit by a range-2 attack
    w.target[melee] = bat;
    w.cooldown[melee] = 0;
    attackPhase(w);
    expect(w.damageQueue.filter((d) => d.sourceId === melee)).toHaveLength(0);
    w.damageQueue = [];
    strike(w, archer, bat);
    expect(w.hp[bat]).toBeLessThan(100);
  });

  it('a throne (structure) can shoot a flying unit', () => {
    const w = createBattle(battleSetup());
    const bat = spawn(w, TEAM_FOE, 192, 150, { tags: ['flying'] });
    expect(pickShotTarget(w, w.throneId)).toBe(bat);
  });
});

describe('kite', () => {
  it('backs away from a foe inside the distance while its attack is cooling down', () => {
    const w = arena();
    const a = spawn(w, TEAM_ALLY, 100, 100, {
      range: 56,
      speed: 1,
      behaviours: [{ type: 'kite', distance: 24 }],
    });
    const v = spawn(w, TEAM_FOE, 114, 100, { speed: 0 });
    w.target[a] = v;
    w.cooldown[a] = 5;
    const before = w.x[v]! - w.x[a]!;
    moveEntities(w);
    expect(w.x[v]! - w.x[a]!).toBeGreaterThan(before);
    expect(w.x[a]).toBeLessThan(100);
  });

  it('stays put when ready to shoot', () => {
    const w = arena();
    const a = spawn(w, TEAM_ALLY, 100, 100, { range: 56, behaviours: [{ type: 'kite', distance: 24 }] });
    const v = spawn(w, TEAM_FOE, 114, 100, { speed: 0 });
    w.target[a] = v;
    w.cooldown[a] = 0;
    moveEntities(w);
    expect(w.x[a]).toBe(100);
  });
});

describe('charge, knockback and pull', () => {
  const charger = (w: BattleWorld) =>
    spawn(w, TEAM_ALLY, 100, 20, {
      behaviours: [{ type: 'charge', dmgMult: 2, knockback: 8, stunTicks: 10 }],
    });

  it('the first strike hits x2, stuns 10 and knocks back 8; the second is ordinary', () => {
    const w = arena();
    const a = charger(w);
    const v = spawn(w, TEAM_FOE, 109, 20, { hp: 1000, speed: 0 });
    strike(w, a, v);
    expect(w.hp[v]).toBe(1000 - 20);
    expect(w.stunTicks[v]).toBe(11); // +1: this tick's status phase takes one
    expect(w.kbTicks[v]).toBe(3);
    expect(w.kbX[v]! * 3).toBeCloseTo(8);
    w.stunTicks[v] = 0;
    w.kbTicks[v] = 0;
    strike(w, a, v);
    expect(w.hp[v]).toBe(1000 - 20 - 10);
    expect(w.stunTicks[v]).toBe(0);
    expect(w.kbTicks[v]).toBe(0);
  });

  it('onHit knockback pushes the foe away; a boss and a structure do not move', () => {
    const w = arena();
    const a = spawn(w, TEAM_ALLY, 100, 20, { onHit: [{ type: 'knockback', px: 8 }] });
    const v = spawn(w, TEAM_FOE, 109, 20, { hp: 1000 });
    const boss = spawn(w, TEAM_FOE, 100, 29, { hp: 1000, tags: ['boss'] });
    strike(w, a, v);
    expect(w.kbX[v]! * 3).toBeCloseTo(8);
    strike(w, a, boss);
    expect(w.kbTicks[boss]).toBe(0);
    const f = spawn(w, TEAM_FOE, 192, 210, { onHit: [{ type: 'knockback', px: 8 }] });
    strike(w, f, w.throneId);
    expect(w.kbTicks[w.throneId]).toBe(0);
  });

  it('pull: every 4th hit drags the victim 16 px toward the attacker', () => {
    const w = arena();
    const a = spawn(w, TEAM_ALLY, 100, 20, { onHit: [{ type: 'pull', px: 16, every: 4 }] });
    const v = spawn(w, TEAM_FOE, 109, 20, { hp: 1000 });
    for (let i = 0; i < 3; i++) strike(w, a, v);
    expect(w.kbTicks[v]).toBe(0);
    strike(w, a, v);
    expect(w.kbTicks[v]).toBe(3);
    expect(w.kbX[v]! * 3).toBeCloseTo(-16); // toward the attacker (west)
  });
});

describe('time and health behaviours', () => {
  const behave = (b: UnitBehaviourDef[], over: Partial<UnitStats> = {}): { w: BattleWorld; id: number } => {
    const w = arena();
    const id = spawn(w, TEAM_ALLY, 100, 20, { dmg: 10, interval: 10, speed: 1, behaviours: b, ...over });
    return { w, id };
  };
  const at = (w: BattleWorld, tick: number): void => {
    w.tick = tick;
    tickBehaviours(w);
  };

  it('enrage: bear 160 HP dmg 16 -> 24 below 50% (79 yes, 80 no)', () => {
    const { w, id } = behave([{ type: 'enrage', belowHpPct: 50, dmgPct: 50 }], { hp: 160, dmg: 16 });
    w.hp[id] = 80;
    at(w, 0);
    expect(w.dmg[id]).toBe(16);
    w.hp[id] = 79;
    at(w, 1);
    expect(w.dmg[id]).toBe(24);
    w.hp[id] = 120;
    at(w, 2);
    expect(w.dmg[id]).toBe(16); // computed from the base each tick, never stacked
  });

  it('rampDmg (tin) 2%/s capped at 80%, and prewind counts as elapsed seconds', () => {
    const { w, id } = behave([{ type: 'rampDmg', pctPerSecond: 2, cap: 80 }]);
    at(w, 100);
    expect(w.dmg[id]).toBeCloseTo(12);
    at(w, 100);
    expect(w.dmg[id]).toBeCloseTo(12);
    at(w, 500);
    expect(w.dmg[id]).toBeCloseTo(18);
    const p = behave([{ type: 'rampDmg', pctPerSecond: 2, cap: 80 }], { prewind: 10 });
    at(p.w, 0);
    expect(p.w.dmg[p.id]).toBeCloseTo(12);
  });

  it('rampAttackSpeed (gear) 1%/s capped at 60%: interval 10 -> 10/1.3 -> 10/1.6', () => {
    const { w, id } = behave([{ type: 'rampAttackSpeed', pctPerSecond: 1, cap: 60 }]);
    at(w, 300);
    expect(w.interval[id]).toBeCloseTo(10 / 1.3);
    at(w, 800);
    expect(w.interval[id]).toBeCloseTo(10 / 1.6);
  });

  it('stepBuff (colossus): +20% DMG / +10% speed every 100 ticks, 6 layers at most', () => {
    const { w, id } = behave([{ type: 'stepBuff', everyTicks: 100, dmgPct: 20, speedPct: 10, maxStacks: 6 }]);
    at(w, 99);
    expect([w.dmg[id], w.speed[id]]).toEqual([10, 1]);
    at(w, 250);
    expect(w.dmg[id]).toBeCloseTo(14);
    expect(w.speed[id]).toBeCloseTo(1.2);
    at(w, 899);
    expect(w.dmg[id]).toBeCloseTo(22);
    expect(w.speed[id]).toBeCloseTo(1.6);
  });

  it('units without such behaviours are left exactly as built', () => {
    const w = arena();
    const id = spawn(w, TEAM_ALLY, 100, 20, { dmg: 7.3, interval: 11, speed: 0.9 });
    const h = hashWorld(w);
    w.tick = 500;
    tickBehaviours(w);
    w.tick = 0;
    expect([w.dmg[id], w.interval[id], w.speed[id]]).toEqual([7.3, 11, 0.9]);
    expect(hashWorld(w)).toBe(h);
  });

  it('soulScaling: +2% HP and DMG per Hồn of its own team; the HP bonus is granted as health', () => {
    const { w, id } = behave([{ type: 'soulScaling', pctPerSoul: 2 }], { hp: 150, dmg: 25 });
    w.souls[TEAM_ALLY] = 3;
    at(w, 0);
    expect(w.dmg[id]).toBeCloseTo(26.5);
    expect(w.maxHp[id]).toBeCloseTo(159);
    expect(w.hp[id]).toBeCloseTo(159);
    w.souls[TEAM_FOE] = 50; // the other side's souls do nothing
    at(w, 1);
    expect(w.dmg[id]).toBeCloseTo(26.5);
  });

  it('every dead unit adds a Hồn for its own team', () => {
    const w = arena();
    const a = spawn(w, TEAM_ALLY, 100, 20);
    const f = spawn(w, TEAM_FOE, 200, 20);
    w.hp[a] = 0;
    w.hp[f] = 0;
    deathPhase(w);
    expect([w.souls[TEAM_ALLY], w.souls[TEAM_FOE]]).toEqual([1, 1]);
  });

  it('killHeal restores 10 HP on a kill', () => {
    const { w, id } = behave([{ type: 'killHeal', hp: 10 }]);
    const v = spawn(w, TEAM_FOE, 109, 20, { hp: 5 });
    w.hp[id] = 50;
    strike(w, id, v);
    deathPhase(w);
    expect(w.alive[v]).toBe(0);
    expect(w.hp[id]).toBe(60);
  });
});

describe('reviveOnce', () => {
  const skeleton = (w: BattleWorld, team = TEAM_ALLY) =>
    spawn(w, team, 100, 20, {
      hp: 40,
      behaviours: [{ type: 'reviveOnce', hpPct: 50 }],
      deathSpawn: { stats: unitStats({ hp: 5 }), count: 2 },
    });

  it('comes back once with 50% HP: no kill, no loss, no death spawn; the second death is final', () => {
    const w = arena();
    const id = skeleton(w);
    const count = w.count;
    drainEvents(w);
    w.hp[id] = -3;
    deathPhase(w);
    expect(w.alive[id]).toBe(1);
    expect(w.hp[id]).toBe(20);
    expect(w.unitsLost).toBe(0);
    expect(w.count).toBe(count);
    expect(drainEvents(w)).toEqual([{ type: 'revive', id }]);
    w.hp[id] = 0;
    deathPhase(w);
    expect(w.alive[id]).toBe(0);
    expect(w.unitsLost).toBe(1);
    expect(w.count).toBe(count + 2);
  });

  it('a revived foe is not counted as a kill the first time', () => {
    const w = arena();
    const id = skeleton(w, TEAM_FOE);
    w.hp[id] = 0;
    deathPhase(w);
    expect(w.kills).toBe(0);
    w.hp[id] = 0;
    deathPhase(w);
    expect(w.kills).toBe(1);
  });
});

describe('cone_without_trig', () => {
  const cone = { range: 30, halfAngleCos: CONE.cos45 };
  const scene = () => {
    const w = arena();
    const a = spawn(w, TEAM_ALLY, 100, 100, { range: 40, cone, dmg: 10 });
    const main = spawn(w, TEAM_FOE, 120, 100);
    return { w, a, main };
  };

  it('hits every foe in the cone and no one outside the angle or the range', () => {
    const { w, a, main } = scene();
    const inside = spawn(w, TEAM_FOE, 100 + 15.3, 100 + 12.9); // about 40 degrees
    const wide = spawn(w, TEAM_FOE, 100 + 12.9, 100 + 15.3); // about 50 degrees
    const tooFar = spawn(w, TEAM_FOE, 100 + 60, 100);
    strike(w, a, main);
    expect(w.hp[main]).toBe(90);
    expect(w.hp[inside]).toBe(90);
    expect(w.hp[wide]).toBe(100);
    expect(w.hp[tooFar]).toBe(100);
  });

  it('exactly 45 degrees is inside', () => {
    const { w, a, main } = scene();
    const edge = spawn(w, TEAM_FOE, 110, 110);
    strike(w, a, main);
    expect(w.hp[edge]).toBe(90);
  });

  it('never hits an ally', () => {
    const { w, a, main } = scene();
    const friend = spawn(w, TEAM_ALLY, 115, 103);
    strike(w, a, main);
    expect(w.hp[friend]).toBe(100);
  });
});

describe('projectile_dead_target', () => {
  it('lands where the target stood and still splashes 50% on a neighbour', () => {
    const w = arena();
    const a = spawn(w, TEAM_ALLY, 100, 100, { range: 80, projectileSpeed: 5, splash: 20, dmg: 10 });
    const v = spawn(w, TEAM_FOE, 140, 100);
    const near = spawn(w, TEAM_FOE, 150, 100);
    w.target[a] = v;
    w.cooldown[a] = 0;
    attackPhase(w);
    expect(w.projectileCount).toBe(1);
    w.hp[v] = 0;
    deathPhase(w);
    projectilePhase(w);
    applyDamagePhase(w);
    expect(w.hp[near]).toBe(95);
    expect(w.projectileCount).toBe(0);
  });
});

describe('gold accumulator and hashing', () => {
  it('starts at 0 and reaches the result only when non-zero', () => {
    const w = arena();
    expect(w.goldDelta).toBe(0);
    w.ended = true;
    w.won = true;
    w.endTick = 5;
    expect(battleResult(w)!.goldDelta ?? 0).toBe(0);
    w.goldDelta = -3;
    expect(battleResult(w)!.goldDelta).toBe(-3);
  });

  const rich = (): { w: BattleWorld; a: number; v: number } => {
    const w = arena();
    const a = spawn(w, TEAM_ALLY, 100, 20, {
      behaviours: [
        { type: 'reviveOnce', hpPct: 50 },
        { type: 'charge', dmgMult: 2, knockback: 8, stunTicks: 10 },
        { type: 'soulScaling', pctPerSoul: 2 },
      ],
      onHit: [{ type: 'pull', px: 16, every: 4 }],
    });
    const v = spawn(w, TEAM_FOE, 200, 20);
    return { w, a, v };
  };

  it('hash_new_fields: every new piece of state changes the hash', () => {
    const base = hashWorld(rich().w);
    const mutations: [string, (c: ReturnType<typeof rich>) => void][] = [
      ['souls', ({ w }) => void (w.souls[TEAM_ALLY] = 1)],
      ['goldDelta', ({ w }) => void (w.goldDelta = 2)],
      ['dot', ({ w, v }) => addDot(w, v, 'burn', 1, 2, 30, 0)],
      ['dot dps', ({ w, v }) => { addDot(w, v, 'burn', 1, 2, 30, 0); w.dots[0]!.dps = 3; }],
      ['pull counter', ({ w, a }) => void (w.pullHits[a] = 2)],
      ['charge spent', ({ w, a }) => void (w.chargeReady[a] = 0)],
      ['revive spent', ({ w, a }) => void (w.reviveReady[a] = 0)],
      ['cooldown', ({ w, a }) => void (w.cooldown[a] = 3)],
      ['ramp target', ({ w, a }) => void (w.rampStacks[a] = 3)],
    ];
    for (const [name, mutate] of mutations) {
      const c = rich();
      mutate(c);
      expect(hashWorld(c.w), name).not.toBe(base);
    }
  });
});
