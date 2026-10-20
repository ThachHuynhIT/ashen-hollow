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

describe('Wheat King (spec §6.3)', () => {
  const wheat = CONTENT.king('wheat');
  const byRarity = (r: string) => wheat.cards.filter((c) => c.rarity === r).map((c) => c.id);

  it('has the throne and nine cards: 4 common, 3 uncommon, 2 rare, all with the wheat prefix', () => {
    expect(wheat.cards).toHaveLength(9);
    expect(byRarity('common').sort()).toEqual(
      ['wheat_militia', 'wheat_field', 'wheat_scarecrow', 'wheat_fertilizer'].sort(),
    );
    expect(byRarity('uncommon').sort()).toEqual(
      ['wheat_reapers', 'wheat_windmill', 'wheat_harvest_festival'].sort(),
    );
    expect(byRarity('rare').sort()).toEqual(['wheat_granary', 'wheat_peasant_horde'].sort());
    for (const c of wheat.cards) expect(c.id.startsWith('wheat_')).toBe(true);
    expect(wheat.throne).toMatchObject({ hp: 300, armor: 0 });
    expect(wheat.throne.attack).toMatchObject({ dmg: 8, range: 72, interval: 10, projectileSpeed: 8 });
  });

  it('has the Đông Như Kiến banner and the 50/25/25 roster with the peasant unit', () => {
    expect(wheat.banner.effects).toEqual([{ type: 'enemyCostPct', pct: -20 }]);
    expect(wheat.enemyRoster).toEqual([
      { unit: 'militia', weight: 50 },
      { unit: 'reaper', weight: 25 },
      { unit: 'peasant', weight: 25 },
    ]);
    expect(CONTENT.unit('peasant')).toMatchObject({ hp: 28, speed: 1.1, radius: 4, armor: 0, enemyCost: 0.8 });
    expect(CONTENT.unit('peasant').attack).toMatchObject({ dmg: 6, range: 2, interval: 10 });
  });

  it('Ruộng Lúa pays 1/1/2/2/3 gold and adds 1/1/2/2/3 units to neighbouring troop buildings', () => {
    const gold = [1, 1, 2, 2, 3];
    for (const level of [1, 2, 3, 4, 5] as const) {
      expect(incomeOf([[6, bld(1, 'wheat_field', level)]]).delta).toBe(gold[level - 1]);
      const s = setupOf([[6, bld(1, 'wheat_field', level)], [7, bld(2, 'wheat_militia', 1)]]);
      expect(structureAt(s, 7).spawn!.count).toBe(4 + gold[level - 1]!);
    }
    const apart = setupOf([[6, bld(1, 'wheat_field', 5)], [8, bld(2, 'wheat_militia', 1)]]);
    expect(structureAt(apart, 8).spawn!.count).toBe(4);
  });

  it('Bùa Phân Bón adds a unit per stack to troops and a gold per stack to economy buildings', () => {
    const manure = (n: number) => [{ cardId: 'wheat_fertilizer' as CardId, stacks: n }];
    expect(structureAt(setupOf([[6, bld(1, 'wheat_militia', 1, manure(3))]]), 6).spawn!.count).toBe(4 + 3);
    expect(incomeOf([[6, bld(1, 'wheat_field', 1, manure(2))]]).delta).toBe(1 + 2);
  });

  it('Cối Xay Gió pays 2/3/4/5/6 plus 1 per neighbouring field', () => {
    const base = [2, 3, 4, 5, 6];
    for (const level of [1, 2, 3, 4, 5] as const) {
      expect(incomeOf([[7, bld(1, 'wheat_windmill', level)]]).delta).toBe(base[level - 1]);
    }
    const two = incomeOf([[7, bld(1, 'wheat_windmill', 1)], [6, bld(2, 'wheat_field')], [8, bld(3, 'wheat_field')]]);
    expect(two.delta).toBe(2 + 2 + 1 + 1 + 1); // windmill, two neighbours, two fields' own gold, Mùa Gặt (2 fields → 1)
  });

  it('Lễ Hội Mùa Màng gives gold equal to the total level of all fields, at least 2', () => {
    const none = playOn([], ['wheat_harvest_festival'], { kind: 'none' }, { gold: 0 });
    expect(none.gold).toBe(2);
    const some = playOn([[6, bld(1, 'wheat_field', 1)], [8, bld(2, 'wheat_field', 3)]], ['wheat_harvest_festival'], { kind: 'none' }, { gold: 5 });
    expect(some.gold).toBe(5 + 4);
    expect(some.stats.goldEarned - RUN.taxPerYear).toBe(4); // minus the year-1 tax already counted
    expect(some.discardPile.at(-1)).toBe('wheat_harvest_festival');
  });

  it('Kho Thóc gives neighbouring troop buildings +15..35% unit HP and +1 gold per neighbouring field', () => {
    const pct = [15, 20, 25, 30, 35];
    const plain = structureAt(setupOf([[7, bld(2, 'wheat_militia')]]), 7).spawn!.stats.hp;
    for (const level of [1, 2, 3, 4, 5] as const) {
      const s = setupOf([[6, bld(1, 'wheat_granary', level)], [7, bld(2, 'wheat_militia')]]);
      expect(structureAt(s, 7).spawn!.stats.hp).toBeCloseTo(plain * (1 + pct[level - 1]! / 100), 9);
    }
    expect(incomeOf([[6, bld(1, 'wheat_granary')], [7, bld(2, 'wheat_field')], [11, bld(3, 'wheat_field')]]).delta).toBe(1 + 1 + 1 + 1 + 1); // granary x2 neighbours, two fields' own gold, Mùa Gặt (2 fields → 1)
  });

  it('Khởi Nghĩa Nông Dân spawns 4 + k × (number of fields), k = 2/2/3/3/4, capped at 20', () => {
    const fields = (n: number): [number, BuildingState][] =>
      [0, 1, 2, 3, 4, 5, 9, 10].slice(0, n).map((p, i) => [p, bld(10 + i, 'wheat_field')]);
    const k = [2, 2, 3, 3, 4];
    for (const level of [1, 2, 3, 4, 5] as const) {
      const s = setupOf([[18, bld(1, 'wheat_peasant_horde', level)], ...fields(3)]);
      expect(structureAt(s, 18).spawn!.count).toBe(4 + k[level - 1]! * 3);
      expect(structureAt(s, 18).spawn!.stats.unit).toBe('peasant');
    }
    expect(structureAt(setupOf([[18, bld(1, 'wheat_peasant_horde', 5)], ...fields(8)]), 18).spawn!.count).toBe(20);
    expect(structureAt(setupOf([[18, bld(1, 'wheat_peasant_horde', 1)]]), 18).spawn!.count).toBe(4);
  });

  it('Mùa Gặt: +1 gold per 2 fields (rounded down), per field from throne level 3', () => {
    const three: [number, BuildingState][] = [[6, bld(1, 'wheat_field')], [8, bld(2, 'wheat_field')], [16, bld(3, 'wheat_field')]];
    const fieldGold = 3; // each field pays 1 at level 1
    expect(incomeOf(three).delta).toBe(fieldGold + 1);
    expect(incomeOf(three, 0, { throneLevel: 3 }).delta).toBe(fieldGold + 3);
    expect(incomeOf([[6, bld(1, 'wheat_field')]]).delta).toBe(1);
  });
});
