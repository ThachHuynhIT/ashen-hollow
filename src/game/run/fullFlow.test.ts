import { describe, expect, it } from 'vitest';
import { RUN, battleGold } from '../../data/run';
import type { Rules } from '../../data/rules';
import type { CardId } from '../../data/types';
import type { BattleResult } from '../battle/types';
import { CONTENT } from '../cards/registry';
import { applyCommand } from './commands';
import type { CommandResult } from './commands';
import type { BuildingState, QuestState, RunCommand, RunState } from './state';
import { runHeadless } from '../sim/headless';
import { newRun } from './yearFlow';

const FULL: Rules = { years: 30, calendar: 'full', autoStart: false };

const result = (won: boolean, over: Partial<BattleResult> = {}): BattleResult => ({
  won,
  ticks: 400,
  throneHpLostPct: 5,
  kills: 10,
  killsBySource: {},
  interventionsUsed: 1,
  unitsLost: 0,
  capped: 0,
  inputs: [],
  ...over,
});

const ok = (r: CommandResult): { state: RunState; events: { type: string }[] } => {
  if ('error' in r) throw new Error(`illegal: ${r.error}`);
  return r;
};
const run = (s: RunState, cmd: RunCommand): RunState => ok(applyCommand(s, cmd, CONTENT)).state;

const bld = (uid: number, cardId: string): BuildingState => ({
  uid,
  cardId: cardId as CardId,
  level: 1,
  enchants: [],
  placedYear: 1,
  permanent: {},
  ageBonus: 0,
  counters: {},
  movedYear: null,
});

const threeBarracks = (s: RunState): RunState => ({
  ...s,
  plots: s.plots.map((p, i) => ([6, 7, 8].includes(i) ? { unlocked: true, building: bld(i, 'wheat_militia') } : p)),
});

const quest = (id: QuestState['id'], over: Partial<QuestState> = {}): QuestState => ({
  id,
  offeredYear: 1,
  deadlineYear: 99,
  status: 'active',
  progress: { rerolls: 0, opened: 0, sacrificeLevel: 0, winsInRow: 0, failedCondition: 0 },
  ...over,
});

/** A full-rules battle at `year` against raiders, hand already spent. */
const fight = (year: number, over: Partial<RunState> = {}): RunState => ({
  ...newRun(5, 'wheat', CONTENT, FULL),
  year,
  phase: 'battle',
  played: true,
  army: { attacker: 'raiders', budget: 10, level: 1, statMult: 1, waves: [] },
  ...over,
});

describe('battle outcome in the full run', () => {
  it('applies goldDelta first (never below 0), counts the battle, then pays the prize', () => {
    const s = fight(4, { gold: 2 });
    const next = run(s, { type: 'battleResult', result: { ...result(true), goldDelta: -5 } });
    expect(next.gold).toBe(0 + battleGold(4));
    expect(next.stats.completedYears).toBe(1);
    expect(run(fight(4, { gold: 9 }), { type: 'battleResult', result: result(true) }).gold).toBe(9 + battleGold(4));
  });

  it('late_year_boundaries: a loss with lives left in a council year still holds the council', () => {
    const next = run(fight(5, { lives: 2 }), { type: 'battleResult', result: result(false) });
    expect(next.lives).toBe(1);
    expect(next.phase).toBe('council');
    expect(next.offers).toMatchObject({ kind: 'council' });
  });

  it('losing the last life ends the run at once, with no council to rescue it', () => {
    const r = ok(applyCommand(fight(5, { lives: 1 }), { type: 'battleResult', result: result(false) }, CONTENT));
    expect(r.state.phase).toBe('ended');
    expect(r.state.won).toBe(false);
    expect(r.state.offers).toBeNull();
    expect(r.events.map((e) => e.type)).toContain('runEnded');
  });

  it('a lost battle in an ordinary year rests at yearEnd, and advance starts the next year', () => {
    const lost = run(fight(4), { type: 'battleResult', result: result(false) });
    expect(lost.phase).toBe('yearEnd');
    const next = run(lost, { type: 'advance' });
    expect(next.year).toBe(5);
    expect(next.phase).toBe('planning');
  });

  it('year 30 with lives left ends the run as a win; there is no year 31', () => {
    const r = ok(applyCommand(fight(30), { type: 'battleResult', result: result(true) }, CONTENT));
    expect(r.state.phase).toBe('ended');
    expect(r.state.won).toBe(true);
    expect(r.state.year).toBe(30);
    expect(r.state.offers).toBeNull();
    expect(r.events.map((e) => e.type)).toContain('runEnded');
    const lost = run(fight(30, { lives: 2 }), { type: 'battleResult', result: result(false) });
    expect(lost).toMatchObject({ phase: 'ended', won: true, year: 30 });
  });

  it('year 30 still lets a quest card reward be picked before the run ends', () => {
    const s = fight(30, { quests: [quest('quest_three_barracks')] });
    const offered = run(threeBarracks(s), { type: 'battleResult', result: result(true) });
    expect(offered.phase).toBe('reward');
    expect(offered.offers).toMatchObject({ kind: 'questReward' });
    const done = run(offered, { type: 'pickOffer', index: 0 });
    expect(done).toMatchObject({ phase: 'ended', won: true, year: 30 });
    expect(done.deck.length).toBe(offered.deck.length + 1);
  });
});

describe('post-battle queue order', () => {
  /** Year 10 victory over the third attack of Stone with a quest card waiting. */
  const setup = (): RunState => {
    const s = fight(10, {
      enemyKings: ['stone', 'arcane', 'grove', 'tide', 'forge', 'clock'],
      enemies: {
        stone: { attacks: 2, status: 'pending' },
        arcane: { attacks: 0, status: 'pending' },
        grove: { attacks: 0, status: 'pending' },
        tide: { attacks: 0, status: 'pending' },
        forge: { attacks: 0, status: 'pending' },
        clock: { attacks: 0, status: 'pending' },
      },
      quests: [quest('quest_three_barracks')],
    });
    return threeBarracks({ ...s, army: { attacker: 'stone', attackNo: 3, budget: 10, level: 1, statMult: 1, waves: [] } });
  };

  it('questReward -> reward -> conquest -> council -> yearEnd -> next year', () => {
    const phases: string[] = [];
    const kinds: string[] = [];
    let s = run(setup(), { type: 'battleResult', result: result(true) });
    const note = (): void => {
      phases.push(s.phase);
      kinds.push(s.offers?.kind ?? 'none');
    };
    note();
    s = run(s, { type: 'pickOffer', index: 0 });
    note();
    s = run(s, { type: 'pickOffer', index: 0 });
    note();
    s = run(s, { type: 'pickOffer', index: 0 });
    note();
    // pin the decree so the test does not depend on the roll
    s = { ...s, offers: { ...(s.offers as Extract<RunState['offers'], { kind: 'council' }>), decreeIds: ['decree_treasury', 'decree_moat', 'decree_trade'] } };
    s = run(run(s, { type: 'chooseDecree', index: 0 }), { type: 'enactDecree' });
    note();
    expect(phases).toEqual(['reward', 'reward', 'conquest', 'council', 'yearEnd']);
    expect(kinds).toEqual(['questReward', 'reward', 'conquest', 'council', 'none']);
    s = run(s, { type: 'advance' });
    expect(s.year).toBe(11);
    expect(s.phase).toBe('planning');
    expect(s.decrees).toEqual(['decree_treasury']);
    expect(s.stats.conquered).toBe(1);
  });

  it('a quest card reward cannot be skipped, an ordinary reward still can', () => {
    const s = run(setup(), { type: 'battleResult', result: result(true) });
    expect(applyCommand(s, { type: 'pickOffer', index: null }, CONTENT)).toEqual({ error: 'badTarget' });
    const reward = run(s, { type: 'pickOffer', index: 0 });
    const gold = reward.gold;
    expect(run(reward, { type: 'pickOffer', index: null }).gold).toBe(gold + RUN.skipRewardGold);
  });

  it('snapshot_offer_reload: reloading from a JSON snapshot at each step gives identical results', () => {
    const reload = (s: RunState): RunState => JSON.parse(JSON.stringify(s)) as RunState;
    let live = run(setup(), { type: 'battleResult', result: result(true) });
    let snap = reload(live);
    for (let step = 0; step < 3; step++) {
      expect(snap).toEqual(live);
      const cmd: RunCommand = { type: 'pickOffer', index: 0 };
      live = run(live, cmd);
      snap = run(snap, cmd);
      expect(snap).toEqual(live);
      expect(snap.rng).toEqual(live.rng); // nothing was rolled twice
      snap = reload(snap);
    }
  });
});

describe('year end settlement', () => {
  it('advance settles quests at year end: a failed deadline closes, then the year changes', () => {
    const s: RunState = { ...fight(5), phase: 'yearEnd', quests: [quest('quest_hoard', { deadlineYear: 5 })], gold: 3 };
    const next = run(s, { type: 'advance' });
    expect(next.quests[0]!.status).toBe('failed');
    expect(next.year).toBe(6);
  });

  it('a card reward earned at year end is offered before the year changes', () => {
    const s: RunState = threeBarracks({ ...fight(5), phase: 'yearEnd', quests: [quest('quest_three_barracks')] });
    const held = run(s, { type: 'advance' });
    expect(held.year).toBe(5);
    expect(held.offers).toMatchObject({ kind: 'questReward' });
    const after = run(held, { type: 'pickOffer', index: 0 });
    expect(after.year).toBe(5); // queue empty: rests at yearEnd until advanced
    expect(after.phase).toBe('yearEnd');
    expect(run(after, { type: 'advance' }).year).toBe(6);
  });

  it('keeps the legacy G2 flow: after the last reward the next year starts at once', () => {
    const g2 = newRun(5, 'wheat', CONTENT, { years: 15, calendar: 'short', autoStart: false });
    const s: RunState = { ...g2, phase: 'battle', year: 2, played: true, army: g2.army };
    const won = run(s, { type: 'battleResult', result: result(true) });
    expect(won.phase).toBe('reward');
    const next = run(won, { type: 'pickOffer', index: 0 });
    expect(next.year).toBe(3);
    expect(next.phase).toBe('planning');
  });
});

describe('the random bot plays the full rules through quests and councils', () => {
  it.each([1, 2, 3])('seed %i ends legally without illegal commands', (seed) => {
    const out = runHeadless({ seed, kingId: 'wheat', rules: FULL });
    expect(out.state.phase).toBe('ended');
    expect(out.state.year).toBeLessThanOrEqual(30);
    expect(out.state.stats.completedYears).toBeGreaterThan(0);
  });
});
