import type Phaser from 'phaser';
import { describe, expect, it } from 'vitest';
import { cameraScroll, screenToWorld } from '../ui/realm/realmLayout';
import type { RangeSpec } from '../ui/info/rangeModel';
import { RANGE_CACHE_MAX, RANGE_DEPTH, RANGE_MAX_RINGS, RangeRenderer } from './RangeRenderer';

/** Just enough of a Graphics to count what the renderer does. */
class FakeGraphics {
  x = 0;
  y = 0;
  depth = 0;
  visible = true;
  destroyed = false;
  rects: { x: number; y: number; color: number }[] = [];
  private color = 0;
  clears = 0;
  setDepth(d: number): this {
    this.depth = d;
    return this;
  }
  setPosition(x: number, y: number): this {
    this.x = x;
    this.y = y;
    return this;
  }
  setVisible(v: boolean): this {
    this.visible = v;
    return this;
  }
  clear(): this {
    this.rects = [];
    this.clears++;
    return this;
  }
  fillStyle(c: number): this {
    this.color = c;
    return this;
  }
  fillRect(x: number, y: number): this {
    this.rects.push({ x, y, color: this.color });
    return this;
  }
  destroy(): void {
    this.destroyed = true;
  }
}

const fakeScene = (): { scene: Phaser.Scene; made: FakeGraphics[] } => {
  const made: FakeGraphics[] = [];
  const scene = {
    add: {
      graphics: () => {
        const g = new FakeGraphics();
        made.push(g);
        return g;
      },
    },
  } as unknown as Phaser.Scene;
  return { scene, made };
};

const ring = (radius: number, kind: RangeSpec['kind'] = 'attack'): RangeSpec => ({ kind, radius, label: kind });

describe('RangeRenderer', () => {
  it('range_renderer_reuses_objects: 1000 show/move calls make exactly one Graphics', () => {
    const { scene, made } = fakeScene();
    const r = new RangeRenderer(scene);
    for (let i = 0; i < 1000; i++) {
      r.show({ x: i, y: i }, [ring(40 + (i % 5)), ring(20, 'pulse')]);
      r.move({ x: i + 1, y: i });
    }
    expect(made).toHaveLength(1);
    expect(made[0]!.depth).toBe(RANGE_DEPTH);
  });

  it('move only repositions: it does not clear or redraw', () => {
    const { scene, made } = fakeScene();
    const r = new RangeRenderer(scene);
    r.show({ x: 100, y: 100 }, [ring(30)]);
    const clears = made[0]!.clears;
    const drawn = made[0]!.rects.length;
    r.move({ x: 250, y: 90 });
    expect([made[0]!.x, made[0]!.y]).toEqual([250, 90]);
    expect(made[0]!.clears).toBe(clears);
    expect(made[0]!.rects).toHaveLength(drawn);
  });

  it('draws whole pixels only, around the origin, in a colour per kind', () => {
    const { scene, made } = fakeScene();
    const r = new RangeRenderer(scene);
    r.show({ x: 0, y: 0 }, [ring(24, 'attack'), ring(24, 'pulse')]);
    for (const p of made[0]!.rects) {
      expect(Number.isInteger(p.x) && Number.isInteger(p.y)).toBe(true);
    }
    expect(new Set(made[0]!.rects.map((p) => p.color)).size).toBe(2);
  });

  it('caps the rings at the budget and the contour cache at 64 radii', () => {
    const { scene, made } = fakeScene();
    const r = new RangeRenderer(scene);
    r.show(
      { x: 0, y: 0 },
      Array.from({ length: 20 }, (_, i) => ring(10 + i)),
    );
    const radii = new Set(made[0]!.rects.map((p) => Math.round(Math.sqrt(p.x * p.x + p.y * p.y))));
    expect(radii.size).toBeLessThanOrEqual(RANGE_MAX_RINGS + 2);
    for (let i = 0; i < 300; i++) r.show({ x: 0, y: 0 }, [ring(5 + i)]);
    expect(r.cacheSize).toBeLessThanOrEqual(RANGE_CACHE_MAX);
  });

  it('hide and destroy clean up, and an empty list hides', () => {
    const { scene, made } = fakeScene();
    const r = new RangeRenderer(scene);
    r.show({ x: 0, y: 0 }, [ring(30)]);
    r.show({ x: 0, y: 0 }, []);
    expect(made[0]!.visible).toBe(false);
    r.show({ x: 0, y: 0 }, [ring(30)]);
    expect(made[0]!.visible).toBe(true);
    r.hide();
    expect(made[0]!.visible).toBe(false);
    r.destroy();
    expect(made[0]!.destroyed).toBe(true);
  });
});

describe('range_zoom_and_camera_transition', () => {
  it('a ring of world radius R is R × zoom on screen at zoom 1, 2 and 3, centred on the source', () => {
    const screen = { w: 1280, h: 720 };
    const centre = { x: 200, y: 180 };
    for (const zoom of [1, 2, 3]) {
      const scroll = cameraScroll(centre, { x: 640, y: 360 }, screen, zoom);
      const edge = { x: centre.x + 64, y: centre.y };
      // the inverse of screenToWorld: world → screen
      const toScreen = (p: { x: number; y: number }) => ({
        x: screen.w / 2 + (p.x - scroll.x - screen.w / 2) * zoom,
        y: screen.h / 2 + (p.y - scroll.y - screen.h / 2) * zoom,
      });
      expect(toScreen(edge).x - toScreen(centre).x).toBe(64 * zoom);
      expect(toScreen(centre)).toEqual({ x: 640, y: 360 });
      const back = screenToWorld(toScreen(edge), scroll, screen, zoom);
      expect(back).toEqual(edge);
    }
  });
});
