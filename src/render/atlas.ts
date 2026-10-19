import type Phaser from 'phaser';
import { PixelCanvas } from './pixel';
import { UI_DECOR_IDS, UI_FRAME_IDS, paintUiDecor, paintUiFrame } from './uiArt';

/**
 * Turns generated pixel art into Phaser textures. Scenes refer to frames by name only, so
 * an Aseprite atlas with the same frame names can replace any generated texture (spec
 * §11.4). World sprites (`field-tiles`, `sprites`) are added here from G1.
 */

/** UI frames (nine-slice sources) and decorations, named as in uiArt.ts. */
export const UI_KEY = 'ui';

export const toCanvas = (art: PixelCanvas): HTMLCanvasElement => {
  const canvas = document.createElement('canvas');
  canvas.width = art.width;
  canvas.height = art.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');
  ctx.putImageData(new ImageData(art.data, art.width, art.height), 0, 0);
  return canvas;
};

/** Pack sprites left-to-right in shelves. Small and good enough for generated art. */
export const packShelves = (sprites: { name: string; art: PixelCanvas }[], maxWidth = 256) => {
  let x = 0;
  let y = 0;
  let shelf = 0;
  const placed = sprites.map((s) => {
    if (x + s.art.width > maxWidth) {
      x = 0;
      y += shelf + 1;
      shelf = 0;
    }
    const p = { ...s, x, y };
    x += s.art.width + 1;
    shelf = Math.max(shelf, s.art.height);
    return p;
  });
  return { placed, height: y + shelf };
};

/** Upload one generated canvas as its own texture (no-op if the key already exists). */
export const addPixelTexture = (
  textures: Phaser.Textures.TextureManager,
  key: string,
  art: PixelCanvas,
): void => {
  if (textures.exists(key)) return;
  if (!textures.addCanvas(key, toCanvas(art))) throw new Error(`Failed to create texture ${key}`);
};

/**
 * The UI atlas: every UI_FRAMES frame and UI_DECOR decoration under its own name, so the
 * HUD only ever refers to frames by name (swap for an Aseprite atlas with the same names).
 */
export const buildUiTexture = (textures: Phaser.Textures.TextureManager): void => {
  if (textures.exists(UI_KEY)) return;
  const sprites: { name: string; art: PixelCanvas }[] = [
    ...UI_FRAME_IDS.map((id) => ({ name: id, art: paintUiFrame(id) })),
    ...UI_DECOR_IDS.map((id) => ({ name: id, art: paintUiDecor(id) })),
  ];
  const width = 128;
  const { placed, height } = packShelves(sprites, width);
  const sheet = new PixelCanvas(width, height);
  for (const p of placed) sheet.blit(p.art, p.x, p.y);
  const texture = textures.addCanvas(UI_KEY, toCanvas(sheet));
  if (!texture) throw new Error('Failed to create UI texture');
  for (const p of placed) texture.add(p.name, 0, p.x, p.y, p.art.width, p.art.height);
};
