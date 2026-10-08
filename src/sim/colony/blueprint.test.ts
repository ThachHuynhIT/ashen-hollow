import { hasComponent } from 'bitecs';
import { describe, expect, it } from 'vitest';
import { Blueprint, Building } from '../components';
import { drainEvents } from '../events';
import { checkPlacement, createGameWorld } from '../GameWorld';
import { openTerrain } from '../testing/terrainFixture';
import {
  completeBlueprint,
  deliverToBlueprint,
  isBlueprint,
  isFullySupplied,
  missingMaterials,
  placeBlueprint,
  planWall,
  placeWall,
  reservePending,
} from './blueprint';
import { inTerritory } from './territory';

/** 512×512 px grass, Hearthfire at (256, 256). */
const world = () =>
  createGameWorld({
    seed: 1,
    map: { terrain: openTerrain(32, 32), doodads: [], start: { x: 256, y: 256 } },
  });

const navBlocked = (w: ReturnType<typeof world>, x: number, y: number) => {
  const { cx, cy } = w.nav.cellOf(x, y);
  return !w.nav.walkable(cx, cy);
};

describe('territory', () => {
  it('is a 192 px radius around the Hearthfire', () => {
    const w = world();
    expect(inTerritory(w, 256 + 192, 256)).toBe(true);
    expect(inTerritory(w, 256 + 193, 256)).toBe(false);
  });

  it('placement outside it is refused with a reason', () => {
    const w = world();
    // 200 px out: past the 192 px border but still inside the 512 px map.
    expect(checkPlacement(w, 'tent', 256 + 200, 256).reason).toBe('outOfTerritory');
    expect(checkPlacement(w, 'tent', 256 + 60, 256).ok).toBe(true);
  });
});

describe('blueprints', () => {
  it('a placed blueprint blocks placement but not movement, and costs nothing yet', () => {
    const w = world();
    const r = placeBlueprint(w, 'tent', 300, 256);
    expect(r.ok).toBe(true);
    const eid = r.eid!;
    expect(isBlueprint(w, eid)).toBe(true);
    expect(hasComponent(w.ecs, eid, Building)).toBe(true);
    expect(navBlocked(w, 300, 256)).toBe(false);
    expect(checkPlacement(w, 'tent', 304, 256).reason).toBe('building');
    expect(w.stock.get('wood')).toBe(30);
    expect(drainEvents(w)).toEqual([{ type: 'blueprintPlaced', eid }]);
  });

  it('tracks missing materials through pending and delivered amounts', () => {
    const w = world();
    const eid = placeBlueprint(w, 'watchtower', 300, 256).eid!; // 15 wood, 10 stone
    expect(missingMaterials(eid)).toEqual({ wood: 15, stone: 10 });
    reservePending(eid, 'wood', 10);
    expect(missingMaterials(eid)).toEqual({ wood: 5, stone: 10 });
    deliverToBlueprint(w, eid, 'wood', 10); // pending 10 → delivered 10
    expect(Blueprint.pending[0]![eid]).toBe(0);
    expect(missingMaterials(eid)).toEqual({ wood: 5, stone: 10 });
    expect(isFullySupplied(eid)).toBe(false);
    reservePending(eid, 'wood', 5);
    deliverToBlueprint(w, eid, 'wood', 5);
    reservePending(eid, 'stone', 10);
    deliverToBlueprint(w, eid, 'stone', 10);
    expect(missingMaterials(eid)).toEqual({});
    expect(isFullySupplied(eid)).toBe(true);
  });

  it('completing turns it into a solid building', () => {
    const w = world();
    const eid = placeBlueprint(w, 'tent', 300, 256).eid!;
    drainEvents(w);
    completeBlueprint(w, eid);
    expect(isBlueprint(w, eid)).toBe(false);
    expect(navBlocked(w, 300, 256)).toBe(true);
    expect(drainEvents(w)).toEqual([{ type: 'buildingCompleted', eid }]);
  });
});

describe('walls', () => {
  it('plans one stake every 8 px from A to B, inclusive', () => {
    const w = world();
    // |AB| = 40 → 40/8 + 1 = 6 stakes
    const plan = planWall(w, { x: 230, y: 300 }, { x: 270, y: 300 });
    expect(plan.map((p) => p.x)).toEqual([230, 238, 246, 254, 262, 270]);
    expect(plan.every((p) => p.ok)).toBe(true);
  });

  it('skips stakes that collide, places the rest as blueprints', () => {
    const w = world();
    placeBlueprint(w, 'tent', 254, 300); // occupies [242,266]×[293,307]
    const eids = placeWall(w, { x: 230, y: 300 }, { x: 270, y: 300 });
    // stakes at 246, 254, 262 overlap the tent; 230, 238, 270 survive
    expect(eids).toHaveLength(3);
    for (const eid of eids) expect(isBlueprint(w, eid)).toBe(true);
  });

  it('a zero-length drag places a single stake', () => {
    const w = world();
    expect(planWall(w, { x: 300, y: 300 }, { x: 300, y: 300 })).toHaveLength(1);
  });
});
