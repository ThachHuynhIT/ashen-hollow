import type Phaser from 'phaser';
import type { CardId } from '../../data/types';
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
import { REWARD_BUTTON, rewardLayout } from './modalLayout';
import { createOverlay, fitOverlay } from './overlay';

const TITLE = 'Phần thưởng — chọn 1 thẻ';
/** Space between the panel border and its contents. */
const PAD_DESKTOP = 12;
const PAD_MOBILE = 4;

/**
 * Reward picker (§10.6): title, the offered cards, **Bỏ qua** and **Nhận** (enabled once a
 * card is chosen). Pure display: the choice goes to `onPick` (index, or null to skip).
 * Call `layout()` on resize and `destroy()` when the reward phase ends.
 */
export class RewardModal {
  private readonly overlay: Phaser.GameObjects.Rectangle;
  private readonly box: UiBox;
  private readonly title: Phaser.GameObjects.Text;
  private readonly cards: CardView[];
  private readonly skip: Button;
  private readonly take: Button;
  private readonly root: Phaser.GameObjects.Container;
  private selected: number | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    content: Content,
    offers: readonly CardId[],
    tooltip: TooltipHost,
    private readonly onPick: (index: number | null) => void,
  ) {
    this.overlay = createOverlay(scene);
    this.box = createPanel(scene, 'panel', 64, 64);
    this.title = addUiText(scene, 0, 0, TITLE, 18).setOrigin(0.5, 0).setFontStyle('bold');
    this.cards = offers.map((id, i) => {
      const card = new CardView(scene, content, { w: 150, h: 210 }, tooltip);
      card.setCard(id);
      card.onClick(() => this.select(i));
      return card;
    });
    this.skip = createButton(scene, 0, 0, 'Bỏ qua', {
      width: REWARD_BUTTON.w,
      height: REWARD_BUTTON.h,
      fontSize: 16,
      onClick: () => this.onPick(null),
      tooltip: { host: tooltip, content: () => textContent(['Bỏ qua phần thưởng']) },
    });
    this.take = createButton(scene, 0, 0, 'Nhận', {
      width: REWARD_BUTTON.w,
      height: REWARD_BUTTON.h,
      fontSize: 16,
      onClick: () => this.confirm(),
      tooltip: { host: tooltip, content: () => textContent(['Nhận thẻ đã chọn (Enter)']) },
    });
    this.take.setEnabled(false);
    this.root = scene.add.container(0, 0, [
      this.overlay,
      this.box.image,
      this.title,
      ...this.cards.map((c) => c.container),
      this.skip.container,
      this.take.container,
    ]);
    this.layout();
  }

  /** Take the selected card (Enter); does nothing until one is chosen. */
  confirm(): void {
    if (this.selected !== null) this.onPick(this.selected);
  }

  setDepth(depth: number): this {
    this.root.setDepth(depth);
    return this;
  }

  layout(): void {
    const { width, height } = this.scene.scale;
    const desktop = width >= 768;
    const inset = frameBorder(this.scene, 'panel') + (desktop ? PAD_DESKTOP : PAD_MOBILE);
    const l = rewardLayout({ w: width, h: height }, inset, this.cards.length);
    fitOverlay(this.scene, this.overlay);
    this.box.resize(l.panel.w, l.panel.h);
    this.box.image.setPosition(l.panel.x, l.panel.y);
    this.title.setPosition(l.title.x + l.title.w / 2, l.title.y);
    this.title.setFontSize(desktop ? 18 : 15);
    this.cards.forEach((card, i) => {
      const r = l.cards[i]!;
      card.resize({ w: r.w, h: r.h });
      card.setPosition(r.x, r.y);
    });
    for (const [button, r] of [
      [this.skip, l.skip],
      [this.take, l.take],
    ] as const) {
      button.container.setPosition(r.x + r.w / 2, r.y + r.h / 2);
    }
  }

  destroy(): void {
    for (const card of this.cards) card.destroy();
    this.root.destroy();
  }

  private select(index: number): void {
    this.selected = this.selected === index ? null : index;
    this.cards.forEach((card, i) => card.setSelected(i === this.selected));
    this.take.setEnabled(this.selected !== null);
  }
}
