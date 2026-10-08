import Phaser from 'phaser';
import { createGameBus, type EventBus, type GameEvents } from '../core/events';
import { PALETTE, toCss } from '../data/palette';
import { DEFAULT_LAYOUT, hexEquals, type Hex } from '../hex';
import { ATLAS_KEY, FRAMES } from '../render/atlas';
import { DEPTH, HexMapRenderer } from '../render/HexMapRenderer';
import { CameraController } from '../platform/CameraController';
import { createGameWorld, stepWorld, type GameWorld } from '../sim/GameWorld';
import type { GameSpeed } from '../sim/SimClock';
import { SCENES, type WorldSceneData } from './keys';

/** Data handed to the HUD overlay scene. */
export interface HudSceneData {
  bus: EventBus<GameEvents>;
  world: GameWorld;
  initialZoom: number;
}

/**
 * The main play scene: owns the simulation, renders the hex map and translates input
 * into hover/selection. UI lives in HudScene, talking to this scene via the event bus.
 */
export class WorldScene extends Phaser.Scene {
  private world!: GameWorld;
  private bus!: EventBus<GameEvents>;
  private mapRenderer!: HexMapRenderer;
  private cameraController!: CameraController;
  private hovered: Hex | null = null;
  private selected: Hex | null = null;

  constructor() {
    super(SCENES.world);
  }

  create(data: WorldSceneData): void {
    // Scene instances are reused between games; reset per-game state.
    this.hovered = null;
    this.selected = null;
    this.world = createGameWorld({ seed: data.seed });
    this.bus = createGameBus();
    this.cameras.main.setBackgroundColor(toCss(PALETTE.void));

    this.mapRenderer = new HexMapRenderer(this, this.world.map);

    const startPx = DEFAULT_LAYOUT.hexToPixel(this.world.start);
    this.add.image(startPx.x, startPx.y - 2, ATLAS_KEY, FRAMES.hearthfire).setDepth(DEPTH.entities);

    const pad = 64;
    this.cameraController = new CameraController(this, {
      bounds: {
        x: -pad,
        y: -pad,
        width: this.mapRenderer.pixelWidth + pad * 2,
        height: this.mapRenderer.pixelHeight + pad * 2,
      },
      onTap: (x, y) => this.selectAt(x, y),
      onZoomChange: (zoom) => this.bus.emit('camera:zoom', { zoom }),
    });
    this.cameraController.centerOn(startPx.x, startPx.y);

    this.bindBus();
    this.bindKeys();

    // The HUD starts on the next frame, so it reads initial state from this data
    // instead of relying on events emitted now.
    this.scene.launch(SCENES.hud, {
      bus: this.bus,
      world: this.world,
      initialZoom: this.cameraController.zoom,
    } satisfies HudSceneData);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scene.stop(SCENES.hud);
      this.bus.clear();
    });
  }

  update(_time: number, delta: number): void {
    this.cameraController.update(delta);
    this.updateHover();

    const ticks = this.world.clock.advance(delta);
    for (let i = 0; i < ticks; i++) stepWorld(this.world);
    if (ticks > 0) this.bus.emit('clock:tick', { tick: this.world.clock.tick });
  }

  private updateHover(): void {
    const pointer = this.input.activePointer;
    // Touch devices have no hover; only mice/pens report it.
    if (!pointer.wasTouch && pointer.active) {
      const world = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      const h = DEFAULT_LAYOUT.pixelToHex(world.x, world.y);
      const next = this.world.map.inBounds(h) ? h : null;
      if (!sameHex(next, this.hovered)) {
        this.hovered = next;
        this.mapRenderer.setHover(next);
        this.bus.emit('hex:hover', { hex: next });
      }
    }
  }

  private selectAt(worldX: number, worldY: number): void {
    const h = DEFAULT_LAYOUT.pixelToHex(worldX, worldY);
    const next = this.world.map.inBounds(h) && !sameHex(h, this.selected) ? h : null;
    this.selected = next;
    this.mapRenderer.setSelected(next);
    this.bus.emit('hex:select', { hex: next });
  }

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
  }

  private bindKeys(): void {
    const kb = this.input.keyboard;
    if (!kb) return;
    kb.on('keydown-SPACE', () => this.bus.emit('ui:toggle-pause', {}));
    kb.on('keydown-ONE', () => this.setSpeed(1));
    kb.on('keydown-TWO', () => this.setSpeed(2));
    kb.on('keydown-THREE', () => this.setSpeed(3));
    kb.on('keydown-PLUS', () => this.cameraController.stepZoom(1));
    kb.on('keydown-NUMPAD_ADD', () => this.cameraController.stepZoom(1));
    kb.on('keydown-MINUS', () => this.cameraController.stepZoom(-1));
    kb.on('keydown-NUMPAD_SUBTRACT', () => this.cameraController.stepZoom(-1));
    kb.on('keydown-ESC', () => this.scene.start(SCENES.mainMenu));
  }
}

const sameHex = (a: Hex | null, b: Hex | null): boolean =>
  a === b || (a !== null && b !== null && hexEquals(a, b));
