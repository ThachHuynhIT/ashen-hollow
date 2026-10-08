import { hasComponent } from 'bitecs';
import Phaser from 'phaser';
import { createGameBus, type EventBus, type GameEvents, type OrderTool } from '../core/events';
import { BUILDINGS, BUILDING_IDS, PLAYER_BUILDINGS, type BuildingId } from '../data/buildings';
import { TERRITORY_RADIUS } from '../data/colonists';
import { PALETTE, toCss } from '../data/palette';
import { CameraController } from '../platform/CameraController';
import { ColonistRenderer } from '../render/ColonistRenderer';
import { DebugOverlay } from '../render/DebugOverlay';
import { DesignationMarkers } from '../render/DesignationMarkers';
import { EntityRenderer } from '../render/EntityRenderer';
import { PlacementPreview } from '../render/PlacementPreview';
import { TerrainRenderer } from '../render/TerrainRenderer';
import { WallPreview } from '../render/WallPreview';
import { placeBlueprint, placeWall, planWall } from '../sim/colony/blueprint';
import { colonistAt, colonistName } from '../sim/colony/colonists';
import { designate, undesignate } from '../sim/colony/designation';
import { Building, Colonist, Position } from '../sim/components';
import { drainEvents } from '../sim/events';
import { checkPlacement, createGameWorld, entityAt, type GameWorld } from '../sim/GameWorld';
import {
  inflateShape,
  shapeBottom,
  shapeContains,
  type Bounds,
  type Shape,
  type Vec2,
} from '../sim/geom';
import type { GameSpeed } from '../sim/SimClock';
import { stepWorld } from '../sim/step';
import { SCENES, type WorldSceneData } from './keys';

/** Data handed to the HUD overlay scene. */
export interface HudSceneData {
  bus: EventBus<GameEvents>;
  world: GameWorld;
  initialZoom: number;
  isTouch: boolean;
}

/** Right-clicks that moved less than this (screen px) count as "cancel", not a pan. */
const RIGHT_CLICK_SLOP = 8;
/** Half-size of the area a single click/tap designates (world px). */
const TAP_AREA = 3;

const TOOL_COLORS: Record<Exclude<OrderTool, 'wall'>, number> = {
  chop: PALETTE.flame,
  mine: PALETTE.stoneLight,
  forage: PALETTE.ghostGreen,
  clear: PALETTE.ember,
};

const TOOL_KEYS: Record<string, OrderTool> = {
  Q: 'chop',
  E: 'mine',
  R: 'forage',
  T: 'clear',
  F: 'wall',
};

const boxBetween = (a: Vec2, b: Vec2): Bounds => ({
  minX: Math.min(a.x, b.x),
  minY: Math.min(a.y, b.y),
  maxX: Math.max(a.x, b.x),
  maxY: Math.max(a.y, b.y),
});

/**
 * The main play scene: owns the simulation, renders the world and turns input into
 * selection, building placement and orders. UI lives in HudScene (event bus only).
 */
export class WorldScene extends Phaser.Scene {
  private world!: GameWorld;
  private bus!: EventBus<GameEvents>;
  private entities!: EntityRenderer;
  private colonists!: ColonistRenderer;
  private markers!: DesignationMarkers;
  private preview!: PlacementPreview;
  private wallPreview!: WallPreview;
  private debug!: DebugOverlay;
  private cameraController!: CameraController;
  private selection!: Phaser.GameObjects.Graphics;
  private box!: Phaser.GameObjects.Graphics;
  private territory!: Phaser.GameObjects.Graphics;
  private shiftKey: Phaser.Input.Keyboard.Key | undefined;

  private buildKind: BuildingId | null = null;
  private lastBuildKind: BuildingId = 'tent';
  private orderTool: OrderTool | null = null;
  private snapToggle = false;
  /** Touch flow: where the ghost was dropped, waiting for Đặt / Huỷ. */
  private pending: Vec2 | null = null;
  private cursor: Vec2 | null = null;
  private selected: number | null = null;
  private lastStatusKey = '';
  /** Inputs of the last ghost check; the ghost is only recomputed when they change. */
  private ghostKey = '';
  private ghostShape: Shape | null = null;
  /** Bumped whenever buildings change, so the cached ghost check is invalidated. */
  private worldVersion = 0;
  /** After a mouse placement, keep "Đã đặt …" on screen until the cursor moves. */
  private holdStatusAt: string | null = null;
  /** Touch: offset from the finger to the ghost while dragging it. */
  private dragOffset: Vec2 = { x: 0, y: 0 };
  /** What the current claimed drag is doing. */
  private claim: 'ghost' | 'tool' | null = null;
  /** Mouse drag start for box designation / wall. */
  private dragStart: Vec2 | null = null;
  /** Touch wall: first and second tap. */
  private wallStart: Vec2 | null = null;
  private wallEnd: Vec2 | null = null;

  constructor() {
    super(SCENES.world);
  }

  create(data: WorldSceneData): void {
    // Scene instances are reused between games; reset per-game state.
    this.buildKind = null;
    this.orderTool = null;
    this.snapToggle = false;
    this.pending = null;
    this.cursor = null;
    this.selected = null;
    this.lastStatusKey = '';
    this.ghostKey = '';
    this.ghostShape = null;
    this.worldVersion = 0;
    this.holdStatusAt = null;
    this.claim = null;
    this.dragStart = null;
    this.wallStart = null;
    this.wallEnd = null;

    this.world = createGameWorld({ seed: data.seed });
    this.bus = createGameBus();
    this.cameras.main.setBackgroundColor(toCss(PALETTE.void));

    new TerrainRenderer(this, this.world.terrain);
    this.entities = new EntityRenderer(this, this.world);
    this.colonists = new ColonistRenderer(this, this.world);
    this.markers = new DesignationMarkers(this, this.world, this.entities);
    this.preview = new PlacementPreview(this);
    this.wallPreview = new WallPreview(this);
    this.debug = new DebugOverlay(this, this.world);
    this.selection = this.add.graphics();
    this.box = this.add.graphics().setDepth(999_500);
    this.territory = this.add
      .graphics()
      .setDepth(-900_000)
      .lineStyle(1, PALETTE.candle, 0.35)
      .strokeCircle(this.world.start.x, this.world.start.y, TERRITORY_RADIUS)
      .setVisible(false);

    const pad = 32;
    this.cameraController = new CameraController(this, {
      bounds: {
        x: -pad,
        y: -pad,
        width: this.world.terrain.widthPx + pad * 2,
        height: this.world.terrain.heightPx + pad * 2,
      },
      onTap: (x, y, pointer) => this.onTap(x, y, pointer),
      onZoomChange: (zoom) => this.bus.emit('camera:zoom', { zoom }),
      claimDrag: (x, y, pointer) => this.claimDrag(x, y, pointer),
      onClaimedDrag: (x, y) => this.onClaimedDrag(x, y),
      onClaimedDragEnd: (x, y) => this.onClaimedDragEnd(x, y),
    });
    this.cameraController.centerOn(this.world.start.x, this.world.start.y);

    this.input.on(Phaser.Input.Events.POINTER_UP, this.onPointerUp, this);
    this.bindBus();
    this.bindKeys();

    // The HUD starts on the next frame, so it reads initial state from this data
    // instead of relying on events emitted now.
    this.scene.launch(SCENES.hud, {
      bus: this.bus,
      world: this.world,
      initialZoom: this.cameraController.zoom,
      isTouch: this.sys.game.device.input.touch,
    } satisfies HudSceneData);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.off(Phaser.Input.Events.POINTER_UP, this.onPointerUp, this);
      this.scene.stop(SCENES.hud);
      this.bus.clear();
    });
  }

  update(_time: number, delta: number): void {
    this.cameraController.update(delta);
    this.trackCursor();
    if (this.buildKind) this.refreshGhost();

    const ticks = this.world.clock.advance(delta);
    for (let i = 0; i < ticks; i++) stepWorld(this.world);
    if (ticks > 0) this.bus.emit('clock:tick', { tick: this.world.clock.tick });

    this.handleWorldEvents();
    this.colonists.update();
    this.entities.updateBlueprints();
    this.drawSelection();
  }

  // --- world events -------------------------------------------------------------------

  /** Apply what the simulation reported since last frame. */
  private handleWorldEvents(): void {
    for (const e of drainEvents(this.world)) {
      switch (e.type) {
        case 'entityRemoved':
          this.entities.remove(e.eid);
          this.markers.remove(e.eid);
          if (this.selected === e.eid) this.select(null);
          this.worldVersion++;
          this.debug.refresh();
          break;
        case 'blueprintPlaced':
          this.entities.addBuilding(e.eid);
          this.worldVersion++;
          break;
        case 'buildingCompleted': {
          this.entities.completeBuilding(e.eid);
          this.worldVersion++;
          this.debug.refresh();
          const name = BUILDINGS[BUILDING_IDS[Building.kind[e.eid]!]!].nameVi;
          this.bus.emit('log', { text: `Đã xây xong ${name}.` });
          break;
        }
        case 'designationChanged':
          this.markers.sync(e.eids);
          break;
        case 'stockChanged':
          this.bus.emit('stock:changed', { stock: this.world.stock.snapshot() });
          break;
        case 'colonistDied': {
          const why = e.cause === 'hunger' ? 'đói' : 'kiệt sức';
          this.bus.emit('log', { text: `${colonistName(e.eid)} đã chết vì ${why}.` });
          break;
        }
      }
    }
  }

  // --- cursor & selection ------------------------------------------------------------

  private trackCursor(): void {
    const pointer = this.input.activePointer;
    // Touch devices have no hover; only mice/pens report a cursor.
    if (pointer.wasTouch) return;
    // Same conversion and rounding as a click, so the ghost shows exactly what a click does.
    const p = this.cameraController.screenToWorld(pointer.x, pointer.y);
    const inside =
      p.x >= 0 && p.y >= 0 && p.x < this.world.terrain.widthPx && p.y < this.world.terrain.heightPx;
    const next = inside ? { x: Math.round(p.x), y: Math.round(p.y) } : null;
    if (next?.x !== this.cursor?.x || next?.y !== this.cursor?.y) {
      this.cursor = next;
      this.bus.emit('cursor:move', next);
    }
  }

  private onTap(x: number, y: number, pointer: Phaser.Input.Pointer): void {
    this.claim = null;
    this.dragStart = null;
    const p = { x: Math.round(x), y: Math.round(y) };
    if (this.orderTool === 'wall') {
      this.tapWall(p, pointer.wasTouch);
      return;
    }
    if (this.orderTool) {
      this.applyArea({
        minX: p.x - TAP_AREA,
        minY: p.y - TAP_AREA,
        maxX: p.x + TAP_AREA,
        maxY: p.y + TAP_AREA,
      });
      return;
    }
    if (this.buildKind) {
      if (pointer.wasTouch) {
        // Touch: drop the ghost, then confirm with Đặt — no accidental builds.
        this.pending = p;
        this.refreshGhost();
      } else {
        this.tryPlace(p.x, p.y);
      }
      return;
    }
    this.select(colonistAt(this.world, x, y) ?? entityAt(this.world, x, y));
  }

  private claimDrag(x: number, y: number, pointer: Phaser.Input.Pointer): boolean {
    // Touch: pressing on the pending ghost drags it instead of panning the map.
    if (this.buildKind && this.pending && this.ghostShape && pointer.wasTouch) {
      if (shapeContains(inflateShape(this.ghostShape, 10), x, y)) {
        this.dragOffset = { x: this.pending.x - x, y: this.pending.y - y };
        this.claim = 'ghost';
        return true;
      }
    }
    // Mouse: with an order tool, the left button draws a box / a wall.
    if (this.orderTool && !pointer.wasTouch && pointer.button === 0) {
      this.dragStart = { x: Math.round(x), y: Math.round(y) };
      this.claim = 'tool';
      return true;
    }
    this.claim = null;
    return false;
  }

  private onClaimedDrag(x: number, y: number): void {
    if (this.claim === 'ghost') {
      this.pending = { x: Math.round(x + this.dragOffset.x), y: Math.round(y + this.dragOffset.y) };
      return;
    }
    if (this.claim !== 'tool' || !this.dragStart || !this.orderTool) return;
    const end = { x: Math.round(x), y: Math.round(y) };
    if (this.orderTool === 'wall') {
      this.wallPreview.show(planWall(this.world, this.dragStart, end));
      return;
    }
    const b = boxBetween(this.dragStart, end);
    const color = TOOL_COLORS[this.orderTool];
    this.box
      .clear()
      .fillStyle(color, 0.12)
      .fillRect(b.minX, b.minY, b.maxX - b.minX, b.maxY - b.minY)
      .lineStyle(1, color, 0.9)
      .strokeRect(b.minX + 0.5, b.minY + 0.5, b.maxX - b.minX, b.maxY - b.minY);
  }

  private onClaimedDragEnd(x: number, y: number): void {
    if (this.claim === 'tool' && this.dragStart && this.orderTool) {
      const end = { x: Math.round(x), y: Math.round(y) };
      if (this.orderTool === 'wall') this.buildWall(this.dragStart, end);
      else this.applyArea(boxBetween(this.dragStart, end));
    }
    this.box.clear();
    this.claim = null;
    this.dragStart = null;
  }

  private onPointerUp(pointer: Phaser.Input.Pointer): void {
    // Right-click (without dragging) cancels the current tool.
    if (pointer.button === 2 && pointer.getDistance() < RIGHT_CLICK_SLOP) {
      if (this.buildKind) this.setBuildKind(null);
      else if (this.orderTool) this.setTool(null);
    }
  }

  private select(eid: number | null): void {
    this.selected = eid;
    this.bus.emit('entity:select', { eid });
  }

  /** Selection ring, redrawn every frame so it follows walking colonists. */
  private drawSelection(): void {
    const g = this.selection.clear();
    const eid = this.selected;
    if (eid === null) return;
    let cx: number;
    let bottom: number;
    let w: number;
    const record = this.world.obstacles.get(eid);
    if (record) {
      cx = record.shape.cx;
      bottom = shapeBottom(record.shape);
      w = record.shape.kind === 'rect' ? record.shape.hw * 2 + 6 : record.shape.r * 2 + 6;
    } else if (hasComponent(this.world.ecs, eid, Colonist)) {
      cx = Position.x[eid]!;
      bottom = Position.y[eid]!;
      w = 12;
    } else {
      return;
    }
    g.lineStyle(1, PALETTE.flame, 1).strokeEllipse(cx, bottom - 1, w, Math.max(5, w * 0.35));
    if (g.depth !== bottom - 0.25) g.setDepth(bottom - 0.25);
  }

  // --- orders ------------------------------------------------------------------------

  private setTool(tool: OrderTool | null): void {
    if (tool && this.buildKind) this.setBuildKind(null);
    this.orderTool = tool;
    this.claim = null;
    this.dragStart = null;
    this.wallStart = null;
    this.wallEnd = null;
    this.box.clear();
    this.wallPreview.hide();
    this.territory.setVisible(tool === 'wall' || this.buildKind !== null);
    if (tool) this.select(null);
    this.bus.emit('tool:changed', { tool });
  }

  private applyArea(area: Bounds): void {
    if (this.orderTool === 'clear') undesignate(this.world, area);
    else if (this.orderTool && this.orderTool !== 'wall')
      designate(this.world, area, this.orderTool);
    this.handleWorldEvents();
  }

  private buildWall(a: Vec2, b: Vec2): void {
    const placed = placeWall(this.world, a, b);
    this.wallPreview.hide();
    this.handleWorldEvents();
    if (placed.length > 0) this.bus.emit('build:placed', { kind: 'wallStake', eid: placed[0]! });
    else this.cameras.main.shake(80, 0.002);
  }

  /** Mouse click: a single stake. Touch: first tap = start, second tap = end (then Đặt). */
  private tapWall(p: Vec2, touch: boolean): void {
    if (!touch) {
      this.buildWall(p, p);
      return;
    }
    if (!this.wallStart || this.wallEnd) {
      this.wallStart = p;
      this.wallEnd = null;
      this.wallPreview.show(planWall(this.world, p, p));
      this.bus.emit('build:status', { ok: true, reason: null, pending: false });
      return;
    }
    this.wallEnd = p;
    const plan = planWall(this.world, this.wallStart, p);
    this.wallPreview.show(plan);
    this.bus.emit('build:status', { ok: plan.some((s) => s.ok), reason: null, pending: true });
  }

  // --- building placement ------------------------------------------------------------

  private get snapping(): boolean {
    return this.snapToggle || (this.shiftKey?.isDown ?? false);
  }

  private setBuildKind(kind: BuildingId | null): void {
    if (kind && this.orderTool) this.setTool(null);
    this.buildKind = kind;
    this.pending = null;
    if (kind) {
      this.lastBuildKind = kind;
      this.select(null);
    } else {
      this.preview.hide();
    }
    this.territory.setVisible(kind !== null || this.orderTool === 'wall');
    this.lastStatusKey = '';
    this.ghostKey = '';
    this.holdStatusAt = null;
    this.bus.emit('build:mode', { kind, snap: this.snapToggle });
  }

  private refreshGhost(): void {
    const kind = this.buildKind;
    const at = this.pending ?? this.cursor;
    if (!kind || !at) {
      this.preview.hide();
      this.ghostShape = null;
      this.ghostKey = '';
      return;
    }
    const pending = this.pending !== null;
    const key = `${kind}|${at.x}|${at.y}|${this.snapping}|${pending}|${this.worldVersion}`;
    if (key === this.ghostKey) return;
    this.ghostKey = key;

    const check = checkPlacement(this.world, kind, at.x, at.y, { snap: this.snapping });
    this.ghostShape = check.shape;
    this.preview.show(kind, check.shape, check.ok);
    const here = `${at.x}|${at.y}`;
    if (this.holdStatusAt === here) return;
    this.holdStatusAt = null;
    const statusKey = `${check.ok}|${check.reason}|${pending}`;
    if (statusKey !== this.lastStatusKey) {
      this.lastStatusKey = statusKey;
      this.bus.emit('build:status', { ok: check.ok, reason: check.reason, pending });
    }
  }

  private tryPlace(x: number, y: number): boolean {
    const kind = this.buildKind;
    if (!kind) return false;
    const result = placeBlueprint(this.world, kind, x, y, { snap: this.snapping });
    if (!result.ok || result.eid === null) {
      this.cameras.main.shake(80, 0.002);
      return false;
    }
    this.handleWorldEvents();
    this.lastStatusKey = '';
    // Mouse: the cursor still sits on the new blueprint; don't immediately replace
    // "Đã đặt …" with "overlaps a building" until the player moves on.
    if (this.cursor) this.holdStatusAt = `${this.cursor.x}|${this.cursor.y}`;
    this.bus.emit('build:placed', { kind, eid: result.eid });
    return true;
  }

  // --- wiring -------------------------------------------------------------------------

  private setSpeed(speed: GameSpeed): void {
    this.world.clock.setSpeed(speed);
    this.bus.emit('clock:speed', { speed: this.world.clock.speed });
  }

  private bindBus(): void {
    this.bus.on('ui:set-speed', ({ speed }) => this.setSpeed(speed));
    this.bus.on('ui:toggle-pause', () => {
      this.world.clock.togglePause();
      this.bus.emit('clock:speed', { speed: this.world.clock.speed });
    });
    this.bus.on('ui:zoom-step', ({ direction }) => this.cameraController.stepZoom(direction));
    this.bus.on('ui:build', ({ kind }) => this.setBuildKind(kind === this.buildKind ? null : kind));
    this.bus.on('ui:tool', ({ tool }) => this.setTool(tool === this.orderTool ? null : tool));
    this.bus.on('ui:toggle-snap', () => {
      this.snapToggle = !this.snapToggle;
      this.bus.emit('build:mode', { kind: this.buildKind, snap: this.snapToggle });
    });
    this.bus.on('ui:build-confirm', () => {
      if (this.orderTool === 'wall' && this.wallStart && this.wallEnd) {
        this.buildWall(this.wallStart, this.wallEnd);
        this.wallStart = null;
        this.wallEnd = null;
        return;
      }
      // On success the HUD hears 'build:placed' (and hides Đặt/Huỷ); keep that message.
      if (this.pending && this.tryPlace(this.pending.x, this.pending.y)) {
        this.pending = null;
        this.preview.hide();
      }
    });
    this.bus.on('ui:build-cancel', () => {
      this.setBuildKind(null);
      this.setTool(null);
    });
    this.bus.on('ui:focus-colonist', ({ eid }) => {
      this.cameraController.centerOn(Position.x[eid]!, Position.y[eid]!);
      this.select(eid);
    });
  }

  private bindKeys(): void {
    const kb = this.input.keyboard;
    if (!kb) return;
    this.shiftKey = kb.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT, false);
    kb.on('keydown-SPACE', () => this.bus.emit('ui:toggle-pause', {}));
    kb.on('keydown-ONE', () => this.setSpeed(1));
    kb.on('keydown-TWO', () => this.setSpeed(2));
    kb.on('keydown-THREE', () => this.setSpeed(3));
    kb.on('keydown-PLUS', () => this.cameraController.stepZoom(1));
    kb.on('keydown-NUMPAD_ADD', () => this.cameraController.stepZoom(1));
    kb.on('keydown-MINUS', () => this.cameraController.stepZoom(-1));
    kb.on('keydown-NUMPAD_SUBTRACT', () => this.cameraController.stepZoom(-1));
    kb.on('keydown-B', () => this.setBuildKind(this.buildKind ? null : this.lastBuildKind));
    for (const id of PLAYER_BUILDINGS) {
      const hotkey = BUILDINGS[id].hotkey;
      if (hotkey) kb.on(`keydown-${hotkey}`, () => this.setBuildKind(id));
    }
    for (const [key, tool] of Object.entries(TOOL_KEYS)) {
      kb.on(`keydown-${key}`, () => this.setTool(this.orderTool === tool ? null : tool));
    }
    kb.on('keydown-F3', (e: KeyboardEvent) => {
      e.preventDefault();
      this.debug.toggle();
    });
    kb.on('keydown-ESC', () => {
      if (this.buildKind) this.setBuildKind(null);
      else if (this.orderTool) this.setTool(null);
      else if (this.selected !== null) this.select(null);
      else this.scene.start(SCENES.mainMenu);
    });
  }
}
