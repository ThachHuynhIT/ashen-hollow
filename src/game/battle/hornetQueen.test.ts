import { describe, expect, it } from 'vitest';
import { attackStats, structure, unitStats } from '../testing/fixtures';
import { bossWorld } from './bossKit';
import { spawnBossSummons, tickBosses } from './bosses';
import { applyDamagePhase, attackPhase, deathPhase } from './combat';
import { inRange } from './targeting';
import { TEAM_ALLY, addUnit, type BattleWorld } from './world';

const at = (w: BattleWorld, tick: number): void => {
  w.tick = tick;
  tickBosses(w);
};
const hornets = (w: BattleWorld): number => [...Array(w.count).keys()].filter((i) => w.alive[i] === 1 && w.label[i] === 'hornet').length;
const hit = (w: BattleWorld, raw: number): void => {
  w.damageQueue.push({ victim: w.bossId, raw, type: 0, sourceUid: 1, slowPct: 0, slowTicks: 0, sourceId: -1, stunTicks: 0, knock: 0 });
  applyDamagePhase(w);
};

describe('Nữ Hoàng Ong: Đàn Ong', () => {
  it('summons 4 hornets at tick 170 (boss age 50) and every 50 ticks after', () => {
    const w = bossWorld(2);
    for (const t of [120, 169]) at(w, t);
    expect(hornets(w)).toBe(0);
    at(w, 170);
    expect(hornets(w)).toBe(4);
    at(w, 171);
    at(w, 219);
    expect(hornets(w)).toBe(4);
    at(w, 220);
    expect(hornets(w)).toBe(8);
    expect(w.bossSummonsAlive).toBe(8);
  });

  it('never exceeds 40 living summons, frees room as they die, and never reuses ids', () => {
    const w = bossWorld(2);
    for (let swarm = 1; swarm <= 12; swarm++) at(w, 120 + swarm * 50);
    expect(hornets(w)).toBe(40);
    expect(w.bossSummonsAlive).toBe(40);
    const before = w.count;
    for (let i = 0; i < w.count; i++) if (w.label[i] === 'hornet' && w.alive[i] === 1) w.hp[i] = 0;
    deathPhase(w);
    expect(w.bossSummonsAlive).toBe(0);
    at(w, 120 + 13 * 50);
    expect(hornets(w)).toBe(4);
    expect(w.count).toBe(before + 4);
  });

  it('the hornets are flying summons of the stats in the setup', () => {
    const w = bossWorld(2);
    spawnBossSummons(w, w.setup.boss!.summons.hornet!, 1);
    const id = [...Array(w.count).keys()].find((i) => w.label[i] === 'hornet')!;
    expect([w.hp[id], w.flying[id], w.isBossSummon[id]]).toEqual([25, 1, 1]);
  });
});

describe('Nữ Hoàng Ong: Hạ Cánh', () => {
  it('lands at 270 (age 150) until 310, flies again, lands again at 420', () => {
    const w = bossWorld(2);
    const state = (t: number): [boolean, number] => {
      at(w, t);
      return [w.bossLanded, w.flying[w.bossId]!];
    };
    expect(state(269)).toEqual([false, 1]);
    expect(state(270)).toEqual([true, 0]);
    expect(state(309)).toEqual([true, 0]);
    expect(state(310)).toEqual([false, 1]);
    expect(state(419)).toEqual([false, 1]);
    expect(state(420)).toEqual([true, 0]);
    expect(state(460)).toEqual([false, 1]);
  });

  it('only a long-range or tower attack can hit her in the air; a melee unit hits only while she is down', () => {
    const w = bossWorld(2, [structure(7, { kind: 'tower', attack: attackStats({ dmg: 5, range: 88, interval: 12 }), cardId: 'neutral_archer_tower' })]);
    const melee = addUnit(w, unitStats({ hp: 100, range: 2 }), TEAM_ALLY, 117, 192, 117, 192, 9);
    const archer = addUnit(w, unitStats({ hp: 100, range: 56 }), TEAM_ALLY, 100, 215, 100, 215, 9);
    at(w, 200);
    expect(inRange(w, melee, w.bossId)).toBe(false);
    expect(inRange(w, archer, w.bossId)).toBe(true);
    expect(inRange(w, 1, w.bossId)).toBe(true); // the tower
    at(w, 270);
    expect(inRange(w, melee, w.bossId)).toBe(true);
    at(w, 310);
    expect(inRange(w, melee, w.bossId)).toBe(false);
  });

  it('does not attack while she is down, and attacks again after', () => {
    const w = bossWorld(2);
    addUnit(w, unitStats({ hp: 1000, speed: 0, dmg: 0, interval: 0 }), TEAM_ALLY, 130, 192, 130, 192, 9);
    const boss = w.bossId;
    w.target[boss] = w.count - 1;
    const shots = (tick: number): number => {
      at(w, tick);
      w.cooldown[boss] = 0;
      const before = w.projectileCount;
      attackPhase(w); // the queen shoots shells
      return w.projectileCount - before;
    };
    expect(shots(200)).toBe(1);
    expect(shots(280)).toBe(0);
    expect(shots(311)).toBe(1);
  });

  it('takes +25% damage while down, per hit, and never stacks when the tick repeats', () => {
    const w = bossWorld(2);
    const lost = (raw: number): number => {
      const before = w.hp[w.bossId]!;
      hit(w, raw);
      return before - w.hp[w.bossId]!;
    };
    at(w, 200);
    const normal = lost(100);
    expect(normal).toBeCloseTo(90); // armor 0.1
    at(w, 280);
    at(w, 280);
    at(w, 280);
    expect(lost(100)).toBeCloseTo(90 * 1.25);
    expect(lost(100)).toBeCloseTo(90 * 1.25);
    at(w, 310);
    expect(lost(100)).toBeCloseTo(90);
  });
});

describe('boss 2 status rules', () => {
  it('stun is halved (10 -> 5) and she cannot be pushed or pulled', () => {
    const w = bossWorld(2);
    w.damageQueue.push({ victim: w.bossId, raw: 1, type: 0, sourceUid: 1, slowPct: 0, slowTicks: 0, sourceId: -1, stunTicks: 10, knock: 0 });
    applyDamagePhase(w);
    expect(w.stunTicks[w.bossId]).toBe(6);
    const a = addUnit(w, unitStats({ hp: 100 }), TEAM_ALLY, 130, 192, 130, 192, 9);
    w.damageQueue.push({ victim: w.bossId, raw: 1, type: 0, sourceUid: 9, slowPct: 0, slowTicks: 0, sourceId: a, stunTicks: 0, knock: 16 });
    applyDamagePhase(w);
    expect(w.kbTicks[w.bossId]).toBe(0);
  });

  it('a stunned queen still cools her attack down', () => {
    const w = bossWorld(2);
    w.cooldown[w.bossId] = 6;
    w.stunTicks[w.bossId] = 5;
    w.tick = 200;
    attackPhase(w);
    expect(w.cooldown[w.bossId]).toBe(5);
  });
});
