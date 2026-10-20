import { describe, expect, it } from 'vitest';
import type { CardDef, CardId, EnchantCardDef, Level } from '../../data/types';
import { CONTENT } from '../cards/registry';
import { contentWith, runState } from '../testing/fixtures';
import { buildBattleSetup } from './battleSetup';
import type { BuildingState, RunState } from './state';

const base = { owner: 'neutral' as const, name: 'x', rarity: 'common' as const, tags: [], textVi: 'x' };

const militia: CardDef = {
  ...base,
  id: 'wheat_militia',
  nameVi: 'Dân Quân',
  kind: 'troop',
  effects: [{ type: 'spawn', unit: 'militia', count: [4, 6, 8, 10, 12] }],
};
const tower: CardDef = {
  ...base,
  id: 'neutral_archer_tower',
  nameVi: 'Tháp',
  kind: 'tower',
  effects: [
    {
      type: 'tower',
      attack: { dmg: 7, type: 'physical', range: 88, interval: 12, projectileSpeed: 8 },
      targeting: 'closestToThrone',
    },
  ],
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
const well: CardDef = { ...base, id: 'neutral_well', nameVi: 'Giếng', kind: 'economy', effects: [{ type: 'gold', amount: 1 }] };
const wall: CardDef = {
  ...base,
  id: 'stone_wall',
  nameVi: 'Tường',
  kind: 'support',
  structureHp: [400, 550, 700, 850, 1000],
  effects: [{ type: 'stat', scope: 'self', stat: 'armor', mode: 'flat', value: 0.3 }],
};
const support: CardDef = { ...base, id: 'neutral_support', nameVi: 'Hỗ trợ', kind: 'support', effects: [] };
const enchant = (id: string, perStack: EnchantCardDef['perStack']): CardDef => ({
  ...base,
  id: id as CardId,
  nameVi: id,
  kind: 'enchantment',
  targets: ['troop', 'tower', 'economy', 'support', 'throne'],
  perStack,
});
const sharpen = enchant('neutral_sharpen', [{ type: 'stat', scope: 'self', stat: 'dmg', mode: 'pct', value: 15 }]);
const stoneskin = enchant('stone_stoneskin', [
  { type: 'stat', scope: 'self', stat: 'hp', mode: 'pct', value: 20 },
  { type: 'stat', scope: 'self', stat: 'structureHp', mode: 'pct', value: 20 },
  { type: 'stat', scope: 'self', stat: 'armor', mode: 'flat', value: 0.05 },
]);
const spark = enchant('arcane_spark', [{ type: 'stat', scope: 'self', stat: 'dmg', mode: 'flatPost', value: 2 }]);
const extreme = (id: string, stat: 'armor' | 'hp' | 'attackSpeed' | 'unitCount' | 'speed', mode: 'flat' | 'pct', value: number): CardDef =>
  enchant(id, [{ type: 'stat', scope: 'self', stat, mode, value }]);
const cards = [militia, tower, field, well, wall, support, sharpen, stoneskin, spark,
  extreme('neutral_x_armor', 'armor', 'flat', 1),
  extreme('neutral_x_hp', 'hp', 'pct', -90),
  extreme('neutral_x_speed_attack', 'attackSpeed', 'pct', 500),
  extreme('neutral_x_count_up', 'unitCount', 'flat', 100),
  extreme('neutral_x_count_down', 'unitCount', 'flat', -100),
  extreme('neutral_x_speed', 'speed', 'pct', -95),
];
const content = contentWith({ cards });

const bld = (uid: number, cardId: string, level: Level = 1, enchants: BuildingState['enchants'] = []): BuildingState => ({
  uid,
  cardId: cardId as CardId,
  level,
  enchants,
  placedYear: 1,
  permanent: {},
});

const board = (built: [number, BuildingState][], over: Partial<RunState> = {}): RunState => {
  const s = runState(over);
  const plots = s.plots.map((p) => ({ ...p }));
  for (const [plot, b] of built) plots[plot] = { ...plots[plot]!, unlocked: true, building: b };
  return { ...s, plots };
};
const setupOf = (built: [number, BuildingState][], over: Partial<RunState> = {}) =>
  buildBattleSetup(board(built, over), content);
const at = (setup: ReturnType<typeof setupOf>, plot: number) => setup.structures.find((s) => s.plot === plot)!;

describe('level scaling (spec §5.2)', () => {
  it('scales troop HP and DMG by TROOP_STD', () => {
    const l1 = at(setupOf([[6, bld(1, 'wheat_militia', 1)]]), 6).spawn!.stats;
    const l3 = at(setupOf([[6, bld(1, 'wheat_militia', 3)]]), 6).spawn!.stats;
    expect(l3.hp).toBeCloseTo(l1.hp * 1.5, 9);
    expect(l3.dmg).toBeCloseTo(l1.dmg * 1.5, 9);
    expect(at(setupOf([[6, bld(1, 'wheat_militia', 5)]]), 6).spawn!.stats.hp).toBeCloseTo(l1.hp * 2, 9);
  });

  it('uses the per-level spawn count', () => {
    for (const level of [1, 2, 3, 4, 5] as const) {
      expect(at(setupOf([[6, bld(1, 'wheat_militia', level)]]), 6).spawn!.count).toBe([4, 6, 8, 10, 12][level - 1]);
    }
  });

  it('scales tower damage by TOWER_STD and adds TOWER_RANGE', () => {
    const t5 = at(setupOf([[6, bld(1, 'neutral_archer_tower', 5)]]), 6).attack!;
    expect(t5.dmg).toBeCloseTo(7 * 2.4, 9);
    expect(t5.range).toBe(88 + 16);
    const t1 = at(setupOf([[6, bld(1, 'neutral_archer_tower', 1)]]), 6).attack!;
    expect(t1.dmg).toBe(7);
    expect(t1.range).toBe(88);
  });

  it('scales structure HP by STRUCT_STD, except cards with their own table', () => {
    expect(at(setupOf([[6, bld(1, 'wheat_militia', 3)]]), 6).hp).toBe(225);
    expect(at(setupOf([[6, bld(1, 'neutral_archer_tower', 2)]]), 6).hp).toBeCloseTo(275, 9);
    expect(at(setupOf([[6, bld(1, 'neutral_well')]]), 6).hp).toBe(120);
    expect(at(setupOf([[6, bld(1, 'neutral_support')]]), 6).hp).toBe(160);
    expect(at(setupOf([[6, bld(1, 'stone_wall', 3)]]), 6).hp).toBe(700);
  });

  it('scales the throne HP and DMG by THRONE_STD at the throne level', () => {
    const l1 = setupOf([]).throne;
    const l3 = setupOf([], { throneLevel: 3 }).throne;
    expect(l3.hp).toBeCloseTo(l1.hp * 1.5, 9);
    expect(l3.attack!.dmg).toBeCloseTo(l1.attack!.dmg * 1.5, 9);
  });

  it('lists economy and support buildings as non-attacking structures, ordered by plot', () => {
    const s = setupOf([[8, bld(1, 'neutral_well')], [6, bld(2, 'neutral_support')], [7, bld(3, 'wheat_militia')]]);
    expect(s.structures.map((x) => x.plot)).toEqual([6, 7, 8]);
    for (const plot of [6, 8]) {
      const st = at(s, plot);
      expect(st.attack).toBeNull();
      expect(st.spawn).toBeNull();
    }
  });
});

describe('modifiers in the setup', () => {
  it('Dân Quân L3 next to a Ruộng Lúa L1 spawns 8 + 1 = 9', () => {
    const s = setupOf([[6, bld(1, 'wheat_militia', 3)], [7, bld(2, 'wheat_field', 1)]]);
    expect(at(s, 6).spawn!.count).toBe(9);
  });

  it('adds percentages (sharpen ×2 = +30%) and applies flatPost after them', () => {
    const base = at(setupOf([[6, bld(1, 'wheat_militia')]]), 6).spawn!.stats.dmg;
    const two = at(setupOf([[6, bld(1, 'wheat_militia', 1, [{ cardId: 'neutral_sharpen', stacks: 2 }])]]), 6).spawn!.stats.dmg;
    expect(two).toBeCloseTo(base * 1.3, 9);
    const t = at(setupOf([[6, bld(1, 'neutral_archer_tower', 1, [
      { cardId: 'neutral_sharpen', stacks: 1 },
      { cardId: 'arcane_spark', stacks: 1 },
    ])]]), 6).attack!;
    expect(t.dmg).toBeCloseTo(7 * 1.15 + 2, 9);
  });

  it('Stoneskin raises unit HP, structure HP and armor', () => {
    const plain = at(setupOf([[6, bld(1, 'wheat_militia')]]), 6);
    const skinned = at(setupOf([[6, bld(1, 'wheat_militia', 1, [{ cardId: 'stone_stoneskin', stacks: 1 }])]]), 6);
    expect(skinned.hp).toBeCloseTo(plain.hp * 1.2, 9);
    expect(skinned.spawn!.stats.hp).toBeCloseTo(plain.spawn!.stats.hp * 1.2, 9);
    expect(skinned.spawn!.stats.armor).toBeCloseTo(plain.spawn!.stats.armor + 0.05, 9);
  });

  it('gives armor to the structure itself for non-troop buildings', () => {
    expect(at(setupOf([[6, bld(1, 'stone_wall', 1)]]), 6).armor).toBeCloseTo(0.3, 9);
    expect(at(setupOf([[6, bld(1, 'neutral_archer_tower', 1, [{ cardId: 'stone_stoneskin', stacks: 1 }])]]), 6).armor).toBeCloseTo(0.05, 9);
  });

  it('does not depend on how the buildings were listed, only on their plots', () => {
    const a = setupOf([[6, bld(1, 'wheat_militia')], [8, bld(2, 'neutral_archer_tower')]]);
    const b = setupOf([[8, bld(2, 'neutral_archer_tower')], [6, bld(1, 'wheat_militia')]]);
    expect(a).toEqual(b);
  });

  it('stays pure', () => {
    const s = board([[6, bld(1, 'wheat_militia', 2, [{ cardId: 'neutral_sharpen', stacks: 1 }])]]);
    const copy = structuredClone(s);
    buildBattleSetup(s, content);
    expect(s).toEqual(copy);
  });
});

describe('limits (spec §5.3 step 4)', () => {
  const unit = (enchantId: string) =>
    at(setupOf([[6, bld(1, 'wheat_militia', 1, [{ cardId: enchantId as CardId, stacks: 1 }])]]), 6);

  it('caps armor at 0.75', () => {
    expect(unit('neutral_x_armor').spawn!.stats.armor).toBe(0.75);
  });

  it('never lets unit HP fall below 30% of its base', () => {
    const base = at(setupOf([[6, bld(1, 'wheat_militia')]]), 6).spawn!.stats.hp;
    expect(unit('neutral_x_hp').spawn!.stats.hp).toBeCloseTo(base * 0.3, 9);
  });

  it('never lets the attack interval fall below 50% of the base', () => {
    const base = at(setupOf([[6, bld(1, 'wheat_militia')]]), 6).spawn!.stats.interval;
    expect(unit('neutral_x_speed_attack').spawn!.stats.interval).toBeCloseTo(base * 0.5, 9);
    const t = at(setupOf([[6, bld(1, 'neutral_archer_tower', 1, [{ cardId: 'neutral_x_speed_attack', stacks: 1 }])]]), 6).attack!;
    expect(t.interval).toBeCloseTo(6, 9);
  });

  it('clamps the unit count to 0..20 and floors fractions', () => {
    expect(unit('neutral_x_count_up').spawn!.count).toBe(20);
    expect(unit('neutral_x_count_down').spawn!.count).toBe(0);
  });

  it('never lets speed fall below 30% of the base', () => {
    const base = at(setupOf([[6, bld(1, 'wheat_militia')]]), 6).spawn!.stats.speed;
    expect(unit('neutral_x_speed').spawn!.stats.speed).toBeCloseTo(base * 0.3, 9);
  });
});

describe('upkeep', () => {
  it('spawns nothing from a building listed in idleUids', () => {
    const s = setupOf([[6, bld(1, 'wheat_militia', 3)]], { idleUids: [1] });
    expect(at(s, 6).spawn!.count).toBe(0);
    expect(at(s, 6).hp).toBe(225);
  });
});

describe('G1 behaviour is unchanged for level-1 plain buildings', () => {
  it('keeps the shipped numbers', () => {
    const s = buildBattleSetup(board([[6, bld(1, 'wheat_scarecrow')]]), CONTENT);
    expect(s.structures[0]!.attack!.dmg).toBe(6);
    expect(s.throne.hp).toBe(300);
  });
});

describe('attack specs map to the battle setup', () => {
  const special: CardDef = {
    ...base,
    id: 'stone_crystal',
    nameVi: 'Pha lê',
    kind: 'tower',
    effects: [
      {
        type: 'tower',
        attack: {
          dmg: 4,
          type: 'magic',
          range: 64,
          interval: 3,
          splash: 16,
          chain: { count: 1, radius: 32, falloff: 0.6 },
          onHit: [
            { type: 'stun', ticks: 10 },
            { type: 'rampSameTarget', pctPerHit: 20, cap: 200 },
          ],
        },
        targeting: 'closestToThrone',
      },
    ],
  };
  const c = contentWith({ cards: [special] });

  it('carries splash, chain, stun and ramp from the AttackSpec', () => {
    const s = buildBattleSetup(board([[6, bld(1, 'stone_crystal')]]), c);
    expect(s.structures[0]!.attack).toMatchObject({
      splash: 16,
      chain: { count: 1, radius: 32, falloff: 0.6 },
      stunTicks: 10,
      rampPctPerHit: 20,
      rampCapPct: 200,
    });
  });

  it('leaves them at zero for plain attacks', () => {
    const s = setupOf([[6, bld(1, 'neutral_archer_tower')]]);
    expect(at(s, 6).attack).toMatchObject({ splash: 0, chain: null, stunTicks: 0, rampPctPerHit: 0, rampCapPct: 0 });
  });
});
