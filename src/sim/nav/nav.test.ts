import { describe, expect, it } from 'vitest';
import { circleShape, rectShape, type Vec2 } from '../geom';
import { openTerrain, terrainFromAscii } from '../testing/terrainFixture';
import { findPath } from './astar';
import { NavGrid } from './NavGrid';
import { lineWalkable, smoothPath } from './smooth';

describe('NavGrid', () => {
  it('splits each 16 px terrain cell into 2×2 nav cells and blocks water', () => {
    const nav = new NavGrid(terrainFromAscii(['.~']));
    expect([nav.width, nav.height]).toEqual([4, 2]);
    expect(nav.walkable(1, 1)).toBe(true);
    expect(nav.walkable(2, 0)).toBe(false);
    expect(nav.walkable(3, 1)).toBe(false);
  });

  it('turns slow terrain into a higher cost', () => {
    const nav = new NavGrid(terrainFromAscii(['.m']));
    expect(nav.cost(0, 0)).toBe(1);
    expect(nav.cost(2, 0)).toBeCloseTo(1 / 0.45);
  });

  it('reference-counts blockers so overlapping obstacles unblock independently', () => {
    const nav = new NavGrid(openTerrain(2, 2));
    const a = rectShape(12, 12, 8, 8); // covers nav cells (1,1)
    const b = circleShape(12, 12, 2);
    nav.block(a);
    nav.block(b);
    expect(nav.walkable(1, 1)).toBe(false);
    nav.unblock(a);
    expect(nav.walkable(1, 1)).toBe(false);
    nav.unblock(b);
    expect(nav.walkable(1, 1)).toBe(true);
  });

  it('only blocks cells the shape really overlaps', () => {
    const nav = new NavGrid(openTerrain(2, 2));
    // Circle r=3 at (8,8) sits on the corner shared by cells (0,0),(1,0),(0,1),(1,1).
    nav.block(circleShape(8, 8, 3));
    expect([
      nav.walkable(0, 0),
      nav.walkable(1, 0),
      nav.walkable(0, 1),
      nav.walkable(1, 1),
    ]).toEqual([false, false, false, false]);
    expect(nav.walkable(2, 2)).toBe(true);
  });
});

/** Sum of segment lengths. */
const pathLength = (p: Vec2[]) =>
  p.slice(1).reduce((sum, q, i) => sum + Math.hypot(q.x - p[i]!.x, q.y - p[i]!.y), 0);

describe('findPath', () => {
  it('walks straight across open ground', () => {
    const nav = new NavGrid(openTerrain(4, 1));
    const path = findPath(nav, { x: 4, y: 4 }, { x: 60, y: 4 });
    expect(path).toEqual([
      { x: 4, y: 4 },
      { x: 12, y: 4 },
      { x: 20, y: 4 },
      { x: 28, y: 4 },
      { x: 36, y: 4 },
      { x: 44, y: 4 },
      { x: 52, y: 4 },
      { x: 60, y: 4 },
    ]);
  });

  it('goes around a wall through the only gap', () => {
    const nav = new NavGrid(
      terrainFromAscii([
        '.....', //
        '####.',
        '.....',
      ]),
    );
    const path = findPath(nav, { x: 8, y: 8 }, { x: 8, y: 40 });
    expect(path).not.toBeNull();
    // Must pass through the gap column (x in [64,80)) on row 1 (y in [16,32)).
    expect(path!.some((p) => p.x >= 64 && p.y >= 16 && p.y < 32)).toBe(true);
    for (const p of path!)
      expect(nav.walkable(Math.floor(p.x / 8), Math.floor(p.y / 8))).toBe(true);
  });

  it('never cuts diagonally between two blocked cells', () => {
    const nav = new NavGrid(openTerrain(2, 2));
    // Block nav cells (1,0) and (0,1): the diagonal (0,0)→(1,1) is a squeeze.
    nav.block(rectShape(12, 4, 8, 8));
    nav.block(rectShape(4, 12, 8, 8));
    expect(findPath(nav, { x: 4, y: 4 }, { x: 12, y: 12 })).toBeNull();
  });

  it('returns null when the goal is unreachable or blocked', () => {
    const nav = new NavGrid(terrainFromAscii(['.#.']));
    expect(findPath(nav, { x: 4, y: 4 }, { x: 44, y: 4 })).toBeNull();
    expect(findPath(nav, { x: 4, y: 4 }, { x: 20, y: 4 })).toBeNull();
  });

  it('prefers a longer route over fast ground to a shorter one through bog', () => {
    const nav = new NavGrid(
      terrainFromAscii(['.......', '.mmmmm.', '.mmmmm.', '.mmmmm.', '.......']),
    );
    // From the middle of the left edge to the middle of the right edge.
    const path = findPath(nav, { x: 8, y: 40 }, { x: 104, y: 40 })!;
    const throughBog = path.filter((p) => p.x > 16 && p.x < 96 && p.y > 16 && p.y < 64);
    expect(throughBog).toEqual([]);
  });
});

describe('smoothing', () => {
  it('reduces an open-field path to a single straight segment', () => {
    const nav = new NavGrid(openTerrain(8, 8));
    const from = { x: 3, y: 5 };
    const to = { x: 120, y: 90 };
    const smooth = smoothPath(nav, findPath(nav, from, to)!, from, to);
    expect(smooth).toEqual([from, to]);
  });

  it('keeps a corner waypoint when a wall is in the way, and every segment is walkable', () => {
    const nav = new NavGrid(
      terrainFromAscii([
        '.....', //
        '####.',
        '.....',
      ]),
    );
    const from = { x: 8, y: 8 };
    const to = { x: 8, y: 40 };
    const raw = findPath(nav, from, to)!;
    const smooth = smoothPath(nav, raw, from, to);
    // Compare like with like: the raw grid path with the same exact endpoints.
    const rawExact = [from, ...raw.slice(1, -1), to];
    expect(smooth.length).toBeGreaterThanOrEqual(3);
    expect(smooth.length).toBeLessThan(rawExact.length);
    expect(pathLength(smooth)).toBeLessThan(pathLength(rawExact));
    for (let i = 1; i < smooth.length; i++) {
      expect(lineWalkable(nav, smooth[i - 1]!, smooth[i]!)).toBe(true);
    }
  });

  it('lineWalkable accepts a segment that ends exactly on a cell corner', () => {
    // Regression: the traversal used to step past the end cell at a t=1 corner tie.
    const nav = new NavGrid(openTerrain(3, 3));
    expect(lineWalkable(nav, { x: 20, y: 36 }, { x: 8, y: 40 })).toBe(true);
    expect(lineWalkable(nav, { x: 4, y: 4 }, { x: 16, y: 16 })).toBe(true);
  });

  it('lineWalkable rejects a segment crossing a blocked cell', () => {
    const nav = new NavGrid(terrainFromAscii(['.#.']));
    expect(lineWalkable(nav, { x: 4, y: 4 }, { x: 44, y: 4 })).toBe(false);
    expect(lineWalkable(nav, { x: 4, y: 4 }, { x: 12, y: 12 })).toBe(true);
  });
});
