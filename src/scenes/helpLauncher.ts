import type Phaser from 'phaser';
import type { EventBus } from '../core/events';
import type { GameSpeed } from '../core/SimClock';
import type { HelpTab } from '../data/help';
import type { GameEvents } from '../game/events';
import { getHelpGate } from '../ui/help/helpGate';
import type { HelpLaunch } from './HelpScene';
import { SCENES } from './keys';

/**
 * Open the Help overlay from `scene`. `bus` is the run's bus (null in the menus) and `speed` the battle speed to hand
 * back (null outside a battle). Does nothing while Help is already open.
 */
export const openHelp = (
  scene: Phaser.Scene,
  bus: EventBus<GameEvents> | null,
  speed: GameSpeed | null,
  tab?: HelpTab,
): void => {
  if (!getHelpGate(scene.game).open()) return;
  const data: HelpLaunch = { owner: scene.scene.key, bus, speed, tab };
  scene.scene.launch(SCENES.help, data);
};
