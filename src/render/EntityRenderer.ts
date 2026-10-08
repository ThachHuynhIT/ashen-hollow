import type Phaser from 'phaser';
import { hasComponent, query } from 'bitecs';
import { BUILDINGS, BUILDING_IDS, type BuildingId } from '../data/buildings';
import { DOODAD_IDS } from '../data/doodads';
import { PALETTE } from '../data/palette';
import { resourceIndex, type ResourceId } from '../data/resources';
import { Blueprint, Building, Doodad, Position } from '../sim/components';
import { shapeBottom } from '../sim/geom';
import type { GameWorld } from '../sim/GameWorld';
import { DOODAD_VARIANTS, SPRITES_KEY, buildingFrame, doodadFrame } from './atlas';
import { pixelHash } from './pixel';

const BLUEPRINT_TINT = 0x8fa7c8;
const BLUEPRINT_ALPHA = 0.55;

/**
 * World sprites (doodads, buildings). Every sprite is anchored at its feet and depth
 * sorted by that y, so things lower on screen draw in front — no grid involved.
 */
export class EntityRenderer {
  private readonly sprites = new Map<number, Phaser.GameObjects.Image>();
  private readonly bars: Phaser.GameObjects.Graphics;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly world: GameWorld,
  ) {
    this.bars = scene.add.graphics().setDepth(999_000);
    for (const eid of query(world.ecs, [Doodad])) this.addDoodad(eid);
    for (const eid of query(world.ecs, [Building])) this.addBuilding(eid);
  }

  private addDoodad(eid: number): void {
    const kind = DOODAD_IDS[Doodad.kind[eid]!]!;
    const x = Position.x[eid]!;
    const y = Position.y[eid]!;
    const variant = Math.floor(pixelHash(Math.round(x), Math.round(y), 5) * DOODAD_VARIANTS[kind]);
    // Doodad sprites have their ground contact on the last row(s): stand them on y.
    const img = this.scene.add
      .image(Math.round(x), Math.round(y) + 1, SPRITES_KEY, doodadFrame(kind, variant))
      .setOrigin(0.5, 1)
      .setDepth(y);
    this.sprites.set(eid, img);
  }

  /** Add the sprite for a building entity (also called after the player places one). */
  addBuilding(eid: number): Phaser.GameObjects.Image {
    const kind = BUILDING_IDS[Building.kind[eid]!]!;
    const shape = this.world.obstacles.get(eid)!.shape;
    const img = buildingSprite(this.scene, kind, shape.cx, shapeBottom(shape));
    if (hasComponent(this.world.ecs, eid, Blueprint))
      img.setTint(BLUEPRINT_TINT).setAlpha(BLUEPRINT_ALPHA);
    this.sprites.set(eid, img);
    return img;
  }

  remove(eid: number): void {
    this.sprites.get(eid)?.destroy();
    this.sprites.delete(eid);
  }

  /** A blueprint became a real building: full colour and a small "thud". */
  completeBuilding(eid: number): void {
    const img = this.sprites.get(eid);
    if (!img) return;
    img.clearTint().setAlpha(1).setScale(1, 0.85);
    this.scene.tweens.add({ targets: img, scaleY: 1, duration: 120, ease: 'Back.easeOut' });
  }

  /** Under each blueprint: materials delivered (bone) and build progress (flame). */
  updateBlueprints(): void {
    const g = this.bars.clear();
    for (const eid of query(this.world.ecs, [Blueprint])) {
      const record = this.world.obstacles.get(eid);
      if (!record) continue;
      const def = BUILDINGS[BUILDING_IDS[Building.kind[eid]!]!];
      const shape = record.shape;
      const width = Math.max(12, shape.kind === 'rect' ? shape.hw * 2 : shape.r * 2);
      const x = Math.round(shape.cx - width / 2);
      const y = Math.round(shapeBottom(shape) + 3);
      let need = 0;
      let have = 0;
      for (const [res, amount] of Object.entries(def.cost)) {
        need += amount ?? 0;
        have += Blueprint.delivered[resourceIndex(res as ResourceId)]![eid]!;
      }
      g.fillStyle(PALETTE.ink, 0.85).fillRect(x - 1, y - 1, width + 2, 4);
      g.fillStyle(PALETTE.boneGrey, 1).fillRect(
        x,
        y,
        Math.round((width * have) / Math.max(1, need)),
        1,
      );
      g.fillStyle(PALETTE.flame, 1).fillRect(
        x,
        y + 1,
        Math.round((width * Blueprint.progress[eid]!) / def.buildTicks),
        1,
      );
    }
  }

  spriteOf(eid: number): Phaser.GameObjects.Image | undefined {
    return this.sprites.get(eid);
  }
}

/** A building sprite standing on the bottom edge of its footprint. */
export const buildingSprite = (
  scene: Phaser.Scene,
  kind: BuildingId,
  x: number,
  bottom: number,
): Phaser.GameObjects.Image =>
  scene.add
    .image(Math.round(x), Math.round(bottom) + 2, SPRITES_KEY, buildingFrame(kind))
    .setOrigin(0.5, 1)
    .setDepth(bottom);
