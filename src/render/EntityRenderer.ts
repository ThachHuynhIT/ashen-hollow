import type Phaser from 'phaser';
import { query } from 'bitecs';
import { BUILDING_IDS, type BuildingId } from '../data/buildings';
import { DOODAD_IDS } from '../data/doodads';
import { Building, Doodad, Position } from '../sim/components';
import { shapeBottom } from '../sim/geom';
import type { GameWorld } from '../sim/GameWorld';
import { DOODAD_VARIANTS, SPRITES_KEY, buildingFrame, doodadFrame } from './atlas';
import { pixelHash } from './pixel';

/**
 * World sprites (doodads, buildings). Every sprite is anchored at its feet and depth
 * sorted by that y, so things lower on screen draw in front — no grid involved.
 */
export class EntityRenderer {
  private readonly sprites = new Map<number, Phaser.GameObjects.Image>();

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly world: GameWorld,
  ) {
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
    this.sprites.set(eid, img);
    return img;
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
