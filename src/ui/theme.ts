import type Phaser from 'phaser';
import { toCss } from '../data/palette';
import { UI_PALETTE } from '../data/uiPalette';
import { UI_KEY } from '../render/atlas';
import type { UiFrame } from '../render/uiArt';
import { uiFrameDef } from '../render/uiKit';
import {
  DRAG_SLOP,
  LONG_PRESS_MS,
  TOUCH_TARGET,
  uiScaleFor,
  type Rect,
  type TooltipContent,
} from './hud/layout';

export { TOUCH_TARGET };

/**
 * UI styling shared by every Phaser-drawn screen: Stardew-style wood frames (nine-slices
 * from the generated `ui` texture) around cream cores, dark brown text with a light drop
 * shadow. Monospace is reserved for debug readouts.
 */
// Every face here ships precomposed Vietnamese glyphs (Georgia does not — its
// diacritics fall back to another font and render detached).
export const FONT_UI =
  '"Palatino Linotype", "Book Antiqua", "Noto Serif", "Times New Roman", Tinos, serif';
export const FONT_TITLE = FONT_UI;
export const FONT_DEBUG = 'ui-monospace, Consolas, monospace';

export const textStyle = (
  size: number,
  color: number = UI_PALETTE.text,
  family: string = FONT_UI,
): Phaser.Types.GameObjects.Text.TextStyle => ({
  fontFamily: family,
  fontSize: `${size}px`,
  color: toCss(color),
});

/** Text on a cream surface: dark brown with a 1 px light shadow down-right. */
export const addUiText = (
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  size: number,
  color: number = UI_PALETTE.text,
): Phaser.GameObjects.Text =>
  scene.add
    .text(x, y, text, textStyle(size, color))
    .setShadow(1, 1, toCss(UI_PALETTE.textShadow), 0, false, true);

/** Border pixel scale for this scene's viewport (1× on phones, 2× otherwise). */
export const uiScale = (scene: Phaser.Scene): 1 | 2 =>
  uiScaleFor(scene.scale.width, scene.scale.height);

/** Screen px of a frame's decorative edge at the current uiScale. */
export const frameBorder = (scene: Phaser.Scene, frame: UiFrame): number =>
  uiFrameDef(frame).border * uiScale(scene);

export interface UiBox {
  readonly image: Phaser.GameObjects.NineSlice;
  /** Logical (screen px) size. */
  readonly width: number;
  readonly height: number;
  /** Set the logical size; also picks up a uiScale change. */
  resize: (width: number, height: number) => void;
  /** Swap to another frame of the same source size (hover/pressed/selected states). */
  setFrame: (frame: UiFrame) => void;
}

/**
 * A nine-slice UI frame sized in logical screen px. The slice is built at `size / uiScale`
 * and scaled up, so borders stay whole pixels (1× or 2×) while the size is exact.
 */
export const createPanel = (
  scene: Phaser.Scene,
  frame: UiFrame,
  width: number,
  height: number,
  originX = 0,
  originY = 0,
): UiBox => {
  const { slice } = uiFrameDef(frame);
  let w = width;
  let h = height;
  const s = uiScale(scene);
  const image = scene.add
    .nineslice(0, 0, UI_KEY, frame, w / s, h / s, slice, slice, slice, slice)
    .setOrigin(originX, originY)
    .setScale(s);
  return {
    image,
    get width() {
      return w;
    },
    get height() {
      return h;
    },
    resize: (nextW, nextH) => {
      w = nextW;
      h = nextH;
      const scale = uiScale(scene);
      image.setSize(w / scale, h / scale).setScale(scale);
    },
    setFrame: (next) => {
      image.setFrame(next, false, false);
      image.updateUVs();
    },
  };
};

/** Implemented by src/ui/Tooltip.ts; `owner` makes sure only whoever showed it can hide it. */
export interface TooltipHost {
  showAtPointer: (content: TooltipContent, owner: string) => void;
  showAbove: (content: TooltipContent, anchor: Rect, owner: string) => void;
  hide: (owner: string) => void;
}

export interface TooltipSource {
  host: TooltipHost;
  content: () => TooltipContent | null;
}

export type PressState = 'idle' | 'hover' | 'down';

export interface PressOptions {
  onClick: () => void;
  onState?: (state: PressState) => void;
  /** Mouse: shown on hover. Touch: shown after a 400 ms hold; that release never clicks. */
  tooltip?: TooltipSource;
}

export interface PressHandle {
  /**
   * Abort any press in progress: stop the long-press timer, forget the press and hide this
   * button's tooltip. Needed because disableInteractive() fires no pointerout.
   */
  cancel: () => void;
}

let nextPressId = 0;

/**
 * Button behaviour for any nine-slice: hover/down states, click on release (only if the
 * press started here and didn't turn into a drag), tooltip on hover or long-press.
 */
export const bindPress = (
  scene: Phaser.Scene,
  target: Phaser.GameObjects.NineSlice,
  { onClick, onState, tooltip }: PressOptions,
): PressHandle => {
  const owner = `press-${nextPressId++}`;
  let timer: Phaser.Time.TimerEvent | null = null;
  let down = false;
  let longPressed = false;
  const stopTimer = (): void => {
    timer?.remove(false);
    timer = null;
  };
  const cancel = (): void => {
    stopTimer();
    down = false;
    longPressed = false;
    tooltip?.host.hide(owner);
  };
  const anchor = (): Rect => {
    const b = target.getBounds();
    return { x: b.x, y: b.y, w: b.width, h: b.height };
  };

  target
    .setInteractive({ useHandCursor: true })
    .on('pointerover', (pointer: Phaser.Input.Pointer) => {
      if (pointer.wasTouch) return;
      onState?.('hover');
      const content = tooltip?.content();
      if (tooltip && content) tooltip.host.showAtPointer(content, owner);
    })
    .on('pointerout', () => {
      cancel();
      onState?.('idle');
    })
    .on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      down = true;
      longPressed = false;
      onState?.('down');
      if (!pointer.wasTouch || !tooltip) return;
      stopTimer();
      timer = scene.time.delayedCall(LONG_PRESS_MS, () => {
        timer = null;
        const content = tooltip.content();
        if (!down || !content) return;
        longPressed = true;
        tooltip.host.showAbove(content, anchor(), owner);
      });
    })
    .on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (down && pointer.getDistance() > DRAG_SLOP) stopTimer();
    })
    .on('pointerup', (pointer: Phaser.Input.Pointer) => {
      stopTimer();
      const wasDown = down;
      down = false;
      onState?.(pointer.wasTouch ? 'idle' : 'hover');
      if (longPressed) {
        // Releasing after a long-press only closes the tooltip; it never clicks.
        longPressed = false;
        tooltip?.host.hide(owner);
        return;
      }
      if (wasDown && pointer.getDistance() <= DRAG_SLOP) onClick();
    })
    .once('destroy', cancel);
  return { cancel };
};

export interface ButtonOptions {
  width?: number;
  height?: number;
  fontSize?: number;
  /** Optional pixel-art icon (texture key + frame), drawn above the label at integer scale. */
  icon?: { key: string; frame: string; scale?: number };
  onClick: () => void;
  /** Optional help shown on hover / long-press. */
  tooltip?: TooltipSource;
}

export interface Button {
  container: Phaser.GameObjects.Container;
  setActive: (active: boolean) => void;
  setLabel: (label: string) => void;
  setVisible: (visible: boolean) => void;
  /**
   * Disabled: dimmed, no hover frame and clicks do nothing — but the tooltip still shows, so
   * it can say why (e.g. "Không đủ vàng").
   */
  setEnabled: (enabled: boolean) => void;
}

/** Opacity of a disabled button. */
const DISABLED_ALPHA = 0.55;

/** Wood button: lighter core on hover, sunk when pressed, gold ring when active. */
export const createButton = (
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  {
    width = TOUCH_TARGET,
    height = TOUCH_TARGET,
    fontSize = 15,
    icon,
    onClick,
    tooltip,
  }: ButtonOptions,
): Button => {
  const box = createPanel(scene, 'button', width, height, 0.5, 0.5);
  const children: Phaser.GameObjects.GameObject[] = [box.image];
  let text: Phaser.GameObjects.Text;
  if (icon) {
    const img = scene.add
      .image(0, height / 2 - fontSize - 6, icon.key, icon.frame)
      .setOrigin(0.5, 1)
      .setScale(icon.scale ?? 1);
    text = addUiText(scene, 0, height / 2 - 4, label, fontSize).setOrigin(0.5, 1);
    children.push(img, text);
  } else {
    text = addUiText(scene, 0, 0, label, fontSize).setOrigin(0.5).setAlign('center');
    children.push(text);
  }
  const container = scene.add.container(x, y, children).setSize(width, height);
  let active = false;
  let enabled = true;
  let state: PressState = 'idle';

  const refresh = (): void => {
    box.setFrame(
      state === 'down'
        ? 'buttonDown'
        : active
          ? 'buttonActive'
          : state === 'hover'
            ? 'buttonHover'
            : 'button',
    );
  };
  const press = bindPress(scene, box.image, {
    onClick: () => {
      if (enabled) onClick();
    },
    tooltip,
    onState: (next) => {
      state = enabled ? next : 'idle';
      refresh();
    },
  });

  // Borders switch between 1× and 2× when the viewport crosses 600 px.
  const onResize = (): void => box.resize(width, height);
  scene.scale.on('resize', onResize);
  container.once('destroy', () => scene.scale.off('resize', onResize));

  return {
    container,
    setActive: (value) => {
      active = value;
      refresh();
    },
    setLabel: (value) => text.setText(value),
    setVisible: (value) => {
      container.setVisible(value);
      if (value) {
        box.image.setInteractive();
      } else {
        box.image.disableInteractive();
        press.cancel();
        state = 'idle';
        refresh();
      }
    },
    setEnabled: (value) => {
      enabled = value;
      container.setAlpha(value ? 1 : DISABLED_ALPHA);
      if (!value) state = 'idle';
      refresh();
    },
  };
};
