import { describe, expect, it } from 'vitest';
import type { CardDef, CardId, CustomEffectId, EnchantCardDef, Level } from '../../data/types';
import type { StatHandler } from '../cards/custom/types';
import { CONTENT } from '../cards/registry';
import { contentWith, runState } from '../testing/fixtures';
import { collectStatSheet, emptySheet, finalStat } from './modifiers';
import type { BuildingState, RunState } from './state';

const base = { owner: 'neutral' as const, name: 'x', rarity: 'common' as const, tags: [], textVi: 'x' };

const militia: CardDef = {
  ...base,
  id: 'wheat_militia',
  nameVi: 'Dân Quân',
  kind: 'troop',
  effects: [{ type: 'spawn', unit: 'militia', count: [4, 6, 8, 10, 12] }],
};
const field: CardDef = {
  ...base,
  id: 'wheat_field',
  nameVi: 'Ruộng',
  kind: 'economy',
  effects: [
    { type: 'gold', amount: 1 },
    {
      type: 'stat',
      scope: 'neighbours',
      filter: { kinds: ['troop'] },
      stat: 'unitCount',
      mode: 'flat',
      value: [1, 1, 2, 2, 3],
    },
  ],
};
const scarecrow: CardDef = {
  ...base,
  id: 'wheat_scarecrow',
  nameVi: 'Bù nhìn',
  kind: 'tower',
  effects: [],
};
const quarry: CardDef = {
  ...base,
  id: 'stone_quarry',
  nameVi: 'Mỏ',
  kind: 'economy',
  effects: [
    { type: 'stat', scope: 'board', filter: { kinds: ['tower'] }, stat: 'dmg', mode: 'pct', value: 10 },
  ],
};
const golemFilter: CardDef = {
  ...base,
  id: 'stone_heart',
  nameVi: 'Tim',
  kind: 'tower',
  effects: [
    {
      type: 'stat',
      scope: 'self',
      filter: { unitTags: ['golem'] },
      stat: 'hp',
      mode: 'pct',
      value: 30,
    },
  ],
};
const enchant = (id: string, perStack: EnchantCardDef['perStack']): CardDef => ({
  ...base,
  id: id as CardId,
  nameVi: id,
  kind: 'enchantment',
  targets: ['troop', 'tower', 'economy', 'throne'],
  perStack,
});
const sharpen = enchant('neutral_sharpen', [{ type: 'stat', scope: 'self', stat: 'dmg', mode: 'pct', value: 15 }]);
const fortify = enchant('neutral_fortify', [{ type: 'stat', scope: 'self', stat: 'dmg', mode: 'pct', value: 20 }]);
const spark = enchant('arcane_spark', [{ type: 'stat', scope: 'self', stat: 'dmg', mode: 'flatPost', value: 2 }]);
const manure = enchant('wheat_manure', [
  { type: 'stat', scope: 'self', filter: { kinds: ['troop'] }, stat: 'unitCount', mode: 'flat', value: 1 },
  { type: 'stat', scope: 'self', filter: { kinds: ['economy'] }, stat: 'gold', mode: 'flat', value: 1 },
]);
const content = contentWith({ cards: [militia, field, scarecrow, quarry, golemFilter, sharpen, fortify, spark, manure] });

const bld = (
  uid: number,
  cardId: string,
  level: Level = 1,
  enchants: BuildingState['enchants'] = [],
  permanent: BuildingState['permanent'] = {},
): BuildingState => ({ uid, cardId: cardId as CardId, level, enchants, placedYear: 1, permanent, ageBonus: 0, counters: {}, movedYear: null });

const board = (built: [number, BuildingState][]): RunState => {
  const s = runState();
  const plots = s.plots.map((p) => ({ ...p }));
  for (const [plot, b] of built) plots[plot] = { ...plots[plot]!, unlocked: true, building: b };
  return { ...s, plots };
};

describe('finalStat', () => {
  it('is (base + flat) × (1 + pct/100) + flatPost', () => {
    expect(finalStat(100, { flat: 0, pct: 50, flatPost: 0 })).toBe(150);
    expect(finalStat(10, { flat: 5, pct: 20, flatPost: 0 })).toBeCloseTo(18);
    expect(finalStat(10, { flat: 0, pct: 50, flatPost: 2 })).toBe(17);
  });
});

describe('collectStatSheet', () => {
  it('is all zero for a building with no modifiers and for an empty plot', () => {
    const s = board([[6, bld(1, 'wheat_militia')]]);
    expect(collectStatSheet(s, content, 6)).toEqual(emptySheet());
    expect(collectStatSheet(s, content, 7)).toEqual(emptySheet());
  });

  it('applies neighbour effects at the source level and only to matching adjacent buildings', () => {
    const near = board([[6, bld(1, 'wheat_militia', 3)], [7, bld(2, 'wheat_field', 1)]]);
    expect(collectStatSheet(near, content, 6).unitCount.flat).toBe(1);
    const levelled = board([[6, bld(1, 'wheat_militia', 3)], [7, bld(2, 'wheat_field', 3)]]);
    expect(collectStatSheet(levelled, content, 6).unitCount.flat).toBe(2);
    const far = board([[6, bld(1, 'wheat_militia')], [8, bld(2, 'wheat_field')]]);
    expect(collectStatSheet(far, content, 6).unitCount.flat).toBe(0);
    const wrongKind = board([[6, bld(1, 'wheat_scarecrow')], [7, bld(2, 'wheat_field')]]);
    expect(collectStatSheet(wrongKind, content, 6).unitCount.flat).toBe(0);
    // a source never affects itself through the neighbours scope
    expect(collectStatSheet(near, content, 7).unitCount.flat).toBe(0);
  });

  it('applies board effects to every matching building wherever it stands', () => {
    const s = board([[6, bld(1, 'wheat_scarecrow')], [18, bld(2, 'stone_quarry')], [8, bld(3, 'wheat_militia')]]);
    expect(collectStatSheet(s, content, 6).dmg.pct).toBe(10);
    expect(collectStatSheet(s, content, 8).dmg.pct).toBe(0);
  });

  it('adds enchant stacks and different enchants together instead of multiplying', () => {
    const s = board([[6, bld(1, 'wheat_scarecrow', 1, [
      { cardId: 'neutral_sharpen', stacks: 2 },
      { cardId: 'neutral_fortify', stacks: 1 },
    ])]]);
    const sheet = collectStatSheet(s, content, 6);
    expect(sheet.dmg.pct).toBe(50);
    expect(finalStat(100, sheet.dmg)).toBe(150);
  });

  it('keeps flatPost separate and honours kind filters on enchants', () => {
    const s = board([
      [6, bld(1, 'wheat_scarecrow', 1, [{ cardId: 'arcane_spark', stacks: 2 }])],
      [7, bld(2, 'wheat_militia', 1, [{ cardId: 'wheat_manure', stacks: 3 }])],
      [16, bld(3, 'wheat_field', 1, [{ cardId: 'wheat_manure', stacks: 2 }])],
    ]);
    expect(collectStatSheet(s, content, 6).dmg).toEqual({ flat: 0, pct: 0, flatPost: 4 });
    expect(collectStatSheet(s, content, 7).unitCount.flat).toBe(3);
    expect(collectStatSheet(s, content, 7).gold.flat).toBe(0);
    expect(collectStatSheet(s, content, 16).gold.flat).toBe(2);
    expect(collectStatSheet(s, content, 16).unitCount.flat).toBe(0);
  });

  it('applies unitTags filters only when a matching unit is given', () => {
    const s = board([[6, bld(1, 'stone_heart')]]);
    const golem = CONTENT.allUnits()[0]!;
    const withTag = { ...golem, tags: ['golem' as const] };
    const without = { ...golem, tags: ['human' as const] };
    expect(collectStatSheet(s, content, 6).hp.pct).toBe(0);
    expect(collectStatSheet(s, content, 6, withTag).hp.pct).toBe(30);
    expect(collectStatSheet(s, content, 6, without).hp.pct).toBe(0);
  });

  it('adds the permanent bonuses of a building as percentages', () => {
    const s = board([[6, bld(1, 'wheat_scarecrow', 1, [], { dmg: 8 })]]);
    expect(collectStatSheet(s, content, 6).dmg.pct).toBe(8);
  });

  it('calls custom handlers for the (source, target) pair and applies what they return', () => {
    const custom: CardDef = {
      ...base,
      id: 'wheat_horde',
      nameVi: 'h',
      kind: 'troop',
      effects: [{ type: 'custom', id: 'peasant_horde', params: { k: [2, 2, 3, 3, 4] } }],
    };
    const c = contentWith({ cards: [militia, custom] });
    const seen: { src: number; tgt: number; level: Level; k: unknown }[] = [];
    const handlers: Partial<Record<CustomEffectId, StatHandler>> = {
      peasant_horde: (ctx, params) => {
        seen.push({ src: ctx.source.plot, tgt: ctx.target.plot, level: ctx.source.level, k: params.k });
        return ctx.source.plot === ctx.target.plot
          ? [{ stat: 'unitCount', mode: 'flat', value: 5 }]
          : [];
      },
    };
    const s = board([[6, bld(1, 'wheat_horde', 4)], [7, bld(2, 'wheat_militia')]]);
    expect(collectStatSheet(s, c, 6, undefined, handlers).unitCount.flat).toBe(5);
    expect(collectStatSheet(s, c, 7, undefined, handlers).unitCount.flat).toBe(0);
    expect(seen).toContainEqual({ src: 6, tgt: 6, level: 4, k: [2, 2, 3, 3, 4] });
    expect(seen).toContainEqual({ src: 6, tgt: 7, level: 4, k: [2, 2, 3, 3, 4] });
  });

  it('does not mutate the state', () => {
    const s = board([[6, bld(1, 'wheat_militia')], [7, bld(2, 'wheat_field')]]);
    const copy = structuredClone(s);
    collectStatSheet(s, content, 6);
    expect(s).toEqual(copy);
  });
});

describe('collectStatSheet with decrees', () => {
  const withDecrees = (decrees: RunState['decrees']): RunState => ({
    ...board([[6, bld(1, 'wheat_militia')]]),
    decrees,
  });

  it('applies decree modifiers board-wide and additively with the building own modifiers', () => {
    const s = withDecrees(['decree_royal_armory', 'decree_new_armor', 'decree_mobilize']);
    const sheet = collectStatSheet(s, content, 6);
    expect(sheet.dmg.pct).toBe(10);
    expect(sheet.hp.pct).toBe(15);
    expect(sheet.unitCount.flat).toBe(1);
  });

  it('never touches buildings of another kind, and does nothing with no decrees', () => {
    const s = { ...withDecrees(['decree_royal_armory']), plots: board([[6, bld(1, 'wheat_militia')], [7, bld(2, 'wheat_field')]]).plots };
    expect(collectStatSheet(s, content, 7).dmg.pct).toBe(0);
    expect(collectStatSheet(withDecrees([]), content, 6)).toEqual(emptySheet());
  });

  it('keeps permanent percentages after the decree layer (both add)', () => {
    const s = { ...withDecrees(['decree_royal_armory']), plots: board([[6, bld(1, 'wheat_militia', 1, [], { dmg: 5 })]]).plots };
    expect(collectStatSheet(s, content, 6).dmg.pct).toBe(15);
  });
});
