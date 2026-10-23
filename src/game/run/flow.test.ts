import { describe, expect, it } from 'vitest';
import { hashSeed } from '../../core/random';
import { RULES_G1, RULES_G2 } from '../../data/rules';
import { RUN } from '../../data/run';
import { CONTENT } from '../cards/registry';
import { enqueueOffers, finishYearStart } from './flow';
import { RUN_SAVE_VERSION, type OfferState, type RunState } from './state';
import { newRun } from './yearFlow';

const multiset = (cards: readonly string[]): string[] => [...cards].sort();

describe('new run (state 4)', () => {
  it('new_state4_defaults', () => {
    const s = newRun(7, 'wheat', CONTENT, RULES_G2);
    expect(RUN_SAVE_VERSION).toBe(4);
    expect(s.version).toBe(4);
    expect(s.difficulty).toBe(0);
    expect(s.decrees).toEqual([]);
    expect(s.quests).toEqual([]);
    expect(s.offeredQuestIds).toEqual([]);
    expect(s.pendingOffers).toEqual([]);
    expect(s.freeRerollsLeft).toBe(0);
    expect(s.interventionDmgPct).toBe(0);
    expect(s.yearStartPendingDraw).toBe(false);
    expect(s.stats).toMatchObject({ bossesWon: 0, bossesDefeated: [], completedYears: 0 });
    expect(s.rng.council).toBe(hashSeed('7:council'));
    expect(s.rng.quest).toBe(hashSeed('7:quest'));
    expect(s.rng.draw).not.toBe(hashSeed('7:draw')); // year 1 already drew a hand
    expect(s.rng.reward).toBe(hashSeed('7:reward'));
    const throne = s.plots[12]!.building!;
    expect(throne).toMatchObject({ ageBonus: 0, counters: {}, movedYear: null });
  });

  it('adds the full-run RUN constants of spec 3.1', () => {
    expect(RUN.councilYears).toEqual([5, 10, 15, 20, 25]);
    expect(RUN.questYears).toEqual([3, 7, 12, 17, 22, 27]);
    expect(RUN.bossYears).toEqual([10, 20, 30]);
    expect(RUN.maxActiveQuests).toBe(2);
    expect(RUN.bossGoldMult).toBe(2);
    expect(RUN.difficultyBudgetStep).toBe(0.1);
  });

  it('g1_g2_regression', () => {
    const g1 = newRun(3, 'wheat', CONTENT, RULES_G1);
    expect(g1.rules).toMatchObject({ years: 10, autoStart: true });
    const g2 = newRun(3, 'stone', CONTENT, RULES_G2);
    expect(g2.rules).toMatchObject({ years: 15, autoStart: false });
    for (const s of [g1, g2]) {
      expect(multiset([...s.hand, ...s.drawPile, ...s.discardPile])).toEqual(multiset(s.deck));
      expect(s.hand).toHaveLength(RUN.handSize);
      expect(s.phase).toBe('planning');
      expect(s.yearStartPendingDraw).toBe(false);
    }
  });
});

describe('finishYearStart', () => {
  /** A year that was prepared (income, army) but whose draw is held back, as the quest step will do. */
  const held = (): RunState => {
    const s = newRun(5, 'wheat', CONTENT, RULES_G2);
    return {
      ...s,
      phase: 'quest',
      yearStartPendingDraw: true,
      hand: [],
      drawPile: [],
      discardPile: [...s.deck],
    };
  };

  it('pending_draw_once: draws exactly once, a second call changes nothing', () => {
    const first = finishYearStart(held(), CONTENT);
    expect(first.yearStartPendingDraw).toBe(false);
    expect(first.phase).toBe('planning');
    expect(first.hand).toHaveLength(RUN.handSize);
    expect(multiset([...first.hand, ...first.drawPile, ...first.discardPile])).toEqual(
      multiset(first.deck),
    );
    const second = finishYearStart(first, CONTENT);
    expect(second).toEqual(first);
  });
});

describe('enqueueOffers', () => {
  const cards: OfferState = {
    kind: 'reward',
    cardIds: ['wheat_militia', 'wheat_scarecrow', 'neutral_move'],
  };
  const quest: OfferState = { kind: 'quest', questId: 'quest_untouched' };

  it('opens the first offer and keeps the rest queued in order', () => {
    const base = { ...newRun(2, 'wheat', CONTENT, RULES_G2), phase: 'yearEnd' as const };
    const next = enqueueOffers(base, [cards, quest]);
    expect(next.offers).toEqual(cards);
    expect(next.phase).toBe('reward');
    expect(next.pendingOffers).toEqual([quest]);
    expect(base.pendingOffers).toEqual([]); // input untouched
  });

  it('appends behind an offer that is already open without rerolling it', () => {
    const open = enqueueOffers({ ...newRun(2, 'wheat', CONTENT, RULES_G2), phase: 'yearEnd' }, [
      cards,
    ]);
    const next = enqueueOffers(open, [quest]);
    expect(next.offers).toEqual(cards);
    expect(next.pendingOffers).toEqual([quest]);
  });
});
