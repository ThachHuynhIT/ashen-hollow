import { describe, expect, it } from 'vitest';
import { TOWER_RANGE } from '../../data/scaling';
import type { CardId, Level } from '../../data/types';
import { stepBattle } from '../battle/step';
import { tickStatuses } from '../battle/statuses';
import { TEAM_ALLY, TEAM_FOE, addUnit, createBattle } from '../battle/world';
import { buildBattleSetup } from '../run/battleSetup';
import { applyCommand } from '../run/commands';
import { collectStatSheet } from '../run/modifiers';
import type { RunState } from '../run/state';
import { startYear } from '../run/yearFlow';
import { runState, unitStats, withBuilding } from '../testing/fixtures';
import { CONTENT } from './registry';

const IDS = [
  'grove_bear_cave',
  'grove_deep_roots',
  'grove_sapling',
  'grove_spirit_stags',
  'grove_spring',
  'grove_spring_rain',
  'grove_thorn_tower',
  'grove_treant',
  'grove_wolf_den',
];

const setupOf = (s: RunState) => buildBattleSetup(s, CONTENT);
const at = (s: RunState, plot: number) => setupOf(s).structures.find((x) => x.plot === plot)!;
const LEVELS = [1, 5] as const satisfies readonly Level[];

describe('the nine Grove King cards (spec 6.6)', () => {
  it('conquering the Grove King offers exactly these nine, never the throne', () => {
    expect(CONTENT.conquestCards('grove').map((c) => c.id).sort()).toEqual(IDS);
    expect(CONTENT.allCards().filter((c) => c.owner === 'grove').map((c) => c.id).sort()).toEqual(IDS);
    expect(CONTENT.conquestCards('grove').map((c) => c.rarity).sort()).toEqual(
      ['common', 'common', 'common', 'common', 'rare', 'rare', 'uncommon', 'uncommon', 'uncommon'].sort(),
    );
  });

  describe.each([
    ['grove_wolf_den', 'wolf', 3, 7],
    ['grove_bear_cave', 'bear', 1, 3],
    ['grove_spirit_stags', 'stag', 2, 5],
    ['grove_treant', 'treant', 1, 2],
  ] as const)('%s spawns %s', (card, unit, l1, l5) => {
    it(`${l1} at level 1 and ${l5} at level 5`, () => {
      for (const [level, count] of [[1, l1], [5, l5]] as const) {
        const s = at(withBuilding(runState(), 6, card, level), 6);
        expect(s.spawn!.count).toBe(count);
        expect(s.spawn!.stats.unit).toBe(unit);
      }
    });
  });

  it('grove_treant: its units carry the 48 px / 3 HP per second healing aura', () => {
    const stats = at(withBuilding(runState(), 6, 'grove_treant', 1), 6).spawn!.stats;
    expect(stats.behaviours).toContainEqual({ type: 'healAura', radius: 48, hpPerSec: 3 });
  });

  describe('grove_sapling', () => {
    const grown = (age: number, over: { ageBonus?: number } = {}) => {
      const s0 = withBuilding(runState(), 6, 'grove_sapling', 1, { placedYear: 1, ...over });
      return startYear({ ...s0, year: age }, CONTENT); // next year = age + 1, so age (year - placedYear) = age
    };

    it('gains a level every 3 years of age (and never above 5)', () => {
      const levels = [1, 2, 3, 4, 5, 6].map((age) => grown(age).plots[6]!.building!.level);
      expect(levels).toEqual([1, 1, 2, 1, 1, 2]); // one year start each: only ages 3 and 6 level up
      const max = withBuilding(runState(), 6, 'grove_sapling', 5, { placedYear: 1 });
      expect(startYear({ ...max, year: 3 }, CONTENT).plots[6]!.building!.level).toBe(5);
    });

    it('counts ageBonus as years too', () => {
      expect(grown(1, { ageBonus: 2 }).plots[6]!.building!.level).toBe(2);
    });

    it('does not age twice when the state is saved and reloaded', () => {
      const once = grown(2);
      const reloaded = JSON.parse(JSON.stringify(once)) as RunState;
      expect(reloaded.plots[6]!.building!.level).toBe(once.plots[6]!.building!.level);
      expect(reloaded.plots[6]!.building!.placedYear).toBe(1);
    });

    it('gives neighbouring troops +8% HP at level 1 and +40% at level 5, nobody else', () => {
      for (const [level, pct] of [[1, 8], [5, 40]] as const) {
        const s = withBuilding(withBuilding(runState(), 6, 'grove_sapling', level), 7, 'wheat_militia');
        expect(collectStatSheet(s, CONTENT, 7).hp.pct).toBe(pct);
        const far = withBuilding(withBuilding(runState(), 6, 'grove_sapling', level), 8, 'wheat_militia');
        expect(collectStatSheet(far, CONTENT, 8).hp.pct).toBe(0);
      }
    });
  });

  describe('grove_spring', () => {
    it('sets a 64 px aura of 2 HP/s at level 1 and 6 HP/s at level 5', () => {
      for (const [level, hps] of [[1, 2], [5, 6]] as const) {
        expect(at(withBuilding(runState(), 6, 'grove_spring', level), 6).healAura).toEqual({ radius: 64, hps });
      }
    });

    it('heals our units in range every second in the battle, not foes', () => {
      const w = createBattle(setupOf(withBuilding(runState(), 6, 'grove_spring', 5)));
      const c = { x: 112 + 32 * 1 + 16, y: 112 + 32 * 1 + 16 };
      const friend = addUnit(w, unitStats({ hp: 100 }), TEAM_ALLY, c.x + 30, c.y, c.x, c.y, 9);
      const foe = addUnit(w, unitStats({ hp: 100 }), TEAM_FOE, c.x + 30, c.y + 5, c.x, c.y, -1);
      w.hp[friend] = 50;
      w.hp[foe] = 50;
      w.tick = 10;
      tickStatuses(w);
      expect(w.hp[friend]).toBe(56);
      expect(w.hp[foe]).toBe(50);
    });
  });

  describe('grove_deep_roots', () => {
    const rooted = (stacks: number) =>
      withBuilding(runState(), 6, 'wheat_militia', 1, { enchants: [{ cardId: 'grove_deep_roots' as CardId, stacks }] });

    it('adds +3% HP and damage per stack at each year start, adding to other percentages', () => {
      const y1 = startYear({ ...rooted(2), year: 1 }, CONTENT);
      const b = y1.plots[6]!.building!;
      expect(b.permanent).toMatchObject({ hp: 6, dmg: 6 });
      expect(b.counters.rootsPct).toBe(6);
      expect(collectStatSheet(y1, CONTENT, 6).hp.pct).toBe(6);
      const y2 = startYear(y1, CONTENT);
      expect(y2.plots[6]!.building!.permanent.hp).toBe(12);
    });

    it('stops at +90% in total, and survives a JSON reload', () => {
      let s = rooted(1);
      for (let i = 0; i < 40; i++) s = startYear({ ...s, year: i + 1 }, CONTENT);
      const b = s.plots[6]!.building!;
      expect(b.permanent.hp).toBe(90);
      expect(b.permanent.dmg).toBe(90);
      expect((JSON.parse(JSON.stringify(s)) as RunState).plots[6]!.building!.counters.rootsPct).toBe(90);
    });

    it('does nothing without the rune', () => {
      const s = startYear({ ...withBuilding(runState(), 6, 'wheat_militia'), year: 1 }, CONTENT);
      expect(s.plots[6]!.building!.permanent).toEqual({});
    });
  });

  describe('grove_thorn_tower', () => {
    it('shoots 5 physical at range 64 every 8 ticks with a poison onHit', () => {
      for (const level of LEVELS) {
        const a = at(withBuilding(runState(), 6, 'grove_thorn_tower', level), 6).attack!;
        expect([a.range, a.interval, a.projectileSpeed]).toEqual([64 + TOWER_RANGE[level - 1]!, 8, 8]);
        expect(a.onHit).toEqual([{ type: 'poison', dps: 2, ticks: 30, maxStacks: 3 }]);
      }
      expect(at(withBuilding(runState(), 6, 'grove_thorn_tower', 1), 6).attack!.dmg).toBe(5);
    });

    it('poisons a foe up to 3 stacks, keyed on the tower uid', () => {
      const s = withBuilding(runState(), 6, 'grove_thorn_tower', 1);
      const w = createBattle(setupOf(s));
      const foe = addUnit(w, unitStats({ hp: 5000, speed: 0, dmg: 0, interval: 0 }), TEAM_FOE, 150, 150, 150, 150, -1);
      for (let i = 0; i < 80; i++) stepBattle(w, []);
      expect(w.hp[foe]).toBeLessThan(5000);
      expect(w.dots).toHaveLength(1);
      expect(w.dots[0]).toMatchObject({ kind: 'poison', stacks: 3, key: 106 });
    });
  });

  describe('grove_spring_rain', () => {
    it('adds 2 years of age to every Grove building and a level to every sapling', () => {
      let s = withBuilding(runState(), 6, 'grove_sapling', 1);
      s = withBuilding(s, 7, 'grove_wolf_den', 1);
      s = withBuilding(s, 8, 'wheat_militia', 1);
      s = { ...s, hand: ['grove_spring_rain' as CardId, ...s.hand.slice(1)] };
      const r = applyCommand(s, { type: 'play', handIndex: 0, target: { kind: 'none' } }, CONTENT);
      if ('error' in r) throw new Error(r.error);
      const p = r.state.plots;
      expect([p[6]!.building!.ageBonus, p[7]!.building!.ageBonus, p[8]!.building!.ageBonus]).toEqual([2, 2, 0]);
      expect([p[6]!.building!.level, p[7]!.building!.level, p[8]!.building!.level]).toEqual([2, 1, 1]);
      expect(r.state.played).toBe(true);
    });
  });
});
