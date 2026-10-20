/** Final stats of every G2 card through the real content (spec §6, §13.1 "mỗi thẻ có test hiệu ứng"). */
import { describe, expect, it } from 'vitest';
import { RUN } from '../../data/run';
import type { CardId, Level } from '../../data/types';
import { buildBattleSetup } from '../run/battleSetup';
import { applyCommand } from '../run/commands';
import { yearIncome } from '../run/income';
import type { BuildingState, PlayTarget, RunState } from '../run/state';
import { runState } from '../testing/fixtures';
import { describeCard } from './describe';
import { CONTENT } from './registry';

export const bld = (
  uid: number,
  cardId: string,
  level: Level = 1,
  enchants: BuildingState['enchants'] = [],
): BuildingState => ({
  uid,
  cardId: cardId as CardId,
  level,
  enchants,
  placedYear: 1,
  permanent: {},
});

/** A fresh run with `built` placed (plots opened as needed) and the given overrides. */
export const board = (built: [number, BuildingState][], over: Partial<RunState> = {}): RunState => {
  const s = runState(over);
  const plots = s.plots.map((p) => ({ ...p }));
  for (const [plot, b] of built) plots[plot] = { unlocked: true, building: b };
  return { ...s, plots };
};

export const setupOf = (built: [number, BuildingState][], over: Partial<RunState> = {}) =>
  buildBattleSetup(board(built, over), CONTENT);
export const structureAt = (s: ReturnType<typeof setupOf>, plot: number) =>
  s.structures.find((x) => x.plot === plot)!;
export const incomeOf = (built: [number, BuildingState][], gold = 0, over: Partial<RunState> = {}) =>
  yearIncome(board(built, over), CONTENT, gold);
export const playOn = (
  built: [number, BuildingState][],
  hand: CardId[],
  target: PlayTarget,
  over: Partial<RunState> = {},
): RunState => {
  const r = applyCommand(board(built, { hand, ...over }), { type: 'play', handIndex: 0, target }, CONTENT);
  if ('error' in r) throw new Error(`illegal: ${r.error}`);
  return r.state;
};
export const plot = (n: number): PlayTarget => ({ kind: 'plot', plot: n });

describe('neutral G2 cards (spec §6.1)', () => {
  it('has the six new cards with the spec kinds and rarities', () => {
    const want: [CardId, string, string][] = [
      ['neutral_well', 'economy', 'common'],
      ['neutral_mercenary_camp', 'troop', 'uncommon'],
      ['neutral_sharpen', 'enchantment', 'common'],
      ['neutral_fortify', 'enchantment', 'common'],
      ['neutral_promote', 'tome', 'common'],
      ['neutral_demolish', 'tome', 'common'],
    ];
    for (const [id, kind, rarity] of want) {
      expect(CONTENT.card(id)).toMatchObject({ kind, rarity, owner: 'neutral' });
    }
    expect(CONTENT.card('neutral_demolish').tags).toContain('sacrifice');
    expect(CONTENT.unit('mercenary')).toMatchObject({ hp: 60, speed: 1, radius: 5, armor: 0.1, enemyCost: 2 });
    expect(CONTENT.unit('mercenary').attack).toMatchObject({ dmg: 10, range: 2, interval: 10 });
  });

  it('puts all ten neutral cards into the reward pool', () => {
    const ids = CONTENT.neutralPool().map((c) => c.id);
    for (const id of [
      'neutral_barracks',
      'neutral_archer_tower',
      'neutral_clear_land',
      'neutral_move',
      'neutral_well',
      'neutral_mercenary_camp',
      'neutral_sharpen',
      'neutral_fortify',
      'neutral_promote',
      'neutral_demolish',
    ]) {
      expect(ids).toContain(id);
    }
  });

  it('Giếng Làng pays 1/2/3/4/5 gold a year', () => {
    for (const level of [1, 2, 3, 4, 5] as const) {
      expect(incomeOf([[6, bld(1, 'neutral_well', level)]]).delta).toBe(level);
    }
    expect(describeCard(CONTENT.card('neutral_well'), 3).lines[0]).toContain('3');
  });

  it('Trại Đánh Thuê spawns 2/3/3/4/5 mercenaries', () => {
    for (const level of [1, 2, 3, 4, 5] as const) {
      const s = setupOf([[6, bld(1, 'neutral_mercenary_camp', level)]]);
      expect(structureAt(s, 6).spawn!.count).toBe([2, 3, 3, 4, 5][level - 1]);
      expect(structureAt(s, 6).spawn!.stats.unit).toBe('mercenary');
    }
  });

  it('Trại Đánh Thuê costs 1 gold a year; without the gold the camp stays idle and spawns nobody', () => {
    const built: [number, BuildingState][] = [[6, bld(1, 'neutral_mercenary_camp', 3)]];
    expect(incomeOf(built, 1)).toEqual({ delta: -1, idleUids: [] });
    expect(incomeOf(built, 0)).toEqual({ delta: 0, idleUids: [1] });
    const idle = setupOf(built, { idleUids: [1] });
    expect(structureAt(idle, 6).spawn!.count).toBe(0);
  });

  it('Bùa Sắc Bén gives +15% damage per stack to troops, towers and the throne', () => {
    const sharpen = (n: number) => [{ cardId: 'neutral_sharpen' as CardId, stacks: n }];
    const plain = setupOf([[6, bld(1, 'wheat_militia')], [8, bld(2, 'wheat_scarecrow')]]);
    const one = setupOf([[6, bld(1, 'wheat_militia', 1, sharpen(1))], [8, bld(2, 'wheat_scarecrow', 1, sharpen(1))]]);
    const two = setupOf([[6, bld(1, 'wheat_militia', 1, sharpen(2))]]);
    expect(structureAt(one, 6).spawn!.stats.dmg).toBeCloseTo(structureAt(plain, 6).spawn!.stats.dmg * 1.15, 9);
    expect(structureAt(one, 8).attack!.dmg).toBeCloseTo(structureAt(plain, 8).attack!.dmg * 1.15, 9);
    expect(structureAt(two, 6).spawn!.stats.dmg).toBeCloseTo(structureAt(plain, 6).spawn!.stats.dmg * 1.3, 9);
    const throne = setupOf([], { plots: board([[12, { ...bld(0, 'wheat_throne', 1, sharpen(1)) }]]).plots });
    expect(throne.throne.attack!.dmg).toBeCloseTo(plain.throne.attack!.dmg * 1.15, 9);
  });

  it('Bùa Vững Chãi gives +20% unit HP and structure HP per stack', () => {
    const fort = (n: number) => [{ cardId: 'neutral_fortify' as CardId, stacks: n }];
    const plain = structureAt(setupOf([[6, bld(1, 'wheat_militia')]]), 6);
    const two = structureAt(setupOf([[6, bld(1, 'wheat_militia', 1, fort(2))]]), 6);
    expect(two.hp).toBeCloseTo(plain.hp * 1.4, 9);
    expect(two.spawn!.stats.hp).toBeCloseTo(plain.spawn!.stats.hp * 1.4, 9);
  });

  it('Thăng Cấp adds a level to a normal building but never to the throne', () => {
    const next = playOn([[6, bld(1, 'wheat_militia', 2)]], ['neutral_promote'], plot(6));
    expect(next.plots[6]!.building!.level).toBe(3);
    const r = applyCommand(
      board([], { hand: ['neutral_promote'] }),
      { type: 'play', handIndex: 0, target: plot(12) },
      CONTENT,
    );
    expect('error' in r).toBe(true);
  });

  it('Dỡ Bỏ removes the building and pays 2 gold per level', () => {
    const start = board([[6, bld(1, 'wheat_militia', 3, [{ cardId: 'neutral_sharpen', stacks: 2 }])]], {
      hand: ['neutral_demolish'],
      gold: 4,
    });
    const r = applyCommand(start, { type: 'play', handIndex: 0, target: plot(6) }, CONTENT);
    if ('error' in r) throw new Error(r.error);
    expect(r.state.plots[6]!.building).toBeNull();
    expect(r.state.gold).toBe(4 + 2 * 3);
    expect(RUN.maxEnchantStacks).toBe(4);
  });
});
