import Phaser from 'phaser';
import type { EventBus } from '../core/events';
import { RULES_G1 } from '../data/rules';
import { CONTENT } from '../game/cards/registry';
import type { GameEvents } from '../game/events';
import type { RunController } from '../game/run/RunController';
import { hasAnyTarget, targetCount } from '../game/run/board';
import type { IllegalReason, RunState } from '../game/run/state';
import { SPRITES_KEY, iconFrame } from '../render/atlas';
import { ContentBox } from '../ui/ContentBox';
import { Tooltip } from '../ui/Tooltip';
import { LONG_PRESS_MS, textContent, type TooltipContent } from '../ui/hud/layout';
import { CLOSE_BUTTON, centredPanel } from '../ui/modals/modalLayout';
import { createOverlay, fitOverlay } from '../ui/modals/overlay';
import { RewardModal } from '../ui/modals/RewardModal';
import { InfoPanel } from '../ui/info/InfoPanel';
import { buildingInfoLines } from '../ui/info/infoLines';
import { HandView } from '../ui/planning/HandView';
import { ScoutPanel } from '../ui/planning/ScoutPanel';
import { dropOutcome, plotIllegalReason } from '../ui/planning/targetHints';
import {
  centerHand,
  confirmFor,
  planningLayout,
  plotAtScreen,
  plotScreenRect,
  type PlanningLayout,
} from '../ui/realm/realmLayout';
import {
  addUiText,
  createButton,
  createPanel,
  type Button,
  type TooltipSource,
  type UiBox,
} from '../ui/theme';
import { SCENES } from './keys';
import type { RealmHudData } from './RealmScene';

/** Why a plot is red (§4.4), shown on hover / long-press over it. */
export const ILLEGAL_TEXT: Record<IllegalReason, string> = {
  locked: 'Ô chưa mở.',
  throne: 'Không thể đặt lên Ngai.',
  occupied: 'Ô đã có công trình.',
  noBuilding: 'Ô này chưa có công trình.',
  noTarget: 'Không còn mục tiêu hợp lệ.',
  notAdjacent: 'Ô phải kề một ô đã mở.',
  notEnoughGold: 'Không đủ vàng.',
  maxLevel: 'Đã đạt cấp tối đa.',
  wrongKind: 'Bùa này không gắn được lên loại công trình đó.',
  stacksFull: 'Công trình đã đủ stack Bùa.',
  wrongPhase: 'Lúc này chưa dùng được.',
  alreadyPlayed: 'Năm nay bạn đã chơi hoặc bỏ thẻ.',
  notPlayed: 'Hãy chơi hoặc bỏ một thẻ trước.',
  badTarget: 'Mục tiêu không hợp lệ.',
};

/** How long a rejected command's reason stays in the hint box. */
const ILLEGAL_MS = 2000;
const PLOT_TIP = 'plot';
const SCOUT_MODAL = { w: 300, h: 460 } as const;
const MODAL_DEPTH = 500;

interface Pending {
  handIndex: number | null;
  targets: number[];
  ready: boolean;
}

const NO_PENDING: Pending = { handIndex: null, targets: [], ready: false };

/** The full scout report opened from the mobile summary (§10.5 side panel). */
interface ScoutModal {
  root: Phaser.GameObjects.Container;
  overlay: Phaser.GameObjects.Rectangle;
  panel: ScoutPanel;
  close: Button;
}

/**
 * Planning HUD over RealmScene (§10.4): lives, year, scout report, the hand, Bỏ bài /
 * Ra trận, ✓/✕ for the aimed card, the play hint and the reward modal (§10.6). It only
 * reads `controller.state` and sends intents on the bus; board clicks are RealmScene's.
 */
export class PlanningHudScene extends Phaser.Scene {
  private bus!: EventBus<GameEvents>;
  private controller!: RunController;
  private offs: (() => void)[] = [];
  private lay!: PlanningLayout;
  private tooltip!: Tooltip;
  private livesBox!: UiBox;
  private livesIcon: Phaser.GameObjects.Image | null = null;
  private livesText!: Phaser.GameObjects.Text;
  private yearBox!: UiBox;
  private yearText!: Phaser.GameObjects.Text;
  private scout!: ScoutPanel;
  private hand!: HandView;
  private skip!: Button;
  private skipSize = { w: 0, h: 0 };
  /** Cards currently in hand (1–3 after a play): the row is centred on this many. */
  private handCount = 0;
  /** Info box of a tapped building (§10.7), and the plot it describes. */
  private info!: InfoPanel;
  private inspected: number | null = null;
  private fight!: Button;
  private confirmBtn!: Button;
  private cancelBtn!: Button;
  private hint!: ContentBox;
  private reward: RewardModal | null = null;
  private scoutModal: ScoutModal | null = null;
  private pending: Pending = NO_PENDING;
  private illegal: IllegalReason | null = null;
  private illegalTimer: Phaser.Time.TimerEvent | null = null;
  private plotTimer: Phaser.Time.TimerEvent | null = null;

  constructor() {
    super(SCENES.planningHud);
  }

  create(data: RealmHudData): void {
    // Scene instances are reused: reset every per-launch field first.
    this.bus = data.bus;
    this.controller = data.controller;
    this.offs = [];
    this.reward = null;
    this.scoutModal = null;
    this.inspected = null;
    this.pending = NO_PENDING;
    this.illegal = null;
    this.illegalTimer = null;
    this.plotTimer = null;
    this.lay = this.currentLayout();

    this.tooltip = new Tooltip(this);
    this.info = new InfoPanel(this, MODAL_DEPTH - 50);
    const tip = (lines: string[]): TooltipSource => ({
      host: this.tooltip,
      content: () => textContent(lines),
    });

    this.livesBox = createPanel(this, 'panel', 120, 52);
    const tex = this.textures;
    this.livesIcon =
      tex.exists(SPRITES_KEY) && tex.get(SPRITES_KEY).has(iconFrame('crown'))
        ? this.add.image(0, 0, SPRITES_KEY, iconFrame('crown')).setScale(2).setOrigin(0, 0.5)
        : null;
    this.livesText = addUiText(this, 0, 0, '', 18).setOrigin(0, 0.5).setFontStyle('bold');
    this.yearBox = createPanel(this, 'panel', 160, 52);
    this.yearText = addUiText(this, 0, 0, '', 18).setOrigin(0.5).setFontStyle('bold');

    this.scout = new ScoutPanel(this, CONTENT, () =>
      this.bus.emit('ui:open-modal', { modal: 'scout' }),
    );
    this.hand = new HandView(this, CONTENT, this.tooltip);
    this.hand.onSelect((i) => this.selectCard(i));
    this.hand.onDrop((i, x, y) => this.dropCard(i, x, y));

    this.skip = this.createSkip();
    this.fight = createButton(this, 0, 0, 'Ra trận', {
      width: this.lay.fight.w,
      height: this.lay.fight.h,
      fontSize: 20,
      onClick: () => this.command('startBattle'),
      tooltip: tip(['Ra trận (Enter)']),
    });
    this.confirmBtn = createButton(this, 0, 0, '✓\nĐặt', {
      width: 48,
      height: 48,
      fontSize: 13,
      onClick: () => this.bus.emit('ui:confirm-play', {}),
      tooltip: tip(['Đặt (Enter)']),
    });
    this.cancelBtn = createButton(this, 0, 0, '✕\nHuỷ', {
      width: 48,
      height: 48,
      fontSize: 13,
      onClick: () => this.bus.emit('ui:cancel-play', {}),
      tooltip: tip(['Huỷ (Esc)']),
    });
    this.hint = new ContentBox(this, 'tooltip', this.lay.hint.w, { fontSize: 13 });

    const bus = this.bus;
    this.offs.push(
      bus.on('run:state', ({ state }) => this.refresh(state)),
      bus.on('ui:pending-play', (p) => {
        this.pending = { handIndex: p.handIndex, targets: [...p.targets], ready: p.ready };
        this.refreshPending();
      }),
      bus.on('run:illegal', ({ reason }) => this.flashIllegal(reason)),
      bus.on('ui:open-modal', ({ modal }) => {
        if (modal === 'scout') this.openScout();
      }),
      bus.on('ui:close-modal', () => this.closeScout()),
      bus.on('ui:inspect', ({ plot, x, y }) => this.inspect(plot, { x, y })),
      bus.on('ui:select-card', ({ handIndex }) => {
        if (handIndex !== null) this.inspect(null, { x: 0, y: 0 });
      }),
    );

    this.input.keyboard?.on(Phaser.Input.Keyboard.Events.ANY_KEY_DOWN, this.onKey, this);
    this.input.on(Phaser.Input.Events.POINTER_MOVE, this.onPointerMove, this);
    this.input.on(Phaser.Input.Events.POINTER_DOWN, this.onPointerDown, this);
    this.input.on(Phaser.Input.Events.POINTER_UP, this.onPointerUp, this);
    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.teardown, this);

    this.layout();
    this.refresh(this.controller.state);
  }

  // ---- state → widgets ---------------------------------------------------------------------

  private refresh(state: RunState): void {
    this.livesText.setText(`× ${state.lives}`);
    this.yearText.setText(`Năm ${state.year} / ${RULES_G1.years}`);
    this.scout.setPlan(state.army);
    if (this.inspected !== null) {
      const building = state.plots[this.inspected]?.building ?? null;
      if (building === null || state.phase !== 'planning') this.inspect(null, { x: 0, y: 0 });
      else this.info.setLines(buildingInfoLines(building, CONTENT));
    }

    const planning = state.phase === 'planning';
    const choosing = planning && !state.played;
    this.hand.setHand(
      choosing ? state.hand : [],
      state.hand.map((id) => !hasAnyTarget(state.plots, CONTENT.card(id))),
    );
    this.skip.setVisible(choosing);
    this.fight.setVisible(planning && state.played && !RULES_G1.autoStart);
    this.handCount = state.hand.length;
    this.hand.layout(centerHand(this.lay.hand, this.handCount));

    if (state.phase === 'reward' && state.offers) {
      if (!this.reward) {
        this.reward = new RewardModal(this, CONTENT, state.offers.cardIds, this.tooltip, (index) =>
          this.bus.emit('ui:command', { command: { type: 'pickOffer', index } }),
        ).setDepth(MODAL_DEPTH);
      }
    } else if (this.reward) {
      this.reward.destroy();
      this.reward = null;
    }
    if (!choosing && this.pending.handIndex !== null) this.pending = NO_PENDING;
    this.refreshPending();
  }

  private refreshPending(): void {
    const p = this.pending;
    this.hand.setSelected(p.handIndex);
    this.skip.setEnabled(p.handIndex !== null);
    const last = p.targets.at(-1);
    const show = p.ready && last !== undefined;
    if (show) {
      const screen = { w: this.scale.width, h: this.scale.height };
      const { confirm, cancel } = confirmFor(this.lay, plotScreenRect(this.lay, last), screen);
      this.confirmBtn.container.setPosition(confirm.x + confirm.w / 2, confirm.y + confirm.h / 2);
      this.cancelBtn.container.setPosition(cancel.x + cancel.w / 2, cancel.y + cancel.h / 2);
    }
    this.confirmBtn.setVisible(show);
    this.cancelBtn.setVisible(show);
    if (p.handIndex === null) this.tooltip.hide(PLOT_TIP);
    this.refreshHint();
  }

  private refreshHint(): void {
    const content = this.hintContent();
    // On mobile ✓/✕ take the row above the board, which the hint shares.
    const hidden = !this.lay.desktop && this.pending.ready && this.illegal === null;
    this.hint.setContent(hidden ? null : content);
    const { x, y, w } = this.lay.hint;
    this.hint.setPosition(this.lay.desktop ? x + (w - this.hint.width) / 2 : x, y);
  }

  private hintContent(): TooltipContent | null {
    if (this.illegal !== null) return { lines: [[{ text: ILLEGAL_TEXT[this.illegal] }]] };
    const state = this.controller.state;
    const p = this.pending;
    const cardId = p.handIndex === null ? undefined : state.hand[p.handIndex];
    if (cardId === undefined) return null;
    const card = CONTENT.card(cardId);
    const two = targetCount(card) === 2;
    let line: string;
    if (p.ready) line = this.lay.desktop ? 'Bấm ✓ để xác nhận, ✕ để huỷ.' : 'Bấm ✓ hoặc ✕.';
    else if (two && p.targets.length === 0) line = 'Chọn công trình cần dời.';
    else if (two) line = 'Chọn ô đích.';
    else line = 'Chọn một ô viền xanh.';
    return this.lay.desktop
      ? { title: card.nameVi, lines: [[{ text: line }]] }
      : { lines: [[{ text: line }]] };
  }

  private flashIllegal(reason: IllegalReason): void {
    this.illegal = reason;
    this.illegalTimer?.remove(false);
    this.illegalTimer = this.time.delayedCall(ILLEGAL_MS, () => {
      this.illegal = null;
      this.illegalTimer = null;
      this.refreshHint();
    });
    this.refreshHint();
  }

  // ---- intents --------------------------------------------------------------------------

  private selectCard(index: number): void {
    const state = this.controller.state;
    if (state.phase !== 'planning' || state.played || state.hand[index] === undefined) return;
    const next = this.pending.handIndex === index ? null : index;
    this.bus.emit('ui:select-card', { handIndex: next });
  }

  /** A hand card released over the board: play it there, aim it (two-target cards) or say why not. */
  private dropCard(index: number, x: number, y: number): void {
    const state = this.controller.state;
    const cardId = state.hand[index];
    if (state.phase !== 'planning' || state.played || cardId === undefined) return;
    if (this.reward || this.scoutModal) return;
    const plot = plotAtScreen(this.lay, { x, y });
    if (plot === null) return; // released off the board: the card just returns to the hand
    const out = dropOutcome(state.plots, CONTENT.card(cardId), plot);
    if (out.action === 'reject') {
      if (this.pending.handIndex !== index) this.bus.emit('ui:select-card', { handIndex: index });
      this.flashIllegal(out.reason);
      return;
    }
    this.bus.emit('ui:drop-card', { handIndex: index, plot });
  }

  private command(type: 'startBattle'): void {
    this.bus.emit('ui:command', { command: { type } });
  }

  /** Bỏ lá đang chọn thay cho việc chơi thẻ (nút Bỏ bài / phím S); không chọn gì thì không làm gì. */
  private sell(): void {
    const handIndex = this.pending.handIndex;
    if (handIndex === null || this.controller.state.hand[handIndex] === undefined) return;
    this.bus.emit('ui:command', { command: { type: 'discard', handIndex } });
  }

  private onKey(event: KeyboardEvent): void {
    if (event.repeat) return; // a held key acts once
    if (this.reward) {
      if (event.key === 'Enter') this.reward.confirm();
      return;
    }
    if (this.scoutModal) {
      if (event.key === 'Escape') this.bus.emit('ui:close-modal', {});
      return;
    }
    const state = this.controller.state;
    if (state.phase !== 'planning') return;
    switch (event.key) {
      case '1':
      case '2':
      case '3':
        this.selectCard(Number(event.key) - 1);
        break;
      case 's':
      case 'S':
        if (!state.played) this.sell();
        break;
      case 'Enter':
        if (this.pending.ready) this.bus.emit('ui:confirm-play', {});
        else if (state.played && !RULES_G1.autoStart) this.command('startBattle');
        break;
      case 'Escape':
        if (this.pending.handIndex !== null) this.bus.emit('ui:cancel-play', {});
        break;
    }
  }

  // ---- red-plot reasons (hover / long-press) --------------------------------------------

  /** Why `plot` cannot take the aimed card, or null (legal, nothing aimed, or off-board). */
  private plotReason(x: number, y: number): { plot: number; reason: IllegalReason } | null {
    if (this.reward || this.scoutModal) return null;
    const p = this.pending;
    const state = this.controller.state;
    const cardId = p.handIndex === null ? undefined : state.hand[p.handIndex];
    if (cardId === undefined) return null;
    const plot = plotAtScreen(this.lay, { x, y });
    if (plot === null) return null;
    const reason = plotIllegalReason(state.plots, CONTENT.card(cardId), p.targets, plot);
    return reason === null ? null : { plot, reason };
  }

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    if (pointer.wasTouch) {
      if (pointer.isDown && pointer.getDistance() > 8) this.stopPlotTimer();
      return;
    }
    const hit = this.plotReason(pointer.x, pointer.y);
    if (hit) this.tooltip.showAtPointer({ title: ILLEGAL_TEXT[hit.reason], lines: [] }, PLOT_TIP);
    else this.tooltip.hide(PLOT_TIP);
  }

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    if (!pointer.wasTouch) return;
    this.stopPlotTimer();
    const hit = this.plotReason(pointer.x, pointer.y);
    if (!hit) return;
    this.plotTimer = this.time.delayedCall(LONG_PRESS_MS, () => {
      this.plotTimer = null;
      const r = plotScreenRect(this.lay, hit.plot);
      this.tooltip.showAbove({ title: ILLEGAL_TEXT[hit.reason], lines: [] }, r, PLOT_TIP);
    });
  }

  private onPointerUp(pointer: Phaser.Input.Pointer): void {
    if (!pointer.wasTouch) return;
    this.stopPlotTimer();
    this.tooltip.hide(PLOT_TIP);
  }

  private stopPlotTimer(): void {
    this.plotTimer?.remove(false);
    this.plotTimer = null;
  }

  // ---- building info (§10.7) ---------------------------------------------------------------

  private inspect(plot: number | null, anchor: { x: number; y: number }): void {
    const building =
      plot === null || this.reward || this.scoutModal
        ? null
        : this.controller.state.plots[plot]?.building ?? null;
    if (plot === null || building === null) {
      this.inspected = null;
      this.info.hide();
      return;
    }
    this.inspected = plot;
    this.info.show(buildingInfoLines(building, CONTENT), anchor, {
      w: this.scale.width,
      h: this.scale.height,
    });
  }

  // ---- scout modal (mobile) ---------------------------------------------------------------

  private openScout(): void {
    if (this.scoutModal) return;
    const overlay = createOverlay(this);
    overlay.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () =>
      this.bus.emit('ui:close-modal', {}),
    );
    const panel = new ScoutPanel(this, CONTENT);
    panel.setPlan(this.controller.state.army);
    const close = createButton(this, 0, 0, '✕', {
      width: CLOSE_BUTTON,
      height: CLOSE_BUTTON,
      fontSize: 20,
      onClick: () => this.bus.emit('ui:close-modal', {}),
      tooltip: { host: this.tooltip, content: () => textContent(['Đóng (Esc)']) },
    });
    const root = this.add
      .container(0, 0, [overlay, panel.container, close.container])
      .setDepth(MODAL_DEPTH);
    this.scoutModal = { root, overlay, panel, close };
    this.layoutScout();
  }

  private layoutScout(): void {
    const modal = this.scoutModal;
    if (!modal) return;
    fitOverlay(this, modal.overlay);
    const r = centredPanel(
      { w: this.scale.width, h: this.scale.height },
      SCOUT_MODAL.w,
      SCOUT_MODAL.h,
    );
    modal.panel.layout(r, 'full');
    modal.close.container.setPosition(r.x + r.w - CLOSE_BUTTON / 2 - 4, r.y + CLOSE_BUTTON / 2 + 4);
  }

  private closeScout(): void {
    if (!this.scoutModal) return;
    this.scoutModal.panel.destroy();
    this.scoutModal.root.destroy();
    this.scoutModal = null;
  }

  // ---- layout ---------------------------------------------------------------------------

  private createSkip(): Button {
    const { w, h } = this.lay.skip;
    this.skipSize = { w, h };
    return createButton(this, 0, 0, 'Bỏ bài', {
      width: w,
      height: h,
      fontSize: 16,
      onClick: () => this.sell(),
      tooltip: {
        host: this.tooltip,
        content: () => textContent(['Bỏ bài (S)', 'Bỏ lá đang chọn thay cho việc chơi thẻ.']),
      },
    });
  }

  private currentLayout(): PlanningLayout {
    return planningLayout({ w: this.scale.width, h: this.scale.height });
  }

  private layout(): void {
    const l = (this.lay = this.currentLayout());
    this.livesBox.resize(l.lives.w, l.lives.h);
    this.livesBox.image.setPosition(l.lives.x, l.lives.y);
    const midY = l.lives.y + l.lives.h / 2;
    const iconX = l.lives.x + 12;
    this.livesIcon?.setPosition(iconX, midY);
    this.livesText.setPosition(iconX + (this.livesIcon ? 36 : 0), midY);
    this.yearBox.resize(l.year.w, l.year.h);
    this.yearBox.image.setPosition(l.year.x, l.year.y);
    this.yearText.setPosition(l.year.x + l.year.w / 2, l.year.y + l.year.h / 2);
    this.yearText.setFontSize(l.desktop ? 18 : 16);

    this.scout.layout(l.scout, l.desktop ? 'full' : 'summary');
    this.hand.layout(centerHand(l.hand, this.handCount));
    if (this.skipSize.w !== l.skip.w || this.skipSize.h !== l.skip.h) {
      // 140×52 on desktop, 84×48 on mobile: buttons have a fixed size, so rebuild it.
      const visible = this.skip.container.visible;
      this.skip.container.destroy();
      this.skip = this.createSkip();
      this.skip.setVisible(visible);
    }
    this.skip.container.setPosition(l.skip.x + l.skip.w / 2, l.skip.y + l.skip.h / 2);
    this.skip.setEnabled(this.pending.handIndex !== null);
    this.fight.container.setPosition(l.fight.x + l.fight.w / 2, l.fight.y + l.fight.h / 2);
    this.hint.setMaxWidth(l.hint.w);
    this.hint.refresh();
    this.tooltip.refresh();
    this.reward?.layout();
    this.layoutScout();
    this.info.layout({ w: this.scale.width, h: this.scale.height });
    this.refreshPending();
  }

  private teardown(): void {
    for (const off of this.offs) off();
    this.offs = [];
    this.input.keyboard?.off(Phaser.Input.Keyboard.Events.ANY_KEY_DOWN, this.onKey, this);
    this.input.off(Phaser.Input.Events.POINTER_MOVE, this.onPointerMove, this);
    this.input.off(Phaser.Input.Events.POINTER_DOWN, this.onPointerDown, this);
    this.input.off(Phaser.Input.Events.POINTER_UP, this.onPointerUp, this);
    this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this);
    this.illegalTimer?.remove(false);
    this.stopPlotTimer();
    this.closeScout();
    this.info.destroy();
    this.reward?.destroy();
    this.reward = null;
    this.hand.destroy();
    this.scout.destroy();
    this.hint.destroy();
    this.tooltip.destroy();
  }
}
