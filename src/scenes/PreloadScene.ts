import Phaser from 'phaser';
import { UI_PALETTE } from '../data/uiPalette';
import { buildUiTexture } from '../render/atlas';
import { textStyle } from '../ui/theme';
import { SCENES } from './keys';

const LOADING_LABEL = 'Đang dựng vương quốc…';

/** Loads (or, for now, generates) every shared asset before the menu appears. */
export class PreloadScene extends Phaser.Scene {
  constructor() {
    super(SCENES.preload);
  }

  preload(): void {
    const { width, height } = this.scale;
    const label = this.add
      .text(width / 2, height / 2, LOADING_LABEL, textStyle(16, UI_PALETTE.creamLight))
      .setOrigin(0.5);
    this.load.on(Phaser.Loader.Events.PROGRESS, (p: number) => {
      label.setText(`${LOADING_LABEL} ${Math.round(p * 100)}%`);
    });
    // Real assets (atlases, audio) will be queued here with this.load.*.
  }

  create(): void {
    buildUiTexture(this.textures);
    this.scene.start(SCENES.mainMenu);
  }
}
