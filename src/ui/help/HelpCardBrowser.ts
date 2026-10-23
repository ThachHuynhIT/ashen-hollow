import Phaser from 'phaser';
import type { Content } from '../../game/cards/registry';
import type { CardId } from '../../data/types';
import { CardView } from '../cards/CardView';
import type { Rect } from '../hud/layout';
import { DECK_CARD } from '../modals/modalLayout';
import { addUiText, type TooltipHost } from '../theme';
import { helpCards, type HelpEntry, type HelpFilter } from './helpModel';
import { EMPTY_CARDS_TEXT } from './helpView';

const GAP = 8;

/**
 * Lưới thẻ của tab Thẻ bài: chỉ dựng đủ CardView cho các hàng đang thấy (tái dùng khi cuộn), cuộn theo hàng bằng
 * lăn chuột hoặc kéo. Chỉ hiển thị: bấm một thẻ chỉ chọn nó, không gửi lệnh nào.
 */
export class HelpCardBrowser {
  private readonly pool: CardView[] = [];
  private readonly empty: Phaser.GameObjects.Text;
  private entries: readonly HelpEntry[] = [];
  private viewport: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private cols = 1;
  private row = 0;
  private selectedId: string | null = null;
  private shown = false;
  private drag: { id: number; startY: number; startRow: number } | null = null;
  private readonly onWheel = (p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number): void => {
    if (this.shown && this.contains(p)) this.scrollRows(dy > 0 ? 1 : dy < 0 ? -1 : 0);
  };
  private readonly onDown = (p: Phaser.Input.Pointer): void => {
    if (this.shown && this.contains(p)) this.drag = { id: p.id, startY: p.y, startRow: this.row };
  };
  private readonly onMove = (p: Phaser.Input.Pointer): void => {
    if (!this.drag || this.drag.id !== p.id || !p.isDown) return;
    this.setRow(this.drag.startRow - Math.trunc((p.y - this.drag.startY) / (DECK_CARD.h + GAP)));
  };
  private readonly onUp = (): void => {
    this.drag = null;
  };

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly content: Content,
    private readonly tooltip: TooltipHost,
    private readonly root: Phaser.GameObjects.Container,
    private readonly onSelect: (entry: HelpEntry) => void,
  ) {
    this.empty = addUiText(scene, 0, 0, EMPTY_CARDS_TEXT, 16).setVisible(false);
    root.add(this.empty);
    scene.input.on(Phaser.Input.Events.POINTER_WHEEL, this.onWheel);
    scene.input.on(Phaser.Input.Events.POINTER_DOWN, this.onDown);
    scene.input.on(Phaser.Input.Events.POINTER_MOVE, this.onMove);
    scene.input.on(Phaser.Input.Events.POINTER_UP, this.onUp);
  }

  get count(): number {
    return this.entries.length;
  }

  setFilter(filter: HelpFilter): void {
    this.entries = helpCards(this.content, filter);
    this.row = 0;
    if (!this.entries.some((e) => e.id === this.selectedId)) this.selectedId = null;
    this.apply();
  }

  setSelected(id: string | null): void {
    this.selectedId = id;
    this.apply();
  }

  /** Show or hide the whole browser (other tabs hide it). */
  setShown(shown: boolean): void {
    this.shown = shown;
    this.apply();
  }

  layout(viewport: Rect): void {
    this.viewport = viewport;
    this.cols = Math.max(1, Math.floor((viewport.w + GAP) / (DECK_CARD.w + GAP)));
    const rows = Math.max(1, Math.floor((viewport.h + GAP) / (DECK_CARD.h + GAP)));
    while (this.pool.length < (rows + 1) * this.cols) this.pool.push(this.makeView());
    this.apply();
  }

  destroy(): void {
    const input = this.scene.input;
    input.off(Phaser.Input.Events.POINTER_WHEEL, this.onWheel);
    input.off(Phaser.Input.Events.POINTER_DOWN, this.onDown);
    input.off(Phaser.Input.Events.POINTER_MOVE, this.onMove);
    input.off(Phaser.Input.Events.POINTER_UP, this.onUp);
    for (const v of this.pool) v.destroy();
    this.pool.length = 0;
  }

  private makeView(): CardView {
    const view = new CardView(this.scene, this.content, { w: DECK_CARD.w, h: DECK_CARD.h }, this.tooltip);
    this.root.add(view.container);
    view.container.setVisible(false);
    return view;
  }

  private contains(p: { x: number; y: number }): boolean {
    const v = this.viewport;
    return p.x >= v.x && p.x <= v.x + v.w && p.y >= v.y && p.y <= v.y + v.h;
  }

  private get maxRow(): number {
    const rows = Math.ceil(this.entries.length / this.cols);
    const visibleRows = Math.max(1, Math.floor((this.viewport.h + GAP) / (DECK_CARD.h + GAP)));
    return Math.max(0, rows - visibleRows);
  }

  private scrollRows(d: number): void {
    this.setRow(this.row + d);
  }

  private setRow(row: number): void {
    const clamped = Math.max(0, Math.min(row, this.maxRow));
    if (clamped === this.row) return;
    this.row = clamped;
    this.apply();
  }

  private apply(): void {
    const v = this.viewport;
    const visibleRows = Math.max(1, Math.floor((v.h + GAP) / (DECK_CARD.h + GAP)));
    this.row = Math.max(0, Math.min(this.row, this.maxRow));
    this.empty.setPosition(v.x + 8, v.y + 8).setVisible(this.shown && this.entries.length === 0);
    this.pool.forEach((view, k) => {
      const r = this.row + Math.floor(k / this.cols);
      const idx = r * this.cols + (k % this.cols);
      const entry = this.entries[idx];
      const on = this.shown && entry !== undefined && r < this.row + visibleRows;
      view.container.setVisible(on);
      if (!on || entry === undefined) return;
      view.setCard(entry.id as CardId);
      view.setSelected(entry.id === this.selectedId);
      view.setPosition(v.x + (k % this.cols) * (DECK_CARD.w + GAP), v.y + (r - this.row) * (DECK_CARD.h + GAP));
      view.onClick(() => {
        this.selectedId = entry.id;
        this.onSelect(entry);
        this.apply();
      });
    });
  }
}
