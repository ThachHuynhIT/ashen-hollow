import { afterEach, describe, expect, it } from 'vitest';
import type { CardDef, CardId, Level, TomeCardDef } from '../../data/types';
import { CUSTOM_TOME_HANDLERS } from '../cards/custom';
import { contentWith, runState } from '../testing/fixtures';
import { applyCommand } from './commands';
import type { BuildingState, IllegalReason, PlayTarget, RunState } from './state';

const base = { owner: 'neutral' as const, name: 'x', rarity: 'common' as const, tags: [], textVi: 'x' };
const barracks: CardDef = { ...base, id: 'neutral_barracks', nameVi: 'Trại', kind: 'troop', effects: [] };
const well: CardDef = { ...base, id: 'neutral_well', nameVi: 'Giếng', kind: 'economy', effects: [] };
const sharpen: CardDef = {
  ...base,
  id: 'neutral_sharpen',
  nameVi: 'Sắc',
  kind: 'enchantment',
  targets: ['troop', 'tower', 'throne'],
  perStack: [],
};
const fortify: CardDef = { ...sharpen, id: 'neutral_fortify' };
const tome = (id: string, target: TomeCardDef['target'], actions: TomeCardDef['actions']): CardDef => ({
  ...base,
  id: id as CardId,
  nameVi: id,
  kind: 'tome',
  target,
  actions,
});
const promote = tome('neutral_promote', 'building', [{ type: 'levelUp', amount: 1 }]);
const demolish = tome('neutral_demolish', 'building', [{ type: 'sacrifice', goldPerLevel: 2 }]);
const move = tome('neutral_move', 'buildingThenPlot', [{ type: 'move', levelIfFar: 0 }]);
const festival = tome('wheat_festival', 'none', [{ type: 'custom', id: 'harvest_festival' }]);
const content = contentWith({ cards: [barracks, well, sharpen, fortify, promote, demolish, move, festival] });

const bld = (uid: number, cardId: string, level: Level = 1, enchants: BuildingState['enchants'] = []): BuildingState => ({
  uid,
  cardId: cardId as CardId,
  level,
  enchants,
  placedYear: 1,
  permanent: {}, ageBonus: 0, counters: {}, movedYear: null,
});

/** Planning state holding exactly `hand`, with buildings at the given plots. */
const state = (hand: string[], built: [number, BuildingState][] = []): RunState => {
  const s = runState({ hand: hand as CardId[], gold: 0 });
  const plots = s.plots.map((p) => ({ ...p }));
  for (const [plot, b] of built) plots[plot] = { ...plots[plot]!, building: b };
  return { ...s, plots, nextUid: 50 };
};

const play = (handIndex: number, target: PlayTarget) => ({ type: 'play' as const, handIndex, target });
const plot = (n: number): PlayTarget => ({ kind: 'plot', plot: n });
const run = (s: RunState, cmd: ReturnType<typeof play>): RunState => {
  const before = structuredClone(s);
  const r = applyCommand(s, cmd, content);
  expect(s).toEqual(before);
  if ('error' in r) throw new Error(`unexpected ${r.error}`);
  return r.state;
};
const fails = (s: RunState, cmd: ReturnType<typeof play>): IllegalReason => {
  const before = structuredClone(s);
  const r = applyCommand(s, cmd, content);
  expect(s).toEqual(before);
  if (!('error' in r)) throw new Error('expected an error');
  return r.error;
};

describe('playing a duplicate levels the building up', () => {
  it('+1 level, same uid, card goes to the discard pile', () => {
    const s = state(['neutral_barracks'], [[6, bld(7, 'neutral_barracks', 2)]]);
    const next = run(s, play(0, plot(6)));
    expect(next.plots[6]!.building).toMatchObject({ uid: 7, level: 3 });
    expect(next.nextUid).toBe(s.nextUid);
    expect(next.discardPile.at(-1)).toBe('neutral_barracks');
    expect(next.played).toBe(true);
  });

  it('a new building of an economy card starts at level 1 with empty enchants', () => {
    const next = run(state(['neutral_well']), play(0, plot(6)));
    expect(next.plots[6]!.building).toMatchObject({
      cardId: 'neutral_well',
      level: 1,
      enchants: [],
      permanent: {},
    });
  });

  it('level 5 duplicate is refused with maxLevel, a different card with occupied', () => {
    expect(fails(state(['neutral_barracks'], [[6, bld(7, 'neutral_barracks', 5)]]), play(0, plot(6)))).toBe('maxLevel');
    expect(fails(state(['neutral_well'], [[6, bld(7, 'neutral_barracks')]]), play(0, plot(6)))).toBe('occupied');
  });
});

describe('enchantments', () => {
  it('attaches one stack per play, in order of first attachment', () => {
    let s = state(['neutral_sharpen', 'neutral_fortify', 'neutral_sharpen'], [[6, bld(7, 'neutral_barracks')]]);
    s = run(s, play(0, plot(6)));
    expect(s.plots[6]!.building!.enchants).toEqual([{ cardId: 'neutral_sharpen', stacks: 1 }]);
    s = { ...s, played: false };
    s = run(s, play(0, plot(6)));
    s = { ...s, played: false };
    s = run(s, play(0, plot(6)));
    expect(s.plots[6]!.building!.enchants).toEqual([
      { cardId: 'neutral_sharpen', stacks: 2 },
      { cardId: 'neutral_fortify', stacks: 1 },
    ]);
  });

  it('refuses a fifth stack with stacksFull and the wrong kind with wrongKind', () => {
    const full = state(['neutral_sharpen'], [[6, bld(7, 'neutral_barracks', 1, [{ cardId: 'neutral_fortify', stacks: 4 }])]]);
    expect(fails(full, play(0, plot(6)))).toBe('stacksFull');
    expect(fails(state(['neutral_sharpen'], [[6, bld(7, 'neutral_well')]]), play(0, plot(6)))).toBe('wrongKind');
  });

  it('can target the throne when the card allows it', () => {
    const next = run(state(['neutral_sharpen']), play(0, plot(12)));
    expect(next.plots[12]!.building!.enchants).toEqual([{ cardId: 'neutral_sharpen', stacks: 1 }]);
  });
});

describe('tomes', () => {
  it('promote adds a level; at level 5 it is refused', () => {
    const next = run(state(['neutral_promote'], [[6, bld(7, 'neutral_barracks', 3)]]), play(0, plot(6)));
    expect(next.plots[6]!.building!.level).toBe(4);
    expect(fails(state(['neutral_promote', 'neutral_well'], [[6, bld(7, 'neutral_barracks', 5)], [7, bld(8, 'neutral_well', 5)]]), play(0, plot(6)))).toBe('noTarget');
  });

  it('demolish removes the building and its enchants and pays 2 gold per level', () => {
    const s = state(['neutral_demolish'], [[6, bld(7, 'neutral_barracks', 3, [{ cardId: 'neutral_sharpen', stacks: 2 }])]]);
    const next = run(s, play(0, plot(6)));
    expect(next.plots[6]).toEqual({ unlocked: true, building: null });
    expect(next.gold).toBe(s.gold + 6);
    expect(next.stats.goldEarned).toBe(s.stats.goldEarned + 6);
  });

  it('move keeps level and enchants and swaps with an occupied destination', () => {
    const a = bld(7, 'neutral_barracks', 3, [{ cardId: 'neutral_sharpen', stacks: 2 }]);
    const b = bld(8, 'neutral_well');
    const s = state(['neutral_move'], [[6, a], [7, b]]);
    const next = run(s, play(0, { kind: 'two', first: 6, second: 7 }));
    expect(next.plots[7]!.building).toEqual(a);
    expect(next.plots[6]!.building).toEqual(b);
    const toEmpty = run(state(['neutral_move'], [[6, a]]), play(0, { kind: 'two', first: 6, second: 8 }));
    expect(toEmpty.plots[8]!.building).toEqual(a);
    expect(toEmpty.plots[6]!.building).toBeNull();
  });

  describe('custom tomes', () => {
    afterEach(() => {
      delete CUSTOM_TOME_HANDLERS.harvest_festival;
    });

    it('run the registered handler and use the action', () => {
      CUSTOM_TOME_HANDLERS.harvest_festival = (s) => ({ ...s, gold: s.gold + 7 });
      const next = run(state(['wheat_festival']), play(0, { kind: 'none' }));
      expect(next.gold).toBe(7);
      expect(next.played).toBe(true);
      expect(next.discardPile.at(-1)).toBe('wheat_festival');
    });

    it('turn a handler refusal into that error and leave the state untouched', () => {
      CUSTOM_TOME_HANDLERS.harvest_festival = () => 'noTarget';
      expect(fails(state(['wheat_festival']), play(0, { kind: 'none' }))).toBe('noTarget');
    });

    it('are refused as badTarget when no handler is registered', () => {
      expect(fails(state(['wheat_festival']), play(0, { kind: 'none' }))).toBe('badTarget');
    });
  });
});
