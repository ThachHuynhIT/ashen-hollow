import type Phaser from 'phaser';
import { CONTENT } from '../game/cards/registry';
import { SCENES } from '../scenes/keys';
import { DevJumpPanel } from './DevJumpPanel';
import { createPreviewRun, previewTargets } from './previewRun';

/** DEV only: adds the year-jump panel; returns a function that removes it. Imported once, from `main.ts`, under `import.meta.env.DEV`. */
export const registerPreview = (game: Phaser.Game): (() => void) => {
  const stopAll = (): void => {
    for (const scene of game.scene.getScenes(true)) game.scene.stop(scene.scene.key);
  };
  const panel: DevJumpPanel = new DevJumpPanel(
    previewTargets(),
    (target) => {
      const run = createPreviewRun(target, CONTENT);
      stopAll();
      game.scene.start(SCENES.realm, { preview: run });
      panel.showBanner();
    },
    () => {
      stopAll();
      game.scene.start(SCENES.mainMenu);
    },
  );
  return () => panel.destroy();
};
