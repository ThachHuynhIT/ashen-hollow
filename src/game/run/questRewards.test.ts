import { describe, expect, it } from 'vitest';
import { Rng } from '../../core/random';
import { QUEST_RULES } from '../../data/quests';
import { RUN } from '../../data/run';
import type { Rules } from '../../data/rules';
import type { BuildingKind, CardDef, CardId, QuestId } from '../../data/types';
import type { BattleResult } from '../battle/types';
import { CONTENT } from '../cards/registry';
import { settleQuests } from './quests';
import { rollRareOffers } from './rewards';
import type { BuildingState, QuestState, RunState } from './state';
import { newRun } from './yearFlow';

const FULL: Rules = { years: 30, calendar: 'full', autoStart: false };
const YEAR = 5;

const bld = (uid: number, cardId: string, level: 1 | 2 | 3 | 4 | 5 = 1, stacks = 0): BuildingState => ({
  uid,
  cardId: cardId as CardId,
  level,
  enchants: stacks > 0 ? [{ cardId: 'wheat_sharpen' as CardId, stacks }] : [],
  placedYear: 1,
  permanent: {},
  ageBonus: 0,
  counters: {},
  movedYear: null,
});

const result = (over: Partial<BattleResult> = {}): BattleResult => ({
  won: true,
  ticks: 400,
  throneHpLostPct: 10,
  kills: 10,
  killsBySource: {},
  interventionsUsed: 1,
  unitsLost: 0,
  capped: 0,
  inputs: [],
  ...over,
});

const questState = (id: QuestId, over: Partial<QuestState> = {}): QuestState => ({
  id,
  offeredYear: YEAR,
  deadlineYear: YEAR,
  status: 'active',
  progress: { rerolls: 0, opened: 0, sacrificeLevel: 0, winsInRow: 0, failedCondition: 0 },
  ...over,
});

/** Year-5 full-run state with one active quest and an empty board but the Ngai. */
const withQuest = (id: QuestId, over: Partial<RunState> = {}, q: Partial<QuestState> = {}): RunState => {
  const s = newRun(33, 'wheat', CONTENT, FULL);
  return { ...s, year: YEAR, gold: 10, quests: [questState(id, q)], phase: 'battle', ...over };
};

const put = (s: RunState, plot: number, b: BuildingState): RunState => ({
  ...s,
  plots: s.plots.map((p, i) => (i === plot ? { unlocked: true, building: b } : p)),
});

const after = (s: RunState, r = result()): RunState => settleQuests(s, r, 'afterBattle', CONTENT);
const atEnd = (s: RunState): RunState => settleQuests(s, null, 'yearEnd', CONTENT);
const status = (s: RunState, i = 0): QuestState['status'] => s.quests[i]!.status;

/** Settles `s` and checks the input was not mutated. */
const pure = <T>(s: RunState, f: (s: RunState) => T): T => {
  const copy = structuredClone(s);
  const out = f(s);
  expect(s).toEqual(copy);
  return out;
};

describe('quest rewards: gold and counters', () => {
  it('untouched: won with no throne damage -> +6; any damage does not', () => {
    const s = withQuest('quest_untouched');
    const done = pure(s, (x) => after(x, result({ throneHpLostPct: 0 })));
    expect(status(done)).toBe('completed');
    expect(done.gold).toBe(10 + 6);
    expect(done.stats.goldEarned).toBe(s.stats.goldEarned + 6);
    const hurt = after(s, result({ throneHpLostPct: 1 }));
    expect(status(hurt)).toBe('active');
    expect(hurt.gold).toBe(10);
    expect(status(atEnd(hurt))).toBe('failed'); // deadline = this year
    expect(status(after(s, result({ won: false, throneHpLostPct: 0 })))).toBe('active');
  });

  it('no_reroll: pays +8 only at the end of the last year, and any reroll (free too) fails it', () => {
    const s = withQuest('quest_no_reroll', {}, { offeredYear: 3, deadlineYear: 5 });
    const early = atEnd({ ...s, year: 4 });
    expect(status(early)).toBe('active');
    expect(early.gold).toBe(10);
    const done = atEnd(s);
    expect(status(done)).toBe('completed');
    expect(done.gold).toBe(18);
    const rerolled = withQuest('quest_no_reroll', {}, { offeredYear: 3, deadlineYear: 5, progress: { rerolls: 1, opened: 0, sacrificeLevel: 0, winsInRow: 0, failedCondition: 0 } });
    const failed = atEnd(rerolled);
    expect(status(failed)).toBe('failed');
    expect(failed.gold).toBe(10);
  });

  it('land_grab: 2 plots opened -> +10, 1 is not enough', () => {
    const two = withQuest('quest_land_grab', {}, { progress: { rerolls: 0, opened: 2, sacrificeLevel: 0, winsInRow: 0, failedCondition: 0 } });
    expect(after(two).gold).toBe(20);
    const one = withQuest('quest_land_grab', {}, { progress: { rerolls: 0, opened: 1, sacrificeLevel: 0, winsInRow: 0, failedCondition: 0 } });
    expect(status(after(one))).toBe('active');
  });

  it.each([
    [300, true],
    [301, false],
  ])('blitz: won in %i ticks -> %s', (ticks, done) => {
    const s = after(withQuest('quest_blitz'), result({ ticks }));
    expect(status(s)).toBe(done ? 'completed' : 'active');
    expect(s.gold).toBe(done ? 15 : 10);
  });

  it.each([
    [20, true],
    [19, false],
  ])('hoard: %i gold at year end -> %s (+5)', (gold, done) => {
    const s = atEnd(withQuest('quest_hoard', { gold }));
    expect(status(s)).toBe(done ? 'completed' : 'failed');
    expect(s.gold).toBe(done ? gold + 5 : gold);
  });

  it('hoard is not checked after the battle, only at year end', () => {
    expect(status(after(withQuest('quest_hoard', { gold: 50 })))).toBe('active');
  });

  it('offering: a level 3 sacrifice pays 4 + 3 = 7; nothing sacrificed pays nothing', () => {
    const s = withQuest('quest_offering', {}, { progress: { rerolls: 0, opened: 0, sacrificeLevel: 3, winsInRow: 0, failedCondition: 0 } });
    expect(after(s).gold).toBe(10 + QUEST_RULES.offeringBase + 3);
    expect(status(after(withQuest('quest_offering')))).toBe('active');
  });

  it.each([
    [0, true],
    [1, false],
  ])('no_help: won with %i interventions -> %s (+20% boulder damage)', (used, done) => {
    const s = after(withQuest('quest_no_help', { interventionDmgPct: 5 }), result({ interventionsUsed: used }));
    expect(status(s)).toBe(done ? 'completed' : 'active');
    expect(s.interventionDmgPct).toBe(done ? 25 : 5);
  });

  it('wager: two wins in a row pay +15; a loss fails it and refunds nothing', () => {
    const q = (over: Partial<QuestState> = {}) => withQuest('quest_wager', { gold: 0 }, { deadlineYear: YEAR + 1, ...over });
    const one = after(q());
    expect(status(one)).toBe('active');
    expect(one.quests[0]!.progress.winsInRow).toBe(1);
    const two = after({ ...one, year: YEAR + 1 });
    expect(status(two)).toBe('completed');
    expect(two.gold).toBe(15);
    const lost = after(q(), result({ won: false }));
    expect(status(lost)).toBe('failed');
    expect(lost.gold).toBe(0);
    // a loss after a win also breaks the streak
    expect(status(after(one, result({ won: false })))).toBe('failed');
  });
});

describe('quest rewards: board and deck', () => {
  it('slaughter: 100 kills in one battle adds Promote to deck and the top of the draw pile; 99 does not', () => {
    const s = withQuest('quest_slaughter');
    const done = after(s, result({ kills: 100 }));
    expect(status(done)).toBe('completed');
    expect(done.deck).toEqual([...s.deck, QUEST_RULES.promoteCard]);
    expect(done.drawPile[0]).toBe(QUEST_RULES.promoteCard);
    expect(status(after(s, result({ kills: 99 })))).toBe('active');
  });

  it('double_rune: first enchant +1 stack on the lowest plot; a full building pays +4 gold instead', () => {
    let s = withQuest('quest_double_rune');
    s = put(s, 8, bld(2, 'wheat_militia', 1, 2));
    s = put(s, 6, bld(1, 'wheat_scarecrow', 1, 2));
    const done = after(s);
    expect(status(done)).toBe('completed');
    expect(done.plots[6]!.building!.enchants[0]!.stacks).toBe(3);
    expect(done.plots[8]!.building!.enchants[0]!.stacks).toBe(2);
    expect(done.gold).toBe(10);
    let full = withQuest('quest_double_rune');
    full = put(full, 6, bld(1, 'wheat_militia', 1, 4));
    const paid = after(full);
    expect(paid.plots[6]!.building!.enchants[0]!.stacks).toBe(4);
    expect(paid.gold).toBe(14);
    let one = withQuest('quest_double_rune');
    one = put(one, 6, bld(1, 'wheat_militia', 1, 1));
    expect(status(after(one))).toBe('active');
  });

  it('master_builder: level 4 -> the lowest non-throne building +1 (tie: lowest plot); all-5 is a no-op', () => {
    let s = withQuest('quest_master_builder');
    s = put(s, 8, bld(3, 'wheat_scarecrow', 2));
    s = put(s, 6, bld(1, 'wheat_militia', 2));
    s = put(s, 7, bld(2, 'neutral_archer_tower', 4));
    const done = after(s);
    expect(status(done)).toBe('completed');
    expect(done.plots[6]!.building!.level).toBe(3);
    expect(done.plots[8]!.building!.level).toBe(2);
    expect(done.plots[7]!.building!.level).toBe(4);
    let top = withQuest('quest_master_builder');
    top = put(top, 6, bld(1, 'wheat_militia', 5));
    const same = after(top);
    expect(status(same)).toBe('completed');
    expect(same.plots[6]!.building!.level).toBe(5);
    let low = withQuest('quest_master_builder');
    low = put(low, 6, bld(1, 'wheat_militia', 3));
    expect(status(after(low))).toBe('active');
  });

  it('three_barracks: 3 troop buildings queue one card pick of rare cards; 2 do not', () => {
    let s = withQuest('quest_three_barracks');
    s = put(put(s, 6, bld(1, 'wheat_militia')), 7, bld(2, 'wheat_militia'));
    expect(status(after(s))).toBe('active');
    const done = after(put(s, 8, bld(3, 'wheat_militia')));
    expect(status(done)).toBe('completed');
    const offer = done.offers;
    expect(offer).toMatchObject({ kind: 'questReward', questId: 'quest_three_barracks' });
    const ids = (offer as { cardIds: CardId[] }).cardIds;
    const rares = new Set([...CONTENT.king('wheat').cards, ...CONTENT.neutralPool()].filter((c) => c.rarity === 'rare').map((c) => c.id));
    expect(ids.length).toBe(Math.min(QUEST_RULES.rareChoices, rares.size));
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(rares.has(id)).toBe(true);
    expect(done.phase).toBe('reward');
    expect(done.rng.reward).not.toBe(s.rng.reward);
  });

  it.each([
    [2, 3, 'lives 2 -> 3, no gold'],
    [3, 3, 'lives stay, +8 gold'],
    [4, 4, 'lives stay, +8 gold'],
  ])('diversity: lives %i -> %i (%s)', (lives, expected) => {
    let s = withQuest('quest_diversity', { lives });
    s = put(put(put(put(s, 6, bld(1, 'wheat_militia')), 7, bld(2, 'neutral_archer_tower')), 8, bld(3, 'neutral_well')), 11, bld(4, 'wheat_granary'));
    const done = after(s);
    expect(status(done)).toBe('completed');
    expect(done.lives).toBe(expected);
    expect(done.gold).toBe(lives < RUN.startLives ? 10 : 18);
  });

  it('diversity needs all four kinds on non-throne plots', () => {
    let s = withQuest('quest_diversity');
    s = put(put(put(s, 6, bld(1, 'wheat_militia')), 7, bld(2, 'neutral_archer_tower')), 8, bld(3, 'neutral_well'));
    expect(status(after(s))).toBe('active'); // the throne never stands in for support
  });
});

describe('quest lifecycle', () => {
  it('a reward is paid once: settling again changes nothing', () => {
    const done = after(withQuest('quest_blitz'), result({ ticks: 10 }));
    expect(atEnd(done)).toEqual(done);
    expect(after(done, result({ ticks: 10 }))).toEqual(done);
  });

  it.each([
    [3, 'active'],
    [4, 'active'],
    [5, 'failed'],
  ])('deadline offered + N - 1: at the end of year %i an unfinished 3-year quest is %s', (year, st) => {
    const s = withQuest('quest_hoard', { year, gold: 0 }, { offeredYear: 3, deadlineYear: 5 });
    expect(status(atEnd(s))).toBe(st);
  });

  it('completes on the deadline year before it can expire', () => {
    const s = withQuest('quest_hoard', { gold: 30 }, { offeredYear: 3, deadlineYear: 5 });
    expect(status(atEnd(s))).toBe('completed');
  });

  it('multiple_quests_order: the first reward can finish the second, in order of acceptance', () => {
    const grab = questState('quest_land_grab', { progress: { rerolls: 0, opened: 2, sacrificeLevel: 0, winsInRow: 0, failedCondition: 0 } });
    const hoard = questState('quest_hoard', { deadlineYear: YEAR + 2 });
    const a = atEnd({ ...withQuest('quest_hoard', { gold: 15 }), quests: [grab, hoard] });
    expect(a.quests.map((q) => q.status)).toEqual(['completed', 'completed']);
    expect(a.gold).toBe(15 + 10 + 5);
    const b = atEnd({ ...withQuest('quest_hoard', { gold: 15 }), quests: [hoard, grab] });
    expect(b.quests.map((q) => q.status)).toEqual(['active', 'completed']);
    expect(b.gold).toBe(25);
  });
});

describe('rollRareOffers', () => {
  const rare = (id: string): CardDef =>
    ({ id: id as CardId, owner: 'neutral', rarity: 'rare', kind: 'tome', nameVi: id, name: id, tags: [], textVi: '', target: 'building', actions: [] }) as unknown as CardDef;
  const common = (id: string): CardDef => ({ ...rare(id), rarity: 'common' }) as CardDef;
  const kinds = (ids: CardId[]): BuildingKind[] => ids as never;

  it('draws only rare cards, unique, with 3 sources of rare available', () => {
    const pools = { king: [rare('wheat_a'), rare('wheat_b'), common('wheat_c')], neutral: [rare('neutral_a'), common('neutral_b')] };
    const ids = rollRareOffers(new Rng(7), pools, 3);
    expect(ids).toHaveLength(3);
    expect(new Set(ids).size).toBe(3);
    expect(ids.every((id) => /_(a|b)$/.test(id) && id !== 'wheat_c')).toBe(true);
    expect(kinds(ids)).toBeDefined();
  });

  it('returns fewer when the pools run dry, and never loops', () => {
    const pools = { king: [rare('wheat_a'), rare('wheat_b')], neutral: [common('neutral_b')] };
    expect(rollRareOffers(new Rng(1), pools, 3).sort()).toEqual(['wheat_a', 'wheat_b']);
    expect(rollRareOffers(new Rng(1), { king: [], neutral: [] }, 3)).toEqual([]);
  });

  it('is deterministic for a given rng state', () => {
    const pools = { king: [rare('wheat_a'), rare('wheat_b')], neutral: [rare('neutral_a'), rare('neutral_c')] };
    expect(rollRareOffers(new Rng(9), pools, 3)).toEqual(rollRareOffers(new Rng(9), pools, 3));
  });
});
