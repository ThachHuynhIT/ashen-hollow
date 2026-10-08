import { describe, expect, it } from 'vitest';
import { drainEvents } from '../events';
import { createGameWorld, entityAt } from '../GameWorld';
import type { DoodadSpawn } from '../map/generate';
import { openTerrain } from '../testing/terrainFixture';
import { designate, designationOf, undesignate } from './designation';

const world = (doodads: DoodadSpawn[]) =>
  createGameWorld({
    seed: 1,
    map: { terrain: openTerrain(32, 32), doodads, start: { x: 256, y: 256 } },
  });

const box = (minX: number, minY: number, maxX: number, maxY: number) => ({
  minX,
  minY,
  maxX,
  maxY,
});

describe('designate', () => {
  const doodads: DoodadSpawn[] = [
    { kind: 'deadTree', x: 100, y: 100 },
    { kind: 'deadTree', x: 130, y: 100 },
    { kind: 'boulder', x: 160, y: 100 },
    { kind: 'glowShroom', x: 115, y: 120 },
    { kind: 'boneHeap', x: 145, y: 120 },
  ];

  it('only marks doodads that match the tool', () => {
    const w = world(doodads);
    const marked = designate(w, box(80, 80, 180, 140), 'chop');
    expect(marked).toHaveLength(2);
    for (const eid of marked) expect(designationOf(w, eid)).toBe('chop');
    expect(designationOf(w, entityAt(w, 160, 100)!)).toBeNull();
    expect(designationOf(w, entityAt(w, 115, 120)!)).toBeNull();
    expect(drainEvents(w)).toEqual([{ type: 'designationChanged', eids: marked }]);
  });

  it('catches doodads whose collider just touches the box edge', () => {
    const w = world(doodads);
    // Tree at (100,100) r=4 reaches x=104; box starts at x=103.
    expect(designate(w, box(103, 90, 110, 110), 'chop')).toHaveLength(1);
  });

  it('does not re-report doodads that were already designated', () => {
    const w = world(doodads);
    designate(w, box(80, 80, 180, 140), 'chop');
    drainEvents(w);
    expect(designate(w, box(80, 80, 180, 140), 'chop')).toEqual([]);
    expect(drainEvents(w)).toEqual([]);
  });

  it('undesignate clears every kind in the area', () => {
    const w = world(doodads);
    designate(w, box(80, 80, 180, 140), 'chop');
    designate(w, box(80, 80, 180, 140), 'mine');
    designate(w, box(80, 80, 180, 140), 'forage');
    drainEvents(w);
    const cleared = undesignate(w, box(80, 80, 180, 140));
    expect(cleared).toHaveLength(4);
    for (const eid of cleared) expect(designationOf(w, eid)).toBeNull();
  });
});
