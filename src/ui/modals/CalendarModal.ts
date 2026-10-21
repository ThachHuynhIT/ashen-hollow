import Phaser from 'phaser';
import type { Content } from '../../game/cards/registry';
import type { RunState } from '../../game/run/state';
import { CalendarCellView } from '../planning/CalendarStrip';
import { textContent } from '../hud/layout';
import { fullCalendar } from '../realm/calendarModel';
import {
  addUiText,
  createButton,
  createPanel,
  frameBorder,
  type Button,
  type TooltipHost,
  type UiBox,
} from '../theme';
import { CLOSE_BUTTON, calendarModalLayout } from './modalLayout';
import { createOverlay, fitOverlay } from './overlay';

const TITLE = 'Lịch các năm';
const PAD_DESKTOP = 12;
const PAD_MOBILE = 4;

/**
 * The whole run's calendar (§10.4): every year of the rules in a 5×3 grid, who attacks and
 * which attack of theirs it is, the current year marked. Pure display; closing goes to `onClose`.
 * Call `layout()` on resize and `destroy()` when closed.
 */
export class CalendarModal {
  private readonly overlay: Phaser.GameObjects.Rectangle;
  private readonly box: UiBox;
  private readonly title: Phaser.GameObjects.Text;
  private readonly close: Button;
  private readonly cells: CalendarCellView[];
  private readonly root: Phaser.GameObjects.Container;

  constructor(
    private readonly scene: Phaser.Scene,
    content: Content,
    state: Pick<RunState, 'year' | 'rules' | 'enemyKings'>,
    tooltip: TooltipHost,
    onClose: () => void,
  ) {
    this.overlay = createOverlay(scene);
    this.overlay.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, onClose);
    this.box = createPanel(scene, 'panel', 64, 64);
    this.box.image.setInteractive(); // a click on the panel must not reach the closing overlay
    this.title = addUiText(scene, 0, 0, TITLE, 18).setOrigin(0, 0.5).setFontStyle('bold');
    this.close = createButton(scene, 0, 0, '✕', {
      width: CLOSE_BUTTON,
      height: CLOSE_BUTTON,
      fontSize: 20,
      onClick: onClose,
      tooltip: { host: tooltip, content: () => textContent(['Đóng (Esc)']) },
    });
    this.cells = fullCalendar(state.rules, state.enemyKings).map((cell) => {
      const view = new CalendarCellView(scene, content, tooltip, () => undefined);
      view.set({ ...cell, current: cell.year === state.year });
      return view;
    });
    this.root = scene.add.container(0, 0, [
      this.overlay,
      this.box.image,
      this.title,
      this.close.container,
      ...this.cells.map((c) => c.container),
    ]);
    this.layout();
  }

  setDepth(depth: number): this {
    this.root.setDepth(depth);
    return this;
  }

  layout(): void {
    const { width, height } = this.scene.scale;
    const inset = frameBorder(this.scene, 'panel') + (width >= 768 ? PAD_DESKTOP : PAD_MOBILE);
    const l = calendarModalLayout({ w: width, h: height }, inset);
    fitOverlay(this.scene, this.overlay);
    this.box.resize(l.panel.w, l.panel.h);
    this.box.image.setPosition(l.panel.x, l.panel.y);
    this.title.setPosition(l.title.x, l.title.y + l.title.h / 2);
    this.close.container.setPosition(l.close.x + l.close.w / 2, l.close.y + l.close.h / 2);
    this.cells.forEach((view, i) => {
      const r = l.cells[i];
      if (r) view.layout(r);
    });
  }

  destroy(): void {
    for (const c of this.cells) c.destroy();
    this.root.destroy();
  }
}
