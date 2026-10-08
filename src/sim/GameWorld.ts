import { addComponent, addEntity, createWorld, removeEntity, type World } from 'bitecs';
import { BUILDINGS, buildingIndex, type BuildingId } from '../data/buildings';
import { DOODADS, doodadIndex } from '../data/doodads';
import { STARTING_STOCK, type ResourceId } from '../data/resources';
import { Stockpile } from './colony/stockpile';
import { Building, Doodad, Position, components } from './components';
import { emit, type WorldEvent } from './events';
import { Reservations } from './jobs/reservations';
import type { Job } from './jobs/types';
import {
  circleShape,
  inflateShape,
  moveShape,
  shapeBounds,
  shapeContains,
  type Shape,
} from './geom';
import { generateMap, type GeneratedMap } from './map/generate';
import type { TerrainGrid } from './map/TerrainGrid';
import { NavGrid } from './nav/NavGrid';
import {
  footprintShape,
  magnetSnap,
  snapToGrid,
  validatePlacement,
  type Obstacle,
  type PlacementProblem,
} from './placement';
import { Rng } from './random';
import { SimClock } from './SimClock';
import { SpatialHash } from './spatial/SpatialHash';
import type { Vec2 } from './geom';

/** Map size in 16 px terrain cells → 2048×2048 px world. */
export const DEFAULT_MAP_WIDTH = 128;
export const DEFAULT_MAP_HEIGHT = 128;

/** Extra slack when picking a small entity with a pointer/finger. */
const PICK_TOLERANCE = 2;

export interface WorldContext {
  readonly components: typeof components;
}

export interface ObstacleRecord {
  shape: Shape;
  type: 'building' | 'doodad';
  /** Stamped on the nav grid: units walk around it. */
  blocksMovement: boolean;
  /** Other buildings can't overlap it (true for blueprints too). */
  blocksPlacement: boolean;
}

export interface GameWorld {
  readonly seed: number;
  readonly ecs: World<WorldContext>;
  readonly terrain: TerrainGrid;
  readonly nav: NavGrid;
  /** Every doodad and building, by entity id, for picking and overlap queries. */
  readonly spatial: SpatialHash;
  readonly obstacles: Map<number, ObstacleRecord>;
  readonly start: Vec2;
  readonly rng: Rng;
  readonly clock: SimClock;
  /** Sim ticks since the world was created (advanced by stepWorld). */
  tick: number;
  /** Entity id of the Hearthfire. */
  hearthfire: number;
  readonly stock: Stockpile;
  readonly events: WorldEvent[];
  readonly jobs: Map<number, Job>;
  readonly reservations: Reservations;
  /** Target eid → tick until which it is considered unreachable. */
  readonly unreachable: Map<number, number>;
}

export interface NewWorldOptions {
  seed: number;
  width?: number;
  height?: number;
  /** Use this map instead of generating one (hand-made maps, saves, tests). */
  map?: GeneratedMap;
  stock?: Partial<Record<ResourceId, number>>;
}

const register = (world: GameWorld, eid: number, record: ObstacleRecord): void => {
  world.obstacles.set(eid, record);
  world.spatial.insert(eid, shapeBounds(record.shape));
  if (record.blocksMovement) world.nav.block(record.shape);
};

const spawnBuilding = (world: GameWorld, kind: BuildingId, shape: Shape): number => {
  const eid = addEntity(world.ecs);
  addComponent(world.ecs, eid, Position);
  addComponent(world.ecs, eid, Building);
  Position.x[eid] = shape.cx;
  Position.y[eid] = shape.cy;
  Building.kind[eid] = buildingIndex(kind);
  register(world, eid, { shape, type: 'building', blocksMovement: true, blocksPlacement: true });
  return eid;
};

/** Create a brand-new game: generate the valley, spawn doodads and the Hearthfire. */
export const createGameWorld = ({
  seed,
  width = DEFAULT_MAP_WIDTH,
  height = DEFAULT_MAP_HEIGHT,
  map,
  stock,
}: NewWorldOptions): GameWorld => {
  const { terrain, doodads, start } = map ?? generateMap({ seed, width, height });
  const world: GameWorld = {
    seed,
    ecs: createWorld<WorldContext>({ components }),
    terrain,
    nav: new NavGrid(terrain),
    spatial: new SpatialHash(64),
    obstacles: new Map(),
    start,
    // Separate stream from map generation so gameplay randomness doesn't shift the map.
    rng: new Rng(seed ^ 0x9e3779b9),
    clock: new SimClock(),
    tick: 0,
    hearthfire: -1,
    stock: new Stockpile(stock ?? STARTING_STOCK),
    events: [],
    jobs: new Map(),
    reservations: new Reservations(),
    unreachable: new Map(),
  };

  for (const d of doodads) {
    const def = DOODADS[d.kind];
    const eid = addEntity(world.ecs);
    addComponent(world.ecs, eid, Position);
    addComponent(world.ecs, eid, Doodad);
    Position.x[eid] = d.x;
    Position.y[eid] = d.y;
    Doodad.kind[eid] = doodadIndex(d.kind);
    register(world, eid, {
      shape: circleShape(d.x, d.y, def.radius),
      type: 'doodad',
      blocksMovement: def.blocksMovement,
      blocksPlacement: def.blocksMovement,
    });
  }

  world.hearthfire = spawnBuilding(
    world,
    'hearthfire',
    footprintShape(BUILDINGS.hearthfire, start.x, start.y),
  );
  return world;
};

export interface PlacementOptions {
  /** Align the footprint's top-left corner to the 8 px grid (Shift / Snap button). */
  snap?: boolean;
}

export interface PlacementCheck {
  ok: boolean;
  reason: PlacementProblem | null;
  /** Final footprint after snapping — where the ghost should be drawn. */
  shape: Shape;
}

/** Blocking obstacles whose bounds come near `shape`. */
const nearbyObstacles = (world: GameWorld, shape: Shape, margin: number): Obstacle[] => {
  const b = shapeBounds(inflateShape(shape, margin));
  const out: Obstacle[] = [];
  for (const eid of world.spatial.query(b)) {
    const o = world.obstacles.get(eid);
    if (o?.blocksPlacement) out.push({ shape: o.shape, type: o.type });
  }
  return out;
};

/**
 * Where would `kind` go if the player clicked at (x, y), and is that legal?
 * Free placement by default, magnet-snapped to neighbouring buildings; optional grid snap.
 */
export const checkPlacement = (
  world: GameWorld,
  kind: BuildingId,
  x: number,
  y: number,
  { snap = false }: PlacementOptions = {},
): PlacementCheck => {
  // "Any pixel", not sub-pixel: keeps ghost, click and stored position identical.
  const raw = footprintShape(BUILDINGS[kind], Math.round(x), Math.round(y));
  const validate = (shape: Shape): PlacementCheck => ({
    ...validatePlacement(shape, world.terrain, nearbyObstacles(world, shape, 0)),
    shape,
  });

  if (snap) {
    const b = shapeBounds(raw);
    return validate(
      moveShape(raw, raw.cx + snapToGrid(b.minX) - b.minX, raw.cy + snapToGrid(b.minY) - b.minY),
    );
  }

  const neighbours = nearbyObstacles(world, raw, 8)
    .filter((o) => o.type === 'building')
    .map((o) => o.shape);
  const magnet = validate(magnetSnap(raw, neighbours));
  if (magnet.ok) return magnet;
  // The magnet must never turn a legal spot into an illegal one.
  const exact = validate(raw);
  return exact.ok ? exact : magnet;
};

export interface PlaceResult extends PlacementCheck {
  eid: number | null;
}

/** Place a building if the spot is legal. The world is untouched on failure. */
export const placeBuilding = (
  world: GameWorld,
  kind: BuildingId,
  x: number,
  y: number,
  options: PlacementOptions = {},
): PlaceResult => {
  const check = checkPlacement(world, kind, x, y, options);
  if (!check.ok) return { ...check, eid: null };
  return { ...check, eid: spawnBuilding(world, kind, check.shape) };
};

/** Remove a doodad or building from every index and tell the renderer. */
export const removeWorldEntity = (world: GameWorld, eid: number): void => {
  const record = world.obstacles.get(eid);
  if (record) {
    if (record.blocksMovement) world.nav.unblock(record.shape);
    world.spatial.remove(eid);
    world.obstacles.delete(eid);
  }
  world.reservations.forgetTarget(eid);
  removeEntity(world.ecs, eid);
  emit(world, { type: 'entityRemoved', eid });
};

/** The building or doodad under a world point (buildings win), or null. */
export const entityAt = (world: GameWorld, x: number, y: number): number | null => {
  let best: number | null = null;
  let bestIsBuilding = false;
  let bestDist = Infinity;
  for (const eid of world.spatial.queryCircle(x, y, PICK_TOLERANCE + 1)) {
    const o = world.obstacles.get(eid);
    if (!o || !shapeContains(inflateShape(o.shape, PICK_TOLERANCE), x, y)) continue;
    const isBuilding = o.type === 'building';
    const dist = (o.shape.cx - x) ** 2 + (o.shape.cy - y) ** 2;
    if ((isBuilding && !bestIsBuilding) || (isBuilding === bestIsBuilding && dist < bestDist)) {
      best = eid;
      bestIsBuilding = isBuilding;
      bestDist = dist;
    }
  }
  return best;
};
