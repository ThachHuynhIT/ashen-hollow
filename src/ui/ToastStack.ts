import type Phaser from 'phaser';
import { TOAST, pushToast, toastText, type ToastEntry } from './hud/layout';
import { addUiText, createPanel, frameBorder, type UiBox } from './theme';

const PAD = 6;
const FONT = 14;

interface ToastView {
  entry: ToastEntry;
  container: Phaser.GameObjects.Container;
  box: UiBox;
  text: Phaser.GameObjects.Text;
  timer: Phaser.Time.TimerEvent | null;
  fading: boolean;
}

/**
 * The `log` toast stack: up to TOAST.max one-line `tooltip` boxes centred under an anchor,
 * newest at the bottom; a repeat merges into "text ×N"; each fades after TOAST.holdMs.
 * Merging/ellipsis rules are the pure, tested `pushToast` / `toastText`.
 */
export class ToastStack {
  private list: ToastEntry[] = [];
  private readonly views = new Map<number, ToastView>();
  private nextId = 1;
  private anchor = { x: 0, y: 0, maxWidth: TOAST.maxWidth as number };

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly depth = 900,
  ) {}

  /** Toasts hang below (x centre, y top), at most `maxWidth` wide. */
  setAnchor(x: number, y: number, maxWidth: number): void {
    this.anchor = { x, y, maxWidth: Math.min(TOAST.maxWidth, maxWidth) };
    for (const v of this.views.values()) this.draw(v);
    this.place();
  }

  push(text: string): void {
    const r = pushToast(this.list, text, this.scene.time.now, this.nextId);
    if (!r.merged) this.nextId += 1;
    this.list = r.list;
    for (const gone of r.dropped) this.remove(gone.id);
    let view = this.views.get(r.entry.id);
    if (view) {
      view.entry = r.entry;
      view.fading = false;
      this.scene.tweens.killTweensOf(view.container);
      view.container.setAlpha(1);
    } else {
      const box = createPanel(this.scene, 'tooltip', 32, TOAST.height);
      const label = addUiText(this.scene, 0, TOAST.height / 2, '', FONT).setOrigin(0.5);
      const container = this.scene.add.container(0, 0, [box.image, label]).setDepth(this.depth);
      view = { entry: r.entry, container, box, text: label, timer: null, fading: false };
      this.views.set(r.entry.id, view);
    }
    this.draw(view);
    this.hold(view);
    this.place();
  }

  /** Re-measure after a resize (the border scale may change). */
  refresh(): void {
    for (const v of this.views.values()) this.draw(v);
    this.place();
  }

  destroy(): void {
    for (const id of [...this.views.keys()]) this.remove(id);
    this.list = [];
  }

  private hold(view: ToastView): void {
    view.timer?.remove(false);
    view.timer = this.scene.time.delayedCall(TOAST.holdMs, () => {
      view.timer = null;
      view.fading = true;
      this.scene.tweens.add({
        targets: view.container,
        alpha: 0,
        duration: TOAST.fadeMs,
        onComplete: () => {
          if (view.fading) this.remove(view.entry.id);
        },
      });
    });
  }

  private draw(view: ToastView): void {
    const inset = frameBorder(this.scene, 'tooltip') + PAD;
    const maxText = Math.max(40, this.anchor.maxWidth - 2 * inset);
    const measure = (s: string): number => view.text.setText(s).width;
    view.text.setText(toastText(view.entry, maxText, measure));
    const w = Math.ceil(view.text.width + 2 * inset);
    view.box.resize(w, TOAST.height);
    view.box.image.setPosition(-w / 2, 0);
  }

  private place(): void {
    this.list.forEach((entry, i) => {
      const v = this.views.get(entry.id);
      v?.container.setPosition(
        Math.round(this.anchor.x),
        Math.round(this.anchor.y + i * (TOAST.height + TOAST.gap)),
      );
    });
  }

  private remove(id: number): void {
    const v = this.views.get(id);
    if (!v) return;
    v.timer?.remove(false);
    this.scene.tweens.killTweensOf(v.container);
    v.container.destroy();
    this.views.delete(id);
    this.list = this.list.filter((e) => e.id !== id);
    this.place();
  }
}
