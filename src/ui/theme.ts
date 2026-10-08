import type Phaser from 'phaser';
import { PALETTE, toCss } from '../data/palette';

/**
 * UI styling shared by every Phaser-drawn screen. A serif "manuscript" face for all HUD
 * text; a pixel font with full Vietnamese diacritics replaces it in the art pass.
 * Monospace is reserved for debug readouts.
 */
// Every face here ships precomposed Vietnamese glyphs (Georgia does not — its
// diacritics fall back to another font and render detached).
export const FONT_UI =
  '"Palatino Linotype", "Book Antiqua", "Noto Serif", "Times New Roman", Tinos, serif';
export const FONT_TITLE = FONT_UI;
export const FONT_DEBUG = 'ui-monospace, Consolas, monospace';

/** Minimum touch target (Apple/Google guidance). */
export const TOUCH_TARGET = 44;

export const textStyle = (
  size: number,
  color: number = PALETTE.parchment,
  family: string = FONT_UI,
): Phaser.Types.GameObjects.Text.TextStyle => ({
  fontFamily: family,
  fontSize: `${size}px`,
  color: toCss(color),
});

export interface ButtonOptions {
  width?: number;
  height?: number;
  fontSize?: number;
  /** Optional pixel-art icon (texture key + frame), drawn above the label at integer scale. */
  icon?: { key: string; frame: string; scale?: number };
  onClick: () => void;
}

export interface Button {
  container: Phaser.GameObjects.Container;
  setActive: (active: boolean) => void;
  setLabel: (label: string) => void;
  setVisible: (visible: boolean) => void;
}

/** Dark panel button; fire-coloured when active (fire = safety in this game's visual language). */
export const createButton = (
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  { width = TOUCH_TARGET, height = TOUCH_TARGET, fontSize = 15, icon, onClick }: ButtonOptions,
): Button => {
  const bg = scene.add
    .rectangle(0, 0, width, height, PALETTE.ink, 0.92)
    .setStrokeStyle(2, PALETTE.shadowPlum);
  const children: Phaser.GameObjects.GameObject[] = [bg];
  let text: Phaser.GameObjects.Text;
  if (icon) {
    const img = scene.add
      .image(0, height / 2 - fontSize - 6, icon.key, icon.frame)
      .setOrigin(0.5, 1)
      .setScale(icon.scale ?? 1);
    text = scene.add
      .text(0, height / 2 - 4, label, textStyle(fontSize, PALETTE.bone))
      .setOrigin(0.5, 1);
    children.push(img, text);
  } else {
    text = scene.add.text(0, 0, label, textStyle(fontSize)).setOrigin(0.5);
    children.push(text);
  }
  const container = scene.add.container(x, y, children).setSize(width, height);
  let active = false;
  let hovered = false;

  const refresh = () => {
    bg.setStrokeStyle(2, active ? PALETTE.flame : hovered ? PALETTE.boneGrey : PALETTE.shadowPlum);
    bg.setFillStyle(active ? PALETTE.emberDark : PALETTE.ink, 0.92);
  };

  bg.setInteractive({ useHandCursor: true })
    .on('pointerover', () => {
      hovered = true;
      refresh();
    })
    .on('pointerout', () => {
      hovered = false;
      refresh();
    })
    .on('pointerup', onClick);

  return {
    container,
    setActive: (value) => {
      active = value;
      refresh();
    },
    setLabel: (value) => text.setText(value),
    setVisible: (value) => {
      container.setVisible(value);
      if (value) bg.setInteractive();
      else bg.disableInteractive();
    },
  };
};
