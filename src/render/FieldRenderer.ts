import type Phaser from 'phaser';
import { ensureFieldTexture } from './atlas';

/** The painted battle field for one seed: a single image at (0, 0), depth 0. */
export class FieldRenderer {
  private image: Phaser.GameObjects.Image | null;

  constructor(scene: Phaser.Scene, seed: number) {
    const key = ensureFieldTexture(scene.textures, seed);
    this.image = scene.add.image(0, 0, key).setOrigin(0, 0).setDepth(0);
  }

  /** Destroys the image; the texture stays cached until another seed replaces it. */
  destroy(): void {
    this.image?.destroy();
    this.image = null;
  }
}
