import type Phaser from 'phaser';
import type { UiFrame } from '../render/uiArt';
import type { TooltipContent } from './hud/layout';
import { addUiText, createPanel, frameBorder, type UiBox } from './theme';

/** Space between a frame's border and its text. */
const PAD = 6;
const LINE_GAP = 2;
const PART_GAP = 6;
const ICON_SCALE = 2;

interface Row {
  top: number;
  h: number;
  items: { obj: Phaser.GameObjects.Text | Phaser.GameObjects.Image; y0: number }[];
}

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
  private maxHeight: number | null = null;
  private scrollLine = 0;
  private rows: Row[] = [];
  private markers: Phaser.GameObjects.Text[] = [];
  private inset = 0;
  private headerBottom = 0;
  private boxWidth = 32;

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

  /** Cap the box height; longer content scrolls by whole lines. `null` (the default) never limits. */
  setMaxHeight(height: number | null): void {
    if (height === this.maxHeight) return;
    this.maxHeight = height;
    if (this.content) this.applyWindow();
  }

  /** Scroll by `lines` (positive = down), clamped; does nothing without a height cap. */
  scrollBy(lines: number): void {
    if (this.maxHeight === null || lines === 0 || !this.content) return;
    this.scrollLine += lines;
    this.applyWindow();
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
    this.rows = [];
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
    this.inset = inset;
    this.headerBottom = y;
    for (const line of content.lines) {
      let x = inset;
      let lineHeight = 0;
      const row: Row = { top: y, h: 0, items: [] };
      for (const part of line) {
        if (part.icon) {
          const icon = this.scene.add
            .image(x, y, part.icon.key, part.icon.frame)
            .setOrigin(0, 0)
            .setScale(ICON_SCALE);
          this.add(icon);
          row.items.push({ obj: icon, y0: y });
          right = Math.max(right, x + icon.displayWidth);
          x += icon.displayWidth + 2;
          lineHeight = Math.max(lineHeight, icon.displayHeight);
        }
        if (part.text) {
          const text = addUiText(this.scene, x, y, part.text, this.fontSize, part.color);
          if (line.length === 1) text.setWordWrapWidth(wrap);
          this.add(text);
          row.items.push({ obj: text, y0: y });
          right = Math.max(right, x + text.width);
          x += text.width + PART_GAP;
          lineHeight = Math.max(lineHeight, text.height);
        }
      }
      row.h = lineHeight;
      this.rows.push(row);
      y += lineHeight + LINE_GAP;
    }
    this.boxWidth = Math.ceil(Math.min(this.maxWidth, right + inset));
    this.applyWindow();
  }

  /** Show the rows that fit under `maxHeight` starting at `scrollLine`; the title stays on top. */
  private applyWindow(): void {
    for (const m of this.markers) m.destroy();
    this.markers.length = 0;
    const rows = this.rows;
    const inset = this.inset;
    const avail = this.maxHeight === null ? Infinity : this.maxHeight - this.headerBottom - inset;
    const span = (from: number, to: number): number => {
      let sum = 0;
      for (let i = from; i < to; i++) sum += rows[i]!.h + LINE_GAP;
      return sum - (to > from ? LINE_GAP : 0);
    };
    let maxFirst = 0;
    while (maxFirst < rows.length - 1 && span(maxFirst, rows.length) > avail) maxFirst++;
    this.scrollLine = Math.max(0, Math.min(this.scrollLine, maxFirst));
    let end = this.scrollLine;
    while (end < rows.length && (end === this.scrollLine || span(this.scrollLine, end + 1) <= avail)) end++;
    let y = this.headerBottom;
    rows.forEach((row, i) => {
      const shown = i >= this.scrollLine && i < end;
      for (const it of row.items) {
        it.obj.setVisible(shown);
        if (shown) it.obj.y = it.y0 - row.top + y;
      }
      if (shown) y += row.h + LINE_GAP;
    });
    this.box.resize(this.boxWidth, Math.ceil(y - LINE_GAP + inset));
    const above = this.scrollLine > 0;
    const below = end < rows.length;
    if (above) this.mark('▲', inset);
    if (below) this.mark('▼', this.box.height - inset - this.fontSize);
  }

  private mark(glyph: string, y: number): void {
    const t = addUiText(this.scene, this.boxWidth - this.inset - this.fontSize, y, glyph, this.fontSize);
    this.container.add(t);
    this.markers.push(t);
  }

  private add(item: Phaser.GameObjects.Text | Phaser.GameObjects.Image): void {
    this.items.push(item);
    this.container.add(item);
  }
}
