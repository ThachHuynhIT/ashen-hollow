import type Phaser from 'phaser';
import { designationOf } from '../sim/colony/designation';
import { Position } from '../sim/components';
import type { GameWorld } from '../sim/GameWorld';
import { SPRITES_KEY, iconFrame } from './atlas';
import type { EntityRenderer } from './EntityRenderer';

/** A small tool icon floating above every designated doodad. */
export class DesignationMarkers {
  private readonly icons = new Map<number, Phaser.GameObjects.Image>();

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly world: GameWorld,
    private readonly entities: EntityRenderer,
  ) {}

  sync(eids: readonly number[]): void {
    for (const eid of eids) {
      const kind = this.world.obstacles.has(eid) ? designationOf(this.world, eid) : null;
      if (!kind) {
        this.remove(eid);
        continue;
      }
      const sprite = this.entities.spriteOf(eid);
      const top = sprite ? sprite.y - sprite.height : Position.y[eid]! - 12;
      const icon =
        this.icons.get(eid) ??
        this.scene.add.image(0, 0, SPRITES_KEY, iconFrame(kind)).setOrigin(0.5, 1);
      icon.setFrame(iconFrame(kind)).setPosition(Math.round(Position.x[eid]!), Math.round(top - 1));
      icon.setDepth(Position.y[eid]! + 0.2).setAlpha(0.9);
      this.icons.set(eid, icon);
    }
  }

  remove(eid: number): void {
    this.icons.get(eid)?.destroy();
    this.icons.delete(eid);
  }
}
