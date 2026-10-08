export const SCENES = {
  boot: 'Boot',
  preload: 'Preload',
  mainMenu: 'MainMenu',
  world: 'World',
  hud: 'Hud',
} as const;

export interface WorldSceneData {
  seed: number;
}
