import { describe, expect, it } from 'vitest';
import type { DecreeId } from '../../data/types';
import { CONTENT } from '../cards/registry';
import { runState, withBuilding } from '../testing/fixtures';
import { attackStats, buildBattleSetup, structureFor } from './battleSetup';
import type { RunState } from './state';

const THRONE = 12;
const withDecree = (s: RunState, id: DecreeId): RunState => ({ ...s, decrees: [...s.decrees, id] });
const tower = (level: 1 | 2 | 3 | 4 | 5 = 5): RunState =>
  withBuilding(runState(), 6, 'neutral_archer_tower', level);

describe('shared effective structure stats', () => {
  it('shared_ranges_and_edge_semantics: L5 tower is 88 + 16, the royal archers decree adds 12', () => {
    expect(structureFor(tower(), 6, CONTENT).attack!.range).toBe(104);
    const decreed = withDecree(tower(), 'decree_royal_archers' as DecreeId);
    expect(structureFor(decreed, 6, CONTENT).attack!.range).toBe(116);
  });

  it('structureFor equals the structure of the same plot in buildBattleSetup, throne included', () => {
    const s = withDecree(withBuilding(tower(), 7, 'stone_mountain_heart', 5), 'decree_royal_archers' as DecreeId);
    const setup = buildBattleSetup(s, CONTENT);
    for (const plot of [6, 7]) {
      expect(structureFor(s, plot, CONTENT)).toEqual(setup.structures.find((x) => x.plot === plot));
    }
    expect(structureFor(s, THRONE, CONTENT)).toEqual(setup.throne);
  });

  it('pulse_is_runtime_not_invented_buff: Mountain Heart L5 radius is 48 + 16 and ignores the range decree', () => {
    const heart = withBuilding(runState(), 6, 'stone_mountain_heart', 5);
    expect(structureFor(heart, 6, CONTENT).pulse!.radius).toBe(64);
    const decreed = withDecree(heart, 'decree_royal_archers' as DecreeId);
    expect(structureFor(decreed, 6, CONTENT).pulse!.radius).toBe(64);
  });

  it('attackStats applies a flat range bonus on top of the base range', () => {
    const base = { dmg: 7, type: 'physical', range: 88, interval: 12, projectileSpeed: 8 } as const;
    expect(attackStats(base, 1, 16).range).toBe(104);
    expect(attackStats(base).range).toBe(88);
  });

  it('public_stats_do_not_mutate: two calls give the same answer on frozen input', () => {
    const s = tower();
    const frozen = structuredClone(s);
    const a = structureFor(s, 6, CONTENT);
    const b = structureFor(s, 6, CONTENT);
    expect(b).toEqual(a);
    expect(s).toEqual(frozen);
  });
});
