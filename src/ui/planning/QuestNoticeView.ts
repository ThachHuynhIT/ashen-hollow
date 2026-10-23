import type Phaser from 'phaser';
import { UI_PALETTE } from '../../data/uiPalette';
import type { RunState } from '../../game/run/state';
import type { Rect } from '../hud/layout';
import { addUiText, bindPress, createPanel, frameBorder, type PressHandle, type TooltipHost, type UiBox } from '../theme';
import { questNotice, type QuestNotice } from './questNotice';

/**
 * Banner tĩnh báo sứ giả: "Năm tới: Sứ giả" / "Đã đủ 2 nhiệm vụ" và "Nhiệm vụ 1/2"; rê chuột để đọc lý do,
 * bấm để mở danh sách nhiệm vụ. Chỉ hiển thị: không bao giờ trả lời đề nghị hay đổi state.
 */
export class QuestNoticeView {
  private readonly box: UiBox;
  private readonly head: Phaser.GameObjects.Text;
  private readonly sub: Phaser.GameObjects.Text;
  private readonly container: Phaser.GameObjects.Container;
  private readonly press: PressHandle;
  private notice: QuestNotice | null = null;
  private rect: Rect | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    tooltip: TooltipHost,
    onOpen: () => void,
  ) {
    this.box = createPanel(scene, 'tooltip', 64, 48);
    this.head = addUiText(scene, 0, 0, '', 14).setFontStyle('bold');
    this.sub = addUiText(scene, 0, 0, '', 12, UI_PALETTE.woodDark);
    this.container = scene.add.container(0, 0, [this.box.image, this.head, this.sub]).setVisible(false);
    this.press = bindPress(scene, this.box.image, {
      onClick: onOpen,
      tooltip: {
        host: tooltip,
        content: () => {
          const n = this.notice;
          return n && n.headline ? { title: n.headline, lines: [[{ text: n.detail }], [{ text: 'Bấm để xem nhiệm vụ.' }]] } : null;
        },
      },
    });
  }

  setState(state: RunState): void {
    this.notice = questNotice(state);
    this.render();
  }

  /** `null` hides it (not enough room, or a short game). */
  layout(rect: Rect | null): void {
    this.rect = rect;
    this.render();
  }

  destroy(): void {
    this.press.cancel();
    this.container.destroy();
  }

  private render(): void {
    const n = this.notice;
    const r = this.rect;
    const show = n !== null && n.headline !== '' && r !== null;
    this.container.setVisible(show);
    if (show) this.box.image.setInteractive();
    else this.box.image.disableInteractive();
    if (!show) return;
    this.container.setPosition(r.x, r.y);
    this.box.resize(r.w, r.h);
    const inset = frameBorder(this.scene, 'tooltip') + 6;
    this.head.setText(n.headline).setPosition(inset, inset - 2).setWordWrapWidth(r.w - 2 * inset);
    this.sub.setText(`Nhiệm vụ ${n.active}/${n.capacity}`).setPosition(inset, r.h - inset - this.sub.height + 2);
  }
}
