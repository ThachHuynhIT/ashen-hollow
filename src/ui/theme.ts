import type Phaser from 'phaser';
import { PALETTE, toCss } from '../data/palette';

/**
 * UI styling shared by every Phaser-drawn screen. Placeholder system fonts for now —
 * a pixel font with full Vietnamese diacritics replaces these in the art pass.
 */
export const FONT_UI = 'ui-monospace, "Cascadia Mono", Consolas, "Liberation Mono", monospace';
export const FONT_TITLE = 'Georgia, "Times New Roman", serif';

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
  onClick: () => void;
}

export interface Button {
  container: Phaser.GameObjects.Container;
  setActive: (active: boolean) => void;
  setLabel: (label: string) => void;
}

/** A flat gothic-ish button: dark panel, bone border, ember highlight when active/hovered. */
export const createButton = (
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  { width = TOUCH_TARGET, height = TOUCH_TARGET, fontSize = 16, onClick }: ButtonOptions,
): Button => {
  const bg = scene.add
    .rectangle(0, 0, width, height, PALETTE.ink, 0.92)
    .setStrokeStyle(2, PALETTE.shadowPlum);
  const text = scene.add.text(0, 0, label, textStyle(fontSize)).setOrigin(0.5);
  const container = scene.add.container(x, y, [bg, text]).setSize(width, height);
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
  };
};
