import { hasComponent, query } from 'bitecs';
import Phaser from 'phaser';
import type { EventBus, GameEvents, OrderTool } from '../core/events';
import { BUILDINGS, BUILDING_IDS, PLAYER_BUILDINGS, type BuildingId } from '../data/buildings';
import { DOODADS, DOODAD_IDS } from '../data/doodads';
import { PALETTE, toCss } from '../data/palette';
import { RESOURCES, RESOURCE_IDS, type ResourceId } from '../data/resources';
import type { TerrainDef } from '../data/terrain';
import { SPRITES_KEY, buildingFrame, iconFrame } from '../render/atlas';
import { carryOf, colonistAt, colonistName } from '../sim/colony/colonists';
import { designationOf } from '../sim/colony/designation';
import { Building, Colonist, Dead, Doodad, Needs } from '../sim/components';
import { entityAt, type GameWorld } from '../sim/GameWorld';
import type { JobKind } from '../sim/jobs/types';
import type { PlacementProblem } from '../sim/placement';
import { TICKS_PER_SECOND, type GameSpeed } from '../sim/SimClock';
import { createButton, FONT_DEBUG, textStyle, TOUCH_TARGET, type Button } from '../ui/theme';
import { SCENES } from './keys';
import type { HudSceneData } from './WorldScene';

const SPEED_LABELS: Record<GameSpeed, string> = { 0: '❚❚', 1: '1×', 2: '2×', 3: '3×' };
const MARGIN = 12;
const GAP = 6;
const TOOL_BUTTON = { w: 46, h: 60 };
const CARD = { w: 150, h: 30 };
const LOG_LINES = 3;
const LOG_TTL_MS = 8_000;

type Tab = 'orders' | 'build';

const ORDER_TOOLS: { tool: Exclude<OrderTool, 'wall'>; label: string }[] = [
  { tool: 'chop', label: 'Chặt' },
  { tool: 'mine', label: 'Đào' },
  { tool: 'forage', label: 'Hái' },
  { tool: 'clear', label: 'Bỏ dấu' },
];

/** Placement problems, phrased as what to do about them. */
const PLACEMENT_HELP: Record<PlacementProblem, string> = {
  outOfBounds: 'Quá sát mép bản đồ — dời vào trong.',
  terrain: 'Nền này không xây được — chọn chỗ đất khô.',
  building: 'Chồng lên công trình khác — dời ra một chút.',
  doodad: 'Vướng cây hoặc đá — chọn chỗ trống khác.',
  outOfTerritory: 'Ngoài lãnh thổ — đặt gần Lửa Thiêng hơn.',
};

const TOOL_HINTS: Record<OrderTool, { mouse: string; touch: string }> = {
  chop: {
    mouse: 'Kéo khung quanh cây chết để chặt.',
    touch: 'Chạm vào cây chết để đánh dấu chặt.',
  },
  mine: { mouse: 'Kéo khung quanh tảng đá để đào.', touch: 'Chạm vào tảng đá để đánh dấu đào.' },
  forage: {
    mouse: 'Kéo khung quanh nấm phát quang để hái.',
    touch: 'Chạm vào nấm để đánh dấu hái.',
  },
  clear: { mouse: 'Kéo khung để bỏ đánh dấu.', touch: 'Chạm vào vật đã đánh dấu để bỏ.' },
  wall: {
    mouse: 'Nhấn và kéo để vẽ tường. Chuột phải để thôi.',
    touch: 'Chạm điểm đầu, chạm điểm cuối, rồi bấm Đặt.',
  },
};

const JOB_LABELS: Record<JobKind, string> = {
  harvest: 'Đang khai thác',
  haulToDrop: 'Đang vác hàng về kho',
  deliver: 'Đang chở vật liệu',
  construct: 'Đang xây',
  eat: 'Đang ăn',
  sleep: 'Đang ngủ',
  idle: 'Đang nghỉ',
};

const HARVEST_LABELS = { chop: 'Đang chặt cây', mine: 'Đang đào đá', forage: 'Đang hái nấm' };

const describeTerrain = (t: TerrainDef): string[] => {
  const lines = [t.nameVi];
  if (!t.passable) lines.push('Không đi qua được');
  else if (t.speed === 1) lines.push('Đi lại bình thường');
  else lines.push(`Đi chậm, tốc độ ×${t.speed}`);
  lines.push(t.buildable ? 'Xây được' : 'Không xây được');
  if (t.defenseBonus) {
    lines.push(`Phòng thủ ${t.defenseBonus > 0 ? '+' : ''}${t.defenseBonus} khi đứng ở đây`);
  }
  return lines;
};

interface ColonistCard {
  container: Phaser.GameObjects.Container;
  name: Phaser.GameObjects.Text;
  job: Phaser.GameObjects.Text;
  bars: Phaser.GameObjects.Graphics;
}

/**
 * Screen-space overlay (camera zoom 1, never scrolls). Reads world state for display
 * and sends player intents back through the bus — it never mutates the simulation.
 */
export class HudScene extends Phaser.Scene {
  private bus!: EventBus<GameEvents>;
  private world!: GameWorld;
  private isTouch = false;
  private status!: Phaser.GameObjects.Text;
  private debugLine!: Phaser.GameObjects.Text;
  private resources = new Map<ResourceId, Phaser.GameObjects.Text>();
  private resourceIcons: Phaser.GameObjects.Image[] = [];
  private cards = new Map<number, ColonistCard>();
  private info!: Phaser.GameObjects.Text;
  private infoBg!: Phaser.GameObjects.Rectangle;
  private message!: Phaser.GameObjects.Text;
  private logText!: Phaser.GameObjects.Text;
  private log: { text: string; at: number }[] = [];
  private speedButtons = new Map<GameSpeed, Button>();
  private tabButton!: Button;
  private orderButtons = new Map<OrderTool, Button>();
  private buildButtons = new Map<BuildingId | 'wall', Button>();
  private snapButton!: Button;
  private confirmButtons: Button[] = [];
  private zoomButtons: Button[] = [];
  private tab: Tab = 'orders';
  private cursor: { x: number; y: number } | null = null;
  private selected: number | null = null;
  private zoom = 1;
  private buildKind: BuildingId | null = null;
  private tool: OrderTool | null = null;
  private pending = false;
  private unsubscribers: (() => void)[] = [];

  constructor() {
    super(SCENES.hud);
  }

  create({ bus, world, initialZoom, isTouch }: HudSceneData): void {
    // Scene instances are reused between games; reset per-game state.
    this.bus = bus;
    this.world = world;
    this.isTouch = isTouch;
    this.zoom = initialZoom;
    this.cursor = null;
    this.selected = null;
    this.buildKind = null;
    this.tool = null;
    this.pending = false;
    this.tab = 'orders';
    this.log = [];
    this.cards = new Map();
    this.resources = new Map();
    this.resourceIcons = [];
    this.orderButtons = new Map();
    this.buildButtons = new Map();
    this.speedButtons = new Map();

    this.status = this.add.text(MARGIN, MARGIN, '', textStyle(15, PALETTE.parchment));
    this.status.setShadow(1, 1, '#000', 0);
    // FPS / seed / coordinates: developer readout, hidden in production builds.
    this.debugLine = this.add
      .text(MARGIN, 0, '', textStyle(10, PALETTE.ashGrey, FONT_DEBUG))
      .setVisible(import.meta.env.DEV);

    for (const r of RESOURCE_IDS) {
      this.resourceIcons.push(
        this.add.image(0, 0, SPRITES_KEY, iconFrame(r)).setScale(2).setOrigin(0, 0.5),
      );
      this.resources.set(r, this.add.text(0, 0, '', textStyle(14, PALETTE.bone)).setOrigin(0, 0.5));
    }

    this.infoBg = this.add
      .rectangle(0, 0, 10, 10, PALETTE.ink, 0.85)
      .setOrigin(0, 0)
      .setStrokeStyle(1, PALETTE.shadowPlum);
    this.info = this.add.text(0, 0, '', { ...textStyle(14), lineSpacing: 3 });

    this.logText = this.add
      .text(0, 0, '', { ...textStyle(13, PALETTE.boneGrey), lineSpacing: 2 })
      .setOrigin(0, 1)
      .setShadow(1, 1, '#000', 0);
    this.message = this.add
      .text(0, 0, '', { ...textStyle(14, PALETTE.bone), wordWrap: { width: 300 } })
      .setOrigin(0, 1)
      .setShadow(1, 1, '#000', 0);

    this.createButtons();
    this.subscribe();

    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this);
      for (const off of this.unsubscribers) off();
    });

    for (const [s, button] of this.speedButtons) button.setActive(s === world.clock.speed);
    this.refreshStatus();
    this.refreshResources();
    this.refreshCards();
    this.refreshInfo();
    this.showTab('orders');
  }

  update(time: number): void {
    const c = this.cursor;
    this.debugLine.setText(
      `${Math.round(this.game.loop.actualFps)} fps   zoom ${this.zoom}×   seed ${this.world.seed}` +
        (c ? `   x ${c.x} y ${c.y}` : ''),
    );
    const before = this.log.length;
    this.log = this.log.filter((l) => time - l.at < LOG_TTL_MS);
    if (this.log.length !== before) this.refreshLog();
  }

  // --- construction -------------------------------------------------------------------

  private createButtons(): void {
    for (const speed of [0, 1, 2, 3] as const) {
      this.speedButtons.set(
        speed,
        createButton(this, 0, 0, SPEED_LABELS[speed], {
          fontSize: 14,
          onClick: () =>
            speed === 0
              ? this.bus.emit('ui:toggle-pause', {})
              : this.bus.emit('ui:set-speed', { speed }),
        }),
      );
    }

    this.tabButton = createButton(this, 0, 0, '', {
      width: TOOL_BUTTON.w,
      height: TOOL_BUTTON.h,
      fontSize: 12,
      onClick: () => this.showTab(this.tab === 'orders' ? 'build' : 'orders'),
    });

    for (const { tool, label } of ORDER_TOOLS) {
      this.orderButtons.set(
        tool,
        createButton(this, 0, 0, label, {
          width: TOOL_BUTTON.w,
          height: TOOL_BUTTON.h,
          fontSize: 12,
          icon: { key: SPRITES_KEY, frame: iconFrame(tool), scale: 2 },
          onClick: () => this.bus.emit('ui:tool', { tool }),
        }),
      );
    }
    for (const id of PLAYER_BUILDINGS) {
      this.buildButtons.set(
        id,
        createButton(this, 0, 0, BUILDINGS[id].nameVi, {
          width: TOOL_BUTTON.w,
          height: TOOL_BUTTON.h,
          fontSize: 11,
          icon: { key: SPRITES_KEY, frame: buildingFrame(id) },
          onClick: () => this.bus.emit('ui:build', { kind: id }),
        }),
      );
    }
    this.buildButtons.set(
      'wall',
      createButton(this, 0, 0, 'Tường', {
        width: TOOL_BUTTON.w,
        height: TOOL_BUTTON.h,
        fontSize: 11,
        icon: { key: SPRITES_KEY, frame: iconFrame('wall'), scale: 2 },
        onClick: () => this.bus.emit('ui:tool', { tool: 'wall' }),
      }),
    );

    this.snapButton = createButton(this, 0, 0, 'Bám lưới', {
      width: 84,
      fontSize: 13,
      onClick: () => this.bus.emit('ui:toggle-snap', {}),
    });
    this.confirmButtons = [
      createButton(this, 0, 0, 'Đặt', {
        width: 64,
        fontSize: 15,
        onClick: () => this.bus.emit('ui:build-confirm', {}),
      }),
      createButton(this, 0, 0, 'Huỷ', {
        width: 64,
        fontSize: 15,
        onClick: () => this.bus.emit('ui:build-cancel', {}),
      }),
    ];
    this.confirmButtons[0]!.setActive(true);

    this.zoomButtons = [
      createButton(this, 0, 0, '+', {
        fontSize: 20,
        onClick: () => this.bus.emit('ui:zoom-step', { direction: 1 }),
      }),
      createButton(this, 0, 0, '−', {
        fontSize: 20,
        onClick: () => this.bus.emit('ui:zoom-step', { direction: -1 }),
      }),
    ];
  }

  private subscribe(): void {
    const { bus } = this;
    this.unsubscribers = [
      bus.on('cursor:move', (p) => {
        this.cursor = p;
        this.refreshInfo();
      }),
      bus.on('entity:select', ({ eid }) => {
        this.selected = eid;
        this.refreshInfo();
      }),
      bus.on('camera:zoom', ({ zoom }) => {
        this.zoom = zoom;
      }),
      bus.on('clock:speed', ({ speed }) => {
        for (const [s, button] of this.speedButtons) button.setActive(s === speed);
        this.refreshStatus();
      }),
      bus.on('clock:tick', () => {
        this.refreshStatus();
        this.refreshCards();
        if (this.selected !== null) this.refreshInfo();
      }),
      bus.on('stock:changed', () => this.refreshResources()),
      bus.on('log', ({ text }) => {
        this.log.push({ text, at: this.time.now });
        this.log = this.log.slice(-LOG_LINES);
        this.refreshLog();
      }),
      bus.on('build:mode', ({ kind, snap }) => {
        this.buildKind = kind;
        this.pending = false;
        if (kind) this.showTab('build');
        for (const [id, button] of this.buildButtons) button.setActive(id === kind);
        this.snapButton.setActive(snap);
        this.setHint();
        this.layout();
      }),
      bus.on('tool:changed', ({ tool }) => {
        this.tool = tool;
        this.pending = false;
        if (tool === 'wall') this.showTab('build');
        else if (tool) this.showTab('orders');
        for (const [t, button] of this.orderButtons) button.setActive(t === tool);
        this.buildButtons.get('wall')?.setActive(tool === 'wall');
        this.setHint();
        this.layout();
      }),
      bus.on('build:status', ({ ok, reason, pending }) => {
        if (!this.buildKind && this.tool !== 'wall') return;
        this.pending = pending;
        if (!ok && reason)
          this.message.setColor(toCss(PALETTE.flame)).setText(PLACEMENT_HELP[reason]);
        else this.setHint();
        this.layout();
      }),
      bus.on('build:placed', ({ kind }) => {
        this.pending = false;
        this.message
          .setColor(toCss(PALETTE.ghostGreen))
          .setText(`Đã đặt ${BUILDINGS[kind].nameVi}.`);
        this.layout();
      }),
    ];
  }

  // --- toolbar ------------------------------------------------------------------------

  private showTab(tab: Tab): void {
    this.tab = tab;
    // The tab button switches to the *other* group.
    const other = tab === 'orders' ? 'Xây' : 'Lệnh';
    this.tabButton.setLabel(`⇄\n${other}`);
    for (const b of this.orderButtons.values()) b.setVisible(tab === 'orders');
    for (const b of this.buildButtons.values()) b.setVisible(tab === 'build');
    this.layout();
  }

  private setHint(): void {
    let text = '';
    if (this.buildKind) {
      const name = BUILDINGS[this.buildKind].nameVi;
      text = this.isTouch
        ? `Chạm vào bản đồ để đặt ${name}, rồi bấm Đặt.`
        : `Nhấp để đặt ${name}. Giữ Shift để bám lưới, chuột phải để thôi.`;
    } else if (this.tool) {
      text = this.isTouch ? TOOL_HINTS[this.tool].touch : TOOL_HINTS[this.tool].mouse;
    }
    this.message.setColor(toCss(PALETTE.bone)).setText(text);
  }

  // --- layout -------------------------------------------------------------------------

  private layout(): void {
    const { width, height } = this.scale;
    const speedBarWidth = 4 * (TOUCH_TARGET + GAP);
    this.status.setWordWrapWidth(Math.max(120, width - speedBarWidth - MARGIN * 3));
    this.debugLine.setY(this.status.y + this.status.height + 2);

    [0, 1, 2, 3].forEach((speed, i) => {
      const x = width - MARGIN - TOUCH_TARGET / 2 - (3 - i) * (TOUCH_TARGET + GAP);
      this.speedButtons
        .get(speed as GameSpeed)
        ?.container.setPosition(x, MARGIN + TOUCH_TARGET / 2);
    });

    // Resources, then colonist cards, under the status line.
    const above = this.debugLine.visible ? this.debugLine : this.status;
    const resY = above.y + above.height + 14;
    let x = MARGIN;
    RESOURCE_IDS.forEach((r, i) => {
      this.resourceIcons[i]!.setPosition(x, resY);
      const text = this.resources.get(r)!;
      text.setPosition(x + 20, resY);
      x += 20 + text.width + 14;
    });
    let cardY = resY + 14;
    for (const card of this.cards.values()) {
      card.container.setPosition(MARGIN, cardY);
      cardY += CARD.h + 4;
    }

    // Zoom: bottom-right, stacked.
    this.zoomButtons.forEach((button, i) => {
      button.container.setPosition(
        width - MARGIN - TOUCH_TARGET / 2,
        height - MARGIN - TOUCH_TARGET / 2 - (1 - i) * (TOUCH_TARGET + GAP),
      );
    });

    // Toolbar: tab button + the visible group, bottom-left.
    const barY = height - MARGIN - TOOL_BUTTON.h / 2;
    const step = TOOL_BUTTON.w + GAP;
    this.tabButton.container.setPosition(MARGIN + TOOL_BUTTON.w / 2, barY);
    const group =
      this.tab === 'orders' ? [...this.orderButtons.values()] : [...this.buildButtons.values()];
    group.forEach((b, i) =>
      b.container.setPosition(MARGIN + TOOL_BUTTON.w / 2 + (i + 1) * step, barY),
    );
    const barTop = height - MARGIN - TOOL_BUTTON.h;

    // Placement row: snap (building only) + Đặt/Huỷ (touch pending only).
    const rowY = barTop - GAP - TOUCH_TARGET / 2;
    const showSnap = this.buildKind !== null;
    this.snapButton.setVisible(showSnap);
    for (const b of this.confirmButtons) b.setVisible(this.pending);
    let rowX = MARGIN;
    if (showSnap) {
      this.snapButton.container.setPosition(rowX + 42, rowY);
      rowX += 84 + GAP;
    }
    this.confirmButtons.forEach((b, i) =>
      b.container.setPosition(rowX + 32 + i * (64 + GAP), rowY),
    );
    const rowShown = showSnap || this.pending;
    const messageBottom = rowShown ? rowY - TOUCH_TARGET / 2 - GAP : barTop - GAP;
    const textWidth = Math.min(420, width - MARGIN * 3 - TOUCH_TARGET);
    this.message.setWordWrapWidth(textWidth).setPosition(MARGIN, messageBottom);
    this.logText
      .setWordWrapWidth(textWidth)
      .setPosition(MARGIN, messageBottom - (this.message.text ? this.message.height + 4 : 0));

    this.positionInfo();
  }

  /** Info panel: top-right under the speed buttons, never over the colonist cards. */
  private positionInfo(): void {
    const pad = 8;
    const { width } = this.scale;
    const maxWidth = Math.min(260, width - MARGIN * 3 - CARD.w) - pad * 2;
    this.info.setWordWrapWidth(Math.max(80, maxWidth));
    const top = MARGIN + TOUCH_TARGET + GAP;
    const left = width - MARGIN - this.info.width - pad * 2;
    this.info.setPosition(left + pad, top + pad);
    this.infoBg
      .setPosition(left, top)
      .setSize(this.info.width + pad * 2, this.info.height + pad * 2)
      .setVisible(this.info.text.length > 0);
  }

  // --- content ------------------------------------------------------------------------

  private refreshStatus(): void {
    const { clock } = this.world;
    const seconds = Math.floor(clock.tick / TICKS_PER_SECOND);
    const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
    const ss = String(seconds % 60).padStart(2, '0');
    const state = clock.paused ? 'đang tạm dừng' : `đang chạy ${clock.speed}×`;
    this.status.setText(`Ngày 1, ${mm}:${ss} — ${state}`);
  }

  private refreshResources(): void {
    const stock = this.world.stock.snapshot();
    for (const r of RESOURCE_IDS) this.resources.get(r)!.setText(String(stock[r]));
    this.layout();
  }

  private refreshLog(): void {
    this.logText.setText(this.log.map((l) => l.text).join('\n'));
  }

  private jobLabel(eid: number): string {
    if (hasComponent(this.world.ecs, eid, Dead)) return 'Đã mất';
    const job = this.world.jobs.get(eid);
    if (!job) return JOB_LABELS.idle;
    if (job.kind === 'harvest' && this.world.obstacles.has(job.target)) {
      const tool = designationOf(this.world, job.target);
      if (tool) return HARVEST_LABELS[tool];
    }
    return JOB_LABELS[job.kind];
  }

  private refreshCards(): void {
    let added = false;
    for (const eid of queryColonists(this.world)) {
      let card = this.cards.get(eid);
      if (!card) {
        card = this.createCard(eid);
        this.cards.set(eid, card);
        added = true;
      }
      const dead = hasComponent(this.world.ecs, eid, Dead);
      card.job.setText(this.jobLabel(eid));
      card.name.setColor(toCss(dead ? PALETTE.ashGrey : PALETTE.bone));
      const g = card.bars.clear();
      if (!dead) {
        const barW = 56;
        g.fillStyle(PALETTE.ink, 1).fillRect(90, 6, barW, 3).fillRect(90, 13, barW, 3);
        g.fillStyle(PALETTE.ember, 1).fillRect(90, 6, (barW * Needs.hunger[eid]!) / 100, 3);
        g.fillStyle(PALETTE.veilViolet, 1).fillRect(90, 13, (barW * Needs.rest[eid]!) / 100, 3);
      }
    }
    if (added) this.layout();
  }

  private createCard(eid: number): ColonistCard {
    const bg = this.add
      .rectangle(0, 0, CARD.w, CARD.h, PALETTE.ink, 0.8)
      .setOrigin(0, 0)
      .setStrokeStyle(1, PALETTE.shadowPlum);
    const name = this.add.text(6, 3, colonistName(eid), textStyle(12, PALETTE.bone));
    const job = this.add.text(6, 16, '', textStyle(10, PALETTE.ashGrey));
    const bars = this.add.graphics();
    const container = this.add.container(0, 0, [bg, name, job, bars]);
    bg.setInteractive({ useHandCursor: true }).on('pointerup', () =>
      this.bus.emit('ui:focus-colonist', { eid }),
    );
    return { container, name, job, bars };
  }

  private refreshInfo(): void {
    this.info.setText(this.describe().join('\n'));
    this.positionInfo();
  }

  /** Selected thing first; otherwise whatever is under the mouse. */
  private describe(): string[] {
    const { world } = this;
    if (this.selected !== null) return this.describeEntity(this.selected);
    const c = this.cursor;
    if (!c) return [];
    const hovered = colonistAt(world, c.x, c.y) ?? entityAt(world, c.x, c.y);
    if (hovered !== null) return this.describeEntity(hovered);
    return describeTerrain(world.terrain.atWorld(c.x, c.y));
  }

  private describeEntity(eid: number): string[] {
    const { world } = this;
    if (hasComponent(world.ecs, eid, Colonist)) {
      const lines = [colonistName(eid), this.jobLabel(eid)];
      if (hasComponent(world.ecs, eid, Dead)) return lines;
      lines.push(`No bụng ${Math.round(Needs.hunger[eid]!)}/100`);
      lines.push(`Tỉnh táo ${Math.round(Needs.rest[eid]!)}/100`);
      lines.push(`Sức khoẻ ${Math.round(Needs.health[eid]!)}/100`);
      const carried = carryOf(eid);
      if (carried)
        lines.push(
          `Đang mang ${carried.amount} ${RESOURCES[carried.resource].nameVi.toLowerCase()}`,
        );
      return lines;
    }
    if (hasComponent(world.ecs, eid, Doodad)) {
      const def = DOODADS[DOODAD_IDS[Doodad.kind[eid]!]!];
      const lines = [def.nameVi];
      if (def.yields) {
        lines.push(
          `Khai thác được ${def.yields.amount} ${RESOURCES[def.yields.resource].nameVi.toLowerCase()}`,
        );
      }
      const tool = designationOf(world, eid);
      if (tool) lines.push('Đã đánh dấu');
      lines.push(def.blocksMovement ? 'Chắn đường đi' : 'Đi xuyên qua được');
      return lines;
    }
    if (hasComponent(world.ecs, eid, Building)) {
      const def = BUILDINGS[BUILDING_IDS[Building.kind[eid]!]!];
      return [def.nameVi, 'Công trình của bạn'];
    }
    return [];
  }
}

/** All colonists, alive or dead (cards stay to show who was lost). */
const queryColonists = (world: GameWorld): readonly number[] =>
  Array.from(query(world.ecs, [Colonist]));
