import Phaser from 'phaser';
import type { CardId } from '../../data/types';
import { UI_PALETTE } from '../../data/uiPalette';
import type { Content } from '../../game/cards/registry';
import { CardView } from '../cards/CardView';
import { textContent } from '../hud/layout';
import {
  addUiText,
  createButton,
  createPanel,
  frameBorder,
  type Button,
  type TooltipHost,
  type UiBox,
} from '../theme';
import { DECK_TABS, deckEntries, type DeckEntry, type DeckTab } from './deckModel';
import { CLOSE_BUTTON, DECK_CARD, deckModalLayout, type DeckModalLayout } from './modalLayout';
import { createOverlay, fitOverlay } from './overlay';

const PAD_DESKTOP = 12;
const PAD_MOBILE = 4;
/** Pixels of wheel / drag travel that scroll one pixel of cards. */
const WHEEL_STEP = 0.5;

/**
 * The deck viewer (§10.4 "Bộ bài"): every owned card once with a ×N badge, a tab per card
 * family and a scrollable grid (mouse wheel or drag; only cards fully inside the viewport
 * are drawn, and a drag snaps to whole rows when released). Pure display.
 * Call `layout()` on resize and `destroy()` when closed.
 */
export class DeckModal {
  private readonly overlay: Phaser.GameObjects.Rectangle;
  private readonly box: UiBox;
  private readonly title: Phaser.GameObjects.Text;
  private readonly close: Button;
  private readonly tabs: Button[];
  private readonly root: Phaser.GameObjects.Container;
  private readonly cards: { view: CardView; badge: Phaser.GameObjects.Text }[] = [];
  private entries: DeckEntry[] = [];
  private tab: DeckTab = 'all';
  private scroll = 0;
  private lay: DeckModalLayout | null = null;
  private drag: { id: number; startY: number; startScroll: number } | null = null;
  private readonly onWheel = (
    _p: Phaser.Input.Pointer,
    _over: unknown,
    _dx: number,
    dy: number,
  ): void => this.scrollBy(dy * WHEEL_STEP);
  private readonly onDown = (p: Phaser.Input.Pointer): void => {
    const v = this.lay?.viewport;
    if (!v || p.x < v.x || p.x > v.x + v.w || p.y < v.y || p.y > v.y + v.h) return;
    this.drag = { id: p.id, startY: p.y, startScroll: this.scroll };
  };
  private readonly onMove = (p: Phaser.Input.Pointer): void => {
    if (!this.drag || this.drag.id !== p.id || !p.isDown) return;
    this.setScroll(this.drag.startScroll - (p.y - this.drag.startY));
  };
  private readonly onUp = (p: Phaser.Input.Pointer): void => {
    if (!this.drag || this.drag.id !== p.id) return;
    this.drag = null;
    const l = this.lay;
    if (l && l.maxScroll > 0) {
      const snapped = Math.round(this.scroll / l.rowStep) * l.rowStep;
      this.setScroll(snapped);
    }
  };

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly content: Content,
    private readonly deck: readonly CardId[],
    private readonly tooltip: TooltipHost,
    onClose: () => void,
  ) {
    this.overlay = createOverlay(scene);
    this.overlay.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, onClose);
    this.box = createPanel(scene, 'panel', 64, 64);
    this.box.image.setInteractive(); // a click on the panel must not reach the closing overlay
    this.title = addUiText(scene, 0, 0, '', 18).setOrigin(0, 0.5).setFontStyle('bold');
    this.close = createButton(scene, 0, 0, '✕', {
      width: CLOSE_BUTTON,
      height: CLOSE_BUTTON,
      fontSize: 20,
      onClick: onClose,
      tooltip: { host: tooltip, content: () => textContent(['Đóng (Esc)']) },
    });
    this.tabs = DECK_TABS.map(({ id, label }) =>
      createButton(scene, 0, 0, label, {
        width: 80,
        height: 44,
        fontSize: 13,
        onClick: () => this.setTab(id),
      }),
    );
    this.root = scene.add.container(0, 0, [
      this.overlay,
      this.box.image,
      this.title,
      this.close.container,
      ...this.tabs.map((t) => t.container),
    ]);
    scene.input.on(Phaser.Input.Events.POINTER_WHEEL, this.onWheel);
    scene.input.on(Phaser.Input.Events.POINTER_DOWN, this.onDown);
    scene.input.on(Phaser.Input.Events.POINTER_MOVE, this.onMove);
    scene.input.on(Phaser.Input.Events.POINTER_UP, this.onUp);
    this.rebuild();
  }

  setDepth(depth: number): this {
    this.root.setDepth(depth);
    return this;
  }

  layout(): void {
    this.apply();
  }

  destroy(): void {
    const input = this.scene.input;
    input.off(Phaser.Input.Events.POINTER_WHEEL, this.onWheel);
    input.off(Phaser.Input.Events.POINTER_DOWN, this.onDown);
    input.off(Phaser.Input.Events.POINTER_MOVE, this.onMove);
    input.off(Phaser.Input.Events.POINTER_UP, this.onUp);
    for (const c of this.cards) c.view.destroy();
    this.cards.length = 0;
    this.root.destroy();
  }

  private setTab(tab: DeckTab): void {
    if (tab === this.tab) return;
    this.tab = tab;
    this.scroll = 0;
    this.rebuild();
  }

  /** Re-group the deck for the current tab and rebuild the card pool. */
  private rebuild(): void {
    this.entries = deckEntries(this.deck, this.content, this.tab);
    for (const c of this.cards) {
      c.view.destroy();
      c.badge.destroy();
    }
    this.cards.length = 0;
    for (const entry of this.entries) {
      const view = new CardView(this.scene, this.content, { w: DECK_CARD.w, h: DECK_CARD.h }, this.tooltip);
      view.setCard(entry.cardId);
      const badge = addUiText(this.scene, 0, 0, `×${entry.count}`, 14, UI_PALETTE.creamLight)
        .setFontStyle('bold')
        .setOrigin(1, 1)
        .setStroke(`#${UI_PALETTE.outline.toString(16).padStart(6, '0')}`, 4);
      this.root.add([view.container, badge]);
      this.cards.push({ view, badge });
    }
    this.tabs.forEach((t, i) => t.setActive(DECK_TABS[i]!.id === this.tab));
    this.apply();
  }

  private scrollBy(delta: number): void {
    this.setScroll(this.scroll + delta);
  }

  private setScroll(value: number): void {
    this.scroll = value;
    this.apply();
  }

  private apply(): void {
    const { width, height } = this.scene.scale;
    const inset = frameBorder(this.scene, 'panel') + (width >= 768 ? PAD_DESKTOP : PAD_MOBILE);
    const l = deckModalLayout({ w: width, h: height }, inset, this.entries.length, this.scroll);
    this.lay = l;
    this.scroll = l.scroll;
    fitOverlay(this.scene, this.overlay);
    this.box.resize(l.panel.w, l.panel.h);
    this.box.image.setPosition(l.panel.x, l.panel.y);
    this.title.setPosition(l.title.x, l.title.y + l.title.h / 2);
    this.title.setText(`Bộ bài (${this.deck.length} thẻ)`);
    this.close.container.setPosition(l.close.x + l.close.w / 2, l.close.y + l.close.h / 2);
    this.tabs.forEach((t, i) => {
      const r = l.tabs[i]!;
      t.container.setPosition(r.x + r.w / 2, r.y + r.h / 2);
    });
    const shown = new Set(l.visible);
    this.cards.forEach((c, i) => {
      const r = l.cards[i]!;
      const on = shown.has(i);
      c.view.container.setVisible(on);
      c.badge.setVisible(on);
      if (!on) return;
      c.view.setPosition(r.x, r.y);
      c.badge.setPosition(r.x + r.w - 4, r.y + r.h - 3);
    });
  }
}
