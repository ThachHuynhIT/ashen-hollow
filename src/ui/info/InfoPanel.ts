import type Phaser from 'phaser';
import { ContentBox } from '../ContentBox';
import type { Point, Size } from '../hud/layout';
import { infoContent, placeInfoBox } from './infoLines';

/**
 * The info box of a tapped building or unit (§10.7): a self-sizing `ContentBox` opened to the
 * lower right of the tap and kept on screen. Blocking, so a tap on it never reaches the map.
 * Lifecycle: the owning HUD scene calls layout() on resize and destroy() on SHUTDOWN.
 */
export class InfoPanel {
  private readonly box: ContentBox;
  private anchor: Point | null = null;
  private screen: Size = { w: 0, h: 0 };

  constructor(scene: Phaser.Scene, depth: number, maxWidth = 280) {
    this.box = new ContentBox(scene, 'panel', maxWidth, { blocking: true });
    this.box.container.setDepth(depth);
  }

  get visible(): boolean {
    return this.box.visible;
  }

  /** Show `lines` (the first is the title) next to `anchor`. */
  show(lines: readonly string[], anchor: Point, screen: Size): void {
    this.anchor = anchor;
    this.screen = screen;
    this.box.setContent(infoContent(lines));
    this.place();
  }

  /** Replace the lines of the open panel in place (e.g. HP ticking down); no-op when hidden. */
  setLines(lines: readonly string[]): void {
    if (!this.anchor) return;
    this.box.setContent(infoContent(lines));
    this.place();
  }

  hide(): void {
    this.anchor = null;
    this.box.setContent(null);
  }

  /** Re-measure and re-clamp after a resize. */
  layout(screen: Size): void {
    this.screen = screen;
    this.box.refresh();
    this.place();
  }

  destroy(): void {
    this.box.destroy();
  }

  private place(): void {
    if (!this.anchor) return;
    const p = placeInfoBox(this.anchor, { w: this.box.width, h: this.box.height }, this.screen);
    this.box.setPosition(p.x, p.y);
  }
}
