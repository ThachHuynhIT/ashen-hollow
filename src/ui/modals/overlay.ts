import type Phaser from 'phaser';
import { UI_PALETTE } from '../../data/uiPalette';

/** Opacity of the dimming layer behind every side panel and modal (§10.5). */
export const OVERLAY_ALPHA = 0.6;

/**
 * Full-screen dimming layer (`outline` at 60 %) that swallows pointer input so nothing
 * underneath (HUD or board) reacts while a modal is open. Call `fitOverlay` on resize.
 */
export const createOverlay = (scene: Phaser.Scene): Phaser.GameObjects.Rectangle =>
  scene.add
    .rectangle(0, 0, scene.scale.width, scene.scale.height, UI_PALETTE.outline, OVERLAY_ALPHA)
    .setOrigin(0, 0)
    .setInteractive();

export const fitOverlay = (scene: Phaser.Scene, overlay: Phaser.GameObjects.Rectangle): void => {
  const { width, height } = scene.scale;
  overlay.setSize(width, height);
  if (overlay.input) overlay.input.hitArea.setSize(width, height);
};
