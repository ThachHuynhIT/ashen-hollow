import type Phaser from 'phaser';
import { ContentBox } from './ContentBox';
import {
  TOOLTIP_MAX_W,
  placeAbove,
  placeTooltip,
  type Rect,
  type Size,
  type TooltipContent,
} from './hud/layout';
import type { TooltipHost } from './theme';

/**
 * The one tooltip of a scene: follows the mouse (+16, +16, flipping at the edges), or sits
 * above a long-pressed control on touch. Never interactive, so it never blocks input.
 * Lifecycle: the owning scene calls refresh() from its layout() on resize and destroy() on
 * scene SHUTDOWN.
 */
export class Tooltip implements TooltipHost {
  private readonly box: ContentBox;
  private owner: string | null = null;
  private followPointer = false;
  /** Set by destroy(): hosts may still call hide() from a button's teardown during shutdown. */
  private destroyed = false;

  constructor(private readonly scene: Phaser.Scene) {
    this.box = new ContentBox(scene, 'tooltip', TOOLTIP_MAX_W);
    this.box.container.setDepth(1000);
    scene.input.on('pointermove', this.onPointerMove, this);
  }

  /** Who is showing the tooltip right now (null = hidden). */
  get shownBy(): string | null {
    return this.owner;
  }

  showAtPointer(content: TooltipContent, owner: string): void {
    if (this.destroyed) return;
    this.owner = owner;
    this.followPointer = true;
    this.box.setContent(content);
    const pointer = this.scene.input.activePointer;
    this.moveTo(pointer.x, pointer.y);
  }

  showAbove(content: TooltipContent, anchor: Rect, owner: string): void {
    if (this.destroyed) return;
    this.owner = owner;
    this.followPointer = false;
    this.box.setContent(content);
    const { x, y } = placeAbove(anchor, this.size(), this.screen());
    this.box.setPosition(x, y);
  }

  hide(owner: string): void {
    if (this.destroyed || this.owner !== owner) return;
    this.owner = null;
    this.followPointer = false;
    this.box.setContent(null);
  }

  refresh(): void {
    if (this.destroyed) return;
    this.box.refresh();
  }

  destroy(): void {
    this.destroyed = true;
    this.scene.input.off('pointermove', this.onPointerMove, this);
    this.box.destroy();
  }

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    if (this.followPointer) this.moveTo(pointer.x, pointer.y);
  }

  private moveTo(px: number, py: number): void {
    const { x, y } = placeTooltip({ x: px, y: py }, this.size(), this.screen());
    this.box.setPosition(x, y);
  }

  private size(): Size {
    return { w: this.box.width, h: this.box.height };
  }

  private screen(): Size {
    return { w: this.scene.scale.width, h: this.scene.scale.height };
  }
}
