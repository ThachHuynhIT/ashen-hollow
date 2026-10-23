import Phaser from 'phaser';
import type { EventBus } from '../core/events';
import { RUN } from '../data/run';
import { describeCard } from '../game/cards/describe';
import { CONTENT } from '../game/cards/registry';
import type { GameEvents } from '../game/events';
import type { RunController } from '../game/run/RunController';
import { hasAnyTarget, targetCount } from '../game/run/board';
import { rerollPrice } from '../game/run/decrees';
import { cardOffer } from '../game/run/flow';
import type { IllegalReason, RunState } from '../game/run/state';
import { SPRITES_KEY, iconFrame } from '../render/atlas';
import { ContentBox } from '../ui/ContentBox';
import { ToastStack } from '../ui/ToastStack';
import { Tooltip } from '../ui/Tooltip';
import { LONG_PRESS_MS, textContent, type TooltipContent } from '../ui/hud/layout';
import { CalendarModal } from '../ui/modals/CalendarModal';
import { DeckModal } from '../ui/modals/DeckModal';
import { CLOSE_BUTTON, centredPanel } from '../ui/modals/modalLayout';
import { createOverlay, fitOverlay } from '../ui/modals/overlay';
import { offerTitle } from '../ui/modals/offerModel';
import { CouncilModal } from '../ui/modals/CouncilModal';
import { QuestModal } from '../ui/modals/QuestModal';
import { RewardModal } from '../ui/modals/RewardModal';
import { modalKind } from '../ui/modals/councilModel';
import { DecreeQuestPanel } from '../ui/planning/DecreeQuestPanel';
import { handLimit } from '../game/run/decrees';
import { InspectionView } from '../ui/info/InspectionView';
import { buildingInfoModel } from '../ui/info/inspectionModel';
import { planningControls } from '../ui/info/inspectionReserved';
import { cardBadge, willLevelUpTo } from '../ui/cards/cardText';
import { CalendarStrip } from '../ui/planning/CalendarStrip';
import { HandView } from '../ui/planning/HandView';
import { ScoutPanel } from '../ui/planning/ScoutPanel';
import { canFight } from '../ui/planning/fightRule';
import { dropOutcome, plotIllegalReason } from '../ui/planning/targetHints';
import { calendarCells, illegalText } from '../ui/realm/calendarModel';
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
  private goldBox!: UiBox;
  private goldIcon: Phaser.GameObjects.Image | null = null;
  private goldText!: Phaser.GameObjects.Text;
  private calendar!: CalendarStrip;
  private sellBtn!: Button;
  private rerollBtn!: Button;
  private deckBtn!: Button;
  private scoutBtn!: Button;
  private actionSize = { w: 0, h: 0 };
  private calendarModal: CalendarModal | null = null;
  private deckModal: DeckModal | null = null;
  /** Cards currently in hand (1–3 after a play): the row is centred on this many. */
  private handCount = 0;
  /** Info box of a tapped building (§10.7), and the plot it describes. */
  private info!: InspectionView;
  private inspected: number | null = null;
  private hoveredPlot: number | null = null;
  private fight!: Button;
  private confirmBtn!: Button;
  private cancelBtn!: Button;
  private hint!: ContentBox;
  private reward: RewardModal | null = null;
  private council: CouncilModal | null = null;
  private quest: QuestModal | null = null;
  private decreePanel!: DecreeQuestPanel;
  /** Which offer the open RewardModal shows (kind + cards). */
  private rewardKey: string | null = null;
  private scoutModal: ScoutModal | null = null;
  private pending: Pending = NO_PENDING;
  /** A locked plot offered for purchase (set by RealmScene), shown with its price and ✓/✕. */
  private buy: { plot: number; price: number } | null = null;
  private toasts!: ToastStack;
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
    this.council = null;
    this.quest = null;
    this.rewardKey = null;
    this.scoutModal = null;
    this.calendarModal = null;
    this.deckModal = null;
    this.actionSize = { w: 0, h: 0 };
    this.inspected = null;
    this.pending = NO_PENDING;
    this.buy = null;
    this.illegal = null;
    this.illegalTimer = null;
    this.plotTimer = null;
    this.hoveredPlot = null;
    this.lay = this.currentLayout();

    this.tooltip = new Tooltip(this);
    this.toasts = new ToastStack(this, MODAL_DEPTH + 50);
    this.info = new InspectionView(this, MODAL_DEPTH - 50, () => {
      this.inspected = null;
      this.bus.emit('ui:range-selection', { target: null, mode: 'selected' });
    });
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
    this.goldBox = createPanel(this, 'panel', 120, 52);
    this.goldIcon =
      tex.exists(SPRITES_KEY) && tex.get(SPRITES_KEY).has(iconFrame('gold'))
        ? this.add.image(0, 0, SPRITES_KEY, iconFrame('gold')).setScale(2).setOrigin(0, 0.5)
        : null;
    this.goldText = addUiText(this, 0, 0, '', 18).setOrigin(0, 0.5).setFontStyle('bold');
    this.calendar = new CalendarStrip(this, CONTENT, this.tooltip, () =>
      this.bus.emit('ui:open-modal', { modal: 'calendar' }),
    );

    this.scout = new ScoutPanel(this, CONTENT, () =>
      this.bus.emit('ui:open-modal', { modal: 'scout' }),
    );
    this.hand = new HandView(this, CONTENT, this.tooltip, 4);
    this.decreePanel = new DecreeQuestPanel(this, this.bus, this.controller.state);
    this.hand.onSelect((i) => this.selectCard(i));
    this.hand.onDrop((i, x, y) => this.dropCard(i, x, y));

    this.createActionButtons();
    this.scoutBtn = createButton(this, 0, 0, 'Địch', {
      width: 52,
      height: 52,
      fontSize: 13,
      onClick: () => this.bus.emit('ui:open-modal', { modal: 'scout' }),
      tooltip: tip(['Trinh sát', 'Xem đội quân địch năm nay.']),
    });
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
      tooltip: { host: this.tooltip, content: () => textContent(this.confirmTip()) },
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
      bus.on('log', ({ text }) => this.toasts.push(text)),
      bus.on('ui:pending-buy', ({ plot, price }) => {
        this.buy = plot === null ? null : { plot, price };
        this.refreshPending();
      }),
      bus.on('ui:open-modal', ({ modal }) => this.openModal(modal)),
      bus.on('ui:close-modal', () => this.closeModals()),
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
    if (this.lay.hand.length !== handLimit(state)) this.layout(); // a decree changed the hand size
    this.decreePanel.setState(state);
    this.refreshModals(state);
    this.livesText.setText(`× ${state.lives}`);
    this.goldText.setText(`${state.gold}`);
    this.yearText.setText(`Năm ${state.year} / ${state.rules.years}`);
    this.calendar.setCells(calendarCells(state, 5));
    this.scout.setPlan(state.army);
    if (this.inspected !== null) {
      const model = buildingInfoModel(state, this.inspected, CONTENT);
      if (model === null || state.phase !== 'planning') this.inspect(null, { x: 0, y: 0 });
      else this.info.setBuilding(model);
    }

    const planning = state.phase === 'planning';
    const choosing = planning && !state.played;
    this.hand.setHand(
      choosing ? state.hand : [],
      state.hand.map((id) => !hasAnyTarget(state.plots, CONTENT.card(id))),
      state.hand.map((id) => {
        const card = CONTENT.card(id);
        return cardBadge(card, willLevelUpTo(state.plots, card));
      }),
    );
    this.sellBtn.setVisible(choosing);
    this.rerollBtn.setVisible(choosing);
    this.deckBtn.setVisible(planning);
    this.fight.setVisible(canFight(state));
    this.refreshActions(state);
    this.handCount = state.hand.length;
    this.hand.layout(centerHand(this.lay.hand, this.handCount));

    const offers = state.phase === 'reward' || state.phase === 'conquest' ? cardOffer(state) : null;
    // The reward step is followed by a conquest step: a new offer replaces the open modal.
    const offerKey = offers ? `${offers.kind}:${offers.cardIds.join(',')}` : null;
    if (this.reward && offerKey !== this.rewardKey) {
      this.reward.destroy();
      this.reward = null;
    }
    if (offers && !this.reward) {
      this.rewardKey = offerKey;
      this.reward = new RewardModal(
        this,
        CONTENT,
        offers.cardIds,
        offerTitle(offers, (id) => CONTENT.enemyKing(id).nameVi),
        this.tooltip,
        (index) => this.bus.emit('ui:command', { command: { type: 'pickOffer', index } }),
      ).setDepth(MODAL_DEPTH);
    }
    if (!choosing && this.pending.handIndex !== null) this.pending = NO_PENDING;
    if (!planning) this.buy = null;
    this.refreshPending();
  }

  /** Council and quest modals follow the open offer: made when it opens, kept in sync, dropped when it closes. */
  private refreshModals(state: RunState): void {
    const kind = modalKind(state);
    if (kind === 'council') {
      if (this.council) this.council.setState(state);
      else this.council = new CouncilModal(this, this.bus, state, this.tooltip).setDepth(MODAL_DEPTH);
    } else if (this.council) {
      this.council.destroy();
      this.council = null;
    }
    if (kind === 'quest') {
      if (this.quest) this.quest.setState(state);
      else this.quest = new QuestModal(this, this.bus, state).setDepth(MODAL_DEPTH);
    } else if (this.quest) {
      this.quest.destroy();
      this.quest = null;
    }
  }

  private rerollPrice(state: RunState): number {
    return rerollPrice(state);
  }

  /** Labels, enabled state of Bán bài / Đổi bài / Bộ bài (they stay hoverable to say why not). */
  private refreshActions(state: RunState): void {
    const price = this.rerollPrice(state);
    const desktop = this.lay.desktop;
    this.sellBtn.setLabel(desktop ? `Bán bài (+${RUN.skipPlayGold})` : `Bán bài\n+${RUN.skipPlayGold}`);
    this.rerollBtn.setLabel(desktop ? `Đổi bài (${price})` : `Đổi bài\n${price} vàng`);
    this.deckBtn.setLabel(desktop ? `Bộ bài (${state.deck.length})` : `Bộ bài\n${state.deck.length}`);
    this.sellBtn.setEnabled(this.pending.handIndex !== null);
    this.rerollBtn.setEnabled(state.gold >= price);
  }

  private sellTip(): string[] {
    return this.pending.handIndex === null
      ? ['Bán bài (S)', 'Chọn một thẻ để bán.']
      : ['Bán bài (S)', `Bán lá đang chọn lấy ${RUN.skipPlayGold} vàng, thay cho việc chơi thẻ.`];
  }

  private rerollTip(): string[] {
    const state = this.controller.state;
    const price = this.rerollPrice(state);
    return state.gold < price
      ? ['Đổi bài (R)', 'Không đủ vàng.']
      : ['Đổi bài (R)', `Bỏ cả tay và rút lại: ${price} vàng (lần sau đắt gấp đôi).`];
  }

  private refreshPending(): void {
    const p = this.pending;
    this.hand.setSelected(p.handIndex);
    this.refreshActions(this.controller.state);
    const buy = this.buy;
    const last = buy ? buy.plot : p.targets.at(-1);
    const show = buy !== null || p.ready;
    if (show) {
      const screen = { w: this.scale.width, h: this.scale.height };
      // A no-target tome has no plot: ✓/✕ take their default spot.
      const { confirm, cancel } =
        last === undefined
          ? { confirm: this.lay.confirm, cancel: this.lay.cancel }
          : confirmFor(this.lay, plotScreenRect(this.lay, last), screen);
      this.confirmBtn.container.setPosition(confirm.x + confirm.w / 2, confirm.y + confirm.h / 2);
      this.cancelBtn.container.setPosition(cancel.x + cancel.w / 2, cancel.y + cancel.h / 2);
    }
    this.confirmBtn.setLabel(buy ? '✓\nMua' : p.ready && last === undefined ? '✓\nDùng' : '✓\nĐặt');
    this.confirmBtn.setEnabled(buy === null || this.controller.state.gold >= buy.price);
    this.confirmBtn.setVisible(show);
    this.cancelBtn.setVisible(show);
    if (p.handIndex === null) this.tooltip.hide(PLOT_TIP);
    this.refreshHint();
  }

  private refreshHint(): void {
    const content = this.hintContent();
    // On mobile ✓/✕ take the row above the board, which the hint shares.
    const hidden = !this.lay.desktop && (this.pending.ready || this.buy !== null) && this.illegal === null;
    this.hint.setContent(hidden ? null : content);
    const { x, y, w } = this.lay.hint;
    this.hint.setPosition(this.lay.desktop ? x + (w - this.hint.width) / 2 : x, y);
  }

  private hintContent(): TooltipContent | null {
    if (this.illegal !== null) return { lines: [[{ text: illegalText(this.illegal) }]] };
    const state = this.controller.state;
    if (this.buy) {
      const text = state.gold >= this.buy.price ? `Mở ô này: ${this.buy.price} vàng.` : 'Không đủ vàng.';
      return this.lay.desktop ? { title: 'Mở ô mới', lines: [[{ text }]] } : { lines: [[{ text }]] };
    }
    const p = this.pending;
    const cardId = p.handIndex === null ? undefined : state.hand[p.handIndex];
    if (cardId === undefined) return null;
    const card = CONTENT.card(cardId);
    const two = targetCount(card) === 2;
    let line: string;
    if (p.ready) line = this.lay.desktop ? 'Bấm ✓ để xác nhận, ✕ để huỷ.' : 'Bấm ✓ hoặc ✕.';
    else if (two && p.targets.length === 0) line = 'Chọn công trình đầu tiên (viền xanh).';
    else if (two) line = 'Chọn công trình hoặc ô thứ hai.';
    else if (card.kind === 'enchantment') line = 'Chọn công trình để gắn Bùa.';
    else if (card.kind === 'tome') line = 'Chọn một ô viền xanh.';
    else line = 'Chọn ô trống, hoặc bản cùng loại để lên cấp.';
    return this.lay.desktop
      ? { title: card.nameVi, lines: [[{ text: line }]] }
      : { lines: [[{ text: line }]] };
  }

  /** Tooltip of ✓: what exactly the play will do (level-up preview, enchantment, purchase). */
  private confirmTip(): string[] {
    const state = this.controller.state;
    if (this.buy) {
      return [`Mua ô (Enter)`, state.gold >= this.buy.price ? `Giá ${this.buy.price} vàng.` : 'Không đủ vàng.'];
    }
    const p = this.pending;
    const cardId = p.handIndex === null ? undefined : state.hand[p.handIndex];
    if (cardId === undefined) return ['Đặt (Enter)'];
    const card = CONTENT.card(cardId);
    const plot = p.targets.at(-1);
    const building = plot === undefined ? null : state.plots[plot]?.building ?? null;
    if (building && building.cardId === card.id && building.level < RUN.maxLevel) {
      const next = (building.level + 1) as 2 | 3 | 4 | 5;
      return [`${card.nameVi} → Cấp ${next} (Enter)`, describeCard(card, next).lines[0] ?? ''];
    }
    if (card.kind === 'enchantment') return ['Gắn Bùa (Enter)', describeCard(card).lines[0] ?? ''];
    if (card.kind === 'tome') return ['Dùng sách (Enter)', describeCard(card).lines[0] ?? ''];
    return ['Đặt (Enter)'];
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
    if (this.modalOpen()) return;
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

  /** Đổi bài (phím R): bỏ cả tay và rút lại; thiếu vàng thì chỉ nhắc lý do. */
  private reroll(): void {
    const state = this.controller.state;
    if (state.phase !== 'planning' || state.played) return;
    if (state.gold < this.rerollPrice(state)) {
      this.flashIllegal('notEnoughGold');
      return;
    }
    this.bus.emit('ui:command', { command: { type: 'reroll' } });
  }

  private modalOpen(): boolean {
    return Boolean(
      this.reward || this.council || this.quest || this.scoutModal || this.calendarModal || this.deckModal || this.decreePanel.isOpen,
    );
  }

  private onKey(event: KeyboardEvent): void {
    if (event.repeat) return; // a held key acts once
    if (this.reward) {
      if (event.key === 'Enter') this.reward.confirm();
      return;
    }
    if (this.council || this.quest) return; // mandatory decisions: Esc does not skip them
    if (this.decreePanel.isOpen) {
      if (event.key === 'Escape') this.decreePanel.closeView();
      return;
    }
    if (this.scoutModal || this.calendarModal || this.deckModal) {
      if (event.key === 'Escape') this.bus.emit('ui:close-modal', {});
      return;
    }
    const state = this.controller.state;
    if (state.phase !== 'planning') return;
    switch (event.key) {
      case 'r':
      case 'R':
        this.reroll();
        break;
      case 'd':
      case 'D':
        this.bus.emit('ui:open-modal', { modal: 'deck' });
        break;
      case 'l':
      case 'L':
        this.bus.emit('ui:open-modal', { modal: 'calendar' });
        break;
      case '1':
      case '2':
      case '3':
      case '4':
        this.selectCard(Number(event.key) - 1);
        break;
      case 's':
      case 'S':
        if (!state.played) this.sell();
        break;
      case 'Enter':
        if (this.buy && state.gold < this.buy.price) this.flashIllegal('notEnoughGold');
        else if (this.pending.ready || this.buy) this.bus.emit('ui:confirm-play', {});
        else if (canFight(state)) this.command('startBattle');
        break;
      case 'Escape':
        if (this.pending.handIndex !== null || this.buy) this.bus.emit('ui:cancel-play', {});
        break;
    }
  }

  // ---- red-plot reasons (hover / long-press) --------------------------------------------

  /** Why `plot` cannot take the aimed card, or null (legal, nothing aimed, or off-board). */
  private plotReason(x: number, y: number): { plot: number; reason: IllegalReason } | null {
    if (this.modalOpen()) return null;
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
    if (hit) this.tooltip.showAtPointer({ title: illegalText(hit.reason), lines: [] }, PLOT_TIP);
    else this.tooltip.hide(PLOT_TIP);
    this.hoverRange(pointer);
  }

  /** Mouse over a built plot shows its rings (desktop); leaving, a modal or a chosen card clears them. */
  private hoverRange(pointer: Phaser.Input.Pointer): void {
    const state = this.controller.state;
    const plot =
      this.modalOpen() || state.phase !== 'planning' ? null : plotAtScreen(this.lay, { x: pointer.x, y: pointer.y });
    const built = plot !== null && state.plots[plot]?.building ? plot : null;
    if (built === this.hoveredPlot) return;
    this.hoveredPlot = built;
    this.bus.emit('ui:range-selection', {
      target: built === null ? null : { kind: 'plot', plot: built },
      mode: 'hover',
    });
  }

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    if (!pointer.wasTouch) return;
    this.stopPlotTimer();
    const hit = this.plotReason(pointer.x, pointer.y);
    if (!hit) return;
    this.plotTimer = this.time.delayedCall(LONG_PRESS_MS, () => {
      this.plotTimer = null;
      const r = plotScreenRect(this.lay, hit.plot);
      this.tooltip.showAbove({ title: illegalText(hit.reason), lines: [] }, r, PLOT_TIP);
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
    const model =
      plot === null || this.modalOpen() ? null : buildingInfoModel(this.controller.state, plot, CONTENT);
    if (plot === null || model === null) {
      this.inspected = null;
      this.info.hide();
      this.bus.emit('ui:range-selection', { target: null, mode: 'selected' });
      return;
    }
    this.inspected = plot;
    this.bus.emit('ui:range-selection', { target: { kind: 'plot', plot }, mode: 'selected' });
    this.info.showBuilding(
      model,
      anchor,
      { w: this.scale.width, h: this.scale.height },
      planningControls(this.lay),
    );
  }

  // ---- modals ------------------------------------------------------------------------------

  private openModal(modal: 'scout' | 'calendar' | 'deck'): void {
    if (this.modalOpen()) return;
    const state = this.controller.state;
    this.inspect(null, { x: 0, y: 0 });
    this.tooltip.hide(PLOT_TIP);
    if (modal === 'scout') this.openScout();
    else if (modal === 'calendar') {
      this.calendarModal = new CalendarModal(this, CONTENT, state, this.tooltip, () =>
        this.bus.emit('ui:close-modal', {}),
      ).setDepth(MODAL_DEPTH);
    } else {
      this.deckModal = new DeckModal(this, CONTENT, state.deck, this.tooltip, () =>
        this.bus.emit('ui:close-modal', {}),
      ).setDepth(MODAL_DEPTH);
    }
  }

  private closeModals(): void {
    this.closeScout();
    this.calendarModal?.destroy();
    this.calendarModal = null;
    this.deckModal?.destroy();
    this.deckModal = null;
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

  /** Bán bài / Đổi bài / Bộ bài share a size that differs per layout, so they are rebuilt on change. */
  private createActionButtons(): void {
    const { w, h } = this.lay.sell;
    const fontSize = this.lay.desktop ? 15 : 13;
    const visible = [this.sellBtn, this.rerollBtn, this.deckBtn].map((b) => b?.container.visible ?? false);
    for (const b of [this.sellBtn, this.rerollBtn, this.deckBtn]) b?.container.destroy();
    this.actionSize = { w, h };
    const common = { width: w, height: h, fontSize };
    this.sellBtn = createButton(this, 0, 0, 'Bán bài', {
      ...common,
      onClick: () => this.sell(),
      tooltip: { host: this.tooltip, content: () => textContent(this.sellTip()) },
    });
    this.rerollBtn = createButton(this, 0, 0, 'Đổi bài', {
      ...common,
      onClick: () => this.reroll(),
      tooltip: { host: this.tooltip, content: () => textContent(this.rerollTip()) },
    });
    this.deckBtn = createButton(this, 0, 0, 'Bộ bài', {
      ...common,
      onClick: () => this.bus.emit('ui:open-modal', { modal: 'deck' }),
      tooltip: { host: this.tooltip, content: () => textContent(['Bộ bài (D)', 'Xem mọi thẻ đang có.']) },
    });
    this.sellBtn.setVisible(visible[0]!);
    this.rerollBtn.setVisible(visible[1]!);
    this.deckBtn.setVisible(visible[2]!);
  }

  private currentLayout(): PlanningLayout {
    return planningLayout({ w: this.scale.width, h: this.scale.height }, handLimit(this.controller.state));
  }

  private layout(): void {
    const l = (this.lay = this.currentLayout());
    this.toasts.setAnchor(this.scale.width / 2, l.lives.y + l.lives.h + 8, this.scale.width - 32);
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

    this.goldBox.resize(l.gold.w, l.gold.h);
    this.goldBox.image.setPosition(l.gold.x, l.gold.y);
    const goldMid = l.gold.y + l.gold.h / 2;
    this.goldIcon?.setPosition(l.gold.x + 12, goldMid);
    this.goldText.setPosition(l.gold.x + 12 + (this.goldIcon ? 36 : 0), goldMid);
    this.calendar.layout(l.calendar);
    this.scout.setVisible(l.scout !== null);
    if (l.scout) this.scout.layout(l.scout, 'full');
    this.scoutBtn.setVisible(l.scoutButton !== null);
    if (l.scoutButton) {
      this.scoutBtn.container.setPosition(l.scoutButton.x + l.scoutButton.w / 2, l.scoutButton.y + l.scoutButton.h / 2);
    }
    this.hand.layout(centerHand(l.hand, this.handCount));
    if (this.actionSize.w !== l.sell.w || this.actionSize.h !== l.sell.h) this.createActionButtons();
    for (const [button, r] of [
      [this.sellBtn, l.sell],
      [this.rerollBtn, l.reroll],
      [this.deckBtn, l.deck],
    ] as const) {
      button.container.setPosition(r.x + r.w / 2, r.y + r.h / 2);
    }
    this.refreshActions(this.controller.state);
    this.fight.container.setPosition(l.fight.x + l.fight.w / 2, l.fight.y + l.fight.h / 2);
    this.hint.setMaxWidth(l.hint.w);
    this.hint.refresh();
    this.tooltip.refresh();
    this.reward?.layout();
    this.council?.layout();
    this.quest?.layout();
    this.decreePanel.layout(l);
    this.layoutScout();
    this.calendarModal?.layout();
    this.deckModal?.layout();
    this.info.layout({ w: this.scale.width, h: this.scale.height }, planningControls(l));
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
    this.closeModals();
    this.calendar.destroy();
    this.info.destroy();
    this.reward?.destroy();
    this.reward = null;
    this.council?.destroy();
    this.council = null;
    this.quest?.destroy();
    this.quest = null;
    this.decreePanel.destroy();
    this.hand.destroy();
    this.scout.destroy();
    this.hint.destroy();
    this.toasts.destroy();
    this.tooltip.destroy();
  }
}
