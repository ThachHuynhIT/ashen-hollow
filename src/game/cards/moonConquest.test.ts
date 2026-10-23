import { describe, expect, it } from 'vitest';
import { TOWER_RANGE, TOWER_STD } from '../../data/scaling';
import type { CardId, Level } from '../../data/types';
import { stepBattle } from '../battle/step';
import { TEAM_ALLY, TEAM_FOE, addUnit, createBattle, type BattleWorld } from '../battle/world';
import { buildBattleSetup } from '../run/battleSetup';
import { applyCommand } from '../run/commands';
import { collectStatSheet } from '../run/modifiers';
import type { RunState } from '../run/state';
import { runState, unitStats, withBuilding } from '../testing/fixtures';
import { CONTENT } from './registry';

const IDS = [
  'moon_altar',
  'moon_blood_moon_rune',
  'moon_blood_pact',
  'moon_crypt',
  'moon_eclipse_pact',
  'moon_reaper_shrine',
  'moon_shadow_spire',
  'moon_summoning_circle',
  'moon_vampires',
];

const setupOf = (s: RunState) => buildBattleSetup(s, CONTENT);
const at = (s: RunState, plot: number) => setupOf(s).structures.find((x) => x.plot === plot)!;
const rune = (card: string, stacks: number) => [{ cardId: card as CardId, stacks }];
const play = (s: RunState, card: string, target: { kind: 'none' } | { kind: 'plot'; plot: number }) =>
  applyCommand({ ...s, hand: [card as CardId, ...s.hand.slice(1)] }, { type: 'play', handIndex: 0, target }, CONTENT);
const ok = (r: ReturnType<typeof play>): RunState => {
  if ('error' in r) throw new Error(r.error);
  return r.state;
};
/** A battle that stays open and quiet: the only wave arrives at tick 800 and is empty. */
const quiet = (s: RunState): RunState => ({ ...s, army: { ...s.army!, waves: [{ spawnTick: 800, units: [] }] } });
const living = (w: BattleWorld, label: string): number =>
  [...Array(w.count).keys()].filter((i) => w.alive[i] === 1 && w.team[i] === TEAM_ALLY && w.label[i] === label).length;

describe('the nine Moon King cards (spec 6.10)', () => {
  it('conquering the Moon King offers exactly these nine, never the throne', () => {
    expect(CONTENT.conquestCards('moon').map((c) => c.id).sort()).toEqual(IDS);
    expect(CONTENT.allCards().filter((c) => c.owner === 'moon').map((c) => c.id).sort()).toEqual(IDS);
  });

  describe.each([
    ['moon_crypt', 'skeleton', 3, 7],
    ['moon_vampires', 'vampire', 2, 5],
    ['moon_reaper_shrine', 'moon_reaper', 1, 2],
  ] as const)('%s spawns %s', (card, unit, l1, l5) => {
    it(`${l1} at level 1 and ${l5} at level 5`, () => {
      for (const [level, count] of [[1, l1], [5, l5]] as const) {
        const s = at(withBuilding(runState(), 6, card, level), 6);
        expect(s.spawn!.count).toBe(count);
        expect(s.spawn!.stats.unit).toBe(unit);
      }
    });
  });

  it('moon_crypt: its skeletons come back once at 50% HP; moon_reaper_shrine: killHeal 10 and +2% per Hồn', () => {
    expect(at(withBuilding(runState(), 6, 'moon_crypt', 1), 6).spawn!.stats.behaviours).toContainEqual({ type: 'reviveOnce', hpPct: 50 });
    expect(at(withBuilding(runState(), 6, 'moon_reaper_shrine', 1), 6).spawn!.stats.behaviours).toEqual([
      { type: 'killHeal', hp: 10 },
      { type: 'soulScaling', pctPerSoul: 2 },
    ]);
  });

  describe('moon_shadow_spire', () => {
    it('shoots 7 magic at range 72 every 10 ticks, shell speed 8', () => {
      for (const level of [1, 5] as Level[]) {
        const s = at(withBuilding(runState(), 6, 'moon_shadow_spire', level), 6);
        expect(s.attack!.dmg).toBeCloseTo(7 * TOWER_STD[level - 1]!);
        expect([s.attack!.dmgType, s.attack!.range, s.attack!.interval, s.attack!.projectileSpeed]).toEqual([
          'magic',
          72 + TOWER_RANGE[level - 1]!,
          10,
          8,
        ]);
        expect(s.summonOnKill!.max).toBe(level === 1 ? 3 : 8);
        expect(s.summonOnKill!.stats.unit).toBe('wraith');
      }
    });

    it('raises a wraith for each foe it kills, up to 3 per battle at level 1', () => {
      const w = createBattle(setupOf(quiet(withBuilding(runState(), 6, 'moon_shadow_spire', 1))));
      const tower = 1;
      const kill = (): void => {
        const foe = addUnit(w, unitStats({ hp: 1, speed: 0, dmg: 0, interval: 0 }), TEAM_FOE, 150, 150, 150, 150, -1);
        w.hp[foe] = 0;
        w.killerId[foe] = tower;
        w.killerUid[foe] = 106;
        w.tick += 1;
        stepBattle(w, []);
      };
      for (let i = 0; i < 5; i++) kill();
      expect(living(w, 'wraith')).toBe(3);
    });

    it('a wraith made by a kill is marked as a summon and never raised by another tower kill', () => {
      const w = createBattle(setupOf(quiet(withBuilding(runState(), 6, 'moon_shadow_spire', 1))));
      const foe = addUnit(w, unitStats({ hp: 1, speed: 0, dmg: 0, interval: 0 }), TEAM_FOE, 150, 150, 150, 150, -1);
      w.hp[foe] = 0;
      w.killerId[foe] = 1;
      stepBattle(w, []);
      const wraith = [...Array(w.count).keys()].find((i) => w.label[i] === 'wraith' && w.team[i] === TEAM_ALLY)!;
      expect(wraith).toBeDefined();
      expect(w.sourceUid[wraith]).toBe(106);
    });
  });

  describe('moon_blood_pact', () => {
    const ench = (card: string, stacks: number) => ({ enchants: rune(card, stacks) });

    it('sacrifices a level-3 building for 9 gold and moves its runes to the Ngai in order, up to 4 stacks', () => {
      let s = { ...runState(), gold: 0 };
      s = withBuilding(s, 6, 'wheat_militia', 3, {
        enchants: [
          { cardId: 'arcane_haste_rune' as CardId, stacks: 2 },
          { cardId: 'arcane_spark_rune' as CardId, stacks: 3 },
        ],
      });
      const next = ok(play(s, 'moon_blood_pact', { kind: 'plot', plot: 6 }));
      expect(next.gold).toBe(9);
      expect(next.plots[6]!.building).toBeNull();
      const throne = next.plots[12]!.building!;
      expect(throne.enchants).toEqual([
        { cardId: 'arcane_haste_rune', stacks: 2 },
        { cardId: 'arcane_spark_rune', stacks: 2 }, // the 4-stack limit stops the third
      ]);
      expect(next.stats.goldEarned).toBe(s.stats.goldEarned + 9);
    });

    it('leaves runes the Ngai cannot wear behind, and refuses the Ngai itself', () => {
      const s = withBuilding(runState(), 6, 'wheat_militia', 1, ench('wheat_fertilizer', 2));
      const next = ok(play(s, 'moon_blood_pact', { kind: 'plot', plot: 6 }));
      expect(next.plots[12]!.building!.enchants).toEqual([]);
      expect('error' in play(s, 'moon_blood_pact', { kind: 'plot', plot: 12 })).toBe(true);
    });

    it('counts as a sacrifice for the altar and the offering quest', () => {
      let s = withBuilding(runState(), 6, 'wheat_militia', 2);
      s = withBuilding(s, 7, 'moon_altar', 1);
      const next = ok(play(s, 'moon_blood_pact', { kind: 'plot', plot: 6 }));
      expect(next.plots[7]!.building!.counters.offerings).toBe(1);
    });
  });

  describe('moon_blood_moon_rune', () => {
    it('gives +30% damage and -10% health per stack, never below the 30% floor', () => {
      const plain = at(withBuilding(runState(), 6, 'moon_crypt', 1), 6).spawn!.stats;
      const one = at(withBuilding(runState(), 6, 'moon_crypt', 1, { enchants: rune('moon_blood_moon_rune', 1) }), 6).spawn!.stats;
      expect(one.dmg).toBeCloseTo(plain.dmg * 1.3);
      expect(one.hp).toBeCloseTo(plain.hp * 0.9);
      const four = at(withBuilding(runState(), 6, 'moon_crypt', 1, { enchants: rune('moon_blood_moon_rune', 4) }), 6).spawn!.stats;
      expect(four.hp).toBeCloseTo(plain.hp * 0.6);
      const tower = at(withBuilding(runState(), 6, 'moon_shadow_spire', 1, { enchants: rune('moon_blood_moon_rune', 1) }), 6);
      const bare = at(withBuilding(runState(), 6, 'moon_shadow_spire', 1), 6);
      expect(tower.hp).toBeCloseTo(bare.hp * 0.9);
      expect(tower.attack!.dmg).toBeCloseTo(bare.attack!.dmg * 1.3);
    });
  });

  describe('moon_altar', () => {
    it('counts an offering each time a sacrifice card is played, including a neutral Demolish', () => {
      let s = withBuilding(runState(), 7, 'moon_altar', 1);
      s = withBuilding(s, 6, 'wheat_militia', 1);
      const once = ok(play(s, 'neutral_demolish', { kind: 'plot', plot: 6 }));
      expect(once.plots[7]!.building!.counters.offerings).toBe(1);
      const other = ok(play(s, 'wheat_militia', { kind: 'plot', plot: 8 }));
      expect(other.plots[7]!.building!.counters.offerings).toBeUndefined();
    });

    it('summons offerings x 1 (level 1) / x 3 (level 5) wraiths, capped at 12 / 20', () => {
      const withOfferings = (level: Level, n: number) => at(withBuilding(runState(), 7, 'moon_altar', level, { counters: { offerings: n } }), 7).startSummon;
      expect(withOfferings(1, 0)).toBeUndefined();
      expect(withOfferings(1, 5)!.count).toBe(5);
      expect(withOfferings(1, 99)!.count).toBe(12);
      expect(withOfferings(5, 4)!.count).toBe(12);
      expect(withOfferings(5, 99)!.count).toBe(20);
      expect(withOfferings(1, 5)!.stats.unit).toBe('wraith');
    });

    it('puts the wraiths on the field at tick 0 and keeps the count after a JSON reload', () => {
      const s = withBuilding(runState(), 7, 'moon_altar', 1, { counters: { offerings: 4 } });
      const w = createBattle(setupOf(quiet(s)));
      expect(living(w, 'wraith')).toBe(4);
      const reloaded = JSON.parse(JSON.stringify(s)) as RunState;
      expect(living(createBattle(setupOf(quiet(reloaded))), 'wraith')).toBe(4);
    });
  });

  describe('moon_summoning_circle', () => {
    it('summons every 80 ticks (level 1) or 40 (level 5), at most 8 a battle', () => {
      expect(at(withBuilding(runState(), 6, 'moon_summoning_circle', 1), 6).summonEvery).toMatchObject({ everyTicks: 80, max: 8 });
      expect(at(withBuilding(runState(), 6, 'moon_summoning_circle', 5), 6).summonEvery).toMatchObject({ everyTicks: 40, max: 8 });
      const w = createBattle(setupOf(quiet(withBuilding(runState(), 6, 'moon_summoning_circle', 5))));
      for (let i = 0; i < 39; i++) stepBattle(w, []);
      expect(living(w, 'wraith')).toBe(0);
      while (w.tick < 41) stepBattle(w, []);
      expect(living(w, 'wraith')).toBe(1);
      while (w.tick < 700) stepBattle(w, []);
      expect(living(w, 'wraith')).toBe(8);
    });
  });

  describe('moon_eclipse_pact', () => {
    const lifeState = (lives: number) => withBuilding({ ...runState(), lives, gold: 0 }, 6, 'wheat_militia', 1);

    it('costs a life, adds 2 levels (up to 5) and pays 5 gold', () => {
      const next = ok(play(lifeState(2), 'moon_eclipse_pact', { kind: 'plot', plot: 6 }));
      expect([next.lives, next.plots[6]!.building!.level, next.gold]).toEqual([1, 3, 5]);
      const high = withBuilding({ ...runState(), lives: 3, gold: 0 }, 6, 'wheat_militia', 4);
      expect(ok(play(high, 'moon_eclipse_pact', { kind: 'plot', plot: 6 })).plots[6]!.building!.level).toBe(5);
    });

    it('is refused on the last life with lastLife and nothing changes', () => {
      const s = lifeState(1);
      const before = structuredClone(s);
      expect(play(s, 'moon_eclipse_pact', { kind: 'plot', plot: 6 })).toEqual({ error: 'lastLife' });
      expect(s).toEqual(before);
    });
  });

  it('no perk or throne of the Moon King is playable: only the nine cards exist', () => {
    expect(() => CONTENT.king('moon')).toThrow();
    expect(CONTENT.allCards().some((c) => c.id === 'moon_throne')).toBe(false);
    expect(collectStatSheet(withBuilding(runState(), 6, 'moon_crypt', 1), CONTENT, 6).hp.pct).toBe(0);
  });
});
