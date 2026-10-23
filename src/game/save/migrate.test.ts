import { describe, expect, it } from 'vitest';
import { RULES_G2 } from '../../data/rules';
import type { RunState } from '../run/state';
import { newRun } from '../run/yearFlow';
import { CONTENT } from '../cards/registry';
import { decodeRun } from './codec';
import { migrateRunState } from './migrate';

/** A state exactly as the version-3 game wrote it: the version 4 fields removed. */
const asV3 = (s: RunState): Record<string, unknown> => {
  const v3: Record<string, unknown> = structuredClone(s) as unknown as Record<string, unknown>;
  v3.version = 3;
  for (const k of ['pendingOffers', 'decrees', 'quests', 'offeredQuestIds', 'freeRerollsLeft', 'interventionDmgPct', 'difficulty', 'yearStartPendingDraw', 'paidRerollsThisYear']) {
    delete v3[k];
  }
  const rng = v3.rng as Record<string, number>;
  delete rng.council;
  delete rng.quest;
  const stats = v3.stats as Record<string, unknown>;
  for (const k of ['bossesWon', 'bossesDefeated', 'completedYears']) delete stats[k];
  for (const p of v3.plots as { building: Record<string, unknown> | null }[]) {
    if (p.building) for (const k of ['ageBonus', 'counters', 'movedYear']) delete p.building[k];
  }
  return v3;
};

describe('migrate_v3_to4', () => {
  const base = (): RunState => {
    const s = newRun(8, 'stone', CONTENT, RULES_G2);
    return { ...s, gold: 11, rerollsThisYear: 2, stats: { ...s.stats, battlesWon: 3, battlesLost: 1, kills: 40 } };
  };

  it('turns a version 3 state into version 4 keeping the run and adding neutral defaults', () => {
    const original = base();
    const migrated = migrateRunState(asV3(original)) as RunState;
    expect(migrated.version).toBe(4);
    expect(migrated).toMatchObject({
      seed: original.seed,
      year: original.year,
      rules: original.rules,
      hand: original.hand,
      drawPile: original.drawPile,
      discardPile: original.discardPile,
      army: original.army,
      gold: 11,
      enemies: original.enemies,
      enemyKings: original.enemyKings,
    });
    expect(migrated).toMatchObject({
      decrees: [],
      quests: [],
      offeredQuestIds: [],
      pendingOffers: [],
      freeRerollsLeft: 0,
      interventionDmgPct: 0,
      difficulty: 0,
      yearStartPendingDraw: false,
    });
    expect(migrated.paidRerollsThisYear).toBe(2);
    expect(migrated.stats).toMatchObject({ bossesWon: 0, bossesDefeated: [], completedYears: 4 });
    expect(migrated.plots[12]!.building).toMatchObject({ ageBonus: 0, counters: {}, movedYear: null });
  });

  it('seeds the council and quest streams from the run seed, and keeps the calendar stream as it was', () => {
    const original = base();
    const migrated = migrateRunState(asV3(original)) as RunState;
    expect(migrated.rng.council).toBe(original.rng.council);
    expect(migrated.rng.quest).toBe(original.rng.quest);
    expect(migrated.rng.calendar).toBe(original.rng.calendar);
    expect(migrated.rng.draw).toBe(original.rng.draw);
  });

  it('is exactly what a new version 4 run looks like when nothing was played yet', () => {
    const original = base();
    expect(migrateRunState(asV3({ ...original, stats: newRun(8, 'stone', CONTENT, RULES_G2).stats, rerollsThisYear: 0, gold: original.gold }))).toEqual(
      { ...original, stats: newRun(8, 'stone', CONTENT, RULES_G2).stats, rerollsThisYear: 0 },
    );
  });

  it('does not change its input', () => {
    const v3 = asV3(base());
    const copy = structuredClone(v3);
    migrateRunState(v3);
    expect(v3).toEqual(copy);
  });

  it('leaves version 4, version 1, 2, 5 and non-objects untouched', () => {
    const v4 = base();
    expect(migrateRunState(v4)).toBe(v4);
    for (const version of [1, 2, 5]) {
      const s = { ...asV3(v4), version };
      expect(migrateRunState(s)).toBe(s);
    }
    expect(migrateRunState('x')).toBe('x');
    expect(migrateRunState(null)).toBeNull();
  });

  it('decodeRun accepts a version 3 envelope and a bare version 3 state, as a valid version 4 run', () => {
    const original = base();
    const v3 = asV3(original);
    const inEnvelope = decodeRun({ formatVersion: 1, version: 3, contentHash: 1, state: v3 }, CONTENT);
    expect(inEnvelope.kind).toBe('ok');
    if (inEnvelope.kind === 'ok') expect(inEnvelope.state.version).toBe(4);
    expect(decodeRun(v3, CONTENT).kind).toBe('ok');
  });

  it('a state 3 that is damaged is still refused after migration', () => {
    const v3 = asV3(base());
    (v3.deck as string[])[0] = 'wheat_ghost';
    expect(decodeRun({ formatVersion: 1, version: 3, contentHash: 1, state: v3 }, CONTENT).kind).toBe('incompatible');
  });
});
