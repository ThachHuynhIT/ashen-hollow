import Phaser from 'phaser';
import type { EventBus, GameEvents } from '../core/events';
import { PALETTE } from '../data/palette';
import { axialToOffset, type Hex } from '../hex';
import type { GameWorld } from '../sim/GameWorld';
import { TICKS_PER_SECOND, type GameSpeed } from '../sim/SimClock';
import { createButton, textStyle, TOUCH_TARGET, type Button } from '../ui/theme';
import { SCENES } from './keys';
import type { HudSceneData } from './WorldScene';

const SPEED_LABELS: Record<GameSpeed, string> = { 0: '❚❚', 1: '1×', 2: '2×', 3: '3×' };
const MARGIN = 12;
const GAP = 6;

/**
 * Screen-space overlay (camera zoom 1, never scrolls). Displays world state and sends
 * player intents back through the bus — it never touches the simulation directly.
 */
export class HudScene extends Phaser.Scene {
  private bus!: EventBus<GameEvents>;
  private world!: GameWorld;
  private status!: Phaser.GameObjects.Text;
  private info!: Phaser.GameObjects.Text;
  private infoBg!: Phaser.GameObjects.Rectangle;
  private fps!: Phaser.GameObjects.Text;
  private speedButtons = new Map<GameSpeed, Button>();
  private zoomButtons: Button[] = [];
  private hovered: Hex | null = null;
  private selected: Hex | null = null;
  private zoom = 1;
  private unsubscribers: (() => void)[] = [];

  constructor() {
    super(SCENES.hud);
  }

  create({ bus, world, initialZoom }: HudSceneData): void {
    this.bus = bus;
    this.world = world;
    this.zoom = initialZoom;
    this.hovered = null;
    this.selected = null;

    this.status = this.add.text(MARGIN, MARGIN, '', textStyle(13, PALETTE.bone));
    this.status.setShadow(1, 1, '#000', 0);
    this.fps = this.add.text(MARGIN, MARGIN + 20, '', textStyle(11, PALETTE.ashGrey));

    this.infoBg = this.add
      .rectangle(0, 0, 10, 10, PALETTE.ink, 0.85)
      .setOrigin(0, 1)
      .setStrokeStyle(1, PALETTE.shadowPlum);
    this.info = this.add.text(0, 0, '', { ...textStyle(13), lineSpacing: 4 }).setOrigin(0, 1);

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
      bus.on('hex:hover', ({ hex }) => {
        this.hovered = hex;
        this.refreshInfo();
      }),
      bus.on('hex:select', ({ hex }) => {
        this.selected = hex;
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
    this.fps.setText(`${Math.round(this.game.loop.actualFps)} FPS`);
  }

  private layout(): void {
    const { width, height } = this.scale;
    // Status text wraps before it reaches the speed buttons (narrow phones).
    const speedBarWidth = 4 * (TOUCH_TARGET + GAP);
    this.status.setWordWrapWidth(Math.max(120, width - speedBarWidth - MARGIN * 3));
    this.fps.setY(this.status.y + this.status.height + 2);
    // Speed controls: top-right.
    [0, 1, 2, 3].forEach((speed, i) => {
      const x = width - MARGIN - TOUCH_TARGET / 2 - (3 - i) * (TOUCH_TARGET + GAP);
      this.speedButtons
        .get(speed as GameSpeed)
        ?.container.setPosition(x, MARGIN + TOUCH_TARGET / 2);
    });
    // Zoom controls: bottom-right, stacked.
    this.zoomButtons.forEach((button, i) => {
      button.container.setPosition(
        width - MARGIN - TOUCH_TARGET / 2,
        height - MARGIN - TOUCH_TARGET / 2 - (1 - i) * (TOUCH_TARGET + GAP),
      );
    });
    this.positionInfo();
  }

  private positionInfo(): void {
    const { width, height } = this.scale;
    const pad = 8;
    // Leave room for the zoom buttons on the right.
    this.info.setWordWrapWidth(width - MARGIN * 3 - TOUCH_TARGET - pad * 2);
    this.info.setPosition(MARGIN + pad, height - MARGIN - pad);
    this.infoBg
      .setPosition(MARGIN, height - MARGIN)
      .setSize(this.info.width + pad * 2, this.info.height + pad * 2)
      .setVisible(this.info.text.length > 0);
  }

  private refreshStatus(): void {
    const { clock, seed } = this.world;
    const seconds = Math.floor(clock.tick / TICKS_PER_SECOND);
    const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
    const ss = String(seconds % 60).padStart(2, '0');
    const state = clock.paused ? 'TẠM DỪNG' : `${clock.speed}×`;
    this.status.setText(
      `Ashen Hollow · hạt giống ${seed} · ${mm}:${ss} · ${state} · zoom ${this.zoom}×`,
    );
    this.fps.setY(this.status.y + this.status.height + 2);
  }

  private refreshInfo(): void {
    // Mouse users see what they hover; touch users see their selection.
    const h = this.hovered ?? this.selected;
    if (!h || !this.world.map.inBounds(h)) {
      this.info.setText('');
      this.positionInfo();
      return;
    }
    const t = this.world.map.terrainOf(h);
    const { col, row } = axialToOffset(h);
    const move = t.moveCost === null ? 'không thể đi qua' : `di chuyển ${t.moveCost}`;
    const def =
      t.defenseBonus === 0 ? '' : ` · phòng thủ ${t.defenseBonus > 0 ? '+' : ''}${t.defenseBonus}`;
    const sight = t.blocksSight ? ' · che tầm nhìn' : '';
    const tag = this.selected && h === this.selected ? ' [đã chọn]' : '';
    this.info.setText(
      [
        `${t.nameVi} (${t.name})${tag}`,
        `${move}${def}${sight}`,
        `hex ${h.q},${h.r} · ô ${col},${row}`,
      ].join('\n'),
    );
    this.positionInfo();
  }
}
