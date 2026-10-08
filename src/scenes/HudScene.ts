import Phaser from 'phaser';
import type { EventBus, GameEvents } from '../core/events';
import { BUILDINGS, BUILDING_IDS, PLAYER_BUILDINGS, type BuildingId } from '../data/buildings';
import { DOODADS, DOODAD_IDS } from '../data/doodads';
import { PALETTE, toCss } from '../data/palette';
import { RESOURCES } from '../data/resources';
import type { TerrainDef } from '../data/terrain';
import { SPRITES_KEY, buildingFrame } from '../render/atlas';
import { hasComponent } from 'bitecs';
import { Building, Doodad } from '../sim/components';
import { entityAt, type GameWorld } from '../sim/GameWorld';
import type { PlacementProblem } from '../sim/placement';
import { TICKS_PER_SECOND, type GameSpeed } from '../sim/SimClock';
import { createButton, FONT_DEBUG, textStyle, TOUCH_TARGET, type Button } from '../ui/theme';
import { SCENES } from './keys';
import type { HudSceneData } from './WorldScene';

const SPEED_LABELS: Record<GameSpeed, string> = { 0: '❚❚', 1: '1×', 2: '2×', 3: '3×' };
const MARGIN = 12;
const GAP = 6;
const BUILD_BUTTON = { w: 64, h: 68 };

/** Placement problems, phrased as what to do about them. */
const PLACEMENT_HELP: Record<PlacementProblem, string> = {
  outOfBounds: 'Quá sát mép bản đồ — dời vào trong.',
  terrain: 'Nền này không xây được — chọn chỗ đất khô.',
  building: 'Chồng lên công trình khác — dời ra một chút.',
  doodad: 'Vướng cây hoặc đá — chọn chỗ trống khác.',
  outOfTerritory: 'Ngoài lãnh thổ — đặt gần Lửa Thiêng hơn.',
};

const describeTerrain = (t: TerrainDef): string[] => {
  const lines = [t.nameVi];
  if (!t.passable) lines.push('Không đi qua được');
  else if (t.speed === 1) lines.push('Đi lại bình thường');
  else lines.push(`Đi chậm, tốc độ ×${t.speed}`);
  lines.push(t.buildable ? 'Xây được' : 'Không xây được');
  if (t.defenseBonus)
    lines.push(`Phòng thủ ${t.defenseBonus > 0 ? '+' : ''}${t.defenseBonus} khi đứng ở đây`);
  return lines;
};

/**
 * Screen-space overlay (camera zoom 1, never scrolls). Displays world state and sends
 * player intents back through the bus — it never touches the simulation directly.
 */
export class HudScene extends Phaser.Scene {
  private bus!: EventBus<GameEvents>;
  private world!: GameWorld;
  private isTouch = false;
  private status!: Phaser.GameObjects.Text;
  private debugLine!: Phaser.GameObjects.Text;
  private info!: Phaser.GameObjects.Text;
  private infoBg!: Phaser.GameObjects.Rectangle;
  private message!: Phaser.GameObjects.Text;
  private speedButtons = new Map<GameSpeed, Button>();
  private buildButtons = new Map<BuildingId, Button>();
  private snapButton!: Button;
  private confirmButtons: Button[] = [];
  private zoomButtons: Button[] = [];
  private cursor: { x: number; y: number } | null = null;
  private selected: number | null = null;
  private zoom = 1;
  private buildKind: BuildingId | null = null;
  private unsubscribers: (() => void)[] = [];

  constructor() {
    super(SCENES.hud);
  }

  create({ bus, world, initialZoom, isTouch }: HudSceneData): void {
    this.bus = bus;
    this.world = world;
    this.isTouch = isTouch;
    this.zoom = initialZoom;
    this.cursor = null;
    this.selected = null;
    this.buildKind = null;

    this.status = this.add.text(MARGIN, MARGIN, '', textStyle(15, PALETTE.parchment));
    this.status.setShadow(1, 1, '#000', 0);
    // FPS / seed / coordinates: developer readout, hidden in production builds.
    this.debugLine = this.add
      .text(MARGIN, 0, '', textStyle(10, PALETTE.ashGrey, FONT_DEBUG))
      .setVisible(import.meta.env.DEV);

    this.infoBg = this.add
      .rectangle(0, 0, 10, 10, PALETTE.ink, 0.85)
      .setOrigin(0, 0)
      .setStrokeStyle(1, PALETTE.shadowPlum);
    this.info = this.add.text(0, 0, '', { ...textStyle(14), lineSpacing: 3 });

    this.message = this.add
      .text(0, 0, '', { ...textStyle(14, PALETTE.bone), wordWrap: { width: 300 } })
      .setOrigin(0, 1)
      .setShadow(1, 1, '#000', 0);

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

    for (const id of PLAYER_BUILDINGS) {
      this.buildButtons.set(
        id,
        createButton(this, 0, 0, BUILDINGS[id].nameVi, {
          width: BUILD_BUTTON.w,
          height: BUILD_BUTTON.h,
          fontSize: 13,
          icon: { key: SPRITES_KEY, frame: buildingFrame(id) },
          onClick: () => this.bus.emit('ui:build', { kind: id }),
        }),
      );
    }
    this.snapButton = createButton(this, 0, 0, 'Bám\nlưới', {
      width: BUILD_BUTTON.w,
      height: BUILD_BUTTON.h,
      fontSize: 13,
      onClick: () => this.bus.emit('ui:toggle-snap', {}),
    });
    this.confirmButtons = [
      createButton(this, 0, 0, 'Đặt', {
        width: 72,
        fontSize: 15,
        onClick: () => this.bus.emit('ui:build-confirm', {}),
      }),
      createButton(this, 0, 0, 'Huỷ', {
        width: 72,
        fontSize: 15,
        onClick: () => this.bus.emit('ui:build-cancel', {}),
      }),
    ];
    this.confirmButtons[0]!.setActive(true);
    for (const b of this.confirmButtons) b.setVisible(false);

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
        this.refreshStatus();
      }),
      bus.on('clock:speed', ({ speed }) => {
        for (const [s, button] of this.speedButtons) button.setActive(s === speed);
        this.refreshStatus();
      }),
      bus.on('clock:tick', () => this.refreshStatus()),
      bus.on('build:mode', ({ kind, snap }) => {
        this.buildKind = kind;
        for (const [id, button] of this.buildButtons) button.setActive(id === kind);
        this.snapButton.setActive(snap);
        for (const b of this.confirmButtons) b.setVisible(false);
        this.message.setColor(toCss(PALETTE.bone)).setText(kind ? this.buildHint(kind) : '');
      }),
      bus.on('build:status', ({ ok, reason, pending }) => this.showPlacement(ok, reason, pending)),
      bus.on('build:placed', ({ kind }) => {
        for (const b of this.confirmButtons) b.setVisible(false);
        this.message
          .setColor(toCss(PALETTE.ghostGreen))
          .setText(`Đã đặt ${BUILDINGS[kind].nameVi}.`);
        this.layout();
      }),
    ];

    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this);
      for (const off of this.unsubscribers) off();
    });

    for (const [s, button] of this.speedButtons) button.setActive(s === world.clock.speed);
    this.refreshStatus();
    this.refreshInfo();
    this.layout();
  }

  update(): void {
    const c = this.cursor;
    this.debugLine.setText(
      `${Math.round(this.game.loop.actualFps)} fps   zoom ${this.zoom}×   seed ${this.world.seed}` +
        (c ? `   x ${c.x} y ${c.y}` : ''),
    );
  }

  private buildHint(kind: BuildingId): string {
    const name = BUILDINGS[kind].nameVi;
    return this.isTouch
      ? `Chạm vào bản đồ để đặt ${name}, rồi bấm Đặt.`
      : `Nhấp để đặt ${name}. Giữ Shift để bám lưới, chuột phải để thôi.`;
  }

  private showPlacement(ok: boolean, reason: PlacementProblem | null, pending: boolean): void {
    if (!this.buildKind) return;
    for (const b of this.confirmButtons) b.setVisible(pending);
    if (!ok && reason) {
      this.message.setColor(toCss(PALETTE.flame)).setText(PLACEMENT_HELP[reason]);
    } else {
      this.message.setColor(toCss(PALETTE.bone)).setText(this.buildHint(this.buildKind));
    }
    this.layout();
  }

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

    // Zoom: bottom-right, stacked.
    this.zoomButtons.forEach((button, i) => {
      button.container.setPosition(
        width - MARGIN - TOUCH_TARGET / 2,
        height - MARGIN - TOUCH_TARGET / 2 - (1 - i) * (TOUCH_TARGET + GAP),
      );
    });

    // Build bar: bottom-left.
    const barY = height - MARGIN - BUILD_BUTTON.h / 2;
    const buttons = [...this.buildButtons.values(), this.snapButton];
    buttons.forEach((b, i) => {
      b.container.setPosition(MARGIN + BUILD_BUTTON.w / 2 + i * (BUILD_BUTTON.w + GAP), barY);
    });
    const barTop = height - MARGIN - BUILD_BUTTON.h;

    // Touch confirm row sits just above the build bar.
    const confirmY = barTop - GAP - TOUCH_TARGET / 2;
    this.confirmButtons.forEach((b, i) =>
      b.container.setPosition(MARGIN + 36 + i * (72 + GAP), confirmY),
    );
    const confirmShown = this.confirmButtons[0]!.container.visible;
    const messageBottom = confirmShown ? confirmY - TOUCH_TARGET / 2 - GAP : barTop - GAP;
    this.message
      .setWordWrapWidth(Math.min(420, width - MARGIN * 3 - TOUCH_TARGET))
      .setPosition(MARGIN, messageBottom);

    this.positionInfo();
  }

  private positionInfo(): void {
    const pad = 8;
    const above = this.debugLine.visible ? this.debugLine : this.status;
    const top = above.y + above.height + 6;
    this.info.setWordWrapWidth(Math.min(280, this.scale.width - MARGIN * 2 - pad * 2));
    this.info.setPosition(MARGIN + pad, top + pad);
    this.infoBg
      .setPosition(MARGIN, top)
      .setSize(this.info.width + pad * 2, this.info.height + pad * 2)
      .setVisible(this.info.text.length > 0);
  }

  private refreshStatus(): void {
    const { clock } = this.world;
    const seconds = Math.floor(clock.tick / TICKS_PER_SECOND);
    const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
    const ss = String(seconds % 60).padStart(2, '0');
    const state = clock.paused ? 'đang tạm dừng' : `đang chạy ${clock.speed}×`;
    this.status.setText(`Ngày 1, ${mm}:${ss} — ${state}`);
    this.debugLine.setY(this.status.y + this.status.height + 2);
  }

  private refreshInfo(): void {
    this.info.setText(this.describe().join('\n'));
    this.positionInfo();
  }

  /** Selected entity first; otherwise whatever is under the mouse. */
  private describe(): string[] {
    const { world } = this;
    if (this.selected !== null) return this.describeEntity(this.selected);
    const c = this.cursor;
    if (!c) return [];
    // Hovering an object describes the object; otherwise the ground under the cursor.
    const hovered = entityAt(world, c.x, c.y);
    if (hovered !== null) return this.describeEntity(hovered);
    return describeTerrain(world.terrain.atWorld(c.x, c.y));
  }

  private describeEntity(eid: number): string[] {
    const { world } = this;
    if (hasComponent(world.ecs, eid, Doodad)) {
      const def = DOODADS[DOODAD_IDS[Doodad.kind[eid]!]!];
      const lines = [def.nameVi];
      if (def.yields) {
        const resource = RESOURCES[def.yields.resource].nameVi;
        lines.push(`Khai thác được ${def.yields.amount} ${resource}`);
      }
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
