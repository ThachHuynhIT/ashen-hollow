import { describe, expect, it } from 'vitest';
import { INTERVENTION } from '../../data/battle';
import { DECREES, DECREE_RULES } from '../../data/decrees';
import { REWARD } from '../../data/run';
import { RULES_G2 } from '../../data/rules';
import type { CardId, DecreeId, Level } from '../../data/types';
import { createBattle } from '../battle/world';
import { CONTENT } from '../cards/registry';
import { applyCommand } from './commands';
import {
  decree,
  handLimit,
  interventionStats,
  rerollPrice,
  rewardCount,
} from './decrees';
import { collectStatSheet } from './modifiers';
import { buildBattleSetup } from './battleSetup';
import { rollOffers } from './rewards';
import { Rng } from '../../core/random';
import type { BuildingState, RunState } from './state';
import { newRun, startYear } from './yearFlow';

const ALL_IDS: DecreeId[] = [
  'decree_harvest_tax',
  'decree_expand_borders',
  'decree_mobilize',
  'decree_recast_crown',
  'decree_royal_armory',
  'decree_new_armor',
  'decree_royal_archers',
  'decree_merchant_guild',
  'decree_fourth_hand',
  'decree_bigger_boulder',
  'decree_quick_reflex',
  'decree_amnesty',
  'decree_treasury',
  'decree_academy',
  'decree_purge',
  'decree_trade',
  'decree_rune_festival',
  'decree_moat',
];

const bld = (uid: number, cardId: CardId, level: Level = 1): BuildingState => ({
  uid,
  cardId,
  level,
  enchants: [],
  placedYear: 1,
  permanent: {},
  ageBonus: 0,
  counters: {},
  movedYear: null,
});

/** Year-1 G2 run with a militia camp (plot 6) and an archer tower (plot 8); `decrees` already enacted. */
const withBoard = (decrees: DecreeId[] = [], over: Partial<RunState> = {}): RunState => {
  const s = newRun(1, 'wheat', CONTENT, RULES_G2);
  const plots = s.plots.map((p) => ({ ...p }));
  plots[6] = { unlocked: true, building: bld(1, 'wheat_militia') };
  plots[8] = { unlocked: true, building: bld(2, 'neutral_archer_tower') };
  return { ...s, plots, decrees, nextUid: 3, ...over };
};

describe('decree catalog', () => {
  it('all_18_decrees_unique', () => {
    expect(DECREES).toHaveLength(18);
    expect(new Set(DECREES.map((d) => d.id))).toEqual(new Set(ALL_IDS));
    expect(decree('decree_moat').id).toBe('decree_moat');
    for (const d of DECREES) {
      expect(d.nameVi.length).toBeGreaterThan(0);
      expect(d.textVi.length).toBeGreaterThan(0);
    }
  });

  it('carries the runtime numbers of spec 7.1/7.4 in data', () => {
    expect(DECREE_RULES).toMatchObject({
      hand: 4,
      freeReroll: 1,
      reward: 4,
      boulderDmgPct: 50,
      boulderRadius: 8,
      cooldownPct: 30,
      moatPct: 10,
    });
  });
});

describe('decree_stat_matrix', () => {
  const structure = (s: RunState, plot: number) => {
    const setup = buildBattleSetup(s, CONTENT);
    return plot === 12 ? setup.throne : setup.structures.find((x) => x.plot === plot)!;
  };

  it('mobilize: militia 4 -> 5', () => {
    expect(structure(withBoard(), 6).spawn!.count).toBe(4);
    expect(structure(withBoard(['decree_mobilize']), 6).spawn!.count).toBe(5);
  });

  it('royal armory: militia damage 5 -> 5.5', () => {
    expect(structure(withBoard(), 6).spawn!.stats.dmg).toBeCloseTo(5);
    expect(structure(withBoard(['decree_royal_armory']), 6).spawn!.stats.dmg).toBeCloseTo(5.5);
  });

  it('new armor: militia hp 32 -> 36.8', () => {
    expect(structure(withBoard(), 6).spawn!.stats.hp).toBeCloseTo(32);
    expect(structure(withBoard(['decree_new_armor']), 6).spawn!.stats.hp).toBeCloseTo(36.8);
  });

  it('royal archers: tower range 88 -> 100 and throne 72 -> 84', () => {
    const before = withBoard();
    const after = withBoard(['decree_royal_archers']);
    expect(structure(before, 8).attack!.range).toBeCloseTo(88);
    expect(structure(after, 8).attack!.range).toBeCloseTo(100);
    expect(structure(before, 12).attack!.range).toBeCloseTo(72);
    expect(structure(after, 12).attack!.range).toBeCloseTo(84);
    // troop buildings are not towers
    expect(collectStatSheet(after, CONTENT, 6).range.flat).toBe(0);
  });

  it('moat: every foe is 10% slower (speed 1 -> 0.9)', () => {
    const speeds = (s: RunState) => buildBattleSetup(s, CONTENT).waves.flatMap((w) => w.spawns.map((x) => x.stats.speed));
    const plain = speeds(withBoard());
    const moat = speeds(withBoard(['decree_moat']));
    expect(plain.length).toBeGreaterThan(0);
    moat.forEach((v, i) => expect(v).toBeCloseTo(plain[i]! * 0.9));
  });
});

describe('harvest tax', () => {
  it('adds +2 gold at year start after upkeep; a camp that cannot pay upkeep stays idle', () => {
    const base = withBoard();
    const taxed = withBoard(['decree_harvest_tax']);
    const a = startYear({ ...base, year: 1 }, CONTENT);
    const b = startYear({ ...taxed, year: 1 }, CONTENT);
    expect(b.gold - a.gold).toBe(2);
    expect(b.idleUids).toEqual(a.idleUids);
    // gold 0: upkeep checks use the gold held before tax and decree gold
    const broke = startYear({ ...taxed, year: 1, gold: 0 }, CONTENT);
    const brokeNoDecree = startYear({ ...base, year: 1, gold: 0 }, CONTENT);
    expect(broke.idleUids).toEqual(brokeNoDecree.idleUids);
  });
});

describe('hand limit, reward count and rerolls', () => {
  it('fourth_hand: refill 4 cards', () => {
    expect(handLimit(withBoard())).toBe(3);
    expect(handLimit(withBoard(['decree_fourth_hand']))).toBe(4);
    const next = startYear({ ...withBoard(['decree_fourth_hand']), year: 1, hand: [] }, CONTENT);
    expect(next.hand).toHaveLength(4);
  });

  it('trade: reward offers 4 unique cards', () => {
    expect(rewardCount(withBoard())).toBe(REWARD.choices);
    expect(rewardCount(withBoard(['decree_trade']))).toBe(4);
    const s = withBoard(['decree_trade']);
    const ids = rollOffers(
      new Rng(5),
      3,
      { king: CONTENT.king('wheat').cards, neutral: CONTENT.neutralPool() },
      rewardCount(s),
    );
    expect(ids).toHaveLength(4);
    expect(new Set(ids).size).toBe(4);
  });

  it('free_reroll_paid_sequence: one free, then 1, 2, 4; total rerolls still counted', () => {
    let s: RunState = {
      ...withBoard(['decree_merchant_guild']),
      year: 1,
      gold: 100,
      paidRerollsThisYear: 0,
      freeRerollsLeft: 0,
    };
    s = startYear(s, CONTENT); // year 2: the free quota is granted at year start
    s = { ...s, gold: 100 };
    expect(s.freeRerollsLeft).toBe(1);
    expect(s.paidRerollsThisYear).toBe(0);
    const prices: number[] = [];
    for (let i = 0; i < 4; i++) {
      const price = rerollPrice(s);
      const r = applyCommand(s, { type: 'reroll' }, CONTENT);
      if ('error' in r) throw new Error(r.error);
      expect(s.gold - r.state.gold).toBe(price);
      prices.push(price);
      s = r.state;
    }
    expect(prices).toEqual([0, 1, 2, 4]);
    expect(s.rerollsThisYear).toBe(4);
    expect(s.paidRerollsThisYear).toBe(3);
    expect(s.freeRerollsLeft).toBe(0);
  });

  it('keeps the G1/G2 price ladder 1, 2, 4 without decrees', () => {
    let s: RunState = { ...withBoard(), gold: 100 };
    const prices: number[] = [];
    for (let i = 0; i < 3; i++) {
      prices.push(rerollPrice(s));
      const r = applyCommand(s, { type: 'reroll' }, CONTENT);
      if ('error' in r) throw new Error(r.error);
      s = r.state;
    }
    expect(prices).toEqual([1, 2, 4]);
  });

  it('a new year resets the paid counter and grants the free reroll only with the guild decree', () => {
    const used = { ...withBoard(['decree_merchant_guild']), year: 1, paidRerollsThisYear: 2, rerollsThisYear: 3 };
    const next = startYear(used, CONTENT);
    expect(next.paidRerollsThisYear).toBe(0);
    expect(next.rerollsThisYear).toBe(0);
    expect(next.freeRerollsLeft).toBe(1);
    expect(startYear({ ...withBoard(), year: 1 }, CONTENT).freeRerollsLeft).toBe(0);
  });
});

describe('boulder_modifiers', () => {
  it('has the legacy numbers without decrees or quest bonus', () => {
    expect(interventionStats(withBoard())).toEqual({
      dmgPct: 0,
      radius: INTERVENTION.radius,
      cooldownTicks: INTERVENTION.cooldownTicks,
    });
  });

  it('bigger boulder + quick reflex: +50% damage, 24 -> 32 radius, cooldown 150 -> 105', () => {
    expect(interventionStats(withBoard(['decree_bigger_boulder', 'decree_quick_reflex']))).toEqual({
      dmgPct: 50,
      radius: 32,
      cooldownTicks: 105,
    });
  });

  it('adds the permanent quest bonus into the same percentage (50 + 20 = 70)', () => {
    const s = withBoard(['decree_bigger_boulder'], { interventionDmgPct: 20 });
    expect(interventionStats(s).dmgPct).toBe(70);
  });

  it('reaches the battle: setup carries it, the world starts with it', () => {
    const s = withBoard(['decree_bigger_boulder', 'decree_quick_reflex']);
    const setup = buildBattleSetup(s, CONTENT);
    expect(setup.intervention).toEqual({ dmgPct: 50, radius: 32, cooldownTicks: 105 });
    const world = createBattle(setup);
    expect(world.boulderRadius).toBe(32);
    expect(world.cooldownTicks).toBe(105);
    expect(world.boulderDmgPct).toBe(50);
    expect(buildBattleSetup(withBoard(), CONTENT).intervention).toBeUndefined();
  });
});
