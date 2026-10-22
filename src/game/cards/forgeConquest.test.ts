import { describe, expect, it } from 'vitest';
import { CONE } from '../../data/battle';
import { TOWER_RANGE, TOWER_STD } from '../../data/scaling';
import type { CardId, Level } from '../../data/types';
import { stepBattle } from '../battle/step';
import { TEAM_FOE, addUnit, createBattle } from '../battle/world';
import { buildBattleSetup } from '../run/battleSetup';
import { applyCommand } from '../run/commands';
import { yearIncome } from '../run/income';
import { collectStatSheet } from '../run/modifiers';
import type { RunState } from '../run/state';
import { runState, unitStats, withBuilding } from '../testing/fixtures';
import { CONTENT } from './registry';

const IDS = [
  'forge_armory',
  'forge_blast_furnace',
  'forge_bombardiers',
  'forge_ember_rune',
  'forge_flame_tower',
  'forge_iron_drake',
  'forge_master_hammer',
  'forge_smithy',
  'forge_swordsmen',
];

const setupOf = (s: RunState) => buildBattleSetup(s, CONTENT);
const at = (s: RunState, plot: number) => setupOf(s).structures.find((x) => x.plot === plot)!;
const incomeOf = (s: RunState): number => yearIncome(s, CONTENT, s.gold).delta;
const ember = (stacks: number) => [{ cardId: 'forge_ember_rune' as CardId, stacks }];
const playOn = (s: RunState, card: string, plot: number): RunState => {
  const r = applyCommand(
    { ...s, hand: [card as CardId, ...s.hand.slice(1)] },
    { type: 'play', handIndex: 0, target: { kind: 'plot', plot } },
    CONTENT,
  );
  if ('error' in r) throw new Error(r.error);
  return r.state;
};

describe('the nine Forge King cards (spec 6.8)', () => {
  it('conquering the Forge King offers exactly these nine, never the throne', () => {
    expect(CONTENT.conquestCards('forge').map((c) => c.id).sort()).toEqual(IDS);
    expect(CONTENT.allCards().filter((c) => c.owner === 'forge').map((c) => c.id).sort()).toEqual(IDS);
  });

  describe.each([
    ['forge_swordsmen', 'swordsman', 3, 7],
    ['forge_bombardiers', 'bombardier', 2, 5],
    ['forge_iron_drake', 'iron_drake', 1, 2],
  ] as const)('%s spawns %s', (card, unit, l1, l5) => {
    it(`${l1} at level 1 and ${l5} at level 5`, () => {
      for (const [level, count] of [[1, l1], [5, l5]] as const) {
        const s = at(withBuilding(runState(), 6, card, level), 6);
        expect(s.spawn!.count).toBe(count);
        expect(s.spawn!.stats.unit).toBe(unit);
      }
    });
  });

  describe('forge_flame_tower', () => {
    it('breathes 4 fire over a 40 px 45-degree cone every 4 ticks with a 1/s, 20 tick burn', () => {
      for (const level of [1, 5] as Level[]) {
        const a = at(withBuilding(runState(), 6, 'forge_flame_tower', level), 6).attack!;
        expect(a.dmg).toBeCloseTo(4 * TOWER_STD[level - 1]!);
        expect([a.dmgType, a.interval, a.projectileSpeed]).toEqual(['fire', 4, 0]);
        expect(a.range).toBe(40 + TOWER_RANGE[level - 1]!);
        expect(a.cone).toEqual({ range: 40, halfAngleCos: CONE.cos45 });
        expect(a.onHit).toEqual([{ type: 'burn', dps: 1, ticks: 20 }]);
      }
    });

    it('sets foes in the cone alight, keyed on the tower uid', () => {
      const w = createBattle(setupOf(withBuilding(runState(), 6, 'forge_flame_tower', 1)));
      const still = unitStats({ hp: 2000, speed: 0, dmg: 0, interval: 0 });
      const a = addUnit(w, still, TEAM_FOE, 130, 160, 130, 160, -1);
      const b = addUnit(w, still, TEAM_FOE, 130, 168, 130, 168, -1);
      for (let i = 0; i < 12; i++) stepBattle(w, []);
      expect(w.hp[a]).toBeLessThan(2000);
      expect(w.hp[b]).toBeLessThan(2000);
      expect(w.dots.map((d) => d.victim).sort()).toEqual([a, b]);
      expect(new Set(w.dots.map((d) => d.key))).toEqual(new Set([106]));
    });
  });

  describe('forge_smithy', () => {
    it('gives neighbouring troops +12% damage at level 1, +28% at level 5, and +0.05 armor', () => {
      for (const [level, pct] of [[1, 12], [5, 28]] as const) {
        const s = withBuilding(withBuilding(runState(), 6, 'forge_smithy', level), 7, 'forge_swordsmen');
        const sheet = collectStatSheet(s, CONTENT, 7);
        expect([sheet.dmg.pct, sheet.armor.flat]).toEqual([pct, 0.05]);
        const stats = at(s, 7).spawn!.stats;
        expect(stats.armor).toBeCloseTo(0.15 + 0.05);
        expect(stats.dmg).toBeCloseTo(9 * (1 + pct / 100));
      }
    });

    it('does not help towers or far troops', () => {
      const s = withBuilding(withBuilding(runState(), 6, 'forge_smithy', 1), 8, 'forge_swordsmen');
      expect(collectStatSheet(s, CONTENT, 8).dmg.pct).toBe(0);
    });
  });

  describe('forge_ember_rune', () => {
    it('gives every hit a 2/s, 30-tick burn per stack, even on an attack that had none', () => {
      const one = at(withBuilding(runState(), 6, 'forge_swordsmen', 1, { enchants: ember(1) }), 6).spawn!.stats;
      expect(one.onHit).toEqual([{ type: 'burn', dps: 2, ticks: 30 }]);
      const two = at(withBuilding(runState(), 6, 'forge_swordsmen', 1, { enchants: ember(2) }), 6).spawn!.stats;
      expect(two.onHit).toEqual([{ type: 'burn', dps: 4, ticks: 30 }]);
    });

    it('adds to the burn the attack already has, keeping its duration (same-source burn)', () => {
      const s = at(withBuilding(runState(), 6, 'forge_flame_tower', 1, { enchants: ember(1) }), 6);
      expect(s.attack!.onHit).toEqual([{ type: 'burn', dps: 3, ticks: 20 }]);
    });
  });

  describe('forge_blast_furnace', () => {
    it('earns +1 gold at level 1 and +3 at level 5', () => {
      const none = incomeOf(runState());
      expect(incomeOf(withBuilding(runState(), 6, 'forge_blast_furnace', 1)) - none).toBe(1);
      expect(incomeOf(withBuilding(runState(), 6, 'forge_blast_furnace', 5)) - none).toBe(3);
    });

    it('multiplies the burn of neighbouring fire buildings by +25% (level 1) to +50% (level 5)', () => {
      for (const [level, mult] of [[1, 1.25], [5, 1.5]] as const) {
        const s = withBuilding(withBuilding(runState(), 6, 'forge_blast_furnace', level), 7, 'forge_flame_tower', 1);
        expect(at(s, 7).attack!.onHit).toEqual([{ type: 'burn', dps: mult, ticks: 20 }]);
      }
    });

    it('stacks flat ember burn before the percentage', () => {
      const s = withBuilding(withBuilding(runState(), 6, 'forge_blast_furnace', 1), 7, 'forge_flame_tower', 1, {
        enchants: ember(1),
      });
      expect(at(s, 7).attack!.onHit).toEqual([{ type: 'burn', dps: (1 + 2) * 1.25, ticks: 20 }]);
    });
  });

  describe('forge_armory', () => {
    it('adds 0.04 armor (level 1) to 0.08 (level 5) to every troop on the board', () => {
      for (const [level, armor] of [[1, 0.04], [5, 0.08]] as const) {
        const s = withBuilding(withBuilding(runState(), 2, 'forge_armory', level), 18, 'forge_swordsmen');
        expect(at(s, 18).spawn!.stats.armor).toBeCloseTo(0.15 + armor);
      }
    });

    it('with two armories only the highest counts', () => {
      let s = withBuilding(withBuilding(runState(), 2, 'forge_armory', 1), 3, 'forge_armory', 5);
      s = withBuilding(s, 18, 'forge_swordsmen');
      expect(collectStatSheet(s, CONTENT, 18).armor.flat).toBeCloseTo(0.08);
      const tie = withBuilding(withBuilding(withBuilding(runState(), 2, 'forge_armory', 3), 3, 'forge_armory', 3), 18, 'forge_swordsmen');
      expect(collectStatSheet(tie, CONTENT, 18).armor.flat).toBeCloseTo(0.06);
    });

    it('gives neighbours +10% HP and does nothing for towers', () => {
      const s = withBuilding(withBuilding(runState(), 6, 'forge_armory', 1), 7, 'forge_swordsmen');
      expect(collectStatSheet(s, CONTENT, 7).hp.pct).toBe(10);
      const tower = withBuilding(withBuilding(runState(), 6, 'forge_armory', 1), 18, 'forge_flame_tower');
      expect(collectStatSheet(tower, CONTENT, 18).armor.flat).toBe(0);
    });
  });

  describe('forge_master_hammer', () => {
    const board = (levels: Record<number, number>): RunState => {
      let s = runState();
      for (const [plot, level] of Object.entries(levels)) s = withBuilding(s, Number(plot), 'wheat_militia', level as Level);
      return s;
    };
    const levelsOf = (s: RunState, plots: number[]): number[] => plots.map((p) => s.plots[p]!.building?.level ?? 0);

    it('raises the chosen building and its lowest neighbour by one level', () => {
      const s = playOn(board({ 6: 2, 7: 3, 5: 1, 11: 2 }), 'forge_master_hammer', 6);
      expect(levelsOf(s, [6, 7, 5, 11])).toEqual([3, 3, 2, 2]);
    });

    it('breaks ties North, East, South, West', () => {
      expect(levelsOf(playOn(board({ 6: 1, 1: 2, 7: 2, 11: 2, 5: 2 }), 'forge_master_hammer', 6), [1, 7, 11, 5])).toEqual([3, 2, 2, 2]);
      expect(levelsOf(playOn(board({ 6: 1, 7: 2, 11: 2, 5: 2 }), 'forge_master_hammer', 6), [7, 11, 5])).toEqual([3, 2, 2]);
      expect(levelsOf(playOn(board({ 6: 1, 11: 2, 5: 2 }), 'forge_master_hammer', 6), [11, 5])).toEqual([3, 2]);
    });

    it('skips the Ngai and maxed neighbours, and a maxed chosen building stays at 5', () => {
      const s = playOn(board({ 11: 5, 17: 2 }), 'forge_master_hammer', 11);
      expect(levelsOf(s, [11, 17])).toEqual([5, 2]); // Ngai at 12 is a neighbour of 11 and ignored; 17 is not adjacent to 11
      const t = playOn(board({ 7: 4, 6: 5, 2: 5 }), 'forge_master_hammer', 7);
      expect(levelsOf(t, [7, 6, 2])).toEqual([5, 5, 5]);
      expect(t.throneLevel).toBe(runState().throneLevel);
    });

    it('works with no neighbour at all', () => {
      expect(levelsOf(playOn(board({ 0: 1 }), 'forge_master_hammer', 0), [0])).toEqual([2]);
    });
  });
});
