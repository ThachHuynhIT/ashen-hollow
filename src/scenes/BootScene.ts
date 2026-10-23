import Phaser from 'phaser';
import { CONTENT } from '../game/cards/registry';
import { browserIdbFactory, createSession } from '../platform/session';
import { SCENES } from './keys';
import { setSession, setStorageWarning } from './sessionRegistry';

/**
 * First scene. Loads only what the loading screen itself needs (nothing yet), opens the
 * save storage (IndexedDB, or memory with one warning), then hands over to Preload.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super(SCENES.boot);
  }

  create(): void {
    const game = this.game;
    createSession(browserIdbFactory(), (text) => setStorageWarning(game, text), CONTENT)
      .catch(() => createSession(null, (text) => setStorageWarning(game, text), CONTENT))
      .then((session) => {
        setSession(game, session);
        this.scene.start(SCENES.preload);
      });
  }
}
