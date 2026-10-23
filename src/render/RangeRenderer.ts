import type Phaser from 'phaser';
import { PALETTE } from '../data/palette';
import type { Point } from '../ui/hud/layout';
import { pixelCircle } from '../ui/info/pixelCircle';
import type { RangeSpec } from '../ui/info/rangeModel';

/** Trên nhà/quân, dưới thanh máu (99 000) và mũi tên (100 000). */
export const RANGE_DEPTH = 90_000;
export const RANGE_MAX_RINGS = 8;
export const RANGE_CACHE_MAX = 64;

const COLORS: Record<RangeSpec['kind'], number> = {
  attack: PALETTE.gold,
  minimum: PALETTE.orange,
  pulse: PALETTE.purple,
  aura: PALETTE.teal,
  shield: PALETTE.blue,
  taunt: PALETTE.red,
  bell: PALETTE.wheatLight,
  heal: PALETTE.grassLight,
};

/**
 * Vòng tầm của thứ đang chọn/rê: MỘT Graphics dùng lại, vẽ quanh gốc (0,0) bằng ô 1 px thế giới nên camera
 * (zoom nguyên) tự phóng; di chuyển chỉ đổi vị trí Graphics, không vẽ lại. Đường viền nguyên lấy từ cache 64 bán kính.
 */
export class RangeRenderer {
  private readonly g: Phaser.GameObjects.Graphics;
  private readonly cache = new Map<number, readonly Point[]>();
  private drawn = '';

  constructor(scene: Phaser.Scene) {
    this.g = scene.add.graphics().setDepth(RANGE_DEPTH).setVisible(false);
  }

  get cacheSize(): number {
    return this.cache.size;
  }

  show(center: Point, ranges: readonly RangeSpec[]): void {
    const rings = ranges.slice(0, RANGE_MAX_RINGS);
    if (rings.length === 0) {
      this.hide();
      return;
    }
    const sig = rings.map((r) => `${r.kind}:${r.radius}`).join('|');
    if (sig !== this.drawn) {
      this.drawn = sig;
      this.g.clear();
      for (const ring of rings) {
        this.g.fillStyle(COLORS[ring.kind], 1);
        for (const p of this.contour(ring.radius)) this.g.fillRect(p.x, p.y, 1, 1);
      }
    }
    this.move(center);
    this.g.setVisible(true);
  }

  move(center: Point): void {
    this.g.setPosition(Math.round(center.x), Math.round(center.y));
  }

  hide(): void {
    this.g.setVisible(false);
  }

  destroy(): void {
    this.g.destroy();
    this.cache.clear();
  }

  private contour(radius: number): readonly Point[] {
    const key = Math.round(radius);
    const hit = this.cache.get(key);
    if (hit) {
      this.cache.delete(key);
      this.cache.set(key, hit); // most recently used last
      return hit;
    }
    const made = pixelCircle(key);
    this.cache.set(key, made);
    if (this.cache.size > RANGE_CACHE_MAX) this.cache.delete(this.cache.keys().next().value as number);
    return made;
  }
}
