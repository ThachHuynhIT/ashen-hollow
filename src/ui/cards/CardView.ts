import type Phaser from 'phaser';
import type { CardDef, CardId } from '../../data/types';
import { UI_PALETTE } from '../../data/uiPalette';
import { describeCard } from '../../game/cards/describe';
import type { Content } from '../../game/cards/registry';
import { SPRITES_KEY, cardArtFrame, iconFrame } from '../../render/atlas';
import type { IconId } from '../../render/iconArt';
import { CARD_ART } from '../../render/cardArt';
import type { UiFrame } from '../../render/uiArt';
import { CARD_LIFT, DRAG_SLOP, ellipsize, type Size, type TooltipContent } from '../hud/layout';
import {
  addUiText,
  bindPress,
  createPanel,
  frameBorder,
  type PressHandle,
  type TooltipHost,
  type UiBox,
} from '../theme';

/** Opacity of a card that cannot be played right now. */
const DIMMED_ALPHA = 0.55;
/** Space between the frame border and the card's contents. */
const PAD = 2;
const ICON = 16;

/** Icon of each card kind until G2c adds dedicated art for the new kinds. */
const KIND_ICON: Record<CardDef['kind'], IconId> = {
  throne: 'throne',
  troop: 'troop',
  tower: 'tower',
  economy: 'crown',
  support: 'tower',
  enchantment: 'tome',
  tome: 'tome',
};
const MAX_ART_SCALE = 3;
/** A dragged card floats above the rest of the HUD. */
const DRAG_DEPTH = 500;
const DRAG_ALPHA = 0.85;

const RARITY_FRAME: Record<CardDef['rarity'], UiFrame> = {
  common: 'card',
  uncommon: 'cardUncommon',
  rare: 'cardRare',
};

/** Greedy word wrap into at most `max` lines; the last line is cut with "…" if needed. */
const clampLines = (
  text: string,
  width: number,
  max: number,
  measure: (s: string) => number,
): string[] => {
  const words = text.split(/\s+/).filter((w) => w.length > 0);
  const lines: string[] = [];
  let i = 0;
  while (i < words.length && lines.length < max - 1) {
    let line = words[i]!;
    i++;
    while (i < words.length && measure(`${line} ${words[i]}`) <= width) {
      line = `${line} ${words[i]}`;
      i++;
    }
    lines.push(ellipsize(line, width, measure));
  }
  if (i < words.length) lines.push(ellipsize(words.slice(i).join(' '), width, measure));
  return lines;
};

/**
 * One card face (§10.4): rarity frame (`cardSelected` while selected), name band, the 32×24
 * picture at an integer scale, kind icon top-left, first description line cut to two lines,
 * optional "Lên cấp" badge. Hover / 400 ms long-press shows the full text in the shared
 * Tooltip; clicks go through bindPress (same drag-slop rules as buttons). Pure display: it
 * never touches game state. Selecting lifts the card CARD_LIFT (12) px above its set position.
 */
export class CardView {
  readonly container: Phaser.GameObjects.Container;
  private readonly box: UiBox;
  private readonly parts: Phaser.GameObjects.GameObject[] = [];
  private def: CardDef | null = null;
  private levelUp = false;
  private selected = false;
  private dimmed = false;
  private handler: (() => void) | null = null;
  private readonly press: PressHandle;
  private base = { x: 0, y: 0 };
  private dropHandler: ((x: number, y: number) => void) | null = null;
  private dragFrom: { id: number } | null = null;
  private dragging = false;
  private readonly onResize = (): void => this.render();

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly content: Content,
    private size: Size,
    tooltip?: TooltipHost,
  ) {
    this.box = createPanel(scene, 'card', size.w, size.h);
    this.container = scene.add.container(0, 0, [this.box.image]).setSize(size.w, size.h);
    this.press = bindPress(scene, this.box.image, {
      onClick: () => this.handler?.(),
      tooltip: tooltip ? { host: tooltip, content: () => this.tooltipContent() } : undefined,
    });
    this.box.image.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.dropHandler) this.dragFrom = { id: pointer.id };
    });
    scene.input.on('pointermove', this.onDragMove);
    scene.input.on('pointerup', this.onDragEnd);
    // Borders switch between 1× and 2× when the viewport crosses 600 px.
    scene.scale.on('resize', this.onResize);
    this.container.once('destroy', () => {
      scene.scale.off('resize', this.onResize);
      scene.input.off('pointermove', this.onDragMove);
      scene.input.off('pointerup', this.onDragEnd);
    });
    this.render();
  }

  setCard(cardId: CardId | null, opts: { levelUp?: boolean } = {}): void {
    this.def = cardId === null ? null : this.content.card(cardId);
    this.levelUp = opts.levelUp ?? false;
    this.press.cancel();
    this.render();
  }

  setSelected(selected: boolean): void {
    if (selected === this.selected) return;
    this.selected = selected;
    this.render();
    this.place();
  }

  setDimmed(dimmed: boolean): void {
    this.dimmed = dimmed;
    this.container.setAlpha(dimmed ? DIMMED_ALPHA : 1);
  }

  setPosition(x: number, y: number): void {
    this.base = { x: Math.round(x), y: Math.round(y) };
    this.place();
  }

  /** New logical size (the hand switches 120×168 ↔ 108×152 between layouts). */
  resize(size: Size): void {
    this.size = size;
    this.render();
  }

  onClick(handler: () => void): void {
    this.handler = handler;
  }

  /** Drag the card by more than DRAG_SLOP and release: `handler` gets the release point (screen px). */
  onDrop(handler: (x: number, y: number) => void): void {
    this.dropHandler = handler;
  }

  destroy(): void {
    this.press.cancel();
    this.container.destroy();
  }

  private readonly onDragMove = (pointer: Phaser.Input.Pointer): void => {
    const from = this.dragFrom;
    if (!from || from.id !== pointer.id || !pointer.isDown) return;
    if (!this.dragging) {
      if (pointer.getDistance() <= DRAG_SLOP) return;
      this.dragging = true;
      this.press.cancel();
      this.container.setDepth(DRAG_DEPTH).setAlpha(DRAG_ALPHA);
    }
    this.container.setPosition(Math.round(pointer.x - this.size.w / 2), Math.round(pointer.y - this.size.h / 2));
  };

  private readonly onDragEnd = (pointer: Phaser.Input.Pointer): void => {
    const from = this.dragFrom;
    if (!from || from.id !== pointer.id) return;
    this.dragFrom = null;
    if (!this.dragging) return;
    this.dragging = false;
    this.container.setDepth(0).setAlpha(this.dimmed ? DIMMED_ALPHA : 1);
    this.place();
    this.dropHandler?.(pointer.x, pointer.y);
  };

  private place(): void {
    this.container.setPosition(this.base.x, this.base.y - (this.selected ? CARD_LIFT : 0));
  }

  private tooltipContent(): TooltipContent | null {
    if (!this.def) return null;
    const { title, lines } = describeCard(this.def);
    return { title, lines: lines.map((text) => [{ text }]) };
  }

  private render(): void {
    for (const part of this.parts) part.destroy();
    this.parts.length = 0;
    const { w, h } = this.size;
    this.container.setSize(w, h);
    const def = this.def;
    this.container.setVisible(def !== null);
    if (!def) {
      this.box.image.disableInteractive();
      return;
    }
    this.box.image.setInteractive();
    const frame = this.selected ? 'cardSelected' : RARITY_FRAME[def.rarity];
    this.box.setFrame(frame);
    this.box.resize(w, h);
    this.container.setAlpha(this.dimmed ? DIMMED_ALPHA : 1);

    const inset = frameBorder(this.scene, frame) + PAD;
    const inner = Math.max(1, w - 2 * inset);
    const big = w >= 100;

    // Name band: wraps to up to two lines in the space right of the kind icon (top-left).
    const nameWidth = Math.max(1, inner - ICON - PAD);
    const name = addUiText(this.scene, inset + ICON + PAD + nameWidth / 2, inset, '', big ? 12 : 10)
      .setOrigin(0.5, 0)
      .setAlign('center')
      .setFontStyle('bold');
    const measureName = (s: string): number => name.setText(s).width;
    name.setText(clampLines(def.nameVi, nameWidth, 2, measureName).join('\n'));
    this.add(name);

    const icon = this.addImage(iconFrame(KIND_ICON[def.kind]), inset, inset)?.setOrigin(0, 0);
    const bandBottom = inset + Math.max(name.height, icon?.displayHeight ?? 0) + PAD;

    // Picture: largest integer scale (≤ 3) that fits the inner width.
    const scale = Math.max(1, Math.min(MAX_ART_SCALE, Math.floor(inner / CARD_ART.w)));
    const art = this.addImage(cardArtFrame(def.id), w / 2, bandBottom)
      ?.setOrigin(0.5, 0)
      .setScale(scale);
    let y = bandBottom + (art?.displayHeight ?? CARD_ART.h * scale) + PAD;

    if (this.levelUp) {
      const badge = addUiText(this.scene, w / 2, y, 'Lên cấp', big ? 12 : 10, UI_PALETTE.good)
        .setOrigin(0.5, 0)
        .setFontStyle('bold');
      this.add(badge);
      y += badge.height;
    }

    const first = describeCard(def).lines[0] ?? '';
    const text = addUiText(this.scene, w / 2, y, '', big ? 11 : 10).setOrigin(0.5, 0);
    const measure = (s: string): number => text.setText(s).width;
    text.setAlign('center').setText(clampLines(first, inner, 2, measure).join('\n'));
    this.add(text);
  }

  /** Image from the sprites atlas, or null (nothing drawn) if the frame is missing. */
  private addImage(frame: string, x: number, y: number): Phaser.GameObjects.Image | null {
    const textures = this.scene.textures;
    if (!textures.exists(SPRITES_KEY) || !textures.get(SPRITES_KEY).has(frame)) return null;
    const image = this.scene.add.image(x, y, SPRITES_KEY, frame);
    this.add(image);
    return image;
  }

  private add(part: Phaser.GameObjects.GameObject): void {
    this.parts.push(part);
    this.container.add(part);
  }
}
