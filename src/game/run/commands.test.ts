import { describe, expect, it } from 'vitest';
import { Rng, hashSeed } from '../../core/random';
import { RULES_G1, RULES_G2 } from '../../data/rules';
import { RUN, START_DECK_G1, battleGold, rerollCost, unlockCost } from '../../data/run';
import { SLOT_MULT } from '../../data/battle';
import { armyBudget, composeArmy } from '../battle/compose';
import type { CardId } from '../../data/types';
import type { BattleResult } from '../battle/types';
import { CONTENT } from '../cards/registry';
import { contentWith, runState } from '../testing/fixtures';
import { applyCommand } from './commands';
import type { CommandResult } from './commands';
import type { IllegalReason, PlayTarget, RunCommand, RunState } from './state';
import { refillHand } from './deck';
import { cardOffer } from './flow';
import { startDeck } from './calendar';
import { newRun } from './yearFlow';

const sorted = (arr: readonly CardId[]): CardId[] => [...arr].sort();

const roster = CONTENT.raiderRoster().map((r) => ({
  unit: r.unit.id,
  weight: r.weight,
  enemyCost: r.unit.enemyCost,
}));

const result = (won: boolean, kills = 4): BattleResult => ({
  won,
  ticks: 100,
  throneHpLostPct: 0,
  kills,
  killsBySource: {},
  interventionsUsed: 0,
  unitsLost: 0,
  capped: 0,
  inputs: [],
});

const ok = (r: CommandResult) => {
  if ('error' in r) throw new Error(`unexpected error ${r.error}`);
  return r;
};

const errorOf = (state: RunState, cmd: RunCommand): IllegalReason => {
  const before = structuredClone(state);
  const r = applyCommand(state, cmd, CONTENT);
  expect(state).toEqual(before);
  if (!('error' in r)) throw new Error('expected error');
  return r.error;
};

const plot = (n: number): PlayTarget => ({ kind: 'plot', plot: n });
const two = (first: number, second: number): PlayTarget => ({ kind: 'two', first, second });
const play = (handIndex: number, target: PlayTarget): RunCommand => ({
  type: 'play',
  handIndex,
  target,
});

describe('newRun under the G2 rules', () => {
  const s = newRun(7, 'wheat', CONTENT, RULES_G2);

  it('starts with gold, the rules, no conquests and the chosen deck', () => {
    expect(s.rules).toEqual(RULES_G2);
    expect(s.gold).toBe(RUN.startGold + RUN.taxPerYear); // year-1 tax is already in
    expect(s.rerollsThisYear).toBe(0);
    expect(s.purchasedPlots).toBe(0);
    expect(s.idleUids).toEqual([]);
    expect(s.stats).toMatchObject({ goldEarned: RUN.taxPerYear, conquered: 0 });
    expect(s.deck).toEqual(startDeck(CONTENT.king('wheat')));
    expect(sorted([...s.hand, ...s.drawPile, ...s.discardPile])).toEqual(sorted(s.deck));
  });

  it('picks two enemy kings that are not the player and marks them pending', () => {
    expect(s.enemyKings).toHaveLength(2);
    expect(s.enemyKings).not.toContain('wheat');
    for (const k of s.enemyKings) expect(s.enemies[k]).toEqual({ attacks: 0, status: 'pending' });
    expect(Object.keys(s.enemies).sort()).toEqual([...s.enemyKings].sort());
    expect(typeof s.rng.calendar).toBe('number');
  });

  it('gives the throne an empty enchant list and no permanent bonuses', () => {
    expect(s.plots[12]!.building).toMatchObject({ enchants: [], permanent: {} });
  });

  it('is deterministic per seed', () => {
    expect(newRun(7, 'wheat', CONTENT, RULES_G2)).toEqual(s);
  });

  it('keeps the G1 rules (and no enemy kings) by default', () => {
    const g1 = newRun(7, 'wheat', CONTENT);
    expect(g1.rules).toEqual(RULES_G1);
    expect(g1.enemyKings).toEqual([]);
    expect(g1.deck).toEqual([...START_DECK_G1]);
  });
});

describe('newRun', () => {
  it('builds year 1 planning state', () => {
    const s = newRun(7, 'wheat', CONTENT);
    expect(s.year).toBe(1);
    expect(s.phase).toBe('planning');
    expect(s.lives).toBe(3);
    expect(s.plots.filter((p) => p.unlocked)).toHaveLength(9);
    expect(s.plots[12]!.building!.cardId).toBe('wheat_throne');
    expect(s.plots[12]!.building!.uid).toBe(0);
    expect(s.deck).toEqual([...START_DECK_G1]);
    expect(s.hand).toHaveLength(3);
    for (const c of s.hand) expect(s.deck).toContain(c);
    expect(sorted([...s.hand, ...s.drawPile, ...s.discardPile])).toEqual(sorted(s.deck));
    expect(s.discardPile).toEqual([]);
    expect(s.drawPile).toHaveLength(s.deck.length - 3);
    expect(s.played).toBe(false);
    expect(s.nextUid).toBe(1);
    expect(s.won).toBeNull();
    expect(s.army).toEqual(composeArmy(roster, 10, 1, 7));
    expect(s.army!.budget).toBe(armyBudget(1, SLOT_MULT.raiders));
  });

  it('is deterministic and seed dependent', () => {
    expect(newRun(7, 'wheat', CONTENT)).toEqual(newRun(7, 'wheat', CONTENT));
    let differs = 0;
    const base = newRun(0, 'wheat', CONTENT);
    for (let seed = 1; seed <= 10; seed++) {
      const s = newRun(seed, 'wheat', CONTENT);
      if (
        JSON.stringify(s.hand) !== JSON.stringify(base.hand) ||
        JSON.stringify(s.army) !== JSON.stringify(base.army)
      ) {
        differs += 1;
      }
    }
    expect(differs).toBeGreaterThanOrEqual(1);
  });
});

describe('play / discard', () => {
  const hand: CardId[] = ['wheat_militia', 'neutral_barracks', 'neutral_move'];

  it('places a troop, keeps the other cards in hand and discards the played one', () => {
    const s = runState({ hand });
    const before = structuredClone(s);
    const r = ok(applyCommand(s, play(0, plot(6)), CONTENT));
    expect(s).toEqual(before);
    expect(r.state.plots[6]!.building).toEqual({
      uid: 1,
      cardId: 'wheat_militia',
      level: 1,
      enchants: [], placedYear: s.year, permanent: {}, ageBonus: 0, counters: {}, movedYear: null
    });
    expect(r.state.nextUid).toBe(2);
    expect(r.state.hand).toEqual(['neutral_barracks', 'neutral_move']);
    expect(r.state.discardPile).toEqual([...s.discardPile, 'wheat_militia']);
    expect(r.state.played).toBe(true);
    expect(r.state.deck).toEqual(s.deck);
    expect(r.events).toContainEqual({ type: 'cardPlayed', cardId: 'wheat_militia' });
  });

  it('clear land unlocks a locked plot that is not next to an open one', () => {
    const s = runState({ hand: ['neutral_clear_land'] });
    expect(s.plots[0]!.unlocked).toBe(false);
    const r = ok(applyCommand(s, play(0, plot(0)), CONTENT));
    expect(r.state.plots[0]!.unlocked).toBe(true);
  });

  it('clear land unlocks a plot', () => {
    const s = runState({ hand: ['neutral_clear_land'] });
    const r = ok(applyCommand(s, play(0, plot(1)), CONTENT));
    expect(r.state.plots[1]!.unlocked).toBe(true);
    expect(r.state.nextUid).toBe(1);
  });

  it('move relocates and swaps', () => {
    const base = runState({ hand: ['neutral_move'] });
    const b7 = { uid: 1, cardId: 'wheat_militia' as CardId, level: 1 as const, enchants: [], placedYear: 1, permanent: {}, ageBonus: 0, counters: {}, movedYear: null };
    const b6 = { uid: 2, cardId: 'neutral_barracks' as CardId, level: 1 as const, enchants: [], placedYear: 1, permanent: {}, ageBonus: 0, counters: {}, movedYear: null };
    const plots = structuredClone(base.plots);
    plots[7]!.building = b7;
    const moved = ok(applyCommand({ ...base, plots }, play(0, two(7, 6)), CONTENT));
    expect(moved.state.plots[6]!.building).toEqual(b7);
    expect(moved.state.plots[7]!.building).toBeNull();

    plots[6]!.building = b6;
    const swapped = ok(applyCommand({ ...base, plots }, play(0, two(7, 6)), CONTENT));
    expect(swapped.state.plots[6]!.building).toEqual(b7);
    expect(swapped.state.plots[7]!.building).toEqual(b6);
  });

  it('discard sells exactly the chosen card, keeps the others and counts as the action', () => {
    const s = runState({ hand });
    const before = structuredClone(s);
    const r = ok(applyCommand(s, { type: 'discard', handIndex: 1 }, CONTENT));
    expect(s).toEqual(before);
    expect(r.state.played).toBe(true);
    expect(r.state.hand).toEqual(['wheat_militia', 'neutral_move']);
    expect(r.state.discardPile).toEqual([...s.discardPile, 'neutral_barracks']);
    expect(r.state.plots).toEqual(s.plots);
  });

  it('discard rejects a bad index, a second action and a wrong phase', () => {
    expect(errorOf(runState({ hand }), { type: 'discard', handIndex: 3 })).toBe('badTarget');
    expect(errorOf(runState({ hand }), { type: 'discard', handIndex: -1 })).toBe('badTarget');
    expect(errorOf(runState({ hand, played: true }), { type: 'discard', handIndex: 0 })).toBe(
      'alreadyPlayed',
    );
    expect(errorOf(runState({ hand, phase: 'reward' }), { type: 'discard', handIndex: 0 })).toBe(
      'wrongPhase',
    );
  });
});

describe('errors', () => {
  const hand: CardId[] = ['wheat_militia', 'neutral_barracks', 'neutral_move'];

  it('phase and played errors', () => {
    expect(errorOf(runState({ hand: [], played: true }), play(0, plot(6)))).toBe('alreadyPlayed');
    expect(errorOf(runState({ hand, phase: 'battle' }), play(0, plot(6)))).toBe('wrongPhase');
    expect(errorOf(runState({ hand }), { type: 'startBattle' })).toBe('notPlayed');
    expect(errorOf(runState({ hand }), { type: 'pickOffer', index: 0 })).toBe('wrongPhase');
    expect(errorOf(runState({ hand }), { type: 'advance' })).toBe('wrongPhase');
    expect(errorOf(runState({ hand }), { type: 'battleResult', result: result(true) })).toBe(
      'wrongPhase',
    );
    expect(errorOf(runState({ hand, phase: 'yearEnd' }), { type: 'startBattle' })).toBe(
      'wrongPhase',
    );
  });

  it('badTarget for bad hand index', () => {
    expect(errorOf(runState({ hand }), play(5, plot(6)))).toBe('badTarget');
    expect(errorOf(runState({ hand }), play(-1, plot(6)))).toBe('badTarget');
  });

  it('pickOffer out of range', () => {
    const s = runState({
      phase: 'reward',
      offers: { kind: 'reward', cardIds: ['neutral_move', 'neutral_move', 'neutral_move'] },
    });
    expect(errorOf(s, { type: 'pickOffer', index: 3 })).toBe('badTarget');
    expect(errorOf(s, { type: 'pickOffer', index: -1 })).toBe('badTarget');
  });

  it('checkPlay reasons', () => {
    const s = runState({ hand });
    expect(errorOf(s, play(0, plot(0)))).toBe('locked');
    expect(errorOf(s, play(0, plot(12)))).toBe('throne');
    expect(errorOf(s, play(0, { kind: 'none' }))).toBe('badTarget');
    expect(errorOf(s, play(2, two(7, 6)))).toBe('noTarget');
    const occ = runState({ hand });
    occ.plots[6]!.building = { uid: 1, cardId: 'wheat_scarecrow', level: 1, enchants: [], placedYear: 1, permanent: {}, ageBonus: 0, counters: {}, movedYear: null };
    expect(errorOf(occ, play(0, plot(6)))).toBe('occupied');
    expect(errorOf(occ, play(2, two(7, 6)))).toBe('noBuilding');
    const clear = runState({ hand: ['neutral_clear_land'] });
    expect(errorOf(clear, play(0, plot(6)))).toBe('badTarget');
  });
});

describe('gold', () => {
  const rich = (over: Partial<RunState> = {}): RunState => runState({ gold: 20, ...over });

  it('adds the yearly tax when a year starts', () => {
    const lost = ok(
      applyCommand(
        { ...rich({ gold: 7 }), phase: 'battle', hand: [], played: true },
        { type: 'battleResult', result: result(false) },
        CONTENT,
      ),
    ).state;
    const next = ok(applyCommand(lost, { type: 'advance' }, CONTENT)).state;
    expect(next.gold).toBe(7 + RUN.taxPerYear);
    expect(next.stats.goldEarned).toBe(lost.stats.goldEarned + RUN.taxPerYear);
  });

  it('reroll costs 1, 2, 4 and moves the whole hand to the discard pile', () => {
    let s = rich();
    const oldHand = s.hand;
    for (const cost of [1, 2, 4]) {
      const before = s.gold;
      s = ok(applyCommand(s, { type: 'reroll' }, CONTENT)).state;
      expect(s.gold).toBe(before - cost);
    }
    expect(s.rerollsThisYear).toBe(3);
    expect(s.hand).toHaveLength(3);
    expect(sorted([...s.hand, ...s.drawPile, ...s.discardPile])).toEqual(sorted(s.deck));
    expect(oldHand).toHaveLength(3);
    expect(rerollCost(s.rerollsThisYear + 1)).toBe(8);
  });

  it('reroll is refused without enough gold, after the action and outside planning', () => {
    expect(errorOf(rich({ gold: 0 }), { type: 'reroll' })).toBe('notEnoughGold');
    expect(errorOf(rich({ gold: 3, rerollsThisYear: 2, paidRerollsThisYear: 2 }), { type: 'reroll' })).toBe('notEnoughGold');
    expect(errorOf(rich({ played: true }), { type: 'reroll' })).toBe('alreadyPlayed');
    expect(errorOf(rich({ phase: 'battle' }), { type: 'reroll' })).toBe('wrongPhase');
  });

  it('discard pays skipPlayGold', () => {
    const s = rich();
    const r = ok(applyCommand(s, { type: 'discard', handIndex: 0 }, CONTENT)).state;
    expect(r.gold).toBe(s.gold + RUN.skipPlayGold);
    expect(r.stats.goldEarned).toBe(s.stats.goldEarned + RUN.skipPlayGold);
  });

  it('unlockPlot buys an adjacent locked plot at 4, then 6, without using the action', () => {
    let s = rich();
    s = ok(applyCommand(s, { type: 'unlockPlot', plot: 1 }, CONTENT)).state;
    expect(s.plots[1]!.unlocked).toBe(true);
    expect(s.gold).toBe(20 - unlockCost(0));
    expect(s.purchasedPlots).toBe(1);
    expect(s.played).toBe(false);
    s = ok(applyCommand(s, { type: 'unlockPlot', plot: 2 }, CONTENT)).state;
    expect(s.gold).toBe(20 - unlockCost(0) - unlockCost(1));
    expect(s.purchasedPlots).toBe(2);
  });

  it('unlockPlot rejects a plot that is not adjacent, already open, out of range or unaffordable', () => {
    expect(errorOf(rich(), { type: 'unlockPlot', plot: 0 })).toBe('notAdjacent');
    expect(errorOf(rich(), { type: 'unlockPlot', plot: 6 })).toBe('badTarget');
    expect(errorOf(rich(), { type: 'unlockPlot', plot: 99 })).toBe('badTarget');
    expect(errorOf(rich({ gold: 3 }), { type: 'unlockPlot', plot: 1 })).toBe('notEnoughGold');
    expect(errorOf(rich({ phase: 'battle' }), { type: 'unlockPlot', plot: 1 })).toBe('wrongPhase');
  });

  it('a won battle pays battleGold(year); skipping the reward pays skipRewardGold', () => {
    const s = rich({ phase: 'battle', hand: [], played: true, year: 4 });
    const won = ok(applyCommand(s, { type: 'battleResult', result: result(true) }, CONTENT)).state;
    expect(won.gold).toBe(20 + battleGold(4));
    expect(won.stats.goldEarned).toBe(s.stats.goldEarned + battleGold(4));
    const skipped = ok(applyCommand(won, { type: 'pickOffer', index: null }, CONTENT)).state;
    expect(skipped.gold).toBe(won.gold + RUN.skipRewardGold + RUN.taxPerYear);
  });

  it('a lost battle pays no battle gold', () => {
    const s = rich({ phase: 'battle', hand: [], played: true });
    const lost = ok(applyCommand(s, { type: 'battleResult', result: result(false) }, CONTENT)).state;
    expect(lost.gold).toBe(20);
  });

  it('income from economy buildings and idle upkeep are applied at the start of a year', () => {
    const well = {
      id: 'neutral_well' as const,
      owner: 'neutral' as const,
      nameVi: 'Giếng',
      name: 'Well',
      kind: 'economy' as const,
      rarity: 'common' as const,
      tags: [],
      textVi: 'Giếng',
      effects: [{ type: 'gold' as const, amount: [1, 2, 3, 4, 5] as const }],
    };
    const c = contentWith({ cards: [well] });
    const s = rich({ phase: 'yearEnd', gold: 10 });
    s.plots[6]!.building = {
      uid: 5,
      cardId: 'neutral_well',
      level: 3,
      enchants: [],
      placedYear: 1,
      permanent: {}, ageBonus: 0, counters: {}, movedYear: null,
    };
    const next = ok(applyCommand(s, { type: 'advance' }, c)).state;
    expect(next.gold).toBe(10 + RUN.taxPerYear + 3);
    expect(next.idleUids).toEqual([]);
  });
});

describe('startBattle legality and auto-fire setting', () => {
  const allOpen = (): RunState => {
    const s = runState({ hand: ['neutral_clear_land'] });
    return { ...s, plots: s.plots.map((p) => ({ ...p, unlocked: true })) };
  };

  it('is allowed without an action when no card in hand has a target', () => {
    const r = ok(applyCommand(allOpen(), { type: 'startBattle' }, CONTENT));
    expect(r.state.phase).toBe('battle');
  });

  it('still needs an action while some card in hand is playable', () => {
    expect(errorOf(runState({ hand: ['wheat_militia'] }), { type: 'startBattle' })).toBe('notPlayed');
  });

  it('setAutoFire flips the flag in any phase except ended and survives the next year', () => {
    const s = runState();
    expect(s.autoFire).toBe(false);
    const on = ok(applyCommand(s, { type: 'setAutoFire', on: true }, CONTENT)).state;
    expect(on.autoFire).toBe(true);
    const inBattle = ok(
      applyCommand({ ...on, hand: [], played: true, phase: 'battle' }, { type: 'setAutoFire', on: false }, CONTENT),
    ).state;
    expect(inBattle.autoFire).toBe(false);
    expect(errorOf(runState({ phase: 'ended' }), { type: 'setAutoFire', on: true })).toBe('wrongPhase');

    const lost = ok(
      applyCommand(
        { ...on, hand: [], played: true, phase: 'battle' },
        { type: 'battleResult', result: result(false) },
        CONTENT,
      ),
    ).state;
    const next = ok(applyCommand(lost, { type: 'advance' }, CONTENT)).state;
    expect(next.autoFire).toBe(true);
  });
});

describe('a hand with no playable card', () => {
  const stuck = (): RunState => {
    // Every free plot is built on, so the three building cards in hand have no target.
    const s = runState({
      phase: 'yearEnd',
      hand: ['wheat_militia', 'neutral_barracks', 'neutral_archer_tower'],
      played: true,
    });
    const plots = s.plots.map((p, i) =>
      p.unlocked && i !== 12
        ? { ...p, building: { uid: i + 10, cardId: 'wheat_scarecrow' as const, level: 1 as const, enchants: [], placedYear: 1, permanent: {}, ageBonus: 0, counters: {}, movedYear: null } }
        : p,
    );
    return {
      ...s,
      plots,
      drawPile: ['neutral_clear_land', 'neutral_move', 'wheat_scarecrow'],
      discardPile: [],
    };
  };

  it('is recycled into the discard pile at the next year so other cards can reach the hand', () => {
    const s = stuck();
    const next = ok(applyCommand(s, { type: 'advance' }, CONTENT)).state;
    expect(sorted(next.hand)).toEqual(sorted(['neutral_clear_land', 'neutral_move', 'wheat_scarecrow']));
    expect(sorted(next.discardPile)).toEqual(
      sorted(['wheat_militia', 'neutral_barracks', 'neutral_archer_tower']),
    );
    expect(sorted([...next.hand, ...next.drawPile, ...next.discardPile])).toEqual(
      sorted([...s.hand, ...s.drawPile, ...s.discardPile]),
    );
  });

  it('keeps a hand in which at least one card is playable', () => {
    const s = { ...stuck(), hand: ['wheat_militia', 'neutral_clear_land'] as CardId[], drawPile: ['neutral_move', 'wheat_scarecrow'] as CardId[] };
    const next = ok(applyCommand(s, { type: 'advance' }, CONTENT)).state;
    expect(next.hand.slice(0, 2)).toEqual(['wheat_militia', 'neutral_clear_land']);
    expect(next.discardPile).toEqual([]);
  });
});

describe('battle flow', () => {
  const planned = (over: Partial<RunState> = {}): RunState =>
    runState({ hand: [], played: true, ...over });

  it('startBattle after the action', () => {
    const r = ok(applyCommand(planned(), { type: 'startBattle' }, CONTENT));
    expect(r.state.phase).toBe('battle');
  });

  it('win at year 3 gives 3 offers and advances rng.reward', () => {
    const s = planned({ phase: 'battle', year: 3 });
    const r = ok(applyCommand(s, { type: 'battleResult', result: result(true, 7) }, CONTENT));
    expect(r.state.phase).toBe('reward');
    expect(cardOffer(r.state)!.cardIds).toHaveLength(3);
    expect(r.state.stats.battlesWon).toBe(1);
    expect(r.state.stats.kills).toBe(7);
    expect(r.state.rng.reward).not.toBe(s.rng.reward);
    expect(r.events).toContainEqual({ type: 'battleEnded', won: true });
  });

  it('loss with 3 lives goes to yearEnd then advance', () => {
    const s = planned({ phase: 'battle' });
    const r = ok(applyCommand(s, { type: 'battleResult', result: result(false) }, CONTENT));
    expect(r.state.lives).toBe(2);
    expect(r.state.phase).toBe('yearEnd');
    expect(r.state.offers).toBeNull();
    expect(r.state.stats.battlesLost).toBe(1);
    const n = ok(applyCommand(r.state, { type: 'advance' }, CONTENT));
    expect(n.state.year).toBe(s.year + 1);
    expect(n.state.phase).toBe('planning');
    expect(n.state.hand).toHaveLength(3);
    expect(n.state.played).toBe(false);
    expect(n.state.army).toEqual(
      composeArmy(roster, armyBudget(2, SLOT_MULT.raiders), 2, s.seed),
    );
    expect(n.events).toContainEqual({ type: 'yearStarted', year: 2 });
  });

  it('loss with 1 life ends the run', () => {
    const s = planned({ phase: 'battle', lives: 1 });
    const r = ok(applyCommand(s, { type: 'battleResult', result: result(false) }, CONTENT));
    expect(r.state.phase).toBe('ended');
    expect(r.state.won).toBe(false);
    expect(r.state.lives).toBe(0);
    expect(r.events).toContainEqual({ type: 'runEnded', won: false });
  });

  it('win at final year ends with victory and no offers', () => {
    const s = planned({ phase: 'battle', year: RULES_G1.years });
    const r = ok(applyCommand(s, { type: 'battleResult', result: result(true) }, CONTENT));
    expect(r.state.phase).toBe('ended');
    expect(r.state.won).toBe(true);
    expect(r.state.offers).toBeNull();
    expect(r.events).toContainEqual({ type: 'runEnded', won: true });
  });

  it('loss at final year with lives left still wins the run (spec 3.10)', () => {
    const s = planned({ phase: 'battle', year: RULES_G1.years, lives: 3 });
    const r = ok(applyCommand(s, { type: 'battleResult', result: result(false) }, CONTENT));
    expect(r.state.phase).toBe('ended');
    expect(r.state.won).toBe(true);
    expect(r.state.lives).toBe(2);
    expect(r.state.stats.battlesLost).toBe(1);
  });

  it('loss at final year with 1 life loses the run', () => {
    const s = planned({ phase: 'battle', year: RULES_G1.years, lives: 1 });
    const r = ok(applyCommand(s, { type: 'battleResult', result: result(false) }, CONTENT));
    expect(r.state.won).toBe(false);
    expect(r.state.lives).toBe(0);
  });
});

describe('rewards', () => {
  const reward = (): RunState => {
    const s = runState({ phase: 'battle', hand: [], played: true, year: 3 });
    return ok(applyCommand(s, { type: 'battleResult', result: result(true) }, CONTENT)).state;
  };

  it('pickOffer 0 appends to the deck and starts next year', () => {
    const s = reward();
    const r = ok(applyCommand(s, { type: 'pickOffer', index: 0 }, CONTENT));
    expect(r.state.deck).toHaveLength(12);
    expect(r.state.deck[11]).toBe(cardOffer(s)!.cardIds[0]);
    const picked = cardOffer(s)!.cardIds[0]!;
    expect(
      [...r.state.hand, ...r.state.drawPile, ...r.state.discardPile].filter((c) => c === picked),
    ).toHaveLength(r.state.deck.filter((c) => c === picked).length);
    expect(r.state.phase).toBe('planning');
    expect(r.state.year).toBe(4);
    expect(r.state.offers).toBeNull();
  });

  it('the chosen reward is in the next hand right away, not buried in the discard pile', () => {
    for (const index of [0, 1, 2]) {
      const s = reward();
      const chosen = cardOffer(s)!.cardIds[index]!;
      const next = ok(applyCommand(s, { type: 'pickOffer', index }, CONTENT)).state;
      expect(next.hand).toContain(chosen);
      expect(next.hand).toHaveLength(3);
      expect(sorted([...next.hand, ...next.drawPile, ...next.discardPile])).toEqual(sorted(next.deck));
    }
  });

  it('under the G1 rules the reward cards come only from the G1 card set', () => {
    const g1 = new Set<string>(START_DECK_G1);
    for (let year = 1; year <= 9; year++) {
      for (let seed = 1; seed <= 6; seed++) {
        const s = ok(
          applyCommand(
            runState({
              phase: 'battle',
              hand: [],
              played: true,
              year,
              rng: { draw: seed, reward: seed * 7919, calendar: 1, council: 2, quest: 3 },
            }),
            { type: 'battleResult', result: result(true) },
            CONTENT,
          ),
        ).state;
        for (const id of cardOffer(s)!.cardIds) expect(g1.has(id), `${id} in G1 rewards`).toBe(true);
      }
    }
  });

  it('pickOffer null skips', () => {
    const s = reward();
    const r = ok(applyCommand(s, { type: 'pickOffer', index: null }, CONTENT));
    expect(r.state.deck).toEqual(s.deck);
    expect(r.state.year).toBe(4);
    expect(r.state.phase).toBe('planning');
  });
});

describe('full run', () => {
  const drive = (): RunState[] => {
    const states: RunState[] = [];
    let s = newRun(11, 'wheat', CONTENT);
    const step = (cmd: RunCommand): void => {
      s = ok(applyCommand(s, cmd, CONTENT)).state;
      states.push(s);
    };
    for (let guard = 0; guard < 100 && s.phase !== 'ended'; guard++) {
      if (s.phase === 'planning') {
        step({ type: 'discard', handIndex: 0 });
        step({ type: 'startBattle' });
      } else if (s.phase === 'battle') {
        step({ type: 'battleResult', result: result(true) });
      } else if (s.phase === 'reward') {
        step({ type: 'pickOffer', index: 0 });
      }
    }
    return states;
  };

  it('plays 10 years to victory, deterministically', () => {
    const a = drive();
    const last = a[a.length - 1]!;
    expect(last.phase).toBe('ended');
    expect(last.won).toBe(true);
    expect(last.year).toBe(10);
    expect(drive()).toEqual(a);
  });
});

describe('rng persistence', () => {
  const lostBattle = (): RunState =>
    ok(
      applyCommand(
        runState({ phase: 'battle', hand: [], played: true }),
        { type: 'battleResult', result: result(false) },
        CONTENT,
      ),
    ).state;

  it('newRun advances draw state but not reward state', () => {
    const s = newRun(7, 'wheat', CONTENT);
    expect(s.rng.draw).not.toBe(hashSeed('7:draw'));
    expect(s.rng.reward).toBe(hashSeed('7:reward'));
  });

  it('advance persists the draw state: unchanged without a reshuffle, advanced with one', () => {
    const ye = lostBattle();
    expect(ye.drawPile.length).toBeGreaterThanOrEqual(3);
    const plain = ok(applyCommand(ye, { type: 'advance' }, CONTENT)).state;
    expect(plain.rng.draw).toBe(ye.rng.draw);

    const dry = { ...ye, hand: [], drawPile: [], discardPile: [...ye.deck] };
    const shuffled = ok(applyCommand(dry, { type: 'advance' }, CONTENT)).state;
    expect(shuffled.rng.draw).not.toBe(ye.rng.draw);
    expect(sorted([...shuffled.hand, ...shuffled.drawPile])).toEqual(sorted(ye.deck));
  });

  it('a won battle advances the reward stream', () => {
    const won = ok(
      applyCommand(
        runState({ phase: 'battle', hand: [], played: true, year: 3 }),
        { type: 'battleResult', result: result(true) },
        CONTENT,
      ),
    ).state;
    expect(won.rng.reward).not.toBe(runState().rng.reward);
  });

  it('next hand equals refillHand from the persisted state', () => {
    const ye = lostBattle();
    const expected = refillHand(ye.hand, ye.drawPile, ye.discardPile, new Rng(ye.rng.draw), 3);
    const adv = ok(applyCommand(ye, { type: 'advance' }, CONTENT)).state;
    expect(adv.hand).toEqual(expected.hand);
    expect(adv.drawPile).toEqual(expected.drawPile);
    expect(adv.discardPile).toEqual(expected.discardPile);
  });

  it('keeps an unplayed card in hand into the next year and only tops the hand up', () => {
    let s = runState({ hand: ['wheat_militia', 'neutral_barracks', 'neutral_move'] });
    s = ok(applyCommand(s, play(0, plot(6)), CONTENT)).state;
    s = ok(applyCommand(s, { type: 'startBattle' }, CONTENT)).state;
    s = ok(applyCommand(s, { type: 'battleResult', result: result(false) }, CONTENT)).state;
    const next = ok(applyCommand(s, { type: 'advance' }, CONTENT)).state;
    expect(next.hand.slice(0, 2)).toEqual(['neutral_barracks', 'neutral_move']);
    expect(next.hand).toHaveLength(3);
  });
});

describe('extra error branches', () => {
  it('rejects commands in wrong phases', () => {
    const cases: [RunState, RunCommand][] = [
      [runState({ phase: 'reward', offers: null }), { type: 'pickOffer', index: 0 }],
      [runState({ phase: 'ended' }), { type: 'advance' }],
      [runState({ phase: 'reward' }), { type: 'advance' }],
      [runState({ phase: 'ended', played: true }), { type: 'startBattle' }],
      [runState({ phase: 'ended' }), { type: 'discard', handIndex: 0 }],
    ];
    for (const [s, cmd] of cases) expect(errorOf(s, cmd)).toBe('wrongPhase');
  });

  it('battleResult twice: second is wrongPhase', () => {
    const s = runState({ phase: 'battle', hand: [], played: true });
    const first = ok(applyCommand(s, { type: 'battleResult', result: result(false) }, CONTENT));
    expect(errorOf(first.state, { type: 'battleResult', result: result(false) })).toBe(
      'wrongPhase',
    );
  });

  it('battleResult win is deterministic', () => {
    const s = runState({ phase: 'battle', hand: [], played: true, year: 3 });
    const cmd: RunCommand = { type: 'battleResult', result: result(true) };
    const a = ok(applyCommand(s, cmd, CONTENT));
    const b = ok(applyCommand(s, cmd, CONTENT));
    expect(a).toEqual(b);
    expect(a.state.offers).toEqual(b.state.offers);
  });
});

describe('G3 commands and offers outside their phase', () => {
  const cmds: RunCommand[] = [
    { type: 'chooseDecree', index: 0 },
    { type: 'setCouncilSelection', selection: { plots: [], cardId: null, deckIndices: [] } },
    { type: 'enactDecree' },
    { type: 'answerQuest', accept: true },
  ];

  it.each(cmds)('%j is wrongPhase while planning', (cmd) => {
    expect(applyCommand(runState(), cmd, CONTENT)).toEqual({ error: 'wrongPhase' });
  });

  it('pickOffer refuses a council or quest offer', () => {
    const base = runState();
    const council = {
      ...base,
      phase: 'reward' as const,
      offers: {
        kind: 'council' as const,
        decreeIds: ['decree_treasury' as const],
        selected: null,
        selection: { plots: [], cardId: null, deckIndices: [] },
      },
    };
    expect(applyCommand(council, { type: 'pickOffer', index: 0 }, CONTENT)).toEqual({ error: 'wrongPhase' });
    const quest = {
      ...base,
      phase: 'reward' as const,
      offers: { kind: 'quest' as const, questId: 'quest_untouched' as const },
    };
    expect(applyCommand(quest, { type: 'pickOffer', index: null }, CONTENT)).toEqual({ error: 'wrongPhase' });
  });
});
