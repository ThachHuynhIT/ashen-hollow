import { describe, expect, it } from 'vitest';
import { TOWER_RANGE, TOWER_STD } from '../../data/scaling';
import type { CardId, Level } from '../../data/types';
import { buildBattleSetup } from '../run/battleSetup';
import { applyCommand } from '../run/commands';
import { yearIncome } from '../run/income';
import { collectStatSheet } from '../run/modifiers';
import type { PlayTarget, RunState } from '../run/state';
import { runState, withBuilding } from '../testing/fixtures';
import { CONTENT } from './registry';

const IDS = [
  'nomad_bazaar',
  'nomad_caravan',
  'nomad_horse_archers',
  'nomad_khan_guard',
  'nomad_relocate',
  'nomad_riders',
  'nomad_stables',
  'nomad_watchtower',
  'nomad_wind_rune',
];

const setupOf = (s: RunState) => buildBattleSetup(s, CONTENT);
const at = (s: RunState, plot: number) => setupOf(s).structures.find((x) => x.plot === plot)!;
const incomeOf = (s: RunState): number => yearIncome(s, CONTENT, s.gold).delta;
const play = (s: RunState, card: string, target: PlayTarget): RunState => {
  const r = applyCommand({ ...s, hand: [card as CardId, ...s.hand.slice(1)] }, { type: 'play', handIndex: 0, target }, CONTENT);
  if ('error' in r) throw new Error(r.error);
  return r.state;
};
const two = (first: number, second: number): PlayTarget => ({ kind: 'two', first, second });
const wind = (stacks: number) => [{ cardId: 'nomad_wind_rune' as CardId, stacks }];

describe('the nine Nomad King cards (spec 6.11)', () => {
  it('conquering the Nomad King offers exactly these nine, never the throne', () => {
    expect(CONTENT.conquestCards('nomad').map((c) => c.id).sort()).toEqual(IDS);
    expect(CONTENT.allCards().filter((c) => c.owner === 'nomad').map((c) => c.id).sort()).toEqual(IDS);
    expect(() => CONTENT.king('nomad')).toThrow();
  });

  describe.each([
    ['nomad_riders', 'rider', 2, 6],
    ['nomad_horse_archers', 'horse_archer', 2, 6],
    ['nomad_khan_guard', 'khan_guard', 2, 4],
  ] as const)('%s spawns %s', (card, unit, l1, l5) => {
    it(`${l1} at level 1 and ${l5} at level 5`, () => {
      for (const [level, count] of [[1, l1], [5, l5]] as const) {
        const s = at(withBuilding(runState(), 6, card, level), 6);
        expect(s.spawn!.count).toBe(count);
        expect(s.spawn!.stats.unit).toBe(unit);
      }
    });
  });

  it('the riders charge and the khan guard stuns on its charge', () => {
    expect(at(withBuilding(runState(), 6, 'nomad_riders', 1), 6).spawn!.stats.behaviours).toEqual([
      { type: 'charge', dmgMult: 2, knockback: 8, stunTicks: 0 },
    ]);
    expect(at(withBuilding(runState(), 6, 'nomad_khan_guard', 1), 6).spawn!.stats.behaviours).toEqual([
      { type: 'charge', dmgMult: 2, knockback: 0, stunTicks: 10 },
    ]);
  });

  describe('nomad_stables', () => {
    it('gives neighbouring cavalry +15% speed and damage (level 1), +35% (level 5); nobody else', () => {
      for (const [level, pct] of [[1, 15], [5, 35]] as const) {
        const s = withBuilding(withBuilding(runState(), 6, 'nomad_stables', level), 7, 'nomad_riders');
        const stats = at(s, 7).spawn!.stats;
        const plain = at(withBuilding(runState(), 7, 'nomad_riders'), 7).spawn!.stats;
        expect(stats.speed).toBeCloseTo(plain.speed * (1 + pct / 100));
        expect(stats.dmg).toBeCloseTo(plain.dmg * (1 + pct / 100));
        const foot = withBuilding(withBuilding(runState(), 6, 'nomad_stables', level), 7, 'wheat_militia');
        expect(collectStatSheet(foot, CONTENT, 7).speed.pct).toBe(0);
      }
    });
  });

  describe('nomad_relocate', () => {
    const board = (): RunState => {
      let s = withBuilding(runState(), 6, 'wheat_militia', 2, { placedYear: 1 });
      s = withBuilding(s, 13, 'neutral_well', 1);
      return { ...s, year: 4 };
    };

    it('moving 2+ squares away adds a level, 1 square does not; it records the year moved', () => {
      const far = play(board(), 'nomad_relocate', two(6, 18)); // (1,1) -> (3,3): Manhattan 4
      expect(far.plots[18]!.building).toMatchObject({ cardId: 'wheat_militia', level: 3, movedYear: 4, uid: 106 });
      const exactly2 = play(board(), 'nomad_relocate', two(6, 16)); // (1,1) -> (3,1): Manhattan 2
      expect(exactly2.plots[16]!.building).toMatchObject({ level: 3 });
      const near = play(board(), 'nomad_relocate', two(6, 7)); // Manhattan 1
      expect(near.plots[7]!.building).toMatchObject({ level: 2, movedYear: 4 });
    });

    it('swaps with an occupied square keeping both uids, and stamps both', () => {
      const s = play(board(), 'nomad_relocate', two(6, 13));
      expect(s.plots[13]!.building).toMatchObject({ cardId: 'wheat_militia', uid: 106, movedYear: 4 });
      expect(s.plots[6]!.building).toMatchObject({ cardId: 'neutral_well', uid: 113, movedYear: 4 });
    });

    it('the neutral Dời Nhà also records the year (the hook is not Nomad-only)', () => {
      const s = play(board(), 'neutral_move', two(6, 7));
      expect(s.plots[7]!.building!.movedYear).toBe(4);
      expect(s.plots[7]!.building!.level).toBe(2);
    });
  });

  describe('nomad_bazaar', () => {
    it('earns +1 gold (level 1) / +3 (level 5) plus 1 for each kind of neighbouring building', () => {
      const none = incomeOf(runState());
      expect(incomeOf(withBuilding(runState(), 6, 'nomad_bazaar', 1)) - none).toBe(1);
      expect(incomeOf(withBuilding(runState(), 6, 'nomad_bazaar', 5)) - none).toBe(3);
      let s = withBuilding(runState(), 6, 'nomad_bazaar', 1);
      s = withBuilding(s, 7, 'wheat_militia');
      s = withBuilding(s, 5, 'wheat_scarecrow'); // troop again: same kind
      s = withBuilding(s, 1, 'neutral_archer_tower');
      s = withBuilding(s, 11, 'neutral_well'); // 12 is the Ngai, never a kind
      const base = incomeOf(withBuilding(withBuilding(withBuilding(withBuilding(runState(), 7, 'wheat_militia'), 5, 'wheat_scarecrow'), 1, 'neutral_archer_tower'), 11, 'neutral_well'));
      expect(incomeOf(s) - base).toBe(1 + 3); // base gold + three different kinds
    });
  });

  describe('nomad_wind_rune', () => {
    it('adds +10% speed and damage per stack, doubled in the year the building was moved', () => {
      const plain = at(withBuilding(runState(), 6, 'nomad_riders', 1), 6).spawn!.stats;
      const quiet = at(withBuilding(runState(), 6, 'nomad_riders', 1, { enchants: wind(1), movedYear: 3 }), 6).spawn!.stats;
      expect(quiet.dmg).toBeCloseTo(plain.dmg * 1.1);
      expect(quiet.speed).toBeCloseTo(plain.speed * 1.1);
      const moved = at(withBuilding(runState(), 6, 'nomad_riders', 1, { enchants: wind(1), movedYear: 1 }), 6).spawn!.stats;
      expect(moved.dmg).toBeCloseTo(plain.dmg * 1.2);
      expect(moved.speed).toBeCloseTo(plain.speed * 1.2);
      const two = at(withBuilding(runState(), 6, 'nomad_riders', 1, { enchants: wind(2), movedYear: 1 }), 6).spawn!.stats;
      expect(two.dmg).toBeCloseTo(plain.dmg * 1.4);
    });

    it('stays doubled only for the current year (a later year is back to +10%)', () => {
      const b = withBuilding(runState(), 6, 'nomad_riders', 1, { enchants: wind(1), movedYear: 1 });
      const later = at({ ...b, year: 2 }, 6).spawn!.stats;
      const plain = at(withBuilding(runState(), 6, 'nomad_riders', 1), 6).spawn!.stats;
      expect(later.dmg).toBeCloseTo(plain.dmg * 1.1);
    });
  });

  describe('nomad_watchtower', () => {
    it('shoots 7 physical at range 96 every 12 ticks, shell speed 9', () => {
      for (const level of [1, 5] as Level[]) {
        const a = at(withBuilding(runState(), 2, 'nomad_watchtower', level), 2).attack!;
        // a plot on the edge has 3 neighbours, none open and empty at the start except those unlocked
        expect([a.range, a.interval, a.projectileSpeed]).toEqual([96 + TOWER_RANGE[level - 1]!, 12, 9]);
        expect(a.dmg).toBeGreaterThanOrEqual(7 * TOWER_STD[level - 1]!);
      }
    });

    it('gains +20% damage for every open, empty neighbouring square', () => {
      const dmgAt = (s: RunState): number => at(s, 6).attack!.dmg;
      const bare = withBuilding(runState(), 6, 'nomad_watchtower', 1);
      // plot 6 = (1,1): neighbours 1, 7, 11, 5. In the opening 3x3 only 7, 11 and 5? count them from the board itself
      const open = [1, 7, 11, 5].filter((n) => bare.plots[n]!.unlocked && bare.plots[n]!.building === null).length;
      expect(dmgAt(bare)).toBeCloseTo(7 * (1 + 0.2 * open));
      const filled = withBuilding(bare, 7, 'wheat_militia');
      expect(dmgAt(filled)).toBeCloseTo(7 * (1 + 0.2 * (open - 1)));
    });
  });

  describe('nomad_caravan', () => {
    it('earns +2 gold (level 1) to +5 (level 5) each year', () => {
      const none = incomeOf(runState());
      expect(incomeOf(withBuilding(runState(), 6, 'nomad_caravan', 1)) - none).toBe(2);
      expect(incomeOf(withBuilding(runState(), 6, 'nomad_caravan', 5)) - none).toBe(5);
    });

    it('pays 1 gold for every move action (a swap counts once), at most 3 a year, then resets next year', () => {
      let s: RunState = { ...withBuilding(withBuilding(runState(), 13, 'nomad_caravan', 1), 6, 'wheat_militia', 1), gold: 0, year: 4 };
      s = play({ ...s, played: false }, 'neutral_move', two(6, 7));
      expect(s.gold).toBe(1);
      s = play({ ...s, played: false }, 'neutral_move', two(7, 13)); // swap with the caravan itself: one action, one gold
      expect(s.gold).toBe(2);
      s = play({ ...s, played: false }, 'neutral_move', two(13, 7));
      s = play({ ...s, played: false }, 'neutral_move', two(7, 13));
      expect(s.gold).toBe(3); // the fourth move pays nothing
      const next = play({ ...s, played: false, year: 5 }, 'neutral_move', two(13, 7));
      expect(next.gold).toBe(4);
    });

    it('does nothing without a caravan on the board', () => {
      const s = play({ ...withBuilding(runState(), 6, 'wheat_militia', 1), gold: 0 }, 'neutral_move', two(6, 7));
      expect(s.gold).toBe(0);
    });
  });
});
