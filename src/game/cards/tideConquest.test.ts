import { describe, expect, it } from 'vitest';
import { TOWER_RANGE, TOWER_STD } from '../../data/scaling';
import type { CardId, Level } from '../../data/types';
import { settleBattleGold } from '../battle/behaviours';
import { attackPhase } from '../battle/combat';
import { stepBattle } from '../battle/step';
import { TEAM_FOE, addUnit, createBattle } from '../battle/world';
import { buildBattleSetup } from '../run/battleSetup';
import { applyCommand } from '../run/commands';
import { yearIncome } from '../run/income';
import type { RunState } from '../run/state';
import { startYear } from '../run/yearFlow';
import { runState, unitStats, withBuilding } from '../testing/fixtures';
import { CONTENT } from './registry';

const IDS = [
  'tide_cannon',
  'tide_harbor',
  'tide_hookmen',
  'tide_kraken',
  'tide_pirates',
  'tide_privateers',
  'tide_treasure',
  'tide_undertow_rune',
  'tide_wave_tower',
];

const setupOf = (s: RunState) => buildBattleSetup(s, CONTENT);
const at = (s: RunState, plot: number) => setupOf(s).structures.find((x) => x.plot === plot)!;
const incomeOf = (s: RunState): number => yearIncome(s, CONTENT, s.gold).delta;
const play = (s: RunState, card: string): RunState => {
  const r = applyCommand(
    { ...s, hand: [card as CardId, ...s.hand.slice(1)] },
    { type: 'play', handIndex: 0, target: { kind: 'none' } },
    CONTENT,
  );
  if ('error' in r) throw new Error(r.error);
  return r.state;
};

describe('the nine Tide King cards (spec 6.7)', () => {
  it('conquering the Tide King offers exactly these nine, never the throne', () => {
    expect(CONTENT.conquestCards('tide').map((c) => c.id).sort()).toEqual(IDS);
    expect(CONTENT.allCards().filter((c) => c.owner === 'tide').map((c) => c.id).sort()).toEqual(IDS);
  });

  describe.each([
    ['tide_pirates', 'pirate', 4, 8],
    ['tide_hookmen', 'hookman', 2, 6],
  ] as const)('%s spawns %s', (card, unit, l1, l5) => {
    it(`${l1} at level 1 and ${l5} at level 5`, () => {
      for (const [level, count] of [[1, l1], [5, l5]] as const) {
        const s = at(withBuilding(runState(), 6, card, level), 6);
        expect(s.spawn!.count).toBe(count);
        expect(s.spawn!.stats.unit).toBe(unit);
      }
    });
  });

  it('tide_hookmen: the hookman pulls every 4th hit by 16 px', () => {
    const stats = at(withBuilding(runState(), 6, 'tide_hookmen', 1), 6).spawn!.stats;
    expect(stats.onHit).toContainEqual({ type: 'pull', px: 16, every: 4 });
  });

  describe('tide_pirates gold', () => {
    const world = () => createBattle(setupOf(withBuilding(runState(), 6, 'tide_pirates', 1)));
    const goldAfter = (kills: number): number => {
      const w = world();
      w.killsBySource[106] = kills;
      settleBattleGold(w);
      return w.goldDelta;
    };

    it('is +1 gold per 8 foes its pirates killed, at most 3 per battle', () => {
      expect([0, 7, 8, 15, 16, 24, 31, 40, 100].map(goldAfter)).toEqual([0, 0, 1, 1, 2, 3, 3, 3, 3]);
    });

    it('counts only its own kills and settles once', () => {
      const w = world();
      w.killsBySource[999] = 80;
      w.killsBySource[106] = 8;
      settleBattleGold(w);
      settleBattleGold(w);
      expect(w.goldDelta).toBe(1);
    });
  });

  describe('tide_cannon', () => {
    it('fires 16 splash-12 shells over 88 range every 22 ticks with a 16 px knockback', () => {
      for (const level of [1, 5] as Level[]) {
        const a = at(withBuilding(runState(), 6, 'tide_cannon', level), 6).attack!;
        expect(a.dmg).toBeCloseTo(16 * TOWER_STD[level - 1]!);
        expect([a.range, a.interval, a.projectileSpeed, a.splash]).toEqual([88 + TOWER_RANGE[level - 1]!, 22, 6, 12]);
        expect(a.onHit).toEqual([{ type: 'knockback', px: 16 }]);
      }
    });
  });

  describe('tide_harbor', () => {
    it('earns +2 gold at level 1 and +6 at level 5 each year', () => {
      const none = incomeOf(runState());
      expect(incomeOf(withBuilding(runState(), 6, 'tide_harbor', 1)) - none).toBe(2);
      expect(incomeOf(withBuilding(runState(), 6, 'tide_harbor', 5)) - none).toBe(6);
    });
  });

  describe('tide_undertow_rune', () => {
    const enchanted = (card: string, stacks: number): RunState =>
      withBuilding(runState(), 6, card, 1, { enchants: [{ cardId: 'tide_undertow_rune' as CardId, stacks }] });

    it('adds 6 px of knockback to every hit of a tower, on top of its own', () => {
      expect(at(enchanted('tide_cannon', 1), 6).attack!.onHit).toEqual([{ type: 'knockback', px: 22 }]);
      expect(at(enchanted('tide_cannon', 2), 6).attack!.onHit).toEqual([{ type: 'knockback', px: 28 }]);
    });

    it('gives troops knockback and +8% speed per stack', () => {
      const stats = at(enchanted('wheat_militia', 1), 6).spawn!.stats;
      expect(stats.onHit).toEqual([{ type: 'knockback', px: 6 }]);
      const plain = at(withBuilding(runState(), 6, 'wheat_militia'), 6).spawn!.stats;
      expect(stats.speed).toBeCloseTo(plain.speed * 1.08);
      expect(at(enchanted('wheat_militia', 3), 6).spawn!.stats.speed).toBeCloseTo(plain.speed * 1.24);
    });
  });

  describe('tide_wave_tower', () => {
    it('is a 50-tick pulse of 10 magic damage with a 24 px knockback', () => {
      for (const level of [1, 5] as Level[]) {
        const pulse = at(withBuilding(runState(), 6, 'tide_wave_tower', level), 6).pulse!;
        expect(pulse.everyTicks).toBe(50);
        expect(pulse.radius).toBe(72 + TOWER_RANGE[level - 1]!);
        expect(pulse.dmg).toBeCloseTo(10 * TOWER_STD[level - 1]!);
        expect([pulse.dmgType, pulse.knockback]).toEqual(['magic', 24]);
      }
    });

    it('hits and shoves a foe in range on the pulse tick, and leaves far ones alone', () => {
      const w = createBattle(setupOf(withBuilding(runState(), 6, 'tide_wave_tower', 1)));
      const near = addUnit(w, unitStats({ hp: 100, speed: 0, dmg: 0, interval: 0 }), TEAM_FOE, 100, 150, 100, 150, -1);
      const far = addUnit(w, unitStats({ hp: 100, speed: 0, dmg: 0, interval: 0 }), TEAM_FOE, 380, 380, 380, 380, -1);
      for (let i = 0; i < 50; i++) stepBattle(w, []);
      expect(w.hp[near]).toBe(100);
      stepBattle(w, []); // tick 50
      expect(w.hp[near]).toBe(90);
      expect(w.kbTicks[near]).toBeGreaterThan(0);
      expect(Math.sqrt(w.kbX[near]! * w.kbX[near]! + w.kbY[near]! * w.kbY[near]!) * 3).toBeCloseTo(24);
      expect(w.kbX[near]).toBeLessThan(0); // shoved west, away from the tower
      expect(w.hp[far]).toBe(100);
    });
  });

  describe('tide_treasure', () => {
    const chest = (gold: number, level: Level): number => {
      const base = { ...runState(), gold };
      return incomeOf({ ...withBuilding(base, 6, 'tide_treasure', level), gold }) - incomeOf(base);
    };

    it('earns floor(gold / 5), up to 3 at level 1 and 7 at level 5', () => {
      expect([0, 4, 5, 14, 15, 100].map((g) => chest(g, 1))).toEqual([0, 0, 1, 2, 3, 3]);
      expect([14, 34, 35, 100].map((g) => chest(g, 5))).toEqual([2, 6, 7, 7]);
    });
  });

  describe('tide_privateers', () => {
    const contract = (gold: number): RunState => play(withBuilding({ ...runState(), gold }, 6, 'wheat_militia'), 'tide_privateers');
    const mercs = (s: RunState): number => s.plots[12]!.building!.counters.privateers ?? 0;

    it('pays everything up to 16 and keeps one mercenary per 2 gold paid', () => {
      const rich = contract(17);
      expect([rich.gold, mercs(rich)]).toEqual([1, 8]);
      const poor = contract(1);
      expect([poor.gold, mercs(poor)]).toEqual([0, 0]);
      const odd = contract(5);
      expect([odd.gold, mercs(odd)]).toEqual([0, 2]);
    });

    it('spawns the mercenaries at the Ngai at the start of this year battle only', () => {
      const s = contract(17);
      expect(setupOf(s).throne.spawnAtThrone).toMatchObject({ count: 8, stats: { unit: 'mercenary' } });
      const without = withBuilding(runState(), 6, 'wheat_militia');
      const base = createBattle(setupOf(without)).count;
      const w = createBattle(setupOf(s));
      expect(w.count - base).toBe(8);
      const next = startYear({ ...s, year: 1 }, CONTENT);
      expect(mercs(next)).toBe(0);
      expect(setupOf(next).throne.spawnAtThrone).toBeUndefined();
    });

    it('never pushes gold below 0 and leaves the other plots alone', () => {
      const s = contract(0);
      expect(s.gold).toBe(0);
      expect(s.plots[6]!.building!.counters).toEqual({});
    });
  });

  describe('tide_kraken', () => {
    it('is a 500-HP (L1) to 1000-HP (L5) tower with four tentacles of 14 damage, range 56, every 12 ticks', () => {
      for (const [level, hp] of [[1, 500], [5, 1000]] as const) {
        const s = at(withBuilding(runState(), 6, 'tide_kraken', level), 6);
        expect(s.hp).toBe(hp);
        expect(s.multiAttack).toBe(4);
        expect([s.attack!.dmg, s.attack!.range, s.attack!.interval, s.attack!.projectileSpeed]).toEqual([
          14 * TOWER_STD[level - 1]!,
          56 + TOWER_RANGE[level - 1]!,
          12,
          0,
        ]);
        expect(s.attack!.onHit).toEqual([{ type: 'knockback', px: 8 }]);
        expect(s.targeting).toBe('nearest');
      }
    });

    it('picks four DIFFERENT nearest foes each beat, and only one if only one is near', () => {
      const w = createBattle(setupOf(withBuilding(runState(), 6, 'tide_kraken', 1)));
      const ids = [0, 1, 2, 3, 4, 5].map((i) =>
        addUnit(w, unitStats({ hp: 1000, speed: 0, dmg: 0, interval: 0 }), TEAM_FOE, 150 + i * 4, 140, 150, 140, -1),
      );
      w.cooldown.fill(0);
      attackPhase(w);
      const victims = w.damageQueue.filter((q) => q.sourceId === 1).map((q) => q.victim);
      expect(new Set(victims).size).toBe(4);
      expect(victims.length).toBe(4);
      for (const v of victims) expect(ids).toContain(v);
      const lone = createBattle(setupOf(withBuilding(runState(), 6, 'tide_kraken', 1)));
      addUnit(lone, unitStats({ hp: 1000, speed: 0, dmg: 0, interval: 0 }), TEAM_FOE, 150, 140, 150, 140, -1);
      lone.cooldown.fill(0);
      attackPhase(lone);
      expect(lone.damageQueue.filter((q) => q.sourceId === 1)).toHaveLength(1);
    });
  });
});
