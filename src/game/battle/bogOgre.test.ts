import { describe, expect, it } from 'vitest';
import { BOSS_RULES } from '../../data/bosses';
import { attackStats, structure, unitStats } from '../testing/fixtures';
import { bossWorld } from './bossKit';
import { afterBossDamage, spawnBossSummons, tickBosses } from './bosses';
import { applyDamagePhase, attackPhase, deathPhase } from './combat';
import { TEAM_FOE, addUnit, type BattleWorld } from './world';

const tower = (plot: number, dmg: number) =>
  structure(plot, {
    cardId: 'neutral_archer_tower',
    kind: 'tower',
    armor: 0.25,
    attack: attackStats({ dmg, range: 88, interval: 12 }),
    targeting: 'closestToThrone',
  });
const troop = (plot: number) => structure(plot, { cardId: 'wheat_militia', kind: 'troop', attack: null });

/** Entity id of the building on `plot`: structures follow the Ngai in plot order. */
const idAt = (w: BattleWorld, plot: number): number => 1 + w.setup.structures.map((s) => s.plot).sort((a, b) => a - b).indexOf(plot);
const at = (w: BattleWorld, tick: number): void => {
  w.tick = tick;
  tickBosses(w);
};
const frogs = (w: BattleWorld): number => [...Array(w.count).keys()].filter((i) => w.alive[i] === 1 && w.label[i] === 'frog').length;

describe('Ông Kẹ Đầm Lầy: Ném Bùn', () => {
  const scene = () => bossWorld(1, [tower(6, 7), tower(7, 12), tower(8, 12), tower(4, 99), troop(11)]);

  it('first throw at tick 200 (boss age 80), then 280; none in between', () => {
    const w = scene();
    for (const t of [120, 150, 199]) {
      at(w, t);
      expect(w.damageQueue, `tick ${t}`).toHaveLength(0);
    }
    at(w, 200);
    expect(w.damageQueue).toHaveLength(1);
    w.damageQueue = [];
    at(w, 201);
    at(w, 279);
    expect(w.damageQueue).toHaveLength(0);
    at(w, 280);
    expect(w.damageQueue).toHaveLength(1);
  });

  it('picks the tower with the highest damage inside 160 px, the lowest plot on a tie, never a troop camp', () => {
    const w = scene();
    at(w, 200);
    expect(w.damageQueue[0]!.victim).toBe(idAt(w, 7)); // 12 beats 7; plot 4 is out of range (99 ignored); 7 beats 8 on the tie
    expect(w.damageQueue[0]!.sourceId).toBe(w.bossId);
    const lone = bossWorld(1, [troop(6), troop(7)]);
    at(lone, 200);
    expect(lone.damageQueue).toHaveLength(0); // no tower: nothing happens, nothing throws
  });

  it('hits for 60 physical through the tower armor and switches it off for 30 ticks', () => {
    const w = scene();
    const id = idAt(w, 7);
    const hp0 = w.hp[id]!;
    at(w, 200);
    applyDamagePhase(w);
    expect(hp0 - w.hp[id]!).toBeCloseTo(60 * (1 - 0.25));
    expect(w.disabledUntil[id]).toBe(230);
    // the boss itself is in range of the tower, so a disabled tower must hold fire while the boss stands there
    const shots = (tick: number): number => {
      w.tick = tick;
      w.cooldown[id] = 0;
      w.damageQueue = [];
      attackPhase(w);
      return w.damageQueue.filter((q) => q.sourceId === id).length;
    };
    expect(shots(229)).toBe(0);
    expect(shots(230)).toBe(1);
  });

  it('a disabled tower still stands: it is not destroyed', () => {
    const w = scene();
    at(w, 200);
    applyDamagePhase(w);
    expect(w.alive[idAt(w, 7)]).toBe(1);
  });
});

describe('Ông Kẹ Đầm Lầy: Gọi Ếch', () => {
  it('does not call at exactly 50% (1250 of 2500), calls ten frogs at 1249', () => {
    const w = bossWorld(1);
    w.hp[w.bossId] = 1250;
    afterBossDamage(w, w.bossId);
    expect(frogs(w)).toBe(0);
    w.hp[w.bossId] = 1249;
    afterBossDamage(w, w.bossId);
    expect(frogs(w)).toBe(BOSS_RULES.bog.frogCount);
    expect(w.bossSummonsAlive).toBe(10);
  });

  it('calls only once, even when the ogre heals back and falls below again', () => {
    const w = bossWorld(1);
    w.hp[w.bossId] = 1000;
    afterBossDamage(w, w.bossId);
    w.hp[w.bossId] = 2400;
    afterBossDamage(w, w.bossId);
    w.hp[w.bossId] = 100;
    afterBossDamage(w, w.bossId);
    at(w, 300);
    expect(frogs(w)).toBe(10);
  });

  it('a dead ogre calls nothing', () => {
    const w = bossWorld(1);
    w.hp[w.bossId] = 0;
    w.alive[w.bossId] = 0;
    afterBossDamage(w, w.bossId);
    expect(frogs(w)).toBe(0);
  });

  it('the call also happens when damage comes through the damage phase', () => {
    const w = bossWorld(1);
    w.hp[w.bossId] = 1260;
    w.damageQueue.push({ victim: w.bossId, raw: 100, type: 2, sourceUid: 3, slowPct: 0, slowTicks: 0, sourceId: -1, stunTicks: 0, knock: 0 });
    applyDamagePhase(w);
    expect(frogs(w)).toBe(10);
  });

  it('frogs count against the 40 summon cap, die out of it, and ids are never reused', () => {
    const w = bossWorld(1);
    const frog = w.setup.boss!.summons.frog!;
    expect(spawnBossSummons(w, frog, 30)).toBe(30);
    expect(spawnBossSummons(w, frog, 30)).toBe(10); // only 10 left under the cap of 40
    expect(spawnBossSummons(w, frog, 5)).toBe(0);
    const before = w.count;
    for (let i = 0; i < w.count; i++) if (w.label[i] === 'frog' && w.alive[i] === 1) w.hp[i] = 0;
    // let the death phase handle them
    deathPhase(w);
    expect(w.bossSummonsAlive).toBe(0);
    expect(spawnBossSummons(w, frog, 3)).toBe(3);
    expect(w.count).toBe(before + 3); // new ids, none recycled
  });

  it('stops cleanly when the entity ids run out (counted as capped)', () => {
    const w = bossWorld(1);
    const dummy = unitStats({ hp: 1, speed: 0, dmg: 0, interval: 0 });
    while (addUnit(w, dummy, TEAM_FOE, 0, 0, 0, 0, -1) >= 0) {
      /* fill the world */
    }
    const capped = w.capped;
    expect(spawnBossSummons(w, w.setup.boss!.summons.frog!, 5)).toBe(0);
    expect(w.capped).toBeGreaterThan(capped);
    expect(w.count).toBe(512);
  });
});

describe('boss 1 status rules', () => {
  it('stun lasts half as long (10 -> 5) and knockback / pull do nothing', () => {
    const w = bossWorld(1);
    w.damageQueue.push({ victim: w.bossId, raw: 1, type: 0, sourceUid: 1, slowPct: 0, slowTicks: 0, sourceId: -1, stunTicks: 10, knock: 0 });
    applyDamagePhase(w);
    expect(w.stunTicks[w.bossId]).toBe(5 + 1); // +1: this tick status phase takes one
    const a = addUnit(w, unitStats({ hp: 100, dmg: 1, onHit: [{ type: 'knockback', px: 8 }, { type: 'pull', px: 16, every: 1 }] }), 0, 110, 192, 110, 192, 4);
    w.damageQueue.push({ victim: w.bossId, raw: 1, type: 0, sourceUid: 4, slowPct: 0, slowTicks: 0, sourceId: a, stunTicks: 0, knock: 8 });
    applyDamagePhase(w);
    expect(w.kbTicks[w.bossId]).toBe(0);
  });

  it('a foe that is not the boss is stunned for the full time', () => {
    const w = bossWorld(1);
    const foe = addUnit(w, unitStats({ hp: 100 }), TEAM_FOE, 150, 150, 150, 150, -1);
    w.damageQueue.push({ victim: foe, raw: 1, type: 0, sourceUid: 1, slowPct: 0, slowTicks: 0, sourceId: -1, stunTicks: 10, knock: 0 });
    applyDamagePhase(w);
    expect(w.stunTicks[foe]).toBe(11);
  });
});
