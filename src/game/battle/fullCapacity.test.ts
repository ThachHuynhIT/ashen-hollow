import { describe, expect, it } from 'vitest';
import { BATTLE } from '../../data/battle';
import { battleSetup, throneSetup, unitStats } from '../testing/fixtures';
import { bossWorld, realBoss } from './bossKit';
import { spawnBossSummons } from './bosses';
import { applyDamagePhase, attackPhase, deathPhase } from './combat';
import { hashWorld } from './hash';
import { addDot } from './statuses';
import { stepBattle } from './step';
import { TEAM_ALLY, TEAM_FOE, addUnit, createBattle, type BattleWorld } from './world';

const finite = (w: BattleWorld): boolean => {
  for (const a of [w.x, w.y, w.hp, w.maxHp, w.dmg, w.speed, w.interval, w.shield]) {
    for (let i = 0; i < w.count; i++) if (!Number.isFinite(a[i]!)) return false;
  }
  return true;
};

describe('full_capacity', () => {
  it('summons that keep dying and coming back run the ids out at 512 without NaN, reuse or overflow', () => {
    const w = bossWorld(2);
    const hornet = w.setup.boss!.summons.hornet!;
    const seen = new Set<number>();
    let guard = 0;
    while (w.count < BATTLE.entityCap && guard++ < 200) {
      const made = spawnBossSummons(w, hornet, 40);
      expect(made).toBeGreaterThan(0);
      for (let i = 0; i < w.count; i++) {
        if (w.isBossSummon[i] === 1 && w.alive[i] === 1) {
          expect(seen.has(i) && w.hp[i] !== hornet.hp).toBe(false);
          seen.add(i);
          w.hp[i] = 0;
        }
      }
      deathPhase(w);
      expect(w.bossSummonsAlive).toBe(0);
    }
    expect(w.count).toBe(BATTLE.entityCap);
    const capped = w.capped;
    expect(spawnBossSummons(w, hornet, 10)).toBe(0);
    expect(w.capped).toBeGreaterThan(capped);
    expect(w.count).toBe(BATTLE.entityCap);
    expect(addUnit(w, hornet, TEAM_FOE, 0, 0, 0, 0, -1)).toBe(-1);
    expect(finite(w)).toBe(true);
  });

  it('a full projectile pool falls back to instant hits (spec 8.5)', () => {
    const w = createBattle(battleSetup({ throne: throneSetup({ attack: null }), waves: [{ spawnTick: 0, spawns: [] }] }));
    const shooter = addUnit(w, unitStats({ hp: 50, dmg: 7, range: 80, interval: 10, projectileSpeed: 6, speed: 0 }), TEAM_ALLY, 100, 100, 100, 100, 3);
    const victim = addUnit(w, unitStats({ hp: 50, speed: 0, dmg: 0, interval: 0 }), TEAM_FOE, 130, 100, 130, 100, -1);
    w.projectileCount = BATTLE.projectileCap;
    w.projectiles.alive.fill(1);
    w.target[shooter] = victim;
    w.cooldown[shooter] = 0;
    attackPhase(w);
    expect(w.projectileCount).toBe(BATTLE.projectileCap); // nothing more was queued as a shell
    applyDamagePhase(w);
    expect(w.hp[victim]).toBe(43);
  });

  it('a whole battle with the queen, a big camp and a full wave ends within 901 steps with sane numbers', () => {
    const boss = realBoss(2);
    const troop = unitStats({ unit: 'militia', hp: 40, dmg: 6, speed: 1 });
    const foe = unitStats({ unit: 'bandit', hp: 30, dmg: 5, speed: 0.9 });
    const w = createBattle(
      battleSetup({
        year: 20,
        boss,
        structures: [6, 7, 8, 11, 13, 16, 17, 18].map((plot) => ({
          plot,
          uid: 100 + plot,
          cardId: 'wheat_militia',
          kind: 'troop' as const,
          hp: 200,
          armor: 0,
          attack: null,
          targeting: 'nearest' as const,
          spawn: { stats: troop, count: 20 },
          pulse: null,
          taunt: 0,
          shieldPulse: null,
        })),
        waves: [
          { spawnTick: 0, spawns: Array.from({ length: 120 }, (_, i) => ({ stats: foe, edge: (['N', 'E', 'S', 'W'] as const)[i % 4]! })) },
        ],
      }),
    );
    let steps = 0;
    while (!w.ended && steps < 905) {
      stepBattle(w, []);
      steps += 1;
      expect(w.count).toBeLessThanOrEqual(BATTLE.entityCap);
      expect(w.projectileCount).toBeLessThanOrEqual(BATTLE.projectileCap);
      expect(w.bossSummonsAlive).toBeLessThanOrEqual(BATTLE.bossSummonCap);
    }
    expect(w.ended).toBe(true);
    expect(steps).toBeLessThanOrEqual(BATTLE.hardLimitTick + 1);
    expect(finite(w)).toBe(true);
  });
});

describe('hash distinguishes the new boss and status state', () => {
  const base = () => bossWorld(3);
  const h0 = hashWorld(base());
  const cases: [string, (w: BattleWorld) => void][] = [
    ['boss landed', (w) => void (w.bossLanded = true)],
    ['land end', (w) => void (w.bossLandEnd = 310)],
    ['frogs called', (w) => void (w.bossFrogsCalled = true)],
    ['shield granted', (w) => void (w.bossShieldGranted = true)],
    ['shield broken', (w) => void (w.bossShieldBroken = true)],
    ['shield deadline', (w) => void (w.bossShieldDeadline = 400)],
    ['summons alive', (w) => void (w.bossSummonsAlive = 3)],
    ['summon sequence', (w) => void (w.bossSummonSeq = 7)],
    ['tower disabled', (w) => void (w.disabledUntil[1] = 230)],
    ['gold', (w) => void (w.goldDelta = -1)],
    ['status', (w) => addDot(w, w.bossId, 'burn', 1, 2, 30, 0)],
    ['souls', (w) => void (w.souls[0] = 1)],
    ['boss hp', (w) => void (w.hp[w.bossId] = w.hp[w.bossId]! - 1)],
    ['boss shield', (w) => void (w.shield[w.bossId] = 5)],
  ];
  it.each(cases)('%s changes the hash', (_name, mutate) => {
    const w = base();
    mutate(w);
    expect(hashWorld(w)).not.toBe(h0);
  });

  it('is the same for two identical worlds', () => {
    expect(hashWorld(base())).toBe(h0);
  });

});
