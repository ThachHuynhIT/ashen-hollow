import type Phaser from 'phaser';
import type { UiFrame } from '../render/uiArt';
import type { TooltipContent } from './hud/layout';
import { addUiText, createPanel, frameBorder, type UiBox } from './theme';

/** Space between a frame's border and its text. */
const PAD = 6;
const LINE_GAP = 2;
const PART_GAP = 6;
const ICON_SCALE = 2;

export interface ContentBoxOptions {
  fontSize?: number;
  /** Make the frame interactive so clicks on it never reach the map. */
  blocking?: boolean;
}

/**
 * A UI frame that sizes itself around TooltipContent: a bold title, then lines made of
 * text and icon parts. Used for the tooltip, the selected-thing panel and the status hint.
 * Hidden while it has no content. Lifecycle: the owning scene calls refresh() from its
 * layout() on resize and destroy() on scene SHUTDOWN.
 */
export class ContentBox {
  readonly container: Phaser.GameObjects.Container;
  private readonly box: UiBox;
  private readonly items: (Phaser.GameObjects.Text | Phaser.GameObjects.Image)[] = [];
  private readonly fontSize: number;
  private content: TooltipContent | null = null;
  private key = '';

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly frame: UiFrame,
    private maxWidth: number,
    { fontSize = 13, blocking = false }: ContentBoxOptions = {},
  ) {
    this.fontSize = fontSize;
    this.box = createPanel(scene, frame, 32, 32);
    if (blocking) this.box.image.setInteractive();
    this.container = scene.add.container(0, 0, [this.box.image]).setVisible(false);
  }

  get width(): number {
    return this.box.width;
  }

  get height(): number {
    return this.box.height;
  }

  get visible(): boolean {
    return this.container.visible;
  }

  setMaxWidth(width: number): void {
    if (width === this.maxWidth) return;
    this.maxWidth = width;
    this.render();
  }

  setContent(content: TooltipContent | null): void {
    const key = content ? JSON.stringify(content) : '';
    if (key === this.key) return;
    this.key = key;
    this.content = content;
    this.render();
  }

  /** Re-measure after a uiScale change (the border thickness differs). */
  refresh(): void {
    this.render();
  }

  setPosition(x: number, y: number): this {
    this.container.setPosition(Math.round(x), Math.round(y));
    return this;
  }

  destroy(): void {
    this.container.destroy();
  }

  private render(): void {
    for (const item of this.items) item.destroy();
    this.items.length = 0;
    const content = this.content;
    if (!content || (!content.title && content.lines.length === 0)) {
      this.container.setVisible(false);
      return;
    }
    this.container.setVisible(true);
    const inset = frameBorder(this.scene, this.frame) + PAD;
    const wrap = Math.max(40, this.maxWidth - inset * 2);
    let y = inset;
    let right = inset;
    if (content.title) {
      const title = addUiText(this.scene, inset, y, content.title, this.fontSize + 1)
        .setFontStyle('bold')
        .setWordWrapWidth(wrap);
      this.add(title);
      y += title.height + LINE_GAP;
      right = Math.max(right, inset + title.width);
    }
    for (const line of content.lines) {
      let x = inset;
      let lineHeight = 0;
      for (const part of line) {
        if (part.icon) {
          const icon = this.scene.add
            .image(x, y, part.icon.key, part.icon.frame)
            .setOrigin(0, 0)
            .setScale(ICON_SCALE);
          this.add(icon);
          right = Math.max(right, x + icon.displayWidth);
          x += icon.displayWidth + 2;
          lineHeight = Math.max(lineHeight, icon.displayHeight);
        }
        if (part.text) {
          const text = addUiText(this.scene, x, y, part.text, this.fontSize, part.color);
          if (line.length === 1) text.setWordWrapWidth(wrap);
          this.add(text);
          right = Math.max(right, x + text.width);
          x += text.width + PART_GAP;
          lineHeight = Math.max(lineHeight, text.height);
        }
      }
      y += lineHeight + LINE_GAP;
    }
    this.box.resize(
      Math.ceil(Math.min(this.maxWidth, right + inset)),
      Math.ceil(y - LINE_GAP + inset),
    );
  }

  private add(item: Phaser.GameObjects.Text | Phaser.GameObjects.Image): void {
    this.items.push(item);
    this.container.add(item);
  }
}
