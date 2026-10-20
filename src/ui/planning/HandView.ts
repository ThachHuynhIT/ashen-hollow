import type Phaser from 'phaser';
import type { CardId } from '../../data/types';
import type { Content } from '../../game/cards/registry';
import { CardView } from '../cards/CardView';
import type { Rect } from '../hud/layout';
import type { TooltipHost } from '../theme';

/** The three-card hand of the planning HUD (§10.4). Pure display; clicks go to `onSelect`. */
export class HandView {
  private readonly cards: CardView[];
  private handler: ((index: number) => void) | null = null;
  private dropper: ((index: number, x: number, y: number) => void) | null = null;

  constructor(scene: Phaser.Scene, content: Content, tooltip: TooltipHost, slots = 3) {
    this.cards = Array.from({ length: slots }, (_, i) => {
      const card = new CardView(scene, content, { w: 120, h: 168 }, tooltip);
      card.onClick(() => this.handler?.(i));
      card.onDrop((x, y) => this.dropper?.(i, x, y));
      return card;
    });
  }

  onSelect(handler: (index: number) => void): void {
    this.handler = handler;
  }

  /** A card dragged off its slot and released at screen (x, y). */
  onDrop(handler: (index: number, x: number, y: number) => void): void {
    this.dropper = handler;
  }

  /** Cards in hand order; missing slots are hidden and ignore input (`[]` hides the hand). */
  setHand(
    hand: readonly CardId[],
    dimmed: readonly boolean[] = [],
    badges: readonly (string | null)[] = [],
  ): void {
    this.cards.forEach((card, i) => {
      card.setCard(hand[i] ?? null, { badge: badges[i] ?? null });
      card.setDimmed(dimmed[i] ?? false);
    });
  }

  setSelected(index: number | null): void {
    this.cards.forEach((card, i) => card.setSelected(i === index));
  }

  layout(slots: readonly Rect[]): void {
    this.cards.forEach((card, i) => {
      const r = slots[i];
      if (!r) return;
      card.resize({ w: r.w, h: r.h });
      card.setPosition(r.x, r.y);
    });
  }

  /** Screen bounds of each card (for browser checks and anchoring). */
  bounds(): Phaser.Geom.Rectangle[] {
    return this.cards.map((c) => c.container.getBounds());
  }

  destroy(): void {
    for (const card of this.cards) card.destroy();
    this.cards.length = 0;
  }
}
