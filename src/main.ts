import Phaser from 'phaser';
import { PALETTE, toCss } from './data/palette';
import { BattleHudScene } from './scenes/BattleHudScene';
import { BootScene } from './scenes/BootScene';
import { KingSelectScene } from './scenes/KingSelectScene';
import { MainMenuScene } from './scenes/MainMenuScene';
import { PlanningHudScene } from './scenes/PlanningHudScene';
import { PreloadScene } from './scenes/PreloadScene';
import { RealmScene } from './scenes/RealmScene';
import { RunEndScene } from './scenes/RunEndScene';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: toCss(PALETTE.outline),
  // Nearest-neighbour sampling + rounded positions: crisp pixel art at integer zoom.
  pixelArt: true,
  scale: {
    // Canvas fills the window 1:1; zoom is handled by the camera in whole steps.
    mode: Phaser.Scale.RESIZE,
    width: window.innerWidth,
    height: window.innerHeight,
  },
  input: {
    // Mouse + up to two simultaneous touches (pinch).
    activePointers: 3,
  },
  scene: [
    BootScene,
    PreloadScene,
    MainMenuScene,
    KingSelectScene,
    RealmScene,
    PlanningHudScene,
    BattleHudScene,
    RunEndScene,
  ],
});

if (import.meta.env.DEV) {
  (window as unknown as { game: Phaser.Game }).game = game;
}
