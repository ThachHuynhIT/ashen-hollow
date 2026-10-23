import Phaser from 'phaser';
import type { EventBus } from '../core/events';
import type { GameSpeed } from '../core/SimClock';
import { INTERVENTION } from '../data/battle';
import { toCss } from '../data/palette';
import { UI_PALETTE } from '../data/uiPalette';
import type { BattleResult } from '../game/battle/types';
import type { BattleWorld } from '../game/battle/world';
import { CONTENT } from '../game/cards/registry';
import type { GameEvents } from '../game/events';
import type { RunController } from '../game/run/RunController';
import { SPRITES_KEY, iconFrame } from '../render/atlas';
import { ToastStack } from '../ui/ToastStack';
import { Tooltip } from '../ui/Tooltip';
import {
  foesRemaining,
  interventionCooldown,
  summaryLines,
  throneHpFraction,
} from '../ui/battle/battleReadout';
import { InfoPanel } from '../ui/info/InfoPanel';
import { entityAt, entityInfoLines } from '../ui/info/infoLines';
import { bossReadout, type BossReadout } from '../ui/battle/battleReadout';
import { DRAG_SLOP, GAP, MARGIN, textContent, type Point, type Rect } from '../ui/hud/layout';
import { RESULT_BUTTON, centredPanel, resultLayout } from '../ui/modals/modalLayout';
import { createOverlay, fitOverlay } from '../ui/modals/overlay';
import { ScoutPanel, tickClock } from '../ui/planning/ScoutPanel';
import {
  battleLayout,
  battleCamera,
  battleWorldAt,
  battleZoom,
  screenToWorld,
  isDesktop,
  type BattleLayout,
} from '../ui/realm/realmLayout';
import {
  addUiText,
  createButton,
  createPanel,
  frameBorder,
  type Button,
  type TooltipSource,
  type UiBox,
} from '../ui/theme';
import { SCENES } from './keys';
import type { RealmHudData } from './RealmScene';

/** §10.7 speed row, left to right. */
const SPEEDS: readonly { speed: GameSpeed; label: string; tip: string[] }[] = [
  { speed: 0, label: '❚❚', tip: ['Tạm dừng (P)'] },
  { speed: 1, label: '1×', tip: ['Tốc độ 1× (1)'] },
  { speed: 2, label: '2×', tip: ['Tốc độ 2× (2)'] },
  { speed: 3, label: '3×', tip: ['Tốc độ 3× (3)'] },
];

const BANNER_MS = 1200;
const WIN_TEXT = 'Chiến thắng!';
const LOSS_TEXT = 'Ngai thất thủ!';
/** HP bar inside the clock panel: left of it the "m:ss" clock. */
const CLOCK_TEXT_W = 64;
const BAR_H = 16;
const DOT_R = 4;
const DOT_GAP = 14;
const PAD = 16;

const RING_DEPTH = 400;
const MODAL_DEPTH = 500;
const TOAST_DEPTH = 900;

interface Press {
  id: number;
  fromButton: boolean;
  x: number;
  y: number;
}

interface Summary {
  overlay: Phaser.GameObjects.Rectangle;
  panel: UiBox;
  title: Phaser.GameObjects.Text;
  lines: Phaser.GameObjects.Text[];
  next: Button;
}

/** Label of the auto-fire toggle (§7.4). */
const autoLabel = (on: boolean): string => `Tự bắn: ${on ? 'Bật' : 'Tắt'}`;

const SCOUT_MODAL = { w: 300, h: 460 } as const;
const SCOUT_CLOSE = 48;

const inside = (r: Rect, p: Point): boolean =>
  p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h;

/**
 * Battle HUD over RealmScene (§10.7): clock + throne HP, lives, enemies left with wave dots,
 * the speed row, the Royal Boulder button with its aim ring, the rage toast and the end
 * banner + summary. It reads `controller.runner.world` / `controller.state` and only sends
 * intents (`ui:set-speed`, `ui:toggle-pause`, `ui:intervene`, `ui:continue`) on the bus.
 */
export class BattleHudScene extends Phaser.Scene {
  private bus!: EventBus<GameEvents>;
  private controller!: RunController;
  private offs: (() => void)[] = [];
  private lay!: BattleLayout;
  private tooltip!: Tooltip;
  private toasts!: ToastStack;
  /** Last world seen: the runner is dropped the tick the battle ends. */
  private world: BattleWorld | null = null;

  private livesBox!: UiBox;
  private livesIcon: Phaser.GameObjects.Image | null = null;
  private livesText!: Phaser.GameObjects.Text;
  private goldBox!: UiBox;
  private goldIcon: Phaser.GameObjects.Image | null = null;
  private goldText!: Phaser.GameObjects.Text;
  private clockBox!: UiBox;
  private clockText!: Phaser.GameObjects.Text;
  private hpBar!: UiBox;
  private hpFill!: Phaser.GameObjects.Graphics;
  /** The boss bar under the clock: shown while a boss is alive. */
  private bossBar!: UiBox;
  private bossFill!: Phaser.GameObjects.Graphics;
  private bossText!: Phaser.GameObjects.Text;
  private bossShown = false;
  private foesBox!: UiBox;
  private foesText!: Phaser.GameObjects.Text;
  private dots!: Phaser.GameObjects.Graphics;
  private speedButtons: Button[] = [];
  private intervene!: Button;
  /** Info box of a tapped building or unit (§10.7), and the entity it describes. */
  private info!: InfoPanel;
  private inspected: number | null = null;
  private autoBtn!: Button;
  private wavesBtn!: Button;
  private scoutModal: {
    root: Phaser.GameObjects.Container;
    overlay: Phaser.GameObjects.Rectangle;
    panel: ScoutPanel;
    close: Button;
  } | null = null;
  private cooldown!: Phaser.GameObjects.Graphics;
  private cooldownText!: Phaser.GameObjects.Text;
  private ring!: Phaser.GameObjects.Graphics;

  private aiming = false;
  private aimAt: Point | null = null;
  private press: Press | null = null;
  private ended = false;
  private continued = false;
  private banner: { box: UiBox; text: Phaser.GameObjects.Text } | null = null;
  private bannerTimer: Phaser.Time.TimerEvent | null = null;
  private summary: Summary | null = null;
  /** Gold when the battle began, to show what it paid in the summary. */
  private goldAtStart = 0;
  private result: BattleResult | null = null;

  constructor() {
    super(SCENES.battleHud);
  }

  create(data: RealmHudData): void {
    // Scene instances are reused: reset every per-battle field first.
    this.bus = data.bus;
    this.controller = data.controller;
    this.offs = [];
    this.world = this.controller.runner?.world ?? null;
    this.speedButtons = [];
    this.aiming = false;
    this.aimAt = null;
    this.press = null;
    this.ended = false;
    this.continued = false;
    this.banner = null;
    this.bannerTimer = null;
    this.summary = null;
    this.result = null;
    this.goldAtStart = this.controller.state.gold;
    this.scoutModal = null;
    this.inspected = null;
    this.lay = this.currentLayout();

    this.tooltip = new Tooltip(this);
    this.toasts = new ToastStack(this, TOAST_DEPTH);
    this.info = new InfoPanel(this, MODAL_DEPTH - 50);
    const tip = (lines: string[]): TooltipSource => ({
      host: this.tooltip,
      content: () => textContent(lines),
    });

    // Top left: lives (as in planning).
    this.livesBox = createPanel(this, 'panel', this.lay.lives.w, this.lay.lives.h);
    const tex = this.textures;
    this.livesIcon =
      tex.exists(SPRITES_KEY) && tex.get(SPRITES_KEY).has(iconFrame('crown'))
        ? this.add.image(0, 0, SPRITES_KEY, iconFrame('crown')).setScale(2).setOrigin(0, 0.5)
        : null;
    this.livesText = addUiText(this, 0, 0, '', 18).setOrigin(0, 0.5).setFontStyle('bold');
    // Gold, right of the lives (as in planning).
    this.goldBox = createPanel(this, 'panel', this.lay.gold.w, this.lay.gold.h);
    this.goldIcon =
      tex.exists(SPRITES_KEY) && tex.get(SPRITES_KEY).has(iconFrame('gold'))
        ? this.add.image(0, 0, SPRITES_KEY, iconFrame('gold')).setScale(2).setOrigin(0, 0.5)
        : null;
    this.goldText = addUiText(this, 0, 0, '', 18).setOrigin(0, 0.5).setFontStyle('bold');

    // Top centre: clock + throne HP.
    this.clockBox = createPanel(this, 'panel', this.lay.clock.w, this.lay.clock.h);
    this.clockText = addUiText(this, 0, 0, tickClock(0), 20).setOrigin(0, 0.5).setFontStyle('bold');
    this.hpBar = createPanel(this, 'bar', 100, BAR_H);
    this.hpFill = this.add.graphics();
    this.bossBar = createPanel(this, 'bar', 100, BAR_H);
    this.bossFill = this.add.graphics();
    this.bossText = addUiText(this, 0, 0, '', 12, UI_PALETTE.creamLight)
      .setOrigin(0.5, 0)
      .setFontStyle('bold')
      .setShadow(1, 1, toCss(UI_PALETTE.outline), 0, false, true);
    this.bossShown = false;
    this.drawBoss(null);

    // Top right: enemies left + wave dots.
    this.foesBox = createPanel(this, 'panel', this.lay.foes.w, this.lay.foes.h);
    this.foesText = addUiText(this, 0, 0, '', 15).setOrigin(0.5, 0).setFontStyle('bold');
    this.dots = this.add.graphics();

    // Bottom left: speeds. Bottom right: Can Thiệp.
    this.speedButtons = SPEEDS.map(({ speed, label, tip: lines }) =>
      createButton(this, 0, 0, label, {
        width: this.lay.speed[0]!.w,
        height: this.lay.speed[0]!.h,
        fontSize: 16,
        onClick: () => this.bus.emit('ui:set-speed', { speed }),
        tooltip: tip(lines),
      }),
    );
    this.intervene = createButton(this, 0, 0, 'Can Thiệp', {
      width: this.lay.intervene.w,
      height: this.lay.intervene.h,
      fontSize: 11,
      icon: tex.exists(SPRITES_KEY)
        ? { key: SPRITES_KEY, frame: iconFrame('boulder'), scale: 2 }
        : undefined,
      onClick: () => this.toggleAim(),
      tooltip: tip([
        'Can Thiệp (Space / B)',
        'Thả Đá Tảng Hoàng Gia lên quân địch.',
        'Bấm lại để huỷ.',
      ]),
    });
    this.autoBtn = createButton(this, 0, 0, autoLabel(this.controller.state.autoFire), {
      width: this.lay.auto.w,
      height: this.lay.auto.h,
      fontSize: 13,
      onClick: () => this.toggleAuto(),
      tooltip: tip([
        'Tự bắn',
        'Đá Tảng tự rơi vào chỗ đông địch nhất khi hết hồi chiêu.',
        'Dùng chung thời gian hồi với Can Thiệp.',
      ]),
    });
    this.autoBtn.setActive(this.controller.state.autoFire);
    this.wavesBtn = createButton(this, 0, 0, 'Địch', {
      width: this.lay.waves.w,
      height: this.lay.waves.h,
      fontSize: 13,
      onClick: () => (this.scoutModal ? this.closeScout() : this.openScout()),
      tooltip: tip(['Các đợt địch', 'Xem lại đạo quân năm nay.']),
    });
    this.cooldown = this.add.graphics();
    this.cooldownText = addUiText(this, 0, 0, '', 22, UI_PALETTE.creamLight)
      .setOrigin(0.5)
      .setFontStyle('bold')
      .setShadow(1, 1, toCss(UI_PALETTE.outline), 0, false, true);
    this.ring = this.add.graphics().setDepth(RING_DEPTH);

    const bus = this.bus;
    this.offs.push(
      bus.on('battle:tick', ({ tick }) => this.clockText.setText(tickClock(tick))),
      bus.on('clock:speed', ({ speed }) => this.showSpeed(speed)),
      bus.on('run:state', ({ state }) => {
        this.livesText.setText(`× ${state.lives}`);
        this.goldText.setText(`${state.gold}`);
        this.autoBtn.setLabel(autoLabel(state.autoFire));
        this.autoBtn.setActive(state.autoFire);
      }),
      bus.on('log', ({ text }) => this.toasts.push(text)),
      bus.on('battle:ended', ({ result }) => this.onEnded(result)),
    );

    this.input.keyboard?.on(Phaser.Input.Keyboard.Events.ANY_KEY_DOWN, this.onKey, this);
    this.input.on(Phaser.Input.Events.POINTER_MOVE, this.onPointerMove, this);
    this.input.on(Phaser.Input.Events.POINTER_DOWN, this.onPointerDown, this);
    this.input.on(Phaser.Input.Events.POINTER_UP, this.onPointerUp, this);
    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.teardown, this);

    this.livesText.setText(`× ${this.controller.state.lives}`);
    this.goldText.setText(`${this.controller.state.gold}`);
    this.showSpeed(this.controller.runner?.clock.speed ?? 1);
    this.layout();
    this.refresh();
  }

  update(): void {
    const runner = this.controller.runner;
    if (runner) this.world = runner.world;
    this.refresh();
  }

  // ---- state → widgets ---------------------------------------------------------------------

  private refresh(): void {
    const world = this.world;
    if (!world) return;
    this.drawHp(throneHpFraction(world));
    this.drawBoss(bossReadout(world));
    this.foesText.setText(`Địch còn: ${foesRemaining(world)}`);
    this.drawDots(world.setup.waves.length, world.spawnedWaves);
    this.drawCooldown();
    this.drawRing();
    this.refreshInfo(world);
  }

  /** The boss bar: name · phase above, HP fill below; hidden while there is no live boss. */
  private drawBoss(boss: BossReadout | null): void {
    const g = this.bossFill;
    g.clear();
    this.bossBar.image.setVisible(boss !== null);
    this.bossText.setVisible(boss !== null);
    if (boss === null) {
      if (this.bossShown) {
        this.bossShown = false;
        this.placeToasts();
      }
      return;
    }
    if (!this.bossShown) {
      this.bossShown = true;
      this.placeToasts();
    }
    this.bossText.setText(`${boss.nameVi} · ${boss.phase}  ${boss.hp}/${boss.maxHp}`);
    const bar = this.bossBar.image;
    const b = frameBorder(this, 'bar');
    const innerW = this.bossBar.width - 2 * b;
    const fraction = boss.maxHp > 0 ? Math.min(1, boss.hp / boss.maxHp) : 0;
    g.fillStyle(UI_PALETTE.bad, 1);
    g.fillRect(bar.x + b, bar.y + b, Math.max(1, Math.round(innerW * fraction)), BAR_H - 2 * b);
  }

  private placeToasts(): void {
    const c = this.lay.clock;
    const below = c.y + c.h + GAP * 2 + (this.bossShown ? BAR_H + 18 : 0);
    this.toasts.setAnchor(this.scale.width / 2, below, this.scale.width - 2 * MARGIN);
  }

  private drawHp(fraction: number): void {
    const bar = this.hpBar.image;
    const b = frameBorder(this, 'bar');
    const innerW = this.hpBar.width - 2 * b;
    const color =
      fraction > 0.5 ? UI_PALETTE.good : fraction > 0.25 ? UI_PALETTE.warn : UI_PALETTE.bad;
    const g = this.hpFill;
    g.clear();
    if (fraction <= 0) return;
    g.fillStyle(color, 1);
    g.fillRect(bar.x + b, bar.y + b, Math.max(1, Math.round(innerW * fraction)), BAR_H - 2 * b);
  }

  private drawDots(waves: number, spawned: number): void {
    const r = this.lay.foes;
    const g = this.dots;
    g.clear();
    const y = r.y + r.h - 14;
    const x0 = r.x + r.w / 2 - ((waves - 1) * DOT_GAP) / 2;
    for (let i = 0; i < waves; i++) {
      const x = x0 + i * DOT_GAP;
      g.fillStyle(UI_PALETTE.outline, 1);
      g.fillCircle(x, y, DOT_R + 1);
      g.fillStyle(i < spawned ? UI_PALETTE.gold : UI_PALETTE.creamDark, 1);
      g.fillCircle(x, y, DOT_R);
    }
  }

  private drawCooldown(): void {
    const g = this.cooldown;
    g.clear();
    const world = this.world;
    if (!world) return;
    const cd = interventionCooldown(world);
    const r = this.lay.intervene;
    if (this.ended) {
      this.cooldownText.setText('');
      return;
    }
    if (!cd.ready) {
      // Dark layer standing up from the bottom: its height is the wait still to go.
      const inset = frameBorder(this, 'button');
      const innerH = r.h - 2 * inset;
      const h = Math.max(1, Math.round(innerH * cd.fraction));
      g.fillStyle(UI_PALETTE.outline, 0.6);
      g.fillRect(r.x + inset, r.y + r.h - inset - h, r.w - 2 * inset, h);
    } else if (this.aiming) {
      g.lineStyle(2, UI_PALETTE.gold, 1);
      g.strokeRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);
    }
    this.cooldownText.setText(cd.ready ? '' : String(cd.seconds));
  }

  private drawRing(): void {
    const g = this.ring;
    g.clear();
    const at = this.aimAt;
    if (!this.aiming || !at) return;
    const radius = INTERVENTION.radius * battleZoom(this.scale.width, this.scale.height);
    const onField = battleWorldAt(at, this.screen()) !== null;
    g.lineStyle(3, UI_PALETTE.outline, 0.8);
    g.strokeCircle(at.x, at.y, radius);
    g.lineStyle(2, onField ? UI_PALETTE.gold : UI_PALETTE.bad, 1);
    g.strokeCircle(at.x, at.y, radius);
  }

  private showSpeed(speed: GameSpeed): void {
    this.speedButtons.forEach((b, i) => b.setActive(SPEEDS[i]!.speed === speed));
  }

  // ---- bảng thông tin nhà / lính (§10.7) ---------------------------------------------------

  /** A tap on the field while not aiming: open the info box of the entity under it, else close it. */
  private inspectAt(p: Point): void {
    const world = this.world;
    if (!world) return;
    const { zoom, scroll } = battleCamera(this.screen());
    const at = screenToWorld(p, scroll, this.screen(), zoom);
    const id = entityAt(world, at.x, at.y);
    if (id === null) {
      this.hideInfo();
      return;
    }
    this.inspected = id;
    this.info.show(entityInfoLines(world, id, CONTENT), p, this.screen());
  }

  private hideInfo(): void {
    this.inspected = null;
    this.info.hide();
  }

  /** Keep the open info box live (HP ticking down) and close it when its entity dies. */
  private refreshInfo(world: BattleWorld): void {
    const id = this.inspected;
    if (id === null) return;
    if (world.alive[id] !== 1) this.hideInfo();
    else this.info.setLines(entityInfoLines(world, id, CONTENT));
  }

  // ---- Tự bắn / các đợt địch -----------------------------------------------------------------

  private toggleAuto(): void {
    if (this.ended) return;
    this.bus.emit('ui:command', {
      command: { type: 'setAutoFire', on: !this.controller.state.autoFire },
    });
  }

  private openScout(): void {
    if (this.scoutModal) return;
    this.setAiming(false);
    const overlay = createOverlay(this);
    overlay.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => this.closeScout());
    const panel = new ScoutPanel(this, CONTENT);
    panel.setPlan(this.controller.state.army);
    const close = createButton(this, 0, 0, '✕', {
      width: SCOUT_CLOSE,
      height: SCOUT_CLOSE,
      fontSize: 20,
      onClick: () => this.closeScout(),
      tooltip: { host: this.tooltip, content: () => textContent(['Đóng (Esc)']) },
    });
    const root = this.add
      .container(0, 0, [overlay, panel.container, close.container])
      .setDepth(MODAL_DEPTH - 1);
    this.scoutModal = { root, overlay, panel, close };
    this.layoutScout();
  }

  private layoutScout(): void {
    const modal = this.scoutModal;
    if (!modal) return;
    fitOverlay(this, modal.overlay);
    const r = centredPanel(this.screen(), SCOUT_MODAL.w, SCOUT_MODAL.h);
    modal.panel.layout(r, 'full');
    modal.close.container.setPosition(r.x + r.w - SCOUT_CLOSE / 2 - 4, r.y + SCOUT_CLOSE / 2 + 4);
  }

  private closeScout(): void {
    if (!this.scoutModal) return;
    this.scoutModal.panel.destroy();
    this.scoutModal.root.destroy();
    this.scoutModal = null;
  }

  // ---- Can Thiệp ----------------------------------------------------------------------------

  private isReady(): boolean {
    return !this.ended && this.world !== null && interventionCooldown(this.world).ready;
  }

  private toggleAim(): void {
    if (this.aiming) this.setAiming(false);
    else if (this.isReady()) this.setAiming(true);
  }

  private setAiming(on: boolean): void {
    this.aiming = on;
    if (on && !this.aimAt) {
      const p = this.input.activePointer;
      this.aimAt = { x: p.x, y: p.y };
    }
    this.drawCooldown();
    this.drawRing();
  }

  /** Drop the boulder at screen point `p` (ignored off the field: keep aiming). */
  private drop(p: Point): void {
    const world = battleWorldAt(p, this.screen());
    if (!world || !this.isReady()) return;
    this.bus.emit('ui:intervene', { x: world.x, y: world.y });
    this.setAiming(false);
  }

  // ---- input ---------------------------------------------------------------------------------

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    const p = { x: pointer.x, y: pointer.y };
    const press = this.press;
    // Dragging out of the button aims (§10.7: drag from the button and release on the field).
    if (
      press?.fromButton &&
      pointer.id === press.id &&
      !this.aiming &&
      !inside(this.lay.intervene, p) &&
      pointer.getDistance() > DRAG_SLOP &&
      this.isReady()
    ) {
      this.setAiming(true);
    }
    this.aimAt = p;
    if (this.aiming) this.drawRing();
  }

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    const p = { x: pointer.x, y: pointer.y };
    this.press = { id: pointer.id, fromButton: inside(this.lay.intervene, p), ...p };
    this.aimAt = p;
    if (this.aiming) this.drawRing();
  }

  private onPointerUp(pointer: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]): void {
    const press = this.press;
    if (!press || press.id !== pointer.id) return;
    this.press = null;
    if (this.ended) return;
    const p = { x: pointer.x, y: pointer.y };
    if (!this.aiming) {
      const moved = (p.x - press.x) ** 2 + (p.y - press.y) ** 2 > DRAG_SLOP * DRAG_SLOP;
      if (!press.fromButton && !moved && over.length === 0) this.inspectAt(p);
      return;
    }
    if (press.fromButton) {
      // Released on the button = its own click (toggle); released elsewhere = drag-drop.
      if (!inside(this.lay.intervene, p) && over.length === 0) this.drop(p);
      return;
    }
    const dx = p.x - press.x;
    const dy = p.y - press.y;
    if (dx * dx + dy * dy > DRAG_SLOP * DRAG_SLOP || over.length > 0) return;
    this.drop(p);
  }

  private onKey(event: KeyboardEvent): void {
    if (event.repeat) return; // a held key acts once
    if (this.scoutModal) {
      if (event.key === 'Escape') this.closeScout();
      return;
    }
    if (this.ended) {
      if (this.summary && (event.key === 'Enter' || event.key === ' ')) this.continueRun();
      return;
    }
    switch (event.key) {
      case 'p':
      case 'P':
        this.bus.emit('ui:toggle-pause', {});
        break;
      case '1':
      case '2':
      case '3':
        this.bus.emit('ui:set-speed', { speed: Number(event.key) as GameSpeed });
        break;
      case ' ':
      case 'b':
      case 'B':
        this.toggleAim();
        break;
      case 'Escape':
        if (this.aiming) this.setAiming(false);
        break;
    }
  }

  // ---- end of battle ----------------------------------------------------------------------

  private onEnded(result: BattleResult): void {
    if (this.ended) return;
    this.ended = true;
    this.result = result;
    this.setAiming(false);
    this.intervene.setEnabled(false);
    this.autoBtn.setEnabled(false);
    this.hideInfo();
    for (const b of this.speedButtons) b.setEnabled(false);
    const box = createPanel(this, 'panel', 280, 72);
    box.image.setDepth(MODAL_DEPTH);
    const text = addUiText(
      this,
      0,
      0,
      result.won ? WIN_TEXT : LOSS_TEXT,
      32,
      result.won ? UI_PALETTE.text : UI_PALETTE.bad,
    )
      .setOrigin(0.5)
      .setFontStyle('bold')
      .setDepth(MODAL_DEPTH);
    this.banner = { box, text };
    this.layoutBanner();
    this.bannerTimer = this.time.delayedCall(BANNER_MS, () => {
      this.bannerTimer = null;
      this.destroyBanner();
      this.showSummary();
    });
  }

  private destroyBanner(): void {
    this.banner?.box.image.destroy();
    this.banner?.text.destroy();
    this.banner = null;
  }

  private showSummary(): void {
    const result = this.result;
    if (!result) return;
    const overlay = createOverlay(this).setDepth(MODAL_DEPTH);
    const panel = createPanel(this, 'panel', 320, 240);
    panel.image.setDepth(MODAL_DEPTH);
    const title = addUiText(
      this,
      0,
      0,
      result.won ? WIN_TEXT : LOSS_TEXT,
      26,
      result.won ? UI_PALETTE.text : UI_PALETTE.bad,
    )
      .setOrigin(0.5)
      .setFontStyle('bold')
      .setDepth(MODAL_DEPTH);
    const state = this.controller.state;
    const lines = summaryLines({
      kills: result.kills,
      lives: state.lives,
      time: tickClock(result.ticks),
      goldGain: Math.max(0, state.gold - this.goldAtStart),
      conquered: state.pendingConquest === null ? null : CONTENT.enemyKing(state.pendingConquest).nameVi,
    }).map((line) => addUiText(this, 0, 0, line, 18).setOrigin(0.5).setDepth(MODAL_DEPTH));
    const next = createButton(this, 0, 0, 'Tiếp tục', {
      width: RESULT_BUTTON.w,
      height: RESULT_BUTTON.h,
      fontSize: 18,
      onClick: () => this.continueRun(),
      tooltip: { host: this.tooltip, content: () => textContent(['Tiếp tục (Enter)']) },
    });
    next.container.setDepth(MODAL_DEPTH);
    this.summary = { overlay, panel, title, lines, next };
    this.layoutSummary();
  }

  private continueRun(): void {
    if (this.continued) return;
    this.continued = true;
    this.bus.emit('ui:continue', {});
  }

  // ---- layout -------------------------------------------------------------------------------

  private screen(): { w: number; h: number } {
    return { w: this.scale.width, h: this.scale.height };
  }

  private currentLayout(): BattleLayout {
    return battleLayout(this.screen());
  }

  private layout(): void {
    const l = (this.lay = this.currentLayout());
    const desktop = isDesktop(this.scale.width);

    this.livesBox.resize(l.lives.w, l.lives.h);
    this.livesBox.image.setPosition(l.lives.x, l.lives.y);
    const midY = l.lives.y + l.lives.h / 2;
    const iconX = l.lives.x + 12;
    this.livesIcon?.setPosition(iconX, midY);
    this.livesText.setPosition(iconX + (this.livesIcon ? 36 : 0), midY);
    this.goldBox.resize(l.gold.w, l.gold.h);
    this.goldBox.image.setPosition(l.gold.x, l.gold.y);
    this.goldIcon?.setPosition(l.gold.x + 12, l.gold.y + l.gold.h / 2);
    this.goldText.setPosition(l.gold.x + 12 + (this.goldIcon ? 36 : 0), l.gold.y + l.gold.h / 2);

    const c = l.clock;
    this.clockBox.resize(c.w, c.h);
    this.clockBox.image.setPosition(c.x, c.y);
    const inset = frameBorder(this, 'panel') + 4;
    this.clockText.setPosition(c.x + inset + 4, c.y + c.h / 2);
    const barX = c.x + inset + CLOCK_TEXT_W;
    this.hpBar.resize(c.x + c.w - inset - barX, BAR_H);
    this.hpBar.image.setPosition(barX, Math.round(c.y + (c.h - BAR_H) / 2));

    const f = l.foes;
    this.foesBox.resize(f.w, f.h);
    this.foesBox.image.setPosition(f.x, f.y);
    this.foesText.setPosition(f.x + f.w / 2, f.y + frameBorder(this, 'panel') + 2);
    this.foesText.setFontSize(desktop ? 15 : 14);

    this.speedButtons.forEach((b, i) => {
      const r = l.speed[i]!;
      b.container.setPosition(r.x + r.w / 2, r.y + r.h / 2);
    });
    const iv = l.intervene;
    this.intervene.container.setPosition(iv.x + iv.w / 2, iv.y + iv.h / 2);
    this.cooldownText.setPosition(iv.x + iv.w / 2, iv.y + iv.h / 2);
    const au = l.auto;
    this.autoBtn.container.setPosition(au.x + au.w / 2, au.y + au.h / 2);
    const wv = l.waves;
    this.wavesBtn.container.setPosition(wv.x + wv.w / 2, wv.y + wv.h / 2);
    this.layoutScout();
    this.info.layout(this.screen());

    this.bossBar.resize(c.w, BAR_H);
    this.bossBar.image.setPosition(c.x, c.y + c.h + GAP + 14);
    this.bossText.setPosition(c.x + c.w / 2, c.y + c.h + GAP);
    this.placeToasts();
    this.tooltip.refresh();
    this.layoutBanner();
    this.layoutSummary();
    this.refresh();
  }

  private layoutBanner(): void {
    const banner = this.banner;
    if (!banner) return;
    const w = Math.min(
      this.scale.width - 2 * MARGIN,
      Math.ceil(banner.text.width) + 2 * (PAD + 12),
    );
    const r = centredPanel(this.screen(), w, 72);
    banner.box.resize(r.w, r.h);
    banner.box.image.setPosition(r.x, r.y);
    banner.text.setPosition(r.x + r.w / 2, r.y + r.h / 2);
  }

  private layoutSummary(): void {
    const s = this.summary;
    if (!s) return;
    fitOverlay(this, s.overlay);
    const inset = frameBorder(this, 'panel') + PAD;
    const l = resultLayout(this.screen(), inset, s.lines.length, 1);
    s.panel.resize(l.panel.w, l.panel.h);
    s.panel.image.setPosition(l.panel.x, l.panel.y);
    s.title.setPosition(l.title.x + l.title.w / 2, l.title.y + l.title.h / 2);
    s.lines.forEach((t, i) => {
      const r = l.lines[i]!;
      t.setPosition(r.x + r.w / 2, r.y + r.h / 2);
    });
    const b = l.buttons[0]!;
    s.next.container.setPosition(b.x + b.w / 2, b.y + b.h / 2);
  }

  private teardown(): void {
    for (const off of this.offs) off();
    this.offs = [];
    this.input.keyboard?.off(Phaser.Input.Keyboard.Events.ANY_KEY_DOWN, this.onKey, this);
    this.input.off(Phaser.Input.Events.POINTER_MOVE, this.onPointerMove, this);
    this.input.off(Phaser.Input.Events.POINTER_DOWN, this.onPointerDown, this);
    this.input.off(Phaser.Input.Events.POINTER_UP, this.onPointerUp, this);
    this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this);
    this.bannerTimer?.remove(false);
    this.bannerTimer = null;
    this.closeScout();
    this.info.destroy();
    this.toasts.destroy();
    this.tooltip.destroy();
    this.world = null;
    this.summary = null;
    this.banner = null;
  }
}
