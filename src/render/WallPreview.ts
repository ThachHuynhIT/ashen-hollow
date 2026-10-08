import type Phaser from 'phaser';
import type { WallStakePlan } from '../sim/colony/blueprint';
import { SPRITES_KEY, buildingFrame } from './atlas';

const OK_TINT = 0x9cffb0;
const BAD_TINT = 0xff7070;

/** Ghost stakes along a wall being dragged (pooled images). */
export class WallPreview {
  private readonly pool: Phaser.GameObjects.Image[] = [];

  constructor(private readonly scene: Phaser.Scene) {}

  show(plan: readonly WallStakePlan[]): void {
    while (this.pool.length < plan.length) {
      this.pool.push(
        this.scene.add
          .image(0, 0, SPRITES_KEY, buildingFrame('wallStake'))
          .setOrigin(0.5, 1)
          .setAlpha(0.7),
      );
    }
    this.pool.forEach((img, i) => {
      const stake = plan[i];
      img.setVisible(stake !== undefined);
      if (!stake) return;
      img.setPosition(stake.x, stake.y + 6).setTint(stake.ok ? OK_TINT : BAD_TINT);
      if (img.depth !== stake.y + 4) img.setDepth(stake.y + 4);
    });
  }

  hide(): void {
    for (const img of this.pool) img.setVisible(false);
  }
}
