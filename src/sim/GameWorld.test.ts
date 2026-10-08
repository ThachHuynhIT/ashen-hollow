import { hasComponent, query } from 'bitecs';
import { describe, expect, it } from 'vitest';
import { BUILDING_IDS } from '../data/buildings';
import { DOODADS, DOODAD_IDS } from '../data/doodads';
import { Building, Doodad, Position } from './components';
import {
  checkPlacement,
  createGameWorld,
  entityAt,
  placeBuilding,
  type GameWorld,
} from './GameWorld';
import { shapeBounds } from './geom';
import type { DoodadSpawn } from './map/generate';
import { openTerrain } from './testing/terrainFixture';

/** A hand-built 256×256 px grass world with the Hearthfire in the middle. */
const smallWorld = (doodads: DoodadSpawn[]) =>
  createGameWorld({
    seed: 1,
    map: { terrain: openTerrain(16, 16), doodads, start: { x: 128, y: 128 } },
  });

const navBlockedAt = (world: ReturnType<typeof createGameWorld>, x: number, y: number) => {
  const { cx, cy } = world.nav.cellOf(x, y);
  return !world.nav.walkable(cx, cy);
};

describe('createGameWorld', () => {
  const world = createGameWorld({ seed: 7 });

  it('lights the Hearthfire at the start and blocks the ground under it', () => {
    const fires = query(world.ecs, [Building]).filter(
      (eid) => BUILDING_IDS[Building.kind[eid]!] === 'hearthfire',
    );
    expect(fires).toHaveLength(1);
    expect(Position.x[fires[0]!]).toBe(world.start.x);
    expect(navBlockedAt(world, world.start.x, world.start.y)).toBe(true);
  });

  it('spawns every doodad as an entity; only movement blockers block navigation', () => {
    const doodads = query(world.ecs, [Doodad]);
    expect(doodads.length).toBeGreaterThan(300);
    const tree = doodads.find((e) => DOODAD_IDS[Doodad.kind[e]!] === 'deadTree')!;
    expect(navBlockedAt(world, Position.x[tree]!, Position.y[tree]!)).toBe(true);
    const shroom = doodads.find(
      (e) =>
        DOODAD_IDS[Doodad.kind[e]!] === 'glowShroom' &&
        // Make sure no other obstacle shares its nav cell.
        world.spatial.queryCircle(Position.x[e]!, Position.y[e]!, 8).length === 1,
    );
    expect(shroom).toBeDefined();
    expect(navBlockedAt(world, Position.x[shroom!]!, Position.y[shroom!]!)).toBe(false);
  });
});

describe('placing buildings', () => {
  // A spot inside the guaranteed clearing, away from the Hearthfire.
  const spot = (world: ReturnType<typeof createGameWorld>) => ({
    x: world.start.x + 48,
    y: world.start.y + 8,
  });

  it('places a building on open ground, registers it and blocks navigation', () => {
    const world = createGameWorld({ seed: 7 });
    const { x, y } = spot(world);
    const result = placeBuilding(world, 'tent', x, y);
    expect(result.ok).toBe(true);
    const eid = result.eid!;
    expect(hasComponent(world.ecs, eid, Building)).toBe(true);
    expect(BUILDING_IDS[Building.kind[eid]!]).toBe('tent');
    expect(navBlockedAt(world, x, y)).toBe(true);
    expect(entityAt(world, x, y)).toBe(eid);
  });

  it('refuses to overlap an existing building, and leaves the world unchanged', () => {
    const world = createGameWorld({ seed: 7 });
    const { x, y } = spot(world);
    placeBuilding(world, 'tent', x, y);
    const before = query(world.ecs, [Building]).length;
    const again = placeBuilding(world, 'storage', x + 4, y);
    expect(again).toMatchObject({ ok: false, reason: 'building', eid: null });
    expect(query(world.ecs, [Building]).length).toBe(before);
  });

  it('refuses to build on top of a tree', () => {
    const world = smallWorld([{ kind: 'deadTree', x: 60, y: 60 }]);
    const result = placeBuilding(world, 'watchtower', 60, 60);
    expect(result).toMatchObject({ ok: false, reason: 'doodad', eid: null });
  });

  it('a failed placement leaves navigation and the spatial index untouched', () => {
    // Boulder r=6 at (70,52) clips only the top-right corner of the footprint below.
    const world = smallWorld([{ kind: 'boulder', x: 70, y: 52 }]);
    const spatialBefore = world.spatial.size;
    // Footprint [48,72]×[57,71]; the nav cell at (50,68) is far from the boulder.
    expect(navBlockedAt(world, 50, 68)).toBe(false);
    expect(placeBuilding(world, 'tent', 60, 64).ok).toBe(false);
    expect(world.spatial.size).toBe(spatialBefore);
    expect(navBlockedAt(world, 50, 68)).toBe(false);
  });

  it('falls back to the exact spot when the magnet would pull into an obstacle', () => {
    const world = smallWorld([{ kind: 'boulder', x: 85, y: 49 }]);
    placeBuilding(world, 'tent', 60, 60); // A: [48,72]×[53,67]
    // Raw ghost [75,99]×[57,71] is legal. The magnet would move it to [72,96]×[53,67]
    // (flush to A, tops aligned) — straight into the boulder (y up to 55).
    const result = checkPlacement(world, 'tent', 87, 64);
    expect(result.ok).toBe(true);
    expect(shapeBounds(result.shape)).toEqual({ minX: 75, minY: 57, maxX: 99, maxY: 71 });
  });

  it('snap aligns the footprint corner to the 8 px grid', () => {
    const world = createGameWorld({ seed: 7 });
    // Tent footprint 24×14 centred at (x, y): corner = (x − 12, y − 7).
    const result = checkPlacement(world, 'tent', world.start.x + 43, world.start.y + 37, {
      snap: true,
    });
    const b = shapeBounds(result.shape);
    expect(b.minX % 8).toBe(0);
    expect(b.minY % 8).toBe(0);
    // 1024 + 43 − 12 = 1055 → 1056;  1024 + 37 − 7 = 1054 → 1056
    expect([b.minX, b.minY]).toEqual([1056, 1056]);
  });

  it('without snap, a nearby building pulls the new one flush (magnet)', () => {
    const world = createGameWorld({ seed: 7 });
    const { x, y } = spot(world);
    placeBuilding(world, 'tent', x, y); // spans [x−12, x+12]
    // Second tent with a 3 px gap on the right.
    const result = checkPlacement(world, 'tent', x + 24 + 3, y);
    expect(result.ok).toBe(true);
    expect(shapeBounds(result.shape).minX).toBe(x + 12);
  });
});

describe('entityAt', () => {
  it('picks a doodad near its base and nothing on empty ground', () => {
    const world = createGameWorld({ seed: 7 });
    const boulder = query(world.ecs, [Doodad]).find(
      (e) => DOODAD_IDS[Doodad.kind[e]!] === 'boulder',
    )!;
    const r = DOODADS.boulder.radius;
    expect(entityAt(world, Position.x[boulder]! + r - 1, Position.y[boulder]!)).toBe(boulder);
    // Inside the start clearing there is only the Hearthfire.
    expect(entityAt(world, world.start.x + 60, world.start.y - 60)).toBeNull();
  });

  it('prefers a building over a doodad at the same point', () => {
    const world = smallWorld([{ kind: 'glowShroom', x: 60, y: 60 }]);
    const tent = placeBuilding(world, 'tent', 60, 60).eid; // shrooms don't block building
    expect(tent).not.toBeNull();
    expect(entityAt(world, 60, 60)).toBe(tent);
  });
});

describe('map reachability', () => {
  /** Open (walkable) nav cells reachable from beside the Hearthfire, as a fraction. */
  const reachableFraction = (world: GameWorld) => {
    const { nav } = world;
    const start = nav.cellOf(world.start.x + 16, world.start.y);
    const seen = new Uint8Array(nav.width * nav.height);
    const queue = [start.cy * nav.width + start.cx];
    seen[queue[0]!] = 1;
    let reached = 0;
    while (queue.length) {
      const i = queue.pop()!;
      reached++;
      const cx = i % nav.width;
      const cy = (i - cx) / nav.width;
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        const nx = cx + dx;
        const ny = cy + dy;
        const ni = ny * nav.width + nx;
        if (nav.walkable(nx, ny) && !seen[ni]) {
          seen[ni] = 1;
          queue.push(ni);
        }
      }
    }
    let open = 0;
    for (let cy = 0; cy < nav.height; cy++) {
      for (let cx = 0; cx < nav.width; cx++) if (nav.walkable(cx, cy)) open++;
    }
    return reached / open;
  };

  it('never seals the start area inside dense groves (seeds 1–8)', () => {
    for (let seed = 1; seed <= 8; seed++) {
      expect(reachableFraction(createGameWorld({ seed })), `seed ${seed}`).toBeGreaterThan(0.95);
    }
  });
});
