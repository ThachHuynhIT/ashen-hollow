import { describe, expect, it } from 'vitest';
import { BUILDINGS, BUILDING_IDS } from './buildings';
import { DOODADS, DOODAD_IDS } from './doodads';
import { COLONIST_NAMES } from './names';
import { RESOURCE_IDS } from './resources';

describe('Phase 1 game data', () => {
  it('building costs only use known resources, in positive amounts', () => {
    for (const id of BUILDING_IDS) {
      for (const [resource, amount] of Object.entries(BUILDINGS[id].cost)) {
        expect(RESOURCE_IDS).toContain(resource);
        expect(amount).toBeGreaterThan(0);
      }
    }
  });

  it('every player building takes time to build and costs something', () => {
    for (const id of BUILDING_IDS) {
      const def = BUILDINGS[id];
      if (!def.playerBuildable) continue;
      expect(def.buildTicks, id).toBeGreaterThan(0);
      expect(Object.keys(def.cost).length, id).toBeGreaterThan(0);
    }
  });

  it('a doodad is harvestable exactly when it yields something', () => {
    for (const id of DOODAD_IDS) {
      expect(DOODADS[id].harvest === null, id).toBe(DOODADS[id].yields === null);
    }
    expect(DOODADS.deadTree.harvest?.tool).toBe('chop');
    expect(DOODADS.boulder.harvest?.tool).toBe('mine');
    expect(DOODADS.glowShroom.harvest?.tool).toBe('forage');
  });

  it('only tents sleep people', () => {
    for (const id of BUILDING_IDS) {
      expect(BUILDINGS[id].sleepCapacity > 0, id).toBe(BUILDINGS[id].role === 'sleep');
    }
  });

  it('keeps existing building indices stable (they are stored in the ECS)', () => {
    expect(BUILDING_IDS.slice(0, 4)).toEqual(['hearthfire', 'tent', 'storage', 'watchtower']);
  });

  it('has at least 12 distinct colonist names', () => {
    expect(new Set(COLONIST_NAMES).size).toBeGreaterThanOrEqual(12);
  });
});
