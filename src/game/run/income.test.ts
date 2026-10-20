import { describe, expect, it } from 'vitest';
import type { BuildingCardDef, CardDef, Level } from '../../data/types';
import type { IncomeHandler } from '../cards/custom/types';
import { contentWith, runState } from '../testing/fixtures';
import { yearIncome } from './income';
import type { BuildingState, RunState } from './state';

const economy = (id: string, effects: BuildingCardDef['effects']): CardDef => ({
  id: id as CardDef['id'],
  owner: id.startsWith('wheat') ? 'wheat' : 'neutral',
  nameVi: id,
  name: id,
  kind: 'economy',
  rarity: 'common',
  tags: [],
  textVi: id,
  effects,
});

const well = economy('neutral_well', [{ type: 'gold', amount: [1, 2, 3, 4, 5] }]);
const field = economy('wheat_field', [{ type: 'gold', amount: [1, 1, 2, 2, 3] }]);
const windmill = economy('wheat_windmill', [
  { type: 'gold', amount: [2, 3, 4, 5, 6] },
  { type: 'goldPerNeighbour', cardId: 'wheat_field', amount: 1 },
]);
const camp: CardDef = {
  id: 'neutral_mercenary_camp',
  owner: 'neutral',
  nameVi: 'camp',
  name: 'camp',
  kind: 'troop',
  rarity: 'uncommon',
  tags: [],
  textVi: 'camp',
  effects: [{ type: 'custom', id: 'mercenary_upkeep', params: { gold: 1 } }],
};
const manure: CardDef = {
  id: 'wheat_manure',
  owner: 'wheat',
  nameVi: 'manure',
  name: 'manure',
  kind: 'enchantment',
  rarity: 'common',
  tags: [],
  textVi: 'manure',
  targets: ['economy'],
  perStack: [{ type: 'stat', scope: 'self', filter: { kinds: ['economy'] }, stat: 'gold', mode: 'flat', value: 1 }],
};
const content = contentWith({ cards: [well, field, windmill, camp, manure] });

const at = (
  state: RunState,
  placed: readonly [plot: number, cardId: string, level?: Level][],
): RunState => {
  const plots = state.plots.map((p) => ({ ...p }));
  placed.forEach(([plot, cardId, level], i) => {
    const b: BuildingState = {
      uid: i + 1,
      cardId: cardId as BuildingState['cardId'],
      level: level ?? 1,
      enchants: [],
      placedYear: 1,
      permanent: {},
    };
    plots[plot] = { ...plots[plot]!, unlocked: true, building: b };
  });
  return { ...state, plots };
};

const upkeep: Record<string, IncomeHandler> = { mercenary_upkeep: () => -1 };

describe('yearIncome', () => {
  it('is zero with no economy buildings', () => {
    expect(yearIncome(runState(), content, 5)).toEqual({ delta: 0, idleUids: [] });
  });

  it('pays the per-level amount of a gold effect', () => {
    for (const level of [1, 2, 3, 4, 5] as const) {
      const s = at(runState(), [[6, 'neutral_well', level]]);
      expect(yearIncome(s, content, 0).delta).toBe(level);
    }
  });

  it('adds goldPerNeighbour for each adjacent matching building only', () => {
    const s = at(runState(), [
      [7, 'wheat_windmill'],
      [6, 'wheat_field'], // west of 7
      [8, 'wheat_field'], // east of 7
      [10, 'wheat_field'], // not adjacent to 7
    ]);
    // windmill 2 + 2 neighbours × 1, plus three fields × 1 gold each
    expect(yearIncome(s, content, 0).delta).toBe(2 + 2 + 3);
  });

  it('pays a negative custom amount only when gold on hand covers it', () => {
    const s = at(runState(), [[6, 'neutral_mercenary_camp']]);
    expect(yearIncome(s, content, 0, upkeep)).toEqual({ delta: 0, idleUids: [1] });
    expect(yearIncome(s, content, 1, upkeep)).toEqual({ delta: -1, idleUids: [] });
  });

  it('serves buildings in plot order, so the first camp pays and the second goes idle', () => {
    const s = at(runState(), [
      [8, 'neutral_mercenary_camp'],
      [6, 'neutral_mercenary_camp'],
    ]);
    const r = yearIncome(s, content, 1, upkeep);
    expect(r.delta).toBe(-1);
    expect(r.idleUids).toEqual([1]); // uid 1 is on plot 8, uid 2 on plot 6 paid first
  });

  it('still counts positive income when the upkeep cannot be paid', () => {
    const s = at(runState(), [
      [6, 'neutral_well', 2],
      [8, 'neutral_mercenary_camp'],
    ]);
    expect(yearIncome(s, content, 0, upkeep)).toEqual({ delta: 2, idleUids: [2] });
  });

  it('adds gold granted by modifiers such as an enchantment on an economy building', () => {
    const s = at(runState(), [[6, 'neutral_well', 2]]);
    s.plots[6]!.building!.enchants = [{ cardId: 'wheat_manure', stacks: 3 }];
    expect(yearIncome(s, content, 0).delta).toBe(2 + 3);
  });

  it('never mutates the state', () => {
    const s = at(runState(), [[6, 'neutral_well']]);
    const before = structuredClone(s);
    yearIncome(s, content, 3);
    expect(s).toEqual(before);
  });
});
