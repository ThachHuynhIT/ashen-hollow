import type Phaser from 'phaser';
import { ensureFieldTexture } from './atlas';

/** The painted battle field for one seed: a single image at (0, 0), depth 0. */
export class FieldRenderer {
  private readonly textures: Phaser.Textures.TextureManager;
  private readonly key: string;
  private image: Phaser.GameObjects.Image | null;

  constructor(scene: Phaser.Scene, seed: number) {
    this.textures = scene.textures;
    this.key = ensureFieldTexture(scene.textures, seed);
    this.image = scene.add.image(0, 0, this.key).setOrigin(0, 0).setDepth(0);
  }

  /** Destroys the image, then removes its `field-<seed>` texture (nothing else uses it). */
  destroy(): void {
    if (this.image === null) return;
    this.image.destroy();
    this.image = null;
    if (this.textures.exists(this.key)) this.textures.remove(this.key);
  }
}
