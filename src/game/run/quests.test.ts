import { describe, expect, it } from 'vitest';
import { QUESTS, QUEST_RULES } from '../../data/quests';
import { RUN } from '../../data/run';
import type { Rules } from '../../data/rules';
import type { CardId, QuestId } from '../../data/types';
import { CONTENT } from '../cards/registry';
import { applyCommand } from './commands';
import { answerQuest, offerQuest, recordQuestCommand } from './quests';
import type { QuestState, RunCommand, RunState } from './state';
import { newRun, startYear } from './yearFlow';

/** Hand-built full-run rules: RULES_FULL itself arrives with plan task B6. */
const FULL: Rules = { years: 30, calendar: 'full', autoStart: false };

const base = (over: Partial<RunState> = {}): RunState => ({
  ...newRun(21, 'wheat', CONTENT, FULL),
  ...over,
});

/** The run at the end of `year - 1`, ready for `startYear`. */
const before = (year: number, over: Partial<RunState> = {}): RunState => base({ year: year - 1, ...over });

const quest = (id: QuestId, over: Partial<QuestState> = {}): QuestState => ({
  id,
  offeredYear: 3,
  deadlineYear: 5,
  status: 'active',
  progress: { rerolls: 0, opened: 0, sacrificeLevel: 0, winsInRow: 0, failedCondition: 0 },
  ...over,
});

const ok = (r: ReturnType<typeof applyCommand>): RunState => {
  if ('error' in r) throw new Error(`illegal: ${r.error}`);
  return r.state;
};
const run = (s: RunState, cmd: RunCommand): RunState => ok(applyCommand(s, cmd, CONTENT));

describe('quest catalog', () => {
  it('has the 13 quests of spec 7.2 with their terms', () => {
    const terms = Object.fromEntries(QUESTS.map((q) => [q.id, [q.duration, q.acceptGold]]));
    expect(QUESTS).toHaveLength(13);
    expect(terms).toEqual({
      quest_untouched: [1, 0],
      quest_three_barracks: [3, 0],
      quest_no_reroll: [3, 0],
      quest_slaughter: [3, 0],
      quest_double_rune: [2, 0],
      quest_land_grab: [3, 0],
      quest_master_builder: [4, 0],
      quest_blitz: [2, 0],
      quest_hoard: [3, 0],
      quest_no_help: [2, 0],
      quest_offering: [3, 0],
      quest_diversity: [3, 0],
      quest_wager: [2, 5],
    });
    for (const q of QUESTS) {
      expect(q.nameVi.length).toBeGreaterThan(0);
      expect(q.textVi.length).toBeGreaterThan(0);
      expect(q.rewardTextVi.length).toBeGreaterThan(0);
    }
    expect(QUEST_RULES).toMatchObject({ kills: 100, blitzTicks: 300, hoardGold: 20, barracks: 3, level: 4, stacks: 2 });
  });
});

describe('quest_years_and_capacity', () => {
  it('offers only in the quest years and holds the draw back until answered', () => {
    for (let year = 1; year <= 30; year++) {
      const next = startYear(before(year), CONTENT);
      const offered = RUN.questYears.includes(year as never);
      expect(next.phase, `year ${year}`).toBe(offered ? 'quest' : 'planning');
      expect(next.yearStartPendingDraw, `year ${year}`).toBe(offered);
    }
  });

  it('does not offer while two quests are active; completed and failed ones free their slot', () => {
    const full = [quest('quest_blitz'), quest('quest_hoard')];
    expect(startYear(before(7, { quests: full }), CONTENT).phase).toBe('planning');
    const freed = [quest('quest_blitz', { status: 'completed' }), quest('quest_hoard', { status: 'failed' })];
    expect(startYear(before(7, { quests: freed }), CONTENT).phase).toBe('quest');
    expect(startYear(before(7, { quests: [quest('quest_blitz')] }), CONTENT).phase).toBe('quest');
  });

  it('never runs outside the full calendar and never offers a quest again', () => {
    const g2 = newRun(21, 'wheat', CONTENT, { years: 15, calendar: 'short', autoStart: false });
    expect(startYear({ ...g2, year: 2 }, CONTENT).phase).toBe('planning');
    const ids = QUESTS.map((q) => q.id);
    const all = offerQuest({ ...before(7), year: 7, offeredQuestIds: ids });
    expect(all.offers).toBeNull(); // everything was offered already
    const last = offerQuest({ ...before(7), year: 7, offeredQuestIds: ids.slice(1) });
    expect(last.offers).toEqual({ kind: 'quest', questId: ids[0] });
  });

  it('rolls with the quest stream only: draw and reward streams stay put until the answer', () => {
    const s = before(3);
    const next = startYear(s, CONTENT);
    expect(next.rng.quest).not.toBe(s.rng.quest);
    expect(next.rng.draw).toBe(s.rng.draw);
    expect(next.rng.reward).toBe(s.rng.reward);
    expect(next.hand).toEqual(s.hand);
    expect(next.offers).toMatchObject({ kind: 'quest' });
    // same state, same offer
    expect(startYear(structuredClone(s), CONTENT).offers).toEqual(next.offers);
  });
});

describe('answering', () => {
  const offered = (over: Partial<RunState> = {}): RunState => startYear(before(3, over), CONTENT);
  const id = (s: RunState): QuestId => (s.offers as { questId: QuestId }).questId;

  it('accept records the quest with deadline offeredYear + duration - 1, then draws the hand', () => {
    const s = offered();
    const qid = id(s);
    const next = run(s, { type: 'answerQuest', accept: true });
    const def = QUESTS.find((q) => q.id === qid)!;
    expect(next.quests).toEqual([
      expect.objectContaining({
        id: qid,
        offeredYear: 3,
        deadlineYear: 3 + def.duration - 1,
        status: 'active',
        progress: { rerolls: 0, opened: 0, sacrificeLevel: 0, winsInRow: 0, failedCondition: 0 },
      }),
    ]);
    expect(next.offeredQuestIds).toEqual([qid]);
    expect(next.offers).toBeNull();
    expect(next.phase).toBe('planning');
    expect(next.yearStartPendingDraw).toBe(false);
    expect(next.hand).toHaveLength(3);
  });

  it('declined_not_reoffered: decline still marks the quest as offered and draws', () => {
    const s = offered();
    const qid = id(s);
    const next = run(s, { type: 'answerQuest', accept: false });
    expect(next.quests).toEqual([]);
    expect(next.offeredQuestIds).toEqual([qid]);
    expect(next.phase).toBe('planning');
    // a later offer cannot be the same quest
    const later = offerQuest({ ...next, year: 7 });
    expect((later.offers as { questId: QuestId }).questId).not.toBe(qid);
  });

  it('refills to the decree hand limit after the answer', () => {
    const s = offered({ decrees: ['decree_fourth_hand'] });
    expect(run(s, { type: 'answerQuest', accept: false }).hand).toHaveLength(4);
  });

  it('answers only while a quest is on offer', () => {
    expect(applyCommand(base(), { type: 'answerQuest', accept: true }, CONTENT)).toEqual({ error: 'wrongPhase' });
    expect(answerQuest(base(), true, CONTENT)).toBe('wrongPhase');
  });

  describe('wager_fee_atomic', () => {
    const wagerOffer = (gold: number): RunState => ({
      ...offered(),
      gold,
      offers: { kind: 'quest', questId: 'quest_wager' },
    });

    it('gold 4: accept is refused and nothing changes, rng included', () => {
      const s = wagerOffer(4);
      expect(applyCommand(s, { type: 'answerQuest', accept: true }, CONTENT)).toEqual({ error: 'notEnoughGold' });
      expect(s.quests).toEqual([]);
      expect(s.offers).toEqual({ kind: 'quest', questId: 'quest_wager' });
    });

    it('gold 5: pays 5 and gets deadline year + 2 - 1', () => {
      const next = run(wagerOffer(5), { type: 'answerQuest', accept: true });
      expect(next.gold).toBe(0);
      expect(next.quests[0]).toMatchObject({ id: 'quest_wager', offeredYear: 3, deadlineYear: 4 });
    });

    it('decline keeps the gold', () => {
      expect(run(wagerOffer(5), { type: 'answerQuest', accept: false }).gold).toBe(5);
    });
  });
});

describe('progress_events', () => {
  const progress = (s: RunState, id: QuestId): QuestState['progress'] => s.quests.find((q) => q.id === id)!.progress;

  /** A planning state with the quests below active. */
  const live = (ids: QuestId[], over: Partial<RunState> = {}): RunState =>
    base({ year: 4, quests: ids.map((q) => quest(q)), gold: 100, ...over });

  it('buying a plot and Clear Land both add to opened; a council expansion does too', () => {
    let s = live(['quest_land_grab']);
    s = run(s, { type: 'unlockPlot', plot: 1 });
    expect(progress(s, 'quest_land_grab').opened).toBe(1);
    const clear = 'neutral_clear_land' as CardId;
    s = { ...s, hand: [clear, ...s.hand.slice(1)] };
    s = run(s, { type: 'play', handIndex: 0, target: { kind: 'plot', plot: 2 } });
    expect(progress(s, 'quest_land_grab').opened).toBe(2);
    // anything that opens plots counts (e.g. a decree) — measured from the board, not the command
    const after = { ...s, plots: s.plots.map((p, i) => (i === 0 ? { ...p, unlocked: true } : p)) };
    const noted = recordQuestCommand(s, after, { type: 'enactDecree' }, CONTENT);
    expect(progress(noted, 'quest_land_grab').opened).toBe(3);
  });

  it('counts every reroll, free ones included, only while the quest is active', () => {
    let s = live(['quest_no_reroll'], { decrees: ['decree_merchant_guild'], freeRerollsLeft: 1 });
    s = run(s, { type: 'reroll' });
    expect(s.freeRerollsLeft).toBe(0);
    expect(progress(s, 'quest_no_reroll').rerolls).toBe(1);
    s = run(s, { type: 'reroll' });
    expect(progress(s, 'quest_no_reroll').rerolls).toBe(2);
    const done = live(['quest_no_reroll']);
    done.quests[0]!.status = 'completed';
    expect(progress(run(done, { type: 'reroll' }), 'quest_no_reroll').rerolls).toBe(0);
  });

  it('records the level of a sacrificed building; a move or a copy is not a sacrifice', () => {
    const level3 = (): RunState => {
      const s = live(['quest_offering']);
      s.plots[6] = {
        unlocked: true,
        building: {
          uid: 9,
          cardId: 'wheat_militia' as CardId,
          level: 3,
          enchants: [],
          placedYear: 1,
          permanent: {},
          ageBonus: 0,
          counters: {},
          movedYear: null,
        },
      };
      return s;
    };
    const withHand = (s: RunState, card: string): RunState => ({ ...s, hand: [card as CardId, ...s.hand.slice(1)] });
    const demolished = run(withHand(level3(), 'neutral_demolish'), {
      type: 'play',
      handIndex: 0,
      target: { kind: 'plot', plot: 6 },
    });
    expect(demolished.plots[6]!.building).toBeNull();
    expect(progress(demolished, 'quest_offering').sacrificeLevel).toBe(3);
    const moved = run(withHand(level3(), 'neutral_move'), {
      type: 'play',
      handIndex: 0,
      target: { kind: 'two', first: 6, second: 7 },
    });
    expect(moved.plots[7]!.building).not.toBeNull();
    expect(progress(moved, 'quest_offering').sacrificeLevel).toBe(0);
  });

  it('a refused command records nothing', () => {
    const s = live(['quest_land_grab', 'quest_no_reroll'], { gold: 0 });
    expect(applyCommand(s, { type: 'unlockPlot', plot: 1 }, CONTENT)).toEqual({ error: 'notEnoughGold' });
    expect(applyCommand(s, { type: 'reroll' }, CONTENT)).toHaveProperty('error');
    expect(s.quests.map((q) => q.progress)).toEqual([quest('x' as QuestId).progress, quest('x' as QuestId).progress]);
  });

  it('leaves the state alone when there is no active quest', () => {
    const s = base({ year: 4 });
    const next = run({ ...s, gold: 50 }, { type: 'reroll' });
    expect(next.quests).toEqual([]);
  });
});
