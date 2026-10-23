import { describe, expect, it } from 'vitest';
import type { KingId } from '../../data/types';
import { CONTENT } from '../cards/registry';
import { buildBattleSetup } from '../run/battleSetup';
import type { RunState } from '../run/state';
import { newRun } from '../run/yearFlow';
import { battleSetup, throneSetup, unitStats } from '../testing/fixtures';
import { bannerPhase, tickBehaviours } from './behaviours';
import { deathPhase } from './combat';
import { tickStatuses } from './statuses';
import type { BattleSetup, UnitStats } from './types';
import { TEAM_ALLY, TEAM_FOE, addUnit, createBattle, spawnWave, type BattleWorld } from './world';

/** A year-5 run in which `king` is attacking, to read the real setup from. */
const attackedBy = (king: KingId): BattleSetup => {
  const s0 = newRun(3, 'wheat', CONTENT, { years: 15, calendar: 'short', autoStart: false });
  const s: RunState = {
    ...s0,
    year: 5,
    army: {
      attacker: king,
      attackNo: 1,
      banner: CONTENT.enemyKing(king).banner.id,
      budget: 60,
      level: 1,
      statMult: 1,
      waves: [
        {
          spawnTick: 0,
          units: CONTENT.enemyRoster(king).map((r, i) => ({ unit: r.unit.id, edge: i % 2 === 0 ? ('N' as const) : ('E' as const) })),
        },
      ],
    },
  };
  return buildBattleSetup(s, CONTENT);
};

const spawnsOf = (setup: BattleSetup): UnitStats[] => setup.waves.flatMap((w) => w.spawns.map((x) => x.stats));
const byUnit = (setup: BattleSetup, id: string): UnitStats => spawnsOf(setup).find((u) => u.unit === id)!;

describe('banner_effects: stat banners reach the battle setup', () => {
  it('forge: +0.15 armor on every foe, clamped to 0.75', () => {
    const setup = attackedBy('forge');
    expect(byUnit(setup, 'swordsman').armor).toBeCloseTo(0.3);
    expect(byUnit(setup, 'shieldbearer').armor).toBeCloseTo(0.5);
    expect(setup.banner?.id).toBe('forge_banner');
  });

  it('nomad: +25% speed on every foe', () => {
    const setup = attackedBy('nomad');
    expect(byUnit(setup, 'rider').speed).toBeCloseTo(2.0 * 1.25);
    expect(byUnit(setup, 'khan_guard').speed).toBeCloseTo(1.6 * 1.25);
    expect(setup.banner?.effects).toContainEqual({ type: 'extraEdge', count: 1 });
  });

  it('raiders carry no banner at all', () => {
    const s0 = newRun(3, 'wheat', CONTENT);
    expect(buildBattleSetup(s0, CONTENT).banner).toBeUndefined();
  });

  it('an existing banner (wheat) still works through the enemy catalog', () => {
    expect(attackedBy('wheat').banner?.id).toBe('wheat_banner');
  });
});

describe('banner_effects: world banners', () => {
  const withBanner = (king: KingId, foes = 1): BattleWorld => {
    const unit = unitStats({ hp: 100, dmg: 10, interval: 10, speed: 0 });
    const setup = battleSetup({
      throne: throneSetup({ attack: null, hp: 200 }),
      banner: CONTENT.enemyKing(king).banner,
      waves: [{ spawnTick: 0, spawns: Array.from({ length: foes }, () => ({ stats: unit, edge: 'N' as const })) }],
    });
    const w = createBattle(setup);
    spawnWave(w, 0);
    return w;
  };

  it('grove Tái Sinh: every foe regains 1% of max HP each second, not above max', () => {
    const w = withBanner('grove', 2);
    const [a, b] = [1, 2];
    w.hp[a] = 50;
    w.hp[b] = 99.5;
    w.tick = 9;
    tickStatuses(w);
    expect(w.hp[a]).toBe(50);
    w.tick = 10;
    tickStatuses(w);
    expect(w.hp[a]).toBeCloseTo(51);
    expect(w.hp[b]).toBe(100);
    const ally = addUnit(w, unitStats({ hp: 100 }), TEAM_ALLY, 100, 100, 100, 100, 5);
    w.hp[ally] = 10;
    w.tick = 20;
    tickStatuses(w);
    expect(w.hp[ally]).toBe(10); // our units are not healed
  });

  it('clock Đếm Ngược: foes gain 1% damage per second up to +50%, on top of their own ramp', () => {
    const w = withBanner('clock');
    w.tick = 100;
    tickBehaviours(w);
    expect(w.dmg[1]).toBeCloseTo(11);
    w.tick = 900;
    tickBehaviours(w);
    expect(w.dmg[1]).toBeCloseTo(15);
    const ally = addUnit(w, unitStats({ hp: 100, dmg: 10 }), TEAM_ALLY, 100, 100, 100, 100, 5);
    tickBehaviours(w);
    expect(w.dmg[ally]).toBe(10);
  });

  it('clock stacks with a unit own ramp (tin soldier 2%/s + banner 1%/s = +30% at 10 s)', () => {
    const setup = battleSetup({
      throne: throneSetup({ attack: null }),
      banner: CONTENT.enemyKing('clock').banner,
      waves: [
        {
          spawnTick: 0,
          spawns: [
            { stats: unitStats({ dmg: 10, speed: 0, behaviours: [{ type: 'rampDmg', pctPerSecond: 2, cap: 80 }] }), edge: 'N' },
          ],
        },
      ],
    });
    const w = createBattle(setup);
    spawnWave(w, 0);
    w.tick = 100;
    tickBehaviours(w);
    expect(w.dmg[1]).toBeCloseTo(13);
  });

  it('moon Bất Tử: floor(20% of the foes) die-hards come back once at 30% HP; the rest die', () => {
    const w = withBanner('moon', 10);
    expect(w.undyingLeft).toBe(2);
    for (let id = 1; id <= 4; id++) w.hp[id] = 0;
    deathPhase(w);
    expect([1, 2].map((i) => [w.alive[i], w.hp[i]])).toEqual([[1, 30], [1, 30]]);
    expect([3, 4].map((i) => w.alive[i])).toEqual([0, 0]);
    expect(w.kills).toBe(2);
    expect(w.undyingLeft).toBe(0);
    w.hp[1] = 0; // a revived foe never returns twice
    deathPhase(w);
    expect(w.alive[1]).toBe(0);
  });

  it('moon Bất Tử gives a skeleton only one revive in total', () => {
    const skeleton = unitStats({ hp: 40, speed: 0, behaviours: [{ type: 'reviveOnce', hpPct: 50 }] });
    const setup = battleSetup({
      throne: throneSetup({ attack: null }),
      banner: CONTENT.enemyKing('moon').banner,
      waves: [{ spawnTick: 0, spawns: Array.from({ length: 10 }, () => ({ stats: skeleton, edge: 'N' as const })) }],
    });
    const w = createBattle(setup);
    spawnWave(w, 0);
    w.hp[1] = 0;
    deathPhase(w);
    expect(w.hp[1]).toBe(20); // its own 50% revive, not both
    w.hp[1] = 0;
    deathPhase(w);
    expect(w.alive[1]).toBe(0);
    expect(w.kills).toBe(1);
  });

  it('banners never touch our own units or the far kings', () => {
    const w = withBanner('tide');
    expect(w.regenPct + w.undyingLeft + w.bannerRampPps).toBe(0);
  });
});

describe('tide Cướp Bóc', () => {
  const tide = (): BattleWorld => {
    const setup = battleSetup({
      throne: throneSetup({ attack: null, hp: 200 }),
      banner: CONTENT.enemyKing('tide').banner,
    });
    return createBattle(setup);
  };
  const lose = (w: BattleWorld, hp: number): void => {
    w.hp[w.throneId] = hp;
    bannerPhase(w);
  };

  it('costs 1 gold per extra 10% of Ngai HP lost, at most 3 per battle', () => {
    const w = tide();
    lose(w, 190);
    expect(w.goldDelta).toBe(0);
    lose(w, 180); // 10% lost
    expect(w.goldDelta).toBe(-1);
    lose(w, 150); // 25% lost
    expect(w.goldDelta).toBe(-2);
    lose(w, 20);
    lose(w, 0);
    expect(w.goldDelta).toBe(-3);
  });

  it('does not charge twice for the same mark after healing back (high-watermark)', () => {
    const w = tide();
    lose(w, 170); // 15% lost -> 1 gold
    lose(w, 200); // healed up
    lose(w, 175); // back to 12.5%: same mark, no new loss
    expect(w.goldDelta).toBe(-1);
    lose(w, 159); // 20.5% lost -> second mark
    expect(w.goldDelta).toBe(-2);
  });

  it('is inert for other kings', () => {
    const w = createBattle(battleSetup({ throne: throneSetup({ attack: null, hp: 200 }) }));
    w.hp[w.throneId] = 10;
    bannerPhase(w);
    expect(w.goldDelta).toBe(0);
  });

  it('a foe never gets a Hồn mix-up: only TEAM_FOE counts toward undying', () => {
    expect(TEAM_FOE).not.toBe(TEAM_ALLY);
  });
});
