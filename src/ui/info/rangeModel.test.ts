import { describe, expect, it } from 'vitest';
import type { DecreeId } from '../../data/types';
import { BATTLE } from '../../data/battle';
import { createBattle, type BattleWorld } from '../../game/battle/world';
import { CONTENT } from '../../game/cards/registry';
import { buildBattleSetup } from '../../game/run/battleSetup';
import type { RunState } from '../../game/run/state';
import { runState, withBuilding } from '../../game/testing/fixtures';
import { buildingRanges, entityRanges } from './rangeModel';

const tower = (decrees: DecreeId[] = []): RunState => ({
  ...withBuilding(runState(), 6, 'neutral_archer_tower', 5),
  decrees,
});
const worldOf = (s: RunState): BattleWorld => createBattle(buildBattleSetup(s, CONTENT));

describe('buildingRanges', () => {
  it('ranges_share_setup: the royal archers decree gives 116 plus the structure radius', () => {
    const r = buildingRanges(tower(['decree_royal_archers' as DecreeId]), 6, CONTENT);
    expect(r.find((x) => x.kind === 'attack')!.radius).toBe(116 + BATTLE.structureRadius);
    const plain = buildingRanges(tower(), 6, CONTENT);
    expect(plain.find((x) => x.kind === 'attack')!.radius).toBe(104 + BATTLE.structureRadius);
  });

  it('Mountain Heart L5 pulses at 64 from its centre, with no attack ring', () => {
    const s = withBuilding(runState(), 6, 'stone_mountain_heart', 5);
    const r = buildingRanges(s, 6, CONTENT);
    expect(r.find((x) => x.kind === 'pulse')!.radius).toBe(64);
    expect(r.some((x) => x.kind === 'attack')).toBe(false);
  });

  it('draws no ring for a building without range, and none for an empty plot', () => {
    expect(buildingRanges(withBuilding(runState(), 6, 'wheat_militia', 1), 6, CONTENT)).toEqual([]);
    expect(buildingRanges(runState(), 0, CONTENT)).toEqual([]);
  });

  it('labels edge-to-edge and centre-based rings differently', () => {
    const a = buildingRanges(tower(), 6, CONTENT).find((x) => x.kind === 'attack')!;
    expect(a.label).toContain('mép');
  });

  it('does not mutate the state', () => {
    const s = tower();
    const copy = structuredClone(s);
    buildingRanges(s, 6, CONTENT);
    expect(s).toEqual(copy);
  });
});

describe('entityRanges', () => {
  it('uses the live world range and radius of a tower', () => {
    const s = tower();
    const w = worldOf(s);
    const id = [...Array(w.count).keys()].find((i) => w.sourceUid[i] === s.plots[6]!.building!.uid && w.isTower[i] === 1)!;
    const r = entityRanges(w, id);
    expect(r.find((x) => x.kind === 'attack')!.radius).toBe(w.range[id]! + w.radius[id]!);
    w.range[id] = 200; // a live change must show, the UnitDef/setup value must not be used
    expect(entityRanges(w, id).find((x) => x.kind === 'attack')!.radius).toBe(200 + w.radius[id]!);
  });

  it('answers empty for invalid or dead ids', () => {
    const w = worldOf(tower());
    expect(entityRanges(w, -1)).toEqual([]);
    expect(entityRanges(w, w.count)).toEqual([]);
    w.alive[w.throneId] = 0;
    expect(entityRanges(w, w.throneId)).toEqual([]);
  });
});
