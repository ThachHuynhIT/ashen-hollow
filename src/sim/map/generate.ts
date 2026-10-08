import { DOODADS, DOODAD_IDS, type DoodadId } from '../../data/doodads';
import { terrainAt, terrainIndex, type TerrainId } from '../../data/terrain';
import { circleShape, type Vec2 } from '../geom';
import { MinHeap } from '../nav/astar';
import { NavGrid } from '../nav/NavGrid';
import { fractalNoise2D } from '../noise';
import { Rng } from '../random';
import { SpatialHash } from '../spatial/SpatialHash';
import { poissonDisk } from './poisson';
import { TERRAIN_CELL, TerrainGrid } from './TerrainGrid';

/** Open ground kept around the starting Hearthfire (px). */
export const START_CLEARING_RADIUS = 96;

/** Doodads off their primary habitat are this much rarer (e.g. lone trees on grass). */
const SECONDARY_HABITAT_FACTOR = 0.12;

export interface DoodadSpawn {
  kind: DoodadId;
  x: number;
  y: number;
}

export interface MapGenOptions {
  seed: number;
  /** Size in 16 px terrain cells. */
  width: number;
  height: number;
}

export interface GeneratedMap {
  terrain: TerrainGrid;
  doodads: DoodadSpawn[];
  /** World position of the Hearthfire. */
  start: Vec2;
}

const pickTerrain = (elevation: number, moisture: number, blight: number): TerrainId => {
  if (elevation > 0.8) return 'cliff';
  if (elevation < 0.3) return 'blackWater';
  if (elevation > 0.64) return 'hills';
  if (blight > 0.72) return 'cursedSoil';
  if (moisture > 0.62) return elevation < 0.42 ? 'mud' : 'forestFloor';
  if (moisture > 0.5) return 'forestFloor';
  return 'deadGrass';
};

const generateTerrain = (seed: number, width: number, height: number, start: Vec2): TerrainGrid => {
  const terrain = new TerrainGrid(width, height);
  const maxEdge = Math.min(width, height) / 2;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const edge = Math.min(x, y, width - 1 - x, height - 1 - y);
      let id: TerrainId;
      if (edge === 0) {
        id = 'cliff';
      } else {
        // Raise ground towards the rim so the valley is walled in by crags.
        const rim = Math.max(0, 1 - edge / (maxEdge * 0.3));
        const elevation =
          fractalNoise2D(seed, x, y, { octaves: 4, frequency: 0.045, persistence: 0.5 }) +
          rim * 0.5;
        const moisture = fractalNoise2D(seed + 101, x, y, {
          octaves: 3,
          frequency: 0.05,
          persistence: 0.5,
        });
        const blight = fractalNoise2D(seed + 202, x, y, {
          octaves: 2,
          frequency: 0.06,
          persistence: 0.5,
        });
        id = pickTerrain(elevation, moisture, blight);
      }
      const cx = (x + 0.5) * TERRAIN_CELL;
      const cy = (y + 0.5) * TERRAIN_CELL;
      if (Math.hypot(cx - start.x, cy - start.y) <= START_CLEARING_RADIUS) id = 'deadGrass';
      terrain.set(x, y, terrainIndex(id));
    }
  }
  return terrain;
};

/**
 * Scatter doodads with Poisson-disk spacing per kind, filtered by habitat and a density
 * noise field so forests come in groves rather than an even carpet.
 */
const scatterDoodads = (seed: number, terrain: TerrainGrid, start: Vec2): DoodadSpawn[] => {
  const rng = new Rng(seed ^ 0x5bd1e995);
  const placed: DoodadSpawn[] = [];
  const blockers = new SpatialHash(32);
  // Big blockers first so small things fill the gaps around them.
  const order = [...DOODAD_IDS].sort((a, b) => DOODADS[b].radius - DOODADS[a].radius);

  order.forEach((kind, kindIndex) => {
    const def = DOODADS[kind];
    const candidates = poissonDisk(rng, terrain.widthPx, terrain.heightPx, def.spacing);
    for (const p of candidates) {
      if (Math.hypot(p.x - start.x, p.y - start.y) <= START_CLEARING_RADIUS) continue;
      const x = Math.round(p.x);
      const y = Math.round(p.y);
      const ground = terrainAt(terrain.indexAtWorld(x, y));
      const habitat = def.habitats.indexOf(ground.id);
      if (habitat < 0 || !ground.passable) continue;
      const grove = fractalNoise2D(seed + 300 + kindIndex, x / 16, y / 16, {
        octaves: 2,
        frequency: 0.08,
        persistence: 0.5,
      });
      const chance = def.density * (habitat === 0 ? 1 : SECONDARY_HABITAT_FACTOR) * (0.4 + grove);
      if (rng.next() >= chance) continue;

      // Nothing may sit inside a blocker (no mushrooms growing out of a boulder).
      const clash = blockers.queryCircle(x, y, def.radius + 16).some((i) => {
        const o = placed[i]!;
        const min = def.radius + DOODADS[o.kind].radius;
        return (o.x - x) ** 2 + (o.y - y) ** 2 < min * min;
      });
      if (clash) continue;
      if (def.blocksMovement) {
        blockers.insert(placed.length, {
          minX: x - def.radius,
          minY: y - def.radius,
          maxX: x + def.radius,
          maxY: y + def.radius,
        });
      }
      placed.push({ kind, x, y });
    }
  });
  return placed;
};

/** Stepping through a doodad-blocked nav cell costs this much more than open ground. */
const BLOCKED_STEP_COST = 30;
const NEIGHBOURS4 = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

/**
 * Dense groves can wall off parts of the valley (trees block 2×2 nav cells). Guarantee
 * every open pocket the ground allows is reachable from the start: one Dijkstra from
 * the start where doodad-blocked cells are expensive, then for each sealed pocket walk
 * its cheapest route back and clear the doodads on it. The result reads as trails.
 */
const carveTrails = (terrain: TerrainGrid, doodads: DoodadSpawn[], start: Vec2): DoodadSpawn[] => {
  const nav = new NavGrid(terrain);
  const n = nav.width * nav.height;
  const coveredBy = new Map<number, number[]>();
  doodads.forEach((d, i) => {
    const def = DOODADS[d.kind];
    if (!def.blocksMovement) return;
    const shape = circleShape(d.x, d.y, def.radius);
    nav.block(shape);
    for (const cell of nav.cellsUnder(shape)) {
      const list = coveredBy.get(cell);
      if (list) list.push(i);
      else coveredBy.set(cell, [i]);
    }
  });

  const s = nav.cellOf(start.x, start.y);
  const startCell = s.cy * nav.width + s.cx;
  const isOpen = (i: number) => nav.walkable(i % nav.width, Math.floor(i / nav.width));

  // Cheapest routes from the start, allowed through doodads at a high price.
  const dist = new Float64Array(n).fill(Infinity);
  const parent = new Int32Array(n).fill(-1);
  const heap = new MinHeap();
  dist[startCell] = 0;
  heap.push(startCell, 0);
  while (heap.size > 0) {
    const cur = heap.pop();
    const cx = cur % nav.width;
    const cy = (cur - cx) / nav.width;
    for (const [dx, dy] of NEIGHBOURS4) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (!nav.groundPassable(nx, ny)) continue;
      const ni = ny * nav.width + nx;
      const d = dist[cur]! + (isOpen(ni) ? 1 : BLOCKED_STEP_COST);
      if (d < dist[ni]!) {
        dist[ni] = d;
        parent[ni] = cur;
        heap.push(ni, d);
      }
    }
  }

  // Flood the currently open area from the start; every other open pocket gets a trail.
  const reached = new Uint8Array(n);
  const flood = (from: number) => {
    const stack = [from];
    reached[from] = 1;
    while (stack.length) {
      const cur = stack.pop()!;
      const cx = cur % nav.width;
      const cy = (cur - cx) / nav.width;
      for (const [dx, dy] of NEIGHBOURS4) {
        const nx = cx + dx;
        const ny = cy + dy;
        const ni = ny * nav.width + nx;
        if (nav.walkable(nx, ny) && !reached[ni]) {
          reached[ni] = 1;
          stack.push(ni);
        }
      }
    }
  };
  flood(startCell);

  const removed = new Set<number>();
  for (let i = 0; i < n; i++) {
    if (reached[i] || !isOpen(i) || parent[i] === -1) continue;
    // Walk back towards the start, clearing whatever blocks the way.
    for (let c = i; c !== -1 && !reached[c]; c = parent[c]!) {
      for (const d of coveredBy.get(c) ?? []) {
        if (removed.has(d)) continue;
        removed.add(d);
        const def = DOODADS[doodads[d]!.kind];
        nav.unblock(circleShape(doodads[d]!.x, doodads[d]!.y, def.radius));
      }
    }
    flood(i);
    // The pocket is now joined to the start's area; mark the connection too.
    for (let c = i; c !== -1; c = parent[c]!) {
      if (!reached[c] && isOpen(c)) flood(c);
    }
  }
  return doodads.filter((_, i) => !removed.has(i));
};

/**
 * "Dead Valley" generator: three noise fields (elevation, moisture, blight) pick the
 * ground; the rim is forced up into crags; doodads are scattered freely on top, then
 * trails are cleared so the whole valley stays reachable.
 */
export const generateMap = ({ seed, width, height }: MapGenOptions): GeneratedMap => {
  const start = { x: (width * TERRAIN_CELL) / 2, y: (height * TERRAIN_CELL) / 2 };
  const terrain = generateTerrain(seed, width, height, start);
  const doodads = carveTrails(terrain, scatterDoodads(seed, terrain, start), start);
  return { terrain, doodads, start };
};
