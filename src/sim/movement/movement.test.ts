import { describe, expect, it } from 'vitest';
import { livingColonists, spawnColonist } from '../colony/colonists';
import { Position } from '../components';
import { createGameWorld } from '../GameWorld';
import { circleShape, inflateShape, shapeContains } from '../geom';
import type { DoodadSpawn } from '../map/generate';
import type { TerrainGrid } from '../map/TerrainGrid';
import { openTerrain, terrainFromAscii } from '../testing/terrainFixture';
import { approachPoint } from './approach';
import { moveTo, movementSystem } from './movement';

const world = (
  terrain: TerrainGrid,
  start: { x: number; y: number },
  doodads: DoodadSpawn[] = [],
) => createGameWorld({ seed: 1, colonists: 0, map: { terrain, doodads, start } });

describe('approachPoint', () => {
  it('finds a walkable spot just outside the target, on the near side', () => {
    const w = world(openTerrain(32, 32), { x: 400, y: 400 }, [
      { kind: 'deadTree', x: 200, y: 200 },
    ]);
    const tree = circleShape(200, 200, 4);
    const p = approachPoint(w, tree, { x: 100, y: 200 })!;
    expect(p).not.toBeNull();
    expect(shapeContains(inflateShape(tree, 4), p.x, p.y)).toBe(false);
    const { cx, cy } = w.nav.cellOf(p.x, p.y);
    expect(w.nav.walkable(cx, cy)).toBe(true);
    expect(p.x).toBeLessThan(200);
    expect(Math.hypot(p.x - 200, p.y - 200)).toBeLessThan(20);
  });

  it('returns null when everything around the target is blocked', () => {
    // One grass cell ([16,32]²) walled by crag. The tree sits on the shared corner of
    // that cell's four 8 px nav cells, so all of them are blocked: nowhere to stand.
    const w = world(terrainFromAscii(['###', '#.#', '###']), { x: 24, y: 24 }, [
      { kind: 'deadTree', x: 24, y: 24 },
    ]);
    expect(approachPoint(w, circleShape(24, 24, 4), { x: 24, y: 24 })).toBeNull();
  });
});

describe('moving', () => {
  const walled = () =>
    terrainFromAscii([
      '..........', //
      '..........',
      '#######...',
      '..........',
      '..........',
    ]);

  it('walks around a wall to the destination, never standing on blocked ground', () => {
    const w = world(walled(), { x: 136, y: 40 });
    const eid = spawnColonist(w, 8, 8, 0);
    const dest = { x: 12, y: 68 };
    let result = 'moving';
    let ticks = 0;
    while (result !== 'arrived' && ticks < 300) {
      result = moveTo(w, eid, dest);
      movementSystem(w);
      const { cx, cy } = w.nav.cellOf(Position.x[eid]!, Position.y[eid]!);
      expect(w.nav.walkable(cx, cy)).toBe(true);
      ticks++;
    }
    expect(result).toBe('arrived');
    // Straight-line distance is 60 px, but the wall forces a ~250 px detour at 2.4 px/tick.
    expect(ticks).toBeGreaterThan(60);
    expect(ticks).toBeLessThan(200);
  });

  it('fails straight away for a destination that cannot be reached', () => {
    const w = world(walled(), { x: 136, y: 40 });
    const eid = spawnColonist(w, 8, 8, 0);
    expect(moveTo(w, eid, { x: 20, y: 40 })).toBe('failed'); // inside the crag
  });

  it('slows down on bog', () => {
    // Bog on row 0, grass on row 1; the Hearthfire sits on row 2, clear of both lanes.
    const w = world(terrainFromAscii(['mmmmmmmmmm', '..........', '..........']), {
      x: 136,
      y: 40,
    });
    const onBog = spawnColonist(w, 4, 4, 0);
    const onGrass = spawnColonist(w, 4, 20, 1);
    for (let i = 0; i < 20; i++) {
      moveTo(w, onBog, { x: 156, y: 4 });
      moveTo(w, onGrass, { x: 156, y: 20 });
      movementSystem(w);
    }
    // 20 ticks × 2.4 = 48 px on grass; × 0.45 on bog = 21.6 px.
    expect(Position.x[onGrass]! - 4).toBeCloseTo(48, 0);
    expect(Position.x[onBog]! - 4).toBeCloseTo(21.6, 0);
  });

  it('pushes colonists standing on the same spot apart', () => {
    const w = world(openTerrain(16, 16), { x: 128, y: 128 });
    spawnColonist(w, 60, 60, 0);
    spawnColonist(w, 60, 60, 1);
    for (let i = 0; i < 20; i++) movementSystem(w);
    const [a, b] = livingColonists(w);
    const gap = Math.hypot(Position.x[a!]! - Position.x[b!]!, Position.y[a!]! - Position.y[b!]!);
    expect(gap).toBeGreaterThan(5);
  });
});
