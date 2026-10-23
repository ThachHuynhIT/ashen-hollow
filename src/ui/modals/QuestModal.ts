import type Phaser from 'phaser';
import type { EventBus } from '../../core/events';
import type { GameEvents } from '../../game/events';
import type { RunState } from '../../game/run/state';
import { UI_PALETTE } from '../../data/uiPalette';
import { addUiText, createButton, createPanel, frameBorder, type Button, type UiBox } from '../theme';
import { questOfferView } from './councilModel';
import { COUNCIL_BUTTON, questLayout } from './modalLayout';
import { createOverlay, fitOverlay } from './overlay';

const PAD_DESKTOP = 12;
const PAD_MOBILE = 4;

/** Title of the quest offer. */
export const QUEST_TITLE = 'Sứ giả mang tin…';

/**
 * A quest offer (§3.10): the condition, the deadline, the reward and the fee, with **Nhận**
 * (disabled when the gold for the fee is missing) and **Từ chối**. Both are `ui:command`s.
 * `setState` follows gold changes; call `layout()` on resize and `destroy()` when answered.
 */
export class QuestModal {
  private readonly overlay: Phaser.GameObjects.Rectangle;
  private readonly box: UiBox;
  private readonly title: Phaser.GameObjects.Text;
  private readonly body: Phaser.GameObjects.Text;
  private readonly warn: Phaser.GameObjects.Text;
  private readonly accept: Button;
  private readonly decline: Button;
  private readonly root: Phaser.GameObjects.Container;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly bus: EventBus<GameEvents>,
    private state: RunState,
  ) {
    this.overlay = createOverlay(scene);
    this.box = createPanel(scene, 'panel', 64, 64);
    this.box.image.setInteractive();
    this.title = addUiText(scene, 0, 0, QUEST_TITLE, 18).setOrigin(0.5, 0).setFontStyle('bold');
    this.body = addUiText(scene, 0, 0, '', 14);
    this.warn = addUiText(scene, 0, 0, '', 13, UI_PALETTE.bad);
    this.accept = createButton(scene, 0, 0, 'Nhận', {
      width: COUNCIL_BUTTON.w,
      height: COUNCIL_BUTTON.h,
      fontSize: 16,
      onClick: () => this.answer(true),
    });
    this.decline = createButton(scene, 0, 0, 'Từ chối', {
      width: COUNCIL_BUTTON.w,
      height: COUNCIL_BUTTON.h,
      fontSize: 16,
      onClick: () => this.answer(false),
    });
    this.root = scene.add.container(0, 0, [
      this.overlay,
      this.box.image,
      this.title,
      this.body,
      this.warn,
      this.accept.container,
      this.decline.container,
    ]);
    this.layout();
  }

  setDepth(depth: number): this {
    this.root.setDepth(depth);
    return this;
  }

  setState(state: RunState): void {
    this.state = state;
    this.layout();
  }

  layout(): void {
    const view = questOfferView(this.state);
    if (view === null) return;
    const { width, height } = this.scene.scale;
    const desktop = width >= 768;
    const inset = frameBorder(this.scene, 'panel') + (desktop ? PAD_DESKTOP : PAD_MOBILE);
    const l = questLayout({ w: width, h: height }, inset);
    fitOverlay(this.scene, this.overlay);
    this.box.resize(l.panel.w, l.panel.h);
    this.box.image.setPosition(l.panel.x, l.panel.y);
    this.title.setPosition(l.title.x + l.title.w / 2, l.title.y + 4);
    this.title.setFontSize(desktop ? 18 : 15);
    const lines = [
      view.nameVi,
      '',
      view.textVi,
      '',
      `Hạn: ${view.duration} năm (đến hết năm ${view.deadlineYear})`,
      `Thưởng: ${view.rewardTextVi}`,
    ];
    if (view.fee > 0) lines.push(`Phí nhận: ${view.fee} vàng`);
    this.body.setText(lines.join('\n')).setPosition(l.body.x, l.body.y).setWordWrapWidth(l.body.w);
    this.warn.setText(view.canAccept ? '' : 'Không đủ vàng để nhận.');
    this.warn.setPosition(l.body.x, l.body.y + l.body.h - this.warn.height).setWordWrapWidth(l.body.w);
    this.accept.container.setPosition(l.accept.x + l.accept.w / 2, l.accept.y + l.accept.h / 2);
    this.decline.container.setPosition(l.decline.x + l.decline.w / 2, l.decline.y + l.decline.h / 2);
    this.accept.setEnabled(view.canAccept);
  }

  destroy(): void {
    this.root.destroy();
  }

  private answer(accept: boolean): void {
    const view = questOfferView(this.state);
    if (view === null || (accept && !view.canAccept)) return;
    this.bus.emit('ui:command', { command: { type: 'answerQuest', accept } });
  }
}
