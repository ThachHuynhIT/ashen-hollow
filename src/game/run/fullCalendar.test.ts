import { describe, expect, it } from 'vitest';
import { Rng, hashSeed } from '../../core/random';
import { ALL_KINGS, RULES_FULL, RULES_G1, RULES_G2 } from '../../data/rules';
import { CONTENT } from '../cards/registry';
import { buildBattleSetup } from './battleSetup';
import { calendarFor, pickEnemyKings, pickEnemyKingsWithState, slotMultFor } from './calendar';
import { newRun, startYear } from './yearFlow';

/** Spec 3.5 table, one code per year: N raiders, Kx.y king x attack y, Cab coalition, B1..B3 bosses. */
const EXPECTED = [
  'N', 'N', 'K1.1', 'K2.1', 'N', 'K1.2', 'K3.1', 'K2.2', 'K1.3', 'B1',
  'K3.2', 'K4.1', 'K2.3', 'N', 'K5.1', 'K3.3', 'K4.2', 'K6.1', 'K5.2', 'B2',
  'K4.3', 'K6.2', 'C12', 'K5.3', 'C34', 'K6.3', 'C56', 'C14', 'C25', 'B3',
];
const code = (s: ReturnType<typeof calendarFor>[number]): string => {
  switch (s.kind) {
    case 'raiders':
      return 'N';
    case 'king':
      return `K${s.king}.${s.attack}`;
    case 'coalition':
      return `C${s.kings[0]}${s.kings[1]}`;
    case 'boss':
      return `B${s.ordinal}`;
  }
};

describe('the 30-year calendar of spec 3.5', () => {
  it('matches the table year by year', () => {
    expect(RULES_FULL).toEqual({ years: 30, calendar: 'full', autoStart: false });
    expect(calendarFor(RULES_FULL).map(code)).toEqual(EXPECTED);
  });

  it('attacks each of the six kings exactly three times, in order, at least three years apart', () => {
    const slots = calendarFor(RULES_FULL);
    for (const king of [1, 2, 3, 4, 5, 6] as const) {
      const years = slots.flatMap((s, i) => (s.kind === 'king' && s.king === king ? [i + 1] : []));
      expect(years, `K${king}`).toHaveLength(3);
      for (let i = 1; i < years.length; i++) expect(years[i]! - years[i - 1]!).toBeGreaterThanOrEqual(3);
      expect(slots.flatMap((s) => (s.kind === 'king' && s.king === king ? [s.attack] : []))).toEqual([1, 2, 3]);
    }
  });

  it('puts the coalitions on 23, 25, 27, 28, 29 and the bosses on 10, 20, 30', () => {
    const slots = calendarFor(RULES_FULL);
    expect(slots[22]).toEqual({ kind: 'coalition', kings: [1, 2] });
    expect(slots[24]).toEqual({ kind: 'coalition', kings: [3, 4] });
    expect(slots[26]).toEqual({ kind: 'coalition', kings: [5, 6] });
    expect(slots[27]).toEqual({ kind: 'coalition', kings: [1, 4] });
    expect(slots[28]).toEqual({ kind: 'coalition', kings: [2, 5] });
    expect([9, 19, 29].map((i) => slots[i])).toEqual([
      { kind: 'boss', boss: 'boss_bog_ogre', ordinal: 1 },
      { kind: 'boss', boss: 'boss_hornet_queen', ordinal: 2 },
      { kind: 'boss', boss: 'boss_crownless_king', ordinal: 3 },
    ]);
  });

  it('maps every slot to its budget multiplier of spec 3.6', () => {
    expect(slotMultFor({ kind: 'coalition', kings: [1, 2] })).toBe(1.1);
    expect([1, 2, 3].map((o) => slotMultFor({ kind: 'boss', boss: 'boss_bog_ogre', ordinal: o as 1 | 2 | 3 }))).toEqual([1.5, 1.75, 2.0]);
    expect(slotMultFor({ kind: 'king', king: 5, attack: 3 })).toBe(1.2);
  });

  it('keeps the older calendars exactly as they were', () => {
    expect(calendarFor(RULES_G2)).toHaveLength(15);
    expect(calendarFor(RULES_G1).every((s) => s.kind === 'raiders')).toBe(true);
  });
});

describe('the six enemy kings', () => {
  it('are six of the eight others, shuffled by the calendar stream, and the stream state is kept', () => {
    const { kings, rngState } = pickEnemyKingsWithState(7, 'wheat', ALL_KINGS, 6);
    expect(kings).toHaveLength(6);
    expect(new Set(kings).size).toBe(6);
    expect(kings).not.toContain('wheat');
    for (const k of kings) expect(ALL_KINGS).toContain(k);
    expect(pickEnemyKingsWithState(7, 'wheat', ALL_KINGS, 6)).toEqual({ kings, rngState });
    expect(rngState).not.toBe(hashSeed('7:calendar'));
    const run = newRun(7, 'wheat', CONTENT, RULES_FULL);
    expect(run.enemyKings).toEqual(kings);
    expect(run.rng.calendar).toBe(rngState);
    expect(Object.keys(run.enemies).sort()).toEqual([...kings].sort());
    // a different seed gives a different pick somewhere in a handful of seeds
    const orders = new Set([1, 2, 3, 4, 5, 6].map((s) => pickEnemyKingsWithState(s, 'wheat', ALL_KINGS, 6).kings.join()));
    expect(orders.size).toBeGreaterThan(1);
  });

  it('leave the two-king pick of the shorter runs unchanged', () => {
    const pool = ['wheat', 'stone', 'arcane'] as const;
    expect(pickEnemyKings(5, 'wheat', pool)).toEqual(pickEnemyKingsWithState(5, 'wheat', pool, 2).kings);
    expect(new Rng(1).getState()).toBeDefined();
  });

  it('every one of them can be looked up as an enemy without error', () => {
    for (const seed of [1, 2, 3]) {
      for (const k of newRun(seed, 'stone', CONTENT, RULES_FULL).enemyKings) {
        expect(CONTENT.enemyKing(k).nameVi.length).toBeGreaterThan(0);
        expect(CONTENT.enemyRoster(k).length).toBeGreaterThan(0);
      }
    }
  });
});

describe('preview_equals_setup', () => {
  it.each(Array.from({ length: 30 }, (_, i) => i + 1))('year %i: the stored army is what the battle uses', (year) => {
    const base = newRun(11, 'wheat', CONTENT, RULES_FULL);
    const s = startYear({ ...base, year: year - 1 }, CONTENT);
    const army = s.army!;
    expect(army.waves.length).toBe(3);
    const setup = buildBattleSetup({ ...s, phase: 'battle' }, CONTENT);
    expect(setup.waves.map((w) => w.spawns.length)).toEqual(army.waves.map((w) => w.units.length));
    expect(setup.waves.flatMap((w) => w.spawns.map((x) => x.stats.unit))).toEqual(army.waves.flatMap((w) => w.units.map((u) => u.unit)));
    expect(setup.waves.flatMap((w) => w.spawns.map((x) => x.edge))).toEqual(army.waves.flatMap((w) => w.units.map((u) => u.edge)));
    const slot = calendarFor(RULES_FULL)[year - 1]!;
    // only a king's attack carries a banner
    expect(setup.banner !== undefined).toBe(slot.kind === 'king');
    expect(army.banner !== undefined).toBe(slot.kind === 'king');
    // the same state gives the same army again
    expect(startYear({ ...base, year: year - 1 }, CONTENT).army).toEqual(army);
  });
});
