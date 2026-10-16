import Phaser from 'phaser';
import { PALETTE } from '../data/palette';
import { textStyle } from '../ui/theme';
import { SCENES } from './keys';

/** Loads (or, for now, generates) every shared asset before the menu appears. */
export class PreloadScene extends Phaser.Scene {
  constructor() {
    super(SCENES.preload);
  }

  preload(): void {
    const { width, height } = this.scale;
    const label = this.add
      .text(width / 2, height / 2, 'Đang thắp lửa…', textStyle(16, PALETTE.boneGrey))
      .setOrigin(0.5);
    this.load.on(Phaser.Loader.Events.PROGRESS, (p: number) => {
      label.setText(`Đang thắp lửa… ${Math.round(p * 100)}%`);
    });
    // Real assets (atlases, audio) will be queued here with this.load.*.
  }

  create(): void {
    this.scene.start(SCENES.mainMenu);
  }
}
