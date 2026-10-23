import Phaser from 'phaser';
import type { EventBus } from '../../core/events';
import type { GameEvents } from '../../game/events';
import type { RunState } from '../../game/run/state';
import { decreeQuestLines } from '../modals/councilModel';
import { CLOSE_BUTTON, centredPanel } from '../modals/modalLayout';
import { createOverlay, fitOverlay } from '../modals/overlay';
import type { PlanningLayout } from '../realm/realmLayout';
import { addUiText, createButton, createPanel, frameBorder, type Button, type UiBox } from '../theme';

const PAD = 10;

/**
 * Decrees enacted and quests running (§10.4): a docked 260 px column on a wide desktop, a
 * "Sắc lệnh" button that opens the same list in a modal everywhere else. It stays hidden until
 * there is something to list. Pure display; it sends nothing (the bus is kept for symmetry with
 * the other panels). `layout(lay)` follows the planning layout; `closeView()` is Esc.
 */
export class DecreeQuestPanel {
  private readonly docked: UiBox;
  private readonly dockedText: Phaser.GameObjects.Text;
  private readonly button: Button;
  private readonly overlay: Phaser.GameObjects.Rectangle;
  private readonly box: UiBox;
  private readonly modalText: Phaser.GameObjects.Text;
  private readonly close: Button;
  private readonly modal: Phaser.GameObjects.Container;
  private lines: string[] = [];
  private lay: PlanningLayout | null = null;
  private open = false;

  constructor(
    private readonly scene: Phaser.Scene,
    _bus: EventBus<GameEvents>,
    state: RunState,
  ) {
    this.docked = createPanel(scene, 'panel', 64, 64);
    this.dockedText = addUiText(scene, 0, 0, '', 12);
    this.button = createButton(scene, 0, 0, 'Sắc lệnh', {
      width: 84,
      height: 48,
      fontSize: 13,
      onClick: () => this.setOpen(true),
    });
    this.overlay = createOverlay(scene);
    this.overlay.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => this.setOpen(false));
    this.box = createPanel(scene, 'panel', 64, 64);
    this.box.image.setInteractive();
    this.modalText = addUiText(scene, 0, 0, '', 13);
    this.close = createButton(scene, 0, 0, '✕', {
      width: CLOSE_BUTTON,
      height: CLOSE_BUTTON,
      fontSize: 20,
      onClick: () => this.setOpen(false),
    });
    this.modal = scene.add
      .container(0, 0, [this.overlay, this.box.image, this.modalText, this.close.container])
      .setDepth(600)
      .setVisible(false);
    this.setState(state);
  }

  setState(state: RunState): void {
    this.lines = decreeQuestLines(state);
    if (this.lines.length === 0) this.open = false;
    this.layout();
  }

  /** Follow the planning layout (call after every resize and after `setState`). */
  layout(lay: PlanningLayout | null = this.lay): void {
    this.lay = lay;
    const has = this.lines.length > 0;
    const text = this.lines.join('\n');
    const dock = has ? (lay?.decreePanel ?? null) : null;
    this.docked.image.setVisible(dock !== null);
    this.dockedText.setVisible(dock !== null);
    if (dock) {
      this.docked.resize(dock.w, dock.h);
      this.docked.image.setPosition(dock.x, dock.y);
      const inset = frameBorder(this.scene, 'panel') + PAD;
      this.dockedText
        .setText(text)
        .setPosition(dock.x + inset, dock.y + inset)
        .setWordWrapWidth(dock.w - 2 * inset);
    }
    const b = has ? (lay?.decreeButton ?? null) : null;
    this.button.setVisible(b !== null);
    if (b) {
      this.button.resize(b.w, b.h);
      this.button.container.setPosition(b.x + b.w / 2, b.y + b.h / 2);
    }
    this.modal.setVisible(this.open && has);
    if (this.open && has) this.layoutModal(text);
  }

  /** Close the opened list (Esc); the docked column never closes. */
  closeView(): void {
    this.setOpen(false);
  }

  get isOpen(): boolean {
    return this.open;
  }

  destroy(): void {
    this.docked.image.destroy();
    this.dockedText.destroy();
    this.button.container.destroy();
    this.modal.destroy();
  }

  private setOpen(open: boolean): void {
    this.open = open && this.lines.length > 0;
    this.layout();
  }

  private layoutModal(text: string): void {
    const { width, height } = this.scene.scale;
    const inset = frameBorder(this.scene, 'panel') + PAD;
    const panel = centredPanel({ w: width, h: height }, 340, 520);
    fitOverlay(this.scene, this.overlay);
    this.box.resize(panel.w, panel.h);
    this.box.image.setPosition(panel.x, panel.y);
    this.modalText
      .setText(text)
      .setPosition(panel.x + inset, panel.y + inset + CLOSE_BUTTON)
      .setWordWrapWidth(panel.w - 2 * inset);
    this.close.container.setPosition(panel.x + panel.w - inset - CLOSE_BUTTON / 2, panel.y + inset + CLOSE_BUTTON / 2);
  }
}
