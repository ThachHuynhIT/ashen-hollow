import Phaser from 'phaser';

/**
 * Integer zoom levels only — pixel art must stay on whole-pixel multiples to look crisp.
 */
export const ZOOM_LEVELS = [1, 2, 3, 4, 5, 6] as const;

/** Pointer travel (screen px) before a press turns into a drag instead of a tap. */
const DRAG_THRESHOLD = 8;
/** Pinch distance ratio needed to step one zoom level. */
const PINCH_STEP_IN = 1.35;
const PINCH_STEP_OUT = 1 / PINCH_STEP_IN;
/** Keyboard pan speed in screen pixels per second. */
const KEY_PAN_SPEED = 700;

export interface CameraControllerOptions {
  /** World-space bounds the camera may look at. */
  bounds: { x: number; y: number; width: number; height: number };
  /** A short press/tap that didn't become a drag or pinch (world coordinates). */
  onTap?: (worldX: number, worldY: number, pointer: Phaser.Input.Pointer) => void;
  onZoomChange?: (zoom: number) => void;
}

interface DragState {
  pointerId: number;
  startX: number;
  startY: number;
  scrollX: number;
  scrollY: number;
  dragging: boolean;
}

interface PinchState {
  distance: number;
  midX: number;
  midY: number;
}

/**
 * Unified camera input for mouse, keyboard and touch:
 *   - drag (any button / one finger) to pan
 *   - wheel or pinch to zoom, anchored under the cursor / between the fingers
 *   - WASD / arrow keys to pan
 *   - tap → onTap (selection), suppressed after drags and pinches
 */
export class CameraController {
  private readonly cam: Phaser.Cameras.Scene2D.Camera;
  private zoomIndex = 0;
  private drag: DragState | null = null;
  private pinch: PinchState | null = null;
  /** Set after a pinch; taps are ignored until every finger is lifted. */
  private suppressTap = false;
  private readonly keys: Record<'up' | 'down' | 'left' | 'right', Phaser.Input.Keyboard.Key[]>;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly options: CameraControllerOptions,
  ) {
    this.cam = scene.cameras.main;
    const { x, y, width, height } = options.bounds;
    this.cam.setBounds(x, y, width, height);

    const kb = scene.input.keyboard;
    const K = Phaser.Input.Keyboard.KeyCodes;
    const add = (...codes: number[]) => (kb ? codes.map((c) => kb.addKey(c, false)) : []);
    this.keys = {
      up: add(K.W, K.UP),
      down: add(K.S, K.DOWN),
      left: add(K.A, K.LEFT),
      right: add(K.D, K.RIGHT),
    };

    scene.input.mouse?.disableContextMenu();
    scene.input.on(Phaser.Input.Events.POINTER_DOWN, this.onPointerDown, this);
    scene.input.on(Phaser.Input.Events.POINTER_MOVE, this.onPointerMove, this);
    scene.input.on(Phaser.Input.Events.POINTER_UP, this.onPointerUp, this);
    scene.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.onPointerUp, this);
    scene.input.on(Phaser.Input.Events.POINTER_WHEEL, this.onWheel, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);

    this.setZoomIndex(this.defaultZoomIndex());
  }

  get zoom(): number {
    return this.cam.zoom;
  }

  centerOn(worldX: number, worldY: number): void {
    this.cam.centerOn(worldX, worldY);
  }

  /** Step zoom in (+1) or out (−1), anchored at a screen point (defaults to the centre). */
  stepZoom(direction: 1 | -1, screenX = this.cam.width / 2, screenY = this.cam.height / 2): void {
    this.setZoomIndex(this.zoomIndex + direction, screenX, screenY);
  }

  update(deltaMs: number): void {
    this.updatePinch();
    const down = (keys: Phaser.Input.Keyboard.Key[]) => keys.some((k) => k.isDown);
    const dx = (down(this.keys.right) ? 1 : 0) - (down(this.keys.left) ? 1 : 0);
    const dy = (down(this.keys.down) ? 1 : 0) - (down(this.keys.up) ? 1 : 0);
    if (dx || dy) {
      const step = (KEY_PAN_SPEED * deltaMs) / 1000 / this.cam.zoom;
      this.cam.scrollX += dx * step;
      this.cam.scrollY += dy * step;
    }
  }

  // --- zoom -----------------------------------------------------------------

  /**
   * Pick a zoom that shows roughly 20 hexes across, whatever the screen size.
   * Touch screens get at least 2× so a hex (64 px) is bigger than a fingertip.
   */
  private defaultZoomIndex(): number {
    const minForTouch = this.scene.sys.game.device.input.touch ? 2 : 1;
    const target = Math.max(minForTouch, Math.round(this.cam.width / (20 * 32)));
    const idx = ZOOM_LEVELS.findIndex((z) => z >= target);
    return idx < 0 ? ZOOM_LEVELS.length - 1 : idx;
  }

  private setZoomIndex(
    index: number,
    screenX = this.cam.width / 2,
    screenY = this.cam.height / 2,
  ): void {
    const clamped = Phaser.Math.Clamp(index, 0, ZOOM_LEVELS.length - 1);
    const newZoom = ZOOM_LEVELS[clamped]!;
    // Keep the world point under (screenX, screenY) fixed while zooming.
    const before = this.screenToWorld(screenX, screenY);
    this.zoomIndex = clamped;
    this.cam.setZoom(newZoom);
    const halfW = this.cam.width / 2;
    const halfH = this.cam.height / 2;
    this.cam.scrollX = before.x - halfW - (screenX - halfW) / newZoom;
    this.cam.scrollY = before.y - halfH - (screenY - halfH) / newZoom;
    this.options.onZoomChange?.(newZoom);
  }

  /**
   * Screen → world using the camera's current scroll/zoom directly (the camera matrix is
   * only refreshed at render time, so getWorldPoint can be one frame stale mid-update).
   */
  private screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
    const halfW = this.cam.width / 2;
    const halfH = this.cam.height / 2;
    return {
      x: this.cam.scrollX + halfW + (screenX - halfW) / this.cam.zoom,
      y: this.cam.scrollY + halfH + (screenY - halfH) / this.cam.zoom,
    };
  }

  private onWheel(
    pointer: Phaser.Input.Pointer,
    _over: unknown,
    _dx: number,
    deltaY: number,
  ): void {
    if (deltaY === 0) return;
    this.stepZoom(deltaY < 0 ? 1 : -1, pointer.x, pointer.y);
  }

  // --- drag & tap -------------------------------------------------------------

  private activeTouches(): Phaser.Input.Pointer[] {
    return this.scene.input.manager.pointers.filter((p) => p.isDown);
  }

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    if (this.activeTouches().length >= 2) {
      // Second finger landed: switch from drag to pinch.
      this.drag = null;
      return;
    }
    this.drag = {
      pointerId: pointer.id,
      startX: pointer.x,
      startY: pointer.y,
      scrollX: this.cam.scrollX,
      scrollY: this.cam.scrollY,
      dragging: false,
    };
  }

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    const drag = this.drag;
    if (!drag || drag.pointerId !== pointer.id || !pointer.isDown || this.pinch) return;
    const dx = pointer.x - drag.startX;
    const dy = pointer.y - drag.startY;
    if (!drag.dragging && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    drag.dragging = true;
    this.cam.scrollX = drag.scrollX - dx / this.cam.zoom;
    this.cam.scrollY = drag.scrollY - dy / this.cam.zoom;
  }

  private onPointerUp(pointer: Phaser.Input.Pointer): void {
    const drag = this.drag;
    const isTap =
      drag !== null && drag.pointerId === pointer.id && !drag.dragging && !this.suppressTap;
    if (drag?.pointerId === pointer.id) this.drag = null;
    if (this.activeTouches().length === 0) this.suppressTap = false;
    // Only primary-button / touch presses select things; right-click is reserved for orders.
    if (isTap && pointer.button === 0) {
      const world = this.screenToWorld(pointer.x, pointer.y);
      this.options.onTap?.(world.x, world.y, pointer);
    }
  }

  // --- pinch -------------------------------------------------------------------

  private updatePinch(): void {
    const touches = this.activeTouches();
    if (touches.length < 2) {
      this.pinch = null;
      return;
    }
    const [a, b] = touches as [Phaser.Input.Pointer, Phaser.Input.Pointer];
    const distance = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y));
    const midX = (a.x + b.x) / 2;
    const midY = (a.y + b.y) / 2;
    this.suppressTap = true;
    this.drag = null;

    if (!this.pinch) {
      this.pinch = { distance, midX, midY };
      return;
    }
    // Two-finger pan follows the midpoint.
    this.cam.scrollX -= (midX - this.pinch.midX) / this.cam.zoom;
    this.cam.scrollY -= (midY - this.pinch.midY) / this.cam.zoom;
    this.pinch.midX = midX;
    this.pinch.midY = midY;

    const ratio = distance / this.pinch.distance;
    if (ratio > PINCH_STEP_IN || ratio < PINCH_STEP_OUT) {
      this.stepZoom(ratio > 1 ? 1 : -1, midX, midY);
      this.pinch.distance = distance;
    }
  }

  // --- lifecycle -----------------------------------------------------------------

  private destroy(): void {
    this.scene.input.off(Phaser.Input.Events.POINTER_DOWN, this.onPointerDown, this);
    this.scene.input.off(Phaser.Input.Events.POINTER_MOVE, this.onPointerMove, this);
    this.scene.input.off(Phaser.Input.Events.POINTER_UP, this.onPointerUp, this);
    this.scene.input.off(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.onPointerUp, this);
    this.scene.input.off(Phaser.Input.Events.POINTER_WHEEL, this.onWheel, this);
  }
}
