import type Phaser from 'phaser';
import { PALETTE } from '../data/palette';
import type { GameWorld } from '../sim/GameWorld';
import { NAV_CELL } from '../sim/nav/NavGrid';

/**
 * F3 debug view: the hidden 8 px nav grid (blocked cells in red) and every obstacle
 * collider. Lets you see what the "free" world looks like to the pathfinder.
 */
export class DebugOverlay {
  private readonly g: Phaser.GameObjects.Graphics;
  private visible = false;

  constructor(
    scene: Phaser.Scene,
    private readonly world: GameWorld,
  ) {
    this.g = scene.add.graphics().setDepth(1_000_000).setVisible(false);
  }

  toggle(): void {
    this.visible = !this.visible;
    if (this.visible) this.redraw();
    this.g.setVisible(this.visible);
  }

  /** Call after the world changes (building placed, tree chopped). */
  refresh(): void {
    if (this.visible) this.redraw();
  }

  private redraw(): void {
    const { nav, obstacles } = this.world;
    const g = this.g.clear();
    g.fillStyle(PALETTE.blood, 0.35);
    for (let cy = 0; cy < nav.height; cy++) {
      for (let cx = 0; cx < nav.width; cx++) {
        if (!nav.walkable(cx, cy)) g.fillRect(cx * NAV_CELL, cy * NAV_CELL, NAV_CELL, NAV_CELL);
      }
    }
    g.lineStyle(1, PALETTE.ghostGreen, 0.8);
    for (const { shape } of obstacles.values()) {
      if (shape.kind === 'circle') g.strokeCircle(shape.cx, shape.cy, shape.r);
      else g.strokeRect(shape.cx - shape.hw, shape.cy - shape.hh, shape.hw * 2, shape.hh * 2);
    }
  }
}
