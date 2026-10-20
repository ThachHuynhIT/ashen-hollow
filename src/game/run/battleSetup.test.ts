import { describe, expect, it } from 'vitest';
import { RULES_G1 } from '../../data/rules';
import { ENEMY_LEVEL_STAT } from '../../data/battle';
import { STRUCT_HP } from '../../data/scaling';
import { composeArmy, armyBudget } from '../battle/compose';
import type { ArmyPlan } from '../battle/types';
import { CONTENT } from '../cards/registry';
import { initialPlots } from './board';
import { buildBattleSetup } from './battleSetup';
import type { RunState } from './state';

const roster = CONTENT.raiderRoster().map((r) => ({
  unit: r.unit.id,
  weight: r.weight,
  enemyCost: r.unit.enemyCost,
}));

function makeState(army: ArmyPlan | null): RunState {
  const plots = initialPlots();
  plots[12]!.building = { uid: 0, cardId: 'wheat_throne', level: 1, enchants: [], placedYear: 1, permanent: {} };
  plots[7]!.building = { uid: 3, cardId: 'wheat_militia', level: 1, enchants: [], placedYear: 1, permanent: {} };
  plots[11]!.building = { uid: 5, cardId: 'neutral_archer_tower', level: 1, enchants: [], placedYear: 1, permanent: {} };
  plots[13]!.building = { uid: 4, cardId: 'neutral_barracks', level: 1, enchants: [], placedYear: 2, permanent: {} };
  return {
    version: 1,
    rules: RULES_G1,
    seed: 42,
    kingId: 'wheat',
    year: 1,
    phase: 'planning',
    lives: 3,
    plots,
    throneLevel: 1,
    deck: [],
    hand: [],
    drawPile: [],
    discardPile: [],
    autoFire: false,
    gold: 0,
    rerollsThisYear: 0,
    purchasedPlots: 0,
    idleUids: [],
    enemyKings: [],
    enemies: {},
    played: true,
    army,
    offers: null,
    rng: { draw: 1, reward: 2, calendar: 3 },
    stats: { kills: 0, battlesWon: 0, battlesLost: 0, goldEarned: 0, conquered: 0 },
    nextUid: 6,
    won: null,
  };
}

const army1 = composeArmy(roster, armyBudget(1, 0.8), 1, 42);

describe('buildBattleSetup', () => {
  const state = makeState(army1);
  const setup = buildBattleSetup(state, CONTENT);

  it('copies the auto-fire setting into the setup', () => {
    expect(setup.autoFire).toBe(false);
    expect(buildBattleSetup({ ...state, autoFire: true }, CONTENT).autoFire).toBe(true);
  });

  it('orders structures by plot and keeps uids', () => {
    expect(setup.structures.map((s) => s.plot)).toEqual([7, 11, 13]);
    expect(setup.structures.map((s) => s.uid)).toEqual([3, 5, 4]);
  });

  it('maps troop buildings', () => {
    const s = setup.structures[0]!;
    expect(s.kind).toBe('troop');
    expect(s.hp).toBe(STRUCT_HP.troop);
    expect(s.spawn!.count).toBe(4);
    expect(s.spawn!.stats.unit).toBe('militia');
    expect(s.spawn!.stats.hp).toBe(32);
    expect(s.spawn!.stats.siege).toBe(false);
    expect(s.attack).toBeNull();
  });

  it('maps towers', () => {
    const t = setup.structures[1]!;
    expect(t.kind).toBe('tower');
    expect(t.hp).toBe(220);
    expect(t.attack!.dmg).toBe(7);
    expect(t.attack!.range).toBe(88);
    expect(t.attack!.projectileSpeed).toBe(8);
    expect(t.attack!.slowPct).toBe(0);
    expect(t.targeting).toBe('closestToThrone');
    expect(t.spawn).toBeNull();
  });

  it('maps slow on-hit for the scarecrow', () => {
    const s = makeState(army1);
    s.plots[7]!.building = { uid: 9, cardId: 'wheat_scarecrow', level: 1, enchants: [], placedYear: 1, permanent: {} };
    const t = buildBattleSetup(s, CONTENT).structures[0]!;
    expect(t.attack!.slowPct).toBe(20);
    expect(t.attack!.slowTicks).toBe(20);
  });

  it('maps the throne', () => {
    expect(setup.throne.hp).toBe(300);
    expect(setup.throne.plot).toBe(12);
    expect(setup.throne.uid).toBe(0);
    expect(setup.throne.kind).toBe('throne');
    expect(setup.throne.attack!.range).toBe(72);
    expect(setup.throne.targeting).toBe('nearest');
  });

  it('maps waves and year', () => {
    expect(setup.year).toBe(state.year);
    expect(setup.waves).toHaveLength(3);
    const total = setup.waves.reduce((n, w) => n + w.spawns.length, 0);
    expect(total).toBe(army1.waves.reduce((n, w) => n + w.units.length, 0));
  });

  it('scales foe hp and dmg by level and statMult', () => {
    const army: ArmyPlan = {
      attacker: 'raiders',
      budget: 10,
      level: 2,
      statMult: 1.5,
      waves: [{ spawnTick: 0, units: [{ unit: 'bandit', edge: 'N' }] }],
    };
    const s = buildBattleSetup(makeState(army), CONTENT).waves[0]!.spawns[0]!.stats;
    expect(s.hp).toBeCloseTo(30 * ENEMY_LEVEL_STAT[1]! * 1.5, 6);
    expect(s.hp).toBeCloseTo(65.25, 6);
    expect(s.dmg).toBeCloseTo(5 * 1.45 * 1.5, 6);
  });

  it('is pure and deterministic', () => {
    const s = makeState(army1);
    const copy = structuredClone(s);
    expect(buildBattleSetup(s, CONTENT)).toEqual(buildBattleSetup(s, CONTENT));
    expect(s).toEqual(copy);
  });

  it('throws without an army', () => {
    expect(() => buildBattleSetup(makeState(null), CONTENT)).toThrow();
  });
});
