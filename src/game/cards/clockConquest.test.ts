import { describe, expect, it } from 'vitest';
import { TOWER_RANGE, TOWER_STD } from '../../data/scaling';
import type { CardId, Level } from '../../data/types';
import { tickBehaviours } from '../battle/behaviours';
import { stepBattle } from '../battle/step';
import { TEAM_ALLY, TEAM_FOE, addUnit, createBattle, type BattleWorld } from '../battle/world';
import { buildBattleSetup } from '../run/battleSetup';
import { applyCommand } from '../run/commands';
import { yearIncome } from '../run/income';
import { collectStatSheet } from '../run/modifiers';
import type { RunState } from '../run/state';
import { runState, unitStats, withBuilding } from '../testing/fixtures';
import { CONTENT } from './registry';

const IDS = [
  'clock_bell_tower',
  'clock_colossus',
  'clock_gear_tower',
  'clock_rewind',
  'clock_spiders',
  'clock_spring_workshop',
  'clock_steam_cannon',
  'clock_tick_rune',
  'clock_windup_soldiers',
];

const setupOf = (s: RunState) => buildBattleSetup(s, CONTENT);
const at = (s: RunState, plot: number) => setupOf(s).structures.find((x) => x.plot === plot)!;
const incomeOf = (s: RunState): number => yearIncome(s, CONTENT, s.gold).delta;
const tick = (w: BattleWorld, t: number): void => {
  w.tick = t;
  tickBehaviours(w);
};
const tickRune = (stacks: number) => [{ cardId: 'clock_tick_rune' as CardId, stacks }];
const playOn = (s: RunState, card: string, plot: number): RunState => {
  const r = applyCommand(
    { ...s, hand: [card as CardId, ...s.hand.slice(1)] },
    { type: 'play', handIndex: 0, target: { kind: 'plot', plot } },
    CONTENT,
  );
  if ('error' in r) throw new Error(r.error);
  return r.state;
};
/** The id of the structure on `plot` inside a world built from `s` (throne is id 0, structures follow by plot). */
const idOfPlot = (w: BattleWorld, plot: number): number => {
  for (let i = 0; i < w.count; i++) if (w.setup.throne.plot === plot ? i === 0 : false) return i;
  const plots = w.setup.structures.map((x) => x.plot).sort((a, b) => a - b);
  return 1 + plots.indexOf(plot);
};

describe('the nine Clock King cards (spec 6.9)', () => {
  it('conquering the Clock King offers exactly these nine, never the throne', () => {
    expect(CONTENT.conquestCards('clock').map((c) => c.id).sort()).toEqual(IDS);
    expect(CONTENT.allCards().filter((c) => c.owner === 'clock').map((c) => c.id).sort()).toEqual(IDS);
  });

  describe.each([
    ['clock_windup_soldiers', 'tin_soldier', 4, 8],
    ['clock_spiders', 'spider', 3, 7],
    ['clock_colossus', 'colossus', 1, 2],
  ] as const)('%s spawns %s', (card, unit, l1, l5) => {
    it(`${l1} at level 1 and ${l5} at level 5`, () => {
      for (const [level, count] of [[1, l1], [5, l5]] as const) {
        const s = at(withBuilding(runState(), 6, card, level), 6);
        expect(s.spawn!.count).toBe(count);
        expect(s.spawn!.stats.unit).toBe(unit);
      }
    });
  });

  describe('clock_gear_tower and clock_steam_cannon', () => {
    it('gear tower: 5 physical, range 72, every 10 ticks, shell speed 8, +2%/s up to +100%', () => {
      for (const level of [1, 5] as Level[]) {
        const s = at(withBuilding(runState(), 6, 'clock_gear_tower', level), 6);
        expect(s.attack!.dmg).toBeCloseTo(5 * TOWER_STD[level - 1]!);
        expect([s.attack!.range, s.attack!.interval, s.attack!.projectileSpeed]).toEqual([72 + TOWER_RANGE[level - 1]!, 10, 8]);
        expect(s.rampAs).toEqual({ pps: 2, cap: 100 });
      }
    });

    it('steam cannon: 30 physical, splash 18, range 104, every 40, +1.5%/s up to +90%', () => {
      const s = at(withBuilding(runState(), 6, 'clock_steam_cannon', 1), 6);
      expect(s.attack).toMatchObject({ dmg: 30, splash: 18, range: 104, interval: 40, projectileSpeed: 5 });
      expect(s.rampAs).toEqual({ pps: 1.5, cap: 90 });
    });

    it('in battle the gear tower shoots faster as seconds pass, and never faster than half the interval', () => {
      const w = createBattle(setupOf(withBuilding(runState(), 6, 'clock_gear_tower', 1)));
      const id = idOfPlot(w, 6);
      tick(w, 0);
      expect(w.interval[id]).toBe(10);
      tick(w, 300); // 30 s => +60%
      expect(w.interval[id]).toBeCloseTo(10 / 1.6);
      tick(w, 800); // capped at +100% => exactly half
      expect(w.interval[id]).toBeCloseTo(5);
    });
  });

  describe('clock_spring_workshop', () => {
    it('earns +1 gold at level 1 and +3 at level 5', () => {
      const none = incomeOf(runState());
      expect(incomeOf(withBuilding(runState(), 6, 'clock_spring_workshop', 1)) - none).toBe(1);
      expect(incomeOf(withBuilding(runState(), 6, 'clock_spring_workshop', 5)) - none).toBe(3);
    });

    it('winds neighbours ahead by 10 s (level 1) to 20 s (level 5), towers and troops alike', () => {
      for (const [level, secs] of [[1, 10], [5, 20]] as const) {
        const s = withBuilding(withBuilding(withBuilding(runState(), 6, 'clock_spring_workshop', level), 7, 'clock_windup_soldiers'), 1, 'clock_gear_tower');
        expect(at(s, 7).spawn!.stats.prewind).toBe(secs);
        expect(at(s, 1).prewind).toBe(secs);
        expect(collectStatSheet(s, CONTENT, 8).prewind.flat).toBe(0);
      }
    });

    it('a prewound tin soldier hits harder from the very first tick', () => {
      const s = withBuilding(withBuilding(runState(), 6, 'clock_spring_workshop', 1), 7, 'clock_windup_soldiers');
      const w = createBattle(setupOf(s));
      const soldier = [...Array(w.count).keys()].find((i) => w.label[i] === 'tin_soldier')!;
      tick(w, 0);
      expect(w.dmg[soldier]).toBeCloseTo(w.baseDmg[soldier]! * 1.2); // 10 s x 2%/s
    });
  });

  describe('clock_tick_rune', () => {
    it('adds +1%/s with a +30% cap per stack to a tower on top of its own ramp', () => {
      const s = at(withBuilding(runState(), 6, 'clock_gear_tower', 1, { enchants: tickRune(2) }), 6);
      expect(s.rampAs).toEqual({ pps: 4, cap: 160 });
    });

    it('gives troops an attack speed ramp, and a bare tower gets one too', () => {
      const troop = at(withBuilding(runState(), 6, 'clock_windup_soldiers', 1, { enchants: tickRune(1) }), 6).spawn!.stats;
      expect(troop.behaviours).toContainEqual({ type: 'rampAttackSpeed', pctPerSecond: 1, cap: 30 });
      const bare = at(withBuilding(runState(), 6, 'forge_flame_tower', 1, { enchants: tickRune(1) }), 6);
      expect(bare.rampAs).toEqual({ pps: 1, cap: 30 });
    });
  });

  describe('clock_bell_tower', () => {
    it('is a 100-tick, 80 px pulse of +25% (L1) to +45% (L5) attack speed for 30 ticks; stun from level 3', () => {
      for (const [level, pct, stun] of [[1, 25, 0], [2, 30, 0], [3, 35, 5], [5, 45, 5]] as const) {
        expect(at(withBuilding(runState(), 6, 'clock_bell_tower', level), 6).bell).toEqual({
          everyTicks: 100,
          radius: 80,
          pct,
          ticks: 30,
          stun,
        });
      }
    });

    it('speeds our units up for 30 ticks only, and stuns foes in range from level 3', () => {
      const setup = (level: Level) => setupOf(withBuilding(runState(), 6, 'clock_bell_tower', level));
      const w = createBattle(setup(3));
      const ally = addUnit(w, unitStats({ hp: 100, dmg: 5, interval: 10, speed: 0 }), TEAM_ALLY, 170, 160, 170, 160, 9);
      const foe = addUnit(w, unitStats({ hp: 1000, dmg: 0, interval: 0, speed: 0 }), TEAM_FOE, 150, 170, 150, 170, -1);
      const far = addUnit(w, unitStats({ hp: 1000, dmg: 0, interval: 0, speed: 0 }), TEAM_FOE, 380, 380, 380, 380, -1);
      while (w.tick < 100) stepBattle(w, []);
      expect(w.interval[ally]).toBe(10);
      stepBattle(w, []); // tick 100: the bell rings
      expect(w.interval[ally]).toBeCloseTo(10 / 1.35);
      expect(w.stunTicks[foe]).toBeGreaterThan(0);
      expect(w.stunTicks[far]).toBe(0);
      while (w.tick < 131) stepBattle(w, []);
      expect(w.interval[ally]).toBe(10);
      const calm = createBattle(setup(1));
      const foe1 = addUnit(calm, unitStats({ hp: 1000, dmg: 0, interval: 0, speed: 0 }), TEAM_FOE, 150, 170, 150, 170, -1);
      while (calm.tick <= 100) stepBattle(calm, []);
      expect(calm.stunTicks[foe1]).toBe(0);
    });
  });

  describe('clock_spiders respawn', () => {
  /** A battle that stays open and quiet: the only wave arrives at tick 800 and is empty. */
  const quiet = (s: RunState): RunState => ({
    ...s,
    army: { ...s.army!, waves: [{ spawnTick: 800, units: [] }] },
  });
    it('brings back one spider every 150 ticks while below the original count, never above', () => {
      const w = createBattle(setupOf(quiet(withBuilding(runState(), 6, 'clock_spiders', 1))));
      const alive = (): number => [...Array(w.count).keys()].filter((i) => w.alive[i] === 1 && w.label[i] === 'spider').length;
      expect(alive()).toBe(3);
      const first = [...Array(w.count).keys()].find((i) => w.label[i] === 'spider')!;
      w.hp[first] = 0;
      w.alive[first] = 0;
      while (w.tick < 149) stepBattle(w, []);
      expect(alive()).toBe(2);
      while (w.tick < 151) stepBattle(w, []);
      expect(alive()).toBe(3);
      while (w.tick < 310) stepBattle(w, []);
      expect(alive()).toBe(3); // nothing missing: nothing more is made
    });

    it('does not respawn once the nest itself is destroyed', () => {
      const w = createBattle(setupOf(quiet(withBuilding(runState(), 6, 'clock_spiders', 1))));
      const nest = idOfPlot(w, 6);
      const first = [...Array(w.count).keys()].find((i) => w.label[i] === 'spider')!;
      w.alive[nest] = 0;
      w.alive[first] = 0;
      while (w.tick < 160) stepBattle(w, []);
      expect([...Array(w.count).keys()].filter((i) => w.alive[i] === 1 && w.label[i] === 'spider')).toHaveLength(2);
    });
  });

  describe('clock_rewind', () => {
    const rewound = (times: number): RunState => {
      let s = withBuilding(runState(), 6, 'clock_gear_tower', 1);
      for (let i = 0; i < times; i++) s = playOn({ ...s, played: false }, 'clock_rewind', 6);
      return s;
    };

    it('adds 5 s of prewind each time, up to 30 s, kept on the building', () => {
      expect(rewound(1).plots[6]!.building!.counters.prewind).toBe(5);
      expect(rewound(3).plots[6]!.building!.counters.prewind).toBe(15);
      expect(rewound(9).plots[6]!.building!.counters.prewind).toBe(30);
      expect(at(rewound(2), 6).prewind).toBe(10);
    });

    it('survives moving the building and a JSON reload', () => {
      const s = rewound(2);
      const moved = { ...s, plots: s.plots.map((p, i) => (i === 7 ? s.plots[6]! : i === 6 ? s.plots[7]! : p)) };
      expect(at(moved, 7).prewind).toBe(10);
      const reloaded = JSON.parse(JSON.stringify(s)) as RunState;
      expect(at(reloaded, 6).prewind).toBe(10);
    });

    it('cannot target the Ngai', () => {
      const r = applyCommand(
        { ...runState(), hand: ['clock_rewind' as CardId, ...runState().hand.slice(1)] },
        { type: 'play', handIndex: 0, target: { kind: 'plot', plot: 12 } },
        CONTENT,
      );
      expect('error' in r).toBe(true);
    });
  });
});
