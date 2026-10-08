import { describe, expect, it } from 'vitest';
import { DOODADS } from '../../data/doodads';
import { TERRAIN_IDS, terrainAt } from '../../data/terrain';
import { generateMap, START_CLEARING_RADIUS } from './generate';

describe('generateMap', () => {
  const opts = { seed: 1234, width: 128, height: 128 };
  const map = generateMap(opts);

  it('is deterministic for a given seed', () => {
    const again = generateMap(opts);
    expect(Array.from(again.terrain.cells)).toEqual(Array.from(map.terrain.cells));
    expect(again.doodads).toEqual(map.doodads);
  });

  it('differs between seeds', () => {
    const other = generateMap({ ...opts, seed: 99 });
    expect(Array.from(other.terrain.cells)).not.toEqual(Array.from(map.terrain.cells));
  });

  it('starts in the middle of the map', () => {
    expect(map.start).toEqual({ x: 1024, y: 1024 });
  });

  it('rings the valley with impassable crags', () => {
    const { terrain } = map;
    for (let i = 0; i < 128; i++) {
      for (const [x, y] of [
        [i, 0],
        [i, 127],
        [0, i],
        [127, i],
      ] as const) {
        expect(terrainAt(terrain.get(x, y)).id).toBe('cliff');
      }
    }
  });

  it('keeps an open, buildable, doodad-free clearing around the start', () => {
    for (let y = 0; y < 128; y++) {
      for (let x = 0; x < 128; x++) {
        const cx = (x + 0.5) * 16;
        const cy = (y + 0.5) * 16;
        if (Math.hypot(cx - 1024, cy - 1024) <= START_CLEARING_RADIUS) {
          expect(terrainAt(map.terrain.get(x, y)).id).toBe('deadGrass');
        }
      }
    }
    for (const d of map.doodads) {
      expect(Math.hypot(d.x - 1024, d.y - 1024)).toBeGreaterThan(START_CLEARING_RADIUS);
    }
  });

  it('only grows doodads on their habitat terrain', () => {
    for (const d of map.doodads) {
      const ground = map.terrain.atWorld(d.x, d.y).id;
      expect(DOODADS[d.kind].habitats).toContain(ground);
    }
  });

  it('never overlaps a doodad with a movement-blocking one (no shrooms inside trees)', () => {
    const blockers = map.doodads.filter((d) => DOODADS[d.kind].blocksMovement);
    for (let i = 0; i < blockers.length; i++) {
      const a = blockers[i]!;
      for (let j = 0; j < map.doodads.length; j++) {
        const b = map.doodads[j]!;
        if (a === b) continue;
        const min = DOODADS[a.kind].radius + DOODADS[b.kind].radius;
        if (Math.abs(a.x - b.x) > min || Math.abs(a.y - b.y) > min) continue;
        expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(min);
      }
    }
  });

  it('produces a varied landscape with real forests', () => {
    expect(new Set(map.terrain.cells).size).toBeGreaterThanOrEqual(5);
    expect(new Set(map.terrain.cells).size).toBeLessThanOrEqual(TERRAIN_IDS.length);
    expect(map.doodads.filter((d) => d.kind === 'deadTree').length).toBeGreaterThan(300);
    expect(map.doodads.filter((d) => d.kind === 'boulder').length).toBeGreaterThan(10);
  });
});
