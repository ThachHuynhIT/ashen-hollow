import { describe, expect, it } from 'vitest';
import { DECREES } from '../../data/decrees';
import { RUN } from '../../data/run';
import { RULES_G2 } from '../../data/rules';
import type { CardId, DecreeId } from '../../data/types';
import { CONTENT } from '../cards/registry';
import { applyCommand } from './commands';
import { enactDecree, rollCouncil, selectDecree, setCouncilSelection } from './council';
import type { CouncilSelection, OfferState, RunCommand, RunState } from './state';
import { newRun } from './yearFlow';

const EMPTY: CouncilSelection = { plots: [], cardId: null, deckIndices: [] };
const ALL = DECREES.map((d) => d.id);

const base = (over: Partial<RunState> = {}): RunState => ({
  ...newRun(11, 'wheat', CONTENT, RULES_G2),
  phase: 'yearEnd',
  ...over,
});

/** A state whose council offer is already open on `ids` (first one is index 0). */
const council = (ids: DecreeId[], over: Partial<RunState> = {}): RunState => ({
  ...base(over),
  phase: 'council',
  offers: { kind: 'council', decreeIds: ids, selected: null, selection: { ...EMPTY } },
});

const ok = (r: ReturnType<typeof applyCommand>): RunState => {
  if ('error' in r) throw new Error(`illegal: ${r.error}`);
  return r.state;
};
const run = (s: RunState, cmd: RunCommand): RunState => ok(applyCommand(s, cmd, CONTENT));

/** Choose decree 0 of the open offer, apply `selection` when given, then enact. */
const enact = (s: RunState, selection?: CouncilSelection): RunState => {
  let cur = run(s, { type: 'chooseDecree', index: 0 });
  if (selection) cur = run(cur, { type: 'setCouncilSelection', selection });
  return run(cur, { type: 'enactDecree' });
};

const offerOf = (s: RunState) => {
  if (s.offers?.kind !== 'council') throw new Error('no council offer');
  return s.offers;
};

describe('rollCouncil', () => {
  it.each(RUN.councilYears)('roll_three_unowned: year %i offers 3 unique decrees not yet owned', (year) => {
    const owned: DecreeId[] = ['decree_trade', 'decree_moat'];
    const s = base({ year, decrees: owned });
    const rolled = rollCouncil(s);
    const offer = offerOf(rolled);
    expect(rolled.phase).toBe('council');
    expect(offer.decreeIds).toHaveLength(3);
    expect(new Set(offer.decreeIds).size).toBe(3);
    for (const id of offer.decreeIds) {
      expect(ALL).toContain(id);
      expect(owned).not.toContain(id);
    }
    expect(offer.selected).toBeNull();
    expect(offer.selection).toEqual(EMPTY);
  });

  it('changes only the council rng and is reproducible from the same state (no reroll on reload)', () => {
    const s = base({ year: 5 });
    const a = rollCouncil(s);
    const b = rollCouncil(structuredClone(s));
    expect(b).toEqual(a);
    expect(a.rng.council).not.toBe(s.rng.council);
    expect({ ...a.rng, council: 0 }).toEqual({ ...s.rng, council: 0 });
    expect(s.offers).toBeNull(); // input untouched
    // the persisted offer is what a reload sees: nothing in it is recomputed
    const reloaded: RunState = JSON.parse(JSON.stringify(a));
    expect(offerOf(reloaded).decreeIds).toEqual(offerOf(a).decreeIds);
  });

  it('queues behind an offer that is already open', () => {
    const open = rollCouncil(base({ year: 5, offers: { kind: 'reward', cardIds: [], }, phase: 'reward' }));
    expect(open.offers?.kind).toBe('reward');
    expect(open.pendingOffers.map((o) => o.kind)).toEqual(['council']);
  });
});

describe('choosing', () => {
  it('choose_not_enact: choosing only records the pick', () => {
    const s = council(['decree_treasury', 'decree_moat', 'decree_trade']);
    const next = run(s, { type: 'chooseDecree', index: 1 });
    expect(offerOf(next).selected).toBe('decree_moat');
    expect(next.gold).toBe(s.gold);
    expect(next.plots).toEqual(s.plots);
    expect(next.decrees).toEqual([]);
    expect(next.phase).toBe('council');
  });

  it('rejects a bad index and a wrong phase without touching the input', () => {
    const s = council(['decree_treasury', 'decree_moat', 'decree_trade']);
    expect(selectDecree(s, 3)).toBe('badTarget');
    expect(selectDecree(s, -1)).toBe('badTarget');
    expect(selectDecree(s, 0.5)).toBe('badTarget');
    expect(applyCommand(base(), { type: 'chooseDecree', index: 0 }, CONTENT)).toEqual({ error: 'wrongPhase' });
  });

  it('choosing another decree clears a half-made selection', () => {
    const s = run(council(['decree_expand_borders', 'decree_purge', 'decree_trade']), { type: 'chooseDecree', index: 0 });
    const withPlot = run(s, { type: 'setCouncilSelection', selection: { ...EMPTY, plots: [1] } });
    expect(offerOf(withPlot).selection.plots).toEqual([1]);
    const other = run(withPlot, { type: 'chooseDecree', index: 1 });
    expect(offerOf(other).selection).toEqual(EMPTY);
  });

  it('enacting without a choice is refused', () => {
    const s = council(['decree_treasury', 'decree_moat', 'decree_trade']);
    expect(enactDecree(s, CONTENT)).toBe('badTarget');
  });
});

describe('immediate_decrees', () => {
  it.each([
    [4, 5],
    [5, 5],
  ])('recast crown: throne level %i -> %i, building stays in sync', (from, to) => {
    const s = council(['decree_recast_crown', 'decree_moat', 'decree_trade'], { throneLevel: from as 4 | 5 });
    s.plots[12]!.building!.level = from as 4 | 5;
    const next = enact(s);
    expect(next.throneLevel).toBe(to);
    expect(next.plots[12]!.building!.level).toBe(to);
    expect(next.decrees).toEqual(['decree_recast_crown']);
  });

  it('treasury: +15 gold, counted as earned', () => {
    const s = council(['decree_treasury', 'decree_moat', 'decree_trade'], { gold: 7 });
    const next = enact(s);
    expect(next.gold).toBe(22);
    expect(next.stats.goldEarned).toBe(s.stats.goldEarned + 15);
  });

  it.each([
    [3, 4, 0],
    [4, 4, 10],
  ])('amnesty: lives %i -> %i, +%i gold at the cap', (from, to, bonus) => {
    const s = council(['decree_amnesty', 'decree_moat', 'decree_trade'], { lives: from, gold: 0 });
    const next = enact(s);
    expect(next.lives).toBe(to);
    expect(next.gold).toBe(bonus);
  });

  it.each([
    [3, 4],
    [4, 4],
  ])('rune festival: first enchant stacks %i -> %i, the second enchant is left alone', (from, to) => {
    const s = council(['decree_rune_festival', 'decree_moat', 'decree_trade']);
    s.plots[6] = {
      unlocked: true,
      building: {
        uid: 5,
        cardId: 'wheat_militia' as CardId,
        level: 1,
        enchants: [
          { cardId: 'wheat_sharpen' as CardId, stacks: from - 1 },
          { cardId: 'wheat_fortify' as CardId, stacks: 1 },
        ],
        placedYear: 1,
        permanent: {},
        ageBonus: 0,
        counters: {},
        movedYear: null,
      },
    };
    const next = enact(s);
    const e = next.plots[6]!.building!.enchants;
    // total stacks cap is 4: from 3 (2 + 1) -> 4, already 4 (3 + 1) -> stays 4
    expect(e[0]!.stacks + e[1]!.stacks).toBe(to);
    expect(e[1]!.stacks).toBe(1);
  });

  it('a permanent-only decree is simply recorded', () => {
    const next = enact(council(['decree_harvest_tax', 'decree_moat', 'decree_trade']));
    expect(next.decrees).toEqual(['decree_harvest_tax']);
  });
});

describe('expansion_transaction', () => {
  const expand = () => run(council(['decree_expand_borders', 'decree_moat', 'decree_trade']), { type: 'chooseDecree', index: 0 });

  it('re-checks adjacency after the first plot opens, without touching purchasedPlots', () => {
    const s = expand();
    expect(s.plots[0]!.unlocked).toBe(false);
    // plot 0 touches no open plot yet: refused alone and as the first of a pair
    expect(setCouncilSelection(s, { ...EMPTY, plots: [0] }, CONTENT)).toBe('badTarget');
    expect(setCouncilSelection(s, { ...EMPTY, plots: [0, 1] }, CONTENT)).toBe('badTarget');
    const ok2 = run(s, { type: 'setCouncilSelection', selection: { ...EMPTY, plots: [1, 0] } });
    const next = run(ok2, { type: 'enactDecree' });
    expect(next.plots[1]!.unlocked).toBe(true);
    expect(next.plots[0]!.unlocked).toBe(true);
    expect(next.purchasedPlots).toBe(s.purchasedPlots);
    expect(next.decrees).toEqual(['decree_expand_borders']);
  });

  it('refuses a duplicate, an open plot, a bad second plot and a third plot; input stays intact', () => {
    const s = expand();
    const before = structuredClone(s);
    for (const plots of [[1, 1], [6], [1, 24], [1, 2, 3], [-1], [99], [1.5]]) {
      expect(setCouncilSelection(s, { ...EMPTY, plots }, CONTENT), JSON.stringify(plots)).toBe('badTarget');
    }
    expect(s).toEqual(before);
  });

  it('refuses to enact an incomplete selection', () => {
    const half = run(expand(), { type: 'setCouncilSelection', selection: { ...EMPTY, plots: [1] } });
    expect(enactDecree(half, CONTENT)).toBe('badTarget');
    expect(half.decrees).toEqual([]);
  });

  it('needs only one plot when a single locked plot is left, and none on a full board', () => {
    const one = expand();
    one.plots = one.plots.map((p, i) => ({ ...p, unlocked: i !== 0 }));
    const picked = run(one, { type: 'setCouncilSelection', selection: { ...EMPTY, plots: [0] } });
    expect(run(picked, { type: 'enactDecree' }).plots[0]!.unlocked).toBe(true);
    expect(enactDecree(one, CONTENT)).toBe('badTarget'); // still needs that one plot

    const full = expand();
    full.plots = full.plots.map((p) => ({ ...p, unlocked: true }));
    const next = run(full, { type: 'enactDecree' }); // no-op target still confirms
    expect(next.decrees).toEqual(['decree_expand_borders']);
  });
});

describe('academy', () => {
  const rares = CONTENT.king('wheat').cards.filter((c) => c.rarity === 'rare').map((c) => c.id);

  it('offers exactly the two rare cards of the king; the pick enters deck and top of the draw pile', () => {
    expect(rares).toHaveLength(2);
    const s = run(council(['decree_academy', 'decree_moat', 'decree_trade']), { type: 'chooseDecree', index: 0 });
    expect(setCouncilSelection(s, { ...EMPTY, cardId: 'neutral_move' as CardId }, CONTENT)).toBe('badTarget');
    expect(setCouncilSelection(s, EMPTY, CONTENT)).not.toBe('badTarget'); // empty is a legal draft
    expect(enactDecree(s, CONTENT)).toBe('badTarget'); // but cannot be enacted
    const picked = run(s, { type: 'setCouncilSelection', selection: { ...EMPTY, cardId: rares[1]! } });
    const next = run(picked, { type: 'enactDecree' });
    expect(next.deck).toEqual([...s.deck, rares[1]]);
    expect(next.drawPile[0]).toBe(rares[1]);
    expect(next.played).toBe(s.played); // not a play
    expect([...next.hand, ...next.drawPile, ...next.discardPile].sort()).toEqual([...next.deck].sort());
  });
});

describe('purge_duplicates', () => {
  const M = 'wheat_militia' as CardId;
  const S = 'wheat_scarecrow' as CardId;
  const deckState = (): RunState =>
    council(['decree_purge', 'decree_moat', 'decree_trade'], {
      deck: [M, M, S, 'neutral_move' as CardId, 'neutral_barracks' as CardId],
      hand: [M],
      drawPile: [S, M],
      discardPile: ['neutral_move' as CardId, 'neutral_barracks' as CardId],
    });

  it('removes exactly the two chosen copies, hand first then draw pile; the rest stays', () => {
    const s = run(deckState(), { type: 'chooseDecree', index: 0 });
    const picked = run(s, { type: 'setCouncilSelection', selection: { ...EMPTY, deckIndices: [1, 0] } });
    expect(offerOf(picked).selection.deckIndices).toEqual([0, 1]); // normalised
    const next = run(picked, { type: 'enactDecree' });
    expect(next.deck).toEqual([S, 'neutral_move', 'neutral_barracks']);
    expect(next.hand).toEqual([]);
    expect(next.drawPile).toEqual([S]);
    expect(next.discardPile).toEqual(['neutral_move', 'neutral_barracks']);
    expect([...next.hand, ...next.drawPile, ...next.discardPile].sort()).toEqual([...next.deck].sort());
  });

  it('removes only one copy when one is chosen, and zero is legal', () => {
    const s = run(deckState(), { type: 'chooseDecree', index: 0 });
    const one = run(run(s, { type: 'setCouncilSelection', selection: { ...EMPTY, deckIndices: [2] } }), { type: 'enactDecree' });
    expect(one.deck).toHaveLength(4);
    expect(one.deck.filter((c) => c === M)).toHaveLength(2);
    expect(one.deck.filter((c) => c === S)).toHaveLength(0);
    const none = run(s, { type: 'enactDecree' });
    expect(none.deck).toEqual(deckState().deck);
    expect(none.decrees).toEqual(['decree_purge']);
  });

  it('refuses bad indices, more than two, and leaving fewer than 3 cards', () => {
    const s = run(deckState(), { type: 'chooseDecree', index: 0 });
    for (const deckIndices of [[0, 0], [5], [-1], [0, 1, 2], [0.5]]) {
      expect(setCouncilSelection(s, { ...EMPTY, deckIndices }, CONTENT), JSON.stringify(deckIndices)).toBe('badTarget');
    }
    const small = run(
      council(['decree_purge', 'decree_moat', 'decree_trade'], {
        deck: [M, S, 'neutral_move' as CardId, 'neutral_barracks' as CardId],
        hand: [M],
        drawPile: [S],
        discardPile: ['neutral_move' as CardId, 'neutral_barracks' as CardId],
      }),
      { type: 'chooseDecree', index: 0 },
    );
    expect(setCouncilSelection(small, { ...EMPTY, deckIndices: [0, 1] }, CONTENT)).toBe('badTarget'); // would leave 2
    expect(setCouncilSelection(small, { ...EMPTY, deckIndices: [0] }, CONTENT)).not.toBe('badTarget');
  });
});

describe('finishing a council step', () => {
  it('double_enact: a second enact is the wrong phase and adds nothing', () => {
    const s = council(['decree_treasury', 'decree_moat', 'decree_trade'], { gold: 0 });
    const once = enact(s);
    expect(once.gold).toBe(15);
    expect(applyCommand(once, { type: 'enactDecree' }, CONTENT)).toEqual({ error: 'wrongPhase' });
    expect(once.decrees).toEqual(['decree_treasury']);
  });

  it('ends at yearEnd with no offer, or opens the next queued offer unchanged', () => {
    const idle = enact(council(['decree_treasury', 'decree_moat', 'decree_trade']));
    expect(idle.phase).toBe('yearEnd');
    expect(idle.offers).toBeNull();
    const next: OfferState = { kind: 'reward', cardIds: ['neutral_move' as CardId] };
    const queued = enact(council(['decree_treasury', 'decree_moat', 'decree_trade'], { pendingOffers: [next] }));
    expect(queued.offers).toEqual(next);
    expect(queued.pendingOffers).toEqual([]);
    expect(queued.phase).toBe('reward');
  });

  it('a refused command never consumes randomness or changes the state', () => {
    const s = council(['decree_expand_borders', 'decree_moat', 'decree_trade']);
    const chosen = run(s, { type: 'chooseDecree', index: 0 });
    const r = applyCommand(chosen, { type: 'setCouncilSelection', selection: { ...EMPTY, plots: [0] } }, CONTENT);
    expect(r).toEqual({ error: 'badTarget' });
    expect(chosen.rng).toEqual(s.rng);
  });
});
