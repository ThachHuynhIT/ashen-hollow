import { describe, expect, it } from 'vitest';
import { RUN } from '../../data/run';
import type { CardDef, Level, TomeCardDef } from '../../data/types';
import { contentWith } from '../testing/fixtures';
import {
  THRONE_PLOT,
  attachEnchant,
  checkPlay,
  copyEnchants,
  hasAnyTarget,
  initialPlots,
  levelUpBuilding,
  moveBuilding,
  placeBuilding,
  sacrificeBuilding,
  targetCount,
} from './board';
import type { BuildingState, PlayTarget, PlotState } from './state';

const base = { owner: 'neutral' as const, name: 'x', rarity: 'common' as const, tags: [], textVi: 'x' };

const barracks: CardDef = { ...base, id: 'neutral_barracks', nameVi: 'Trại', kind: 'troop', effects: [] };
const tower: CardDef = { ...base, id: 'neutral_archer_tower', nameVi: 'Tháp', kind: 'tower', effects: [] };
const well: CardDef = { ...base, id: 'neutral_well', nameVi: 'Giếng', kind: 'economy', effects: [] };
const wall: CardDef = { ...base, id: 'neutral_wall', nameVi: 'Tường', kind: 'support', effects: [] };
const sharpen: CardDef = {
  ...base,
  id: 'neutral_sharpen',
  nameVi: 'Sắc',
  kind: 'enchantment',
  targets: ['troop', 'tower', 'throne'],
  perStack: [],
};
const fortify: CardDef = { ...sharpen, id: 'neutral_fortify', targets: ['troop', 'tower', 'support', 'throne'] };
const tome = (id: string, target: TomeCardDef['target'], actions: TomeCardDef['actions']): CardDef => ({
  ...base,
  id: id as CardDef['id'],
  nameVi: id,
  kind: 'tome',
  target,
  actions,
});
const promote = tome('neutral_promote', 'building', [{ type: 'levelUp', amount: 1 }]);
const demolish = tome('neutral_demolish', 'building', [{ type: 'sacrifice', goldPerLevel: 2 }]);
const festival = tome('wheat_festival', 'none', [{ type: 'custom', id: 'harvest_festival' }]);
const mirror = tome('arcane_mirror', 'buildingThenBuilding', [{ type: 'custom', id: 'mirror_enchants' }]);
const clearLand = tome('neutral_clear_land', 'lockedPlot', [{ type: 'unlockPlot', gold: 0 }]);
const content = contentWith({
  cards: [barracks, tower, well, wall, sharpen, fortify, promote, demolish, festival, mirror, clearLand],
});

const bld = (
  uid: number,
  cardId: string,
  level: Level = 1,
  enchants: BuildingState['enchants'] = [],
): BuildingState => ({
  uid,
  cardId: cardId as BuildingState['cardId'],
  level,
  enchants,
  placedYear: 1,
  permanent: {}, ageBonus: 0, counters: {}, movedYear: null,
});

const throne = (): PlotState[] =>
  placeBuilding(initialPlots(), THRONE_PLOT, bld(0, content.king('wheat').throne.id));

const plot = (n: number): PlayTarget => ({ kind: 'plot', plot: n });
const two = (first: number, second: number): PlayTarget => ({ kind: 'two', first, second });
const play = (plots: PlotState[], card: CardDef, target: PlayTarget) =>
  checkPlay(plots, card, target, content);

describe('building cards: placing and levelling by playing a duplicate', () => {
  const plots = placeBuilding(placeBuilding(throne(), 6, bld(1, 'neutral_barracks', 2)), 7, bld(2, 'neutral_barracks', 5));
  const withTower = placeBuilding(plots, 8, bld(3, 'neutral_archer_tower'));

  it('places on an empty open plot', () => {
    expect(play(plots, barracks, plot(11))).toBeNull();
    expect(play(plots, well, plot(11))).toBeNull();
    expect(play(plots, wall, plot(11))).toBeNull();
  });

  it('levels up a plot that already holds the same card (below level 5)', () => {
    expect(play(plots, barracks, plot(6))).toBeNull();
  });

  it('refuses a level-5 duplicate with maxLevel and a different card with occupied', () => {
    expect(play(plots, barracks, plot(7))).toBe('maxLevel');
    expect(play(withTower, barracks, plot(8))).toBe('occupied');
  });

  it('still rejects the throne and locked plots', () => {
    expect(play(plots, barracks, plot(12))).toBe('throne');
    expect(play(plots, barracks, plot(0))).toBe('locked');
  });

  it('has a target while a duplicate can still level up even if no plot is empty', () => {
    let full = throne();
    for (let i = 0; i < 25; i++) {
      if (full[i]!.unlocked && i !== THRONE_PLOT) full = placeBuilding(full, i, bld(i + 1, 'neutral_archer_tower', 5));
    }
    full = placeBuilding(full, 6, bld(99, 'neutral_barracks', 3));
    expect(hasAnyTarget(full, barracks, content)).toBe(true);
    full = placeBuilding(full, 6, bld(99, 'neutral_barracks', 5));
    expect(hasAnyTarget(full, barracks, content)).toBe(false);
    expect(play(full, barracks, plot(7))).toBe('noTarget');
  });
});

describe('enchantment cards', () => {
  const plots = placeBuilding(
    placeBuilding(
      placeBuilding(placeBuilding(throne(), 6, bld(1, 'neutral_barracks')), 7, bld(2, 'neutral_well')),
      8,
      bld(3, 'neutral_barracks', 1, [{ cardId: 'neutral_sharpen', stacks: RUN.maxEnchantStacks }]),
    ),
    11,
    bld(4, 'neutral_wall'),
  );

  it('attaches to a building of an allowed kind with room for a stack', () => {
    expect(play(plots, sharpen, plot(6))).toBeNull();
  });

  it('rejects a wrong kind, an empty plot, a locked plot and a full building', () => {
    expect(play(plots, sharpen, plot(7))).toBe('wrongKind');
    expect(play(plots, sharpen, plot(13))).toBe('noBuilding');
    expect(play(plots, sharpen, plot(0))).toBe('locked');
    expect(play(plots, sharpen, plot(8))).toBe('stacksFull');
  });

  it('counts stacks across different enchantments', () => {
    const mixed = placeBuilding(plots, 6, bld(1, 'neutral_barracks', 1, [
      { cardId: 'neutral_sharpen', stacks: 2 },
      { cardId: 'neutral_fortify', stacks: 2 },
    ]));
    expect(play(mixed, fortify, plot(6))).toBe('stacksFull');
  });

  it('targets the throne only when the card lists it', () => {
    expect(play(plots, sharpen, plot(12))).toBeNull();
    const noThrone: CardDef = { ...sharpen, targets: ['troop'] } as CardDef;
    expect(play(plots, noThrone, plot(12))).toBe('throne');
  });

  it('has no target on an empty board of the right kinds', () => {
    const only = placeBuilding(throne(), 7, bld(2, 'neutral_well'));
    const noThrone: CardDef = { ...sharpen, targets: ['troop'] } as CardDef;
    expect(hasAnyTarget(only, noThrone, content)).toBe(false);
    expect(play(only, noThrone, plot(7))).toBe('noTarget');
  });
});

describe('tome cards', () => {
  const plots = placeBuilding(
    placeBuilding(placeBuilding(throne(), 6, bld(1, 'neutral_barracks', 2)), 7, bld(2, 'neutral_archer_tower', 5)),
    8,
    bld(3, 'neutral_well'),
  );

  it('building tomes: promote needs a non-throne building below level 5', () => {
    expect(play(plots, promote, plot(6))).toBeNull();
    expect(play(plots, promote, plot(7))).toBe('maxLevel');
    expect(play(plots, promote, plot(12))).toBe('throne');
    expect(play(plots, promote, plot(11))).toBe('noBuilding');
    expect(play(plots, promote, plot(0))).toBe('locked');
  });

  it('demolish works at any level but not on the throne', () => {
    expect(play(plots, demolish, plot(7))).toBeNull();
    expect(play(plots, demolish, plot(12))).toBe('throne');
  });

  it('promote has no target when every building is at level 5 (but demolish still does)', () => {
    const maxed = placeBuilding(throne(), 7, bld(2, 'neutral_archer_tower', 5));
    expect(hasAnyTarget(maxed, promote, content)).toBe(false);
    expect(hasAnyTarget(maxed, demolish, content)).toBe(true);
  });

  it("'none' tomes take no target and reject any other", () => {
    expect(targetCount(festival)).toBe(0);
    expect(play(plots, festival, { kind: 'none' })).toBeNull();
    expect(play(plots, festival, plot(6))).toBe('badTarget');
    expect(hasAnyTarget(initialPlots(), festival, content)).toBe(true);
  });

  it('building-then-building needs two different buildings (the throne counts)', () => {
    expect(targetCount(mirror)).toBe(2);
    expect(play(plots, mirror, two(6, 7))).toBeNull();
    expect(play(plots, mirror, two(12, 6))).toBeNull();
    expect(play(plots, mirror, two(6, 6))).toBe('badTarget');
    expect(play(plots, mirror, two(6, 11))).toBe('noBuilding');
    expect(play(plots, mirror, two(0, 6))).toBe('locked');
    expect(play(plots, mirror, plot(6))).toBe('badTarget');
    expect(hasAnyTarget(throne(), mirror, content)).toBe(false);
    expect(play(throne(), mirror, two(12, 6))).toBe('noTarget');
  });

  it('keeps clear land free of the adjacency rule', () => {
    expect(play(plots, clearLand, plot(0))).toBeNull();
  });
});

describe('pure board operations', () => {
  const plots = placeBuilding(placeBuilding(throne(), 6, bld(1, 'neutral_barracks', 2, [{ cardId: 'neutral_sharpen', stacks: 1 }])), 7, bld(2, 'neutral_barracks'));

  it('levelUpBuilding adds levels, capped at the maximum, without mutating', () => {
    const before = structuredClone(plots);
    expect(levelUpBuilding(plots, 6, 1)[6]!.building!.level).toBe(3);
    expect(levelUpBuilding(plots, 6, 9)[6]!.building!.level).toBe(RUN.maxLevel);
    expect(plots).toEqual(before);
  });

  it('attachEnchant adds a stack to an existing entry or appends a new one in order', () => {
    const a = attachEnchant(plots, 6, 'neutral_sharpen', RUN.maxEnchantStacks);
    expect(a[6]!.building!.enchants).toEqual([{ cardId: 'neutral_sharpen', stacks: 2 }]);
    const b = attachEnchant(a, 6, 'neutral_fortify', RUN.maxEnchantStacks);
    expect(b[6]!.building!.enchants).toEqual([
      { cardId: 'neutral_sharpen', stacks: 2 },
      { cardId: 'neutral_fortify', stacks: 1 },
    ]);
  });

  it('sacrificeBuilding empties the plot but keeps it open, enchants gone', () => {
    const s = sacrificeBuilding(plots, 6);
    expect(s[6]).toEqual({ unlocked: true, building: null });
  });

  it('moveBuilding swaps buildings and keeps level and enchants', () => {
    const m = moveBuilding(plots, 6, 7);
    expect(m[7]!.building).toEqual(plots[6]!.building);
    expect(m[6]!.building).toEqual(plots[7]!.building);
    const empty = moveBuilding(plots, 6, 11);
    expect(empty[11]!.building).toEqual(plots[6]!.building);
    expect(empty[6]!.building).toBeNull();
  });

  it('copyEnchants copies every stack in order up to the cap, never above it', () => {
    const src = placeBuilding(plots, 6, bld(1, 'neutral_barracks', 1, [
      { cardId: 'neutral_sharpen', stacks: 3 },
      { cardId: 'neutral_fortify', stacks: 2 },
    ]));
    const out = copyEnchants(src, 6, 7, RUN.maxEnchantStacks);
    expect(out[7]!.building!.enchants).toEqual([
      { cardId: 'neutral_sharpen', stacks: 3 },
      { cardId: 'neutral_fortify', stacks: 1 },
    ]);
    expect(out[6]!.building!.enchants).toEqual(src[6]!.building!.enchants);
  });
});
