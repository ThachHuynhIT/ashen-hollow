import Phaser from 'phaser';
import { createGameBus, type EventBus, type GameEvents } from '../core/events';
import { BUILDINGS, PLAYER_BUILDINGS, type BuildingId } from '../data/buildings';
import { PALETTE, toCss } from '../data/palette';
import { DebugOverlay } from '../render/DebugOverlay';
import { EntityRenderer } from '../render/EntityRenderer';
import { PlacementPreview } from '../render/PlacementPreview';
import { TerrainRenderer } from '../render/TerrainRenderer';
import { CameraController } from '../platform/CameraController';
import { inflateShape, shapeBottom, shapeContains, type Shape } from '../sim/geom';
import {
  checkPlacement,
  createGameWorld,
  entityAt,
  placeBuilding,
  type GameWorld,
} from '../sim/GameWorld';
import type { Vec2 } from '../sim/geom';
import { stepWorld } from '../sim/step';
import type { GameSpeed } from '../sim/SimClock';
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

/**
 * The main play scene: owns the simulation, renders the free-form world and turns
 * input into selection and building placement. UI lives in HudScene (event bus only).
 */
export class WorldScene extends Phaser.Scene {
  private world!: GameWorld;
  private bus!: EventBus<GameEvents>;
  private entities!: EntityRenderer;
  private preview!: PlacementPreview;
  private debug!: DebugOverlay;
  private cameraController!: CameraController;
  private selection!: Phaser.GameObjects.Graphics;
  private shiftKey: Phaser.Input.Keyboard.Key | undefined;

  private buildKind: BuildingId | null = null;
  private lastBuildKind: BuildingId = 'tent';
  private snapToggle = false;
  /** Touch flow: where the ghost was dropped, waiting for ✓ / ✕. */
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

  constructor() {
    super(SCENES.world);
  }

  create(data: WorldSceneData): void {
    // Scene instances are reused between games; reset per-game state.
    this.buildKind = null;
    this.snapToggle = false;
    this.pending = null;
    this.cursor = null;
    this.selected = null;
    this.lastStatusKey = '';
    this.ghostKey = '';
    this.ghostShape = null;
    this.worldVersion = 0;
    this.holdStatusAt = null;

    this.world = createGameWorld({ seed: data.seed });
    this.bus = createGameBus();
    this.cameras.main.setBackgroundColor(toCss(PALETTE.void));

    new TerrainRenderer(this, this.world.terrain);
    this.entities = new EntityRenderer(this, this.world);
    this.preview = new PlacementPreview(this);
    this.debug = new DebugOverlay(this, this.world);
    this.selection = this.add.graphics();

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
      claimDrag: (x, y, pointer) => this.claimGhostDrag(x, y, pointer),
      onClaimedDrag: (x, y) => {
        this.pending = { x: x + this.dragOffset.x, y: y + this.dragOffset.y };
      },
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
    if (this.buildKind) {
      if (pointer.wasTouch) {
        // Touch: drop the ghost, then confirm with ✓ — no accidental builds.
        this.pending = { x: Math.round(x), y: Math.round(y) };
        this.refreshGhost();
      } else {
        this.tryPlace(x, y);
      }
      return;
    }
    this.select(entityAt(this.world, x, y));
  }

  /** Touch: pressing on the pending ghost drags it instead of panning the map. */
  private claimGhostDrag(x: number, y: number, pointer: Phaser.Input.Pointer): boolean {
    if (!this.buildKind || !this.pending || !this.ghostShape || !pointer.wasTouch) return false;
    // Generous finger margin: the ghost is small at low zoom.
    if (!shapeContains(inflateShape(this.ghostShape, 10), x, y)) return false;
    this.dragOffset = { x: this.pending.x - x, y: this.pending.y - y };
    return true;
  }

  private onPointerUp(pointer: Phaser.Input.Pointer): void {
    // Right-click (without dragging) cancels build mode.
    if (pointer.button === 2 && pointer.getDistance() < RIGHT_CLICK_SLOP && this.buildKind) {
      this.setBuildKind(null);
    }
  }

  private select(eid: number | null): void {
    this.selected = eid;
    this.selection.clear();
    if (eid !== null) {
      const { shape } = this.world.obstacles.get(eid)!;
      const bottom = shapeBottom(shape);
      const w = shape.kind === 'rect' ? shape.hw * 2 + 6 : shape.r * 2 + 6;
      this.selection
        .lineStyle(1, PALETTE.flame, 1)
        .strokeEllipse(shape.cx, bottom - 1, w, Math.max(5, w * 0.35))
        .setDepth(bottom - 0.25);
    }
    this.bus.emit('entity:select', { eid });
  }

  // --- building placement ------------------------------------------------------------

  private get snapping(): boolean {
    return this.snapToggle || (this.shiftKey?.isDown ?? false);
  }

  private setBuildKind(kind: BuildingId | null): void {
    this.buildKind = kind;
    this.pending = null;
    if (kind) {
      this.lastBuildKind = kind;
      this.select(null);
    } else {
      this.preview.hide();
    }
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
    const statusKey = `${check.ok}|${check.reason}|${this.pending !== null}`;
    if (statusKey !== this.lastStatusKey) {
      this.lastStatusKey = statusKey;
      this.bus.emit('build:status', {
        ok: check.ok,
        reason: check.reason,
        pending: this.pending !== null,
      });
    }
  }

  private tryPlace(x: number, y: number): boolean {
    const kind = this.buildKind;
    if (!kind) return false;
    const result = placeBuilding(this.world, kind, x, y, { snap: this.snapping });
    if (!result.ok || result.eid === null) {
      this.cameras.main.shake(80, 0.002);
      return false;
    }
    const sprite = this.entities.addBuilding(result.eid);
    // A small "thud" so the player sees the building land.
    sprite.setScale(1, 0.85);
    this.tweens.add({ targets: sprite, scaleY: 1, duration: 120, ease: 'Back.easeOut' });
    this.debug.refresh();
    this.worldVersion++;
    this.lastStatusKey = '';
    // Mouse: the cursor still sits on the new building; don't immediately replace
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
    this.bus.on('ui:toggle-snap', () => {
      this.snapToggle = !this.snapToggle;
      this.bus.emit('build:mode', { kind: this.buildKind, snap: this.snapToggle });
    });
    this.bus.on('ui:build-confirm', () => {
      // On success the HUD hears 'build:placed' (and hides ✓/✕); keep that message visible.
      if (this.pending && this.tryPlace(this.pending.x, this.pending.y)) {
        this.pending = null;
        this.preview.hide();
      }
    });
    this.bus.on('ui:build-cancel', () => this.setBuildKind(null));
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
    kb.on('keydown-F3', (e: KeyboardEvent) => {
      e.preventDefault();
      this.debug.toggle();
    });
    kb.on('keydown-ESC', () => {
      if (this.buildKind) this.setBuildKind(null);
      else if (this.selected !== null) this.select(null);
      else this.scene.start(SCENES.mainMenu);
    });
  }
}
