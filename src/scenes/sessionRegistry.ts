import type Phaser from 'phaser';
import type { GameSession } from '../platform/session';

const SESSION_KEY = 'session';
export const STORAGE_WARNING_KEY = 'storageWarning';
/** Phaser's registry event for a change of the warning value. */
export const WARNING_EVENT = `changedata-${STORAGE_WARNING_KEY}`;

/** BootScene calls this once; scenes read the session back with `getSession`. */
export const setSession = (game: Phaser.Game, session: GameSession): void => {
  game.registry.set(SESSION_KEY, session);
};

export const getSession = (scene: Phaser.Scene): GameSession | null =>
  (scene.registry.get(SESSION_KEY) as GameSession | undefined) ?? null;

/** The storage could not be used: remembered until a scene shows it. */
export const setStorageWarning = (game: Phaser.Game, text: string): void => {
  game.registry.set(STORAGE_WARNING_KEY, text);
};

/** The pending storage warning, once: the first scene to ask gets it, later ones get null. */
export const takeStorageWarning = (scene: Phaser.Scene): string | null => {
  const text = (scene.registry.get(STORAGE_WARNING_KEY) as string | undefined) ?? null;
  if (text !== null) scene.registry.remove(STORAGE_WARNING_KEY);
  return text;
};
