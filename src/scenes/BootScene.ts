import Phaser from 'phaser';
import { SCENES } from './keys';

/**
 * First scene. Loads only what the loading screen itself needs (nothing yet), then hands
 * over to Preload. Platform setup (storage, locale, Tauri/Capacitor bridges) goes here.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super(SCENES.boot);
  }

  create(): void {
    this.scene.start(SCENES.preload);
  }
}
