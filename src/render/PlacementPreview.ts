import type Phaser from 'phaser';
import type { BuildingId } from '../data/buildings';
import { PALETTE } from '../data/palette';
import { shapeBottom, type Shape } from '../sim/geom';
import { SPRITES_KEY, buildingFrame } from './atlas';

const VALID_TINT = 0x9cffb0;
const INVALID_TINT = 0xff7070;

/**
 * Ghost of the building being placed: translucent sprite tinted green/red plus the
 * footprint outline on the ground, drawn exactly where the building would land.
 */
export class PlacementPreview {
  private readonly ghost: Phaser.GameObjects.Image;
  private readonly outline: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene) {
    this.outline = scene.add.graphics().setVisible(false);
    this.ghost = scene.add
      .image(0, 0, SPRITES_KEY, buildingFrame('tent'))
      .setOrigin(0.5, 1)
      .setAlpha(0.7)
      .setVisible(false);
  }

  show(kind: BuildingId, shape: Shape, valid: boolean): void {
    const bottom = shapeBottom(shape);
    this.ghost
      .setFrame(buildingFrame(kind))
      .setPosition(Math.round(shape.cx), Math.round(bottom) + 2)
      .setTint(valid ? VALID_TINT : INVALID_TINT)
      .setVisible(true);
    // Setting depth queues a full display-list sort in Phaser 4 (thousands of trees),
    // so only touch it when it actually changes.
    if (this.ghost.depth !== bottom + 0.5) this.ghost.setDepth(bottom + 0.5);
    if (this.outline.depth !== bottom - 0.5) this.outline.setDepth(bottom - 0.5);

    const color = valid ? PALETTE.ghostGreen : PALETTE.blood;
    this.outline.clear().setVisible(true);
    this.outline.fillStyle(color, 0.25).lineStyle(1, color, 0.9);
    if (shape.kind === 'rect') {
      const x = shape.cx - shape.hw;
      const y = shape.cy - shape.hh;
      this.outline.fillRect(x, y, shape.hw * 2, shape.hh * 2);
      this.outline.strokeRect(x + 0.5, y + 0.5, shape.hw * 2 - 1, shape.hh * 2 - 1);
    } else {
      this.outline.fillCircle(shape.cx, shape.cy, shape.r);
      this.outline.strokeCircle(shape.cx, shape.cy, shape.r);
    }
  }

  hide(): void {
    this.ghost.setVisible(false);
    this.outline.setVisible(false);
  }
}
