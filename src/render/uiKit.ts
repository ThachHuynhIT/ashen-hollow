import { UI_FRAMES, type UiFrame, type UiFrameDef } from './uiArt';

/**
 * Kenney "Pixel UI Pack" (CC0) 9-slice frames laid over the generated UI frames
 * (docs/assets.manifest.yml, docs/licenses/kenney-pixel-ui-pack/). Frames not listed here
 * (hotbar slots, bars) stay generated. A frame only counts as kit art once its PNG has
 * really been loaded and blitted into the `ui` atlas (`activateUiKitFrames`), so a missing
 * file falls back to the generated frame.
 */
export const UI_KIT_DIR = 'assets/ui/kenney-pixel-ui/';

/** Every kit frame is a 48×48 9-slice; frames that swap into each other share this size. */
export const UI_KIT_FRAME: UiFrameDef = { w: 48, h: 48, slice: 8, border: 5 };

/** Kit PNG (inside `UI_KIT_DIR`) painted over each UI frame. */
export const UI_KIT_FILES: Readonly<Partial<Record<UiFrame, string>>> = {
  panel: 'ancient_tan.png',
  tooltip: 'ancient_tan.png',
  button: 'ancient_tan.png',
  buttonHover: 'ancient_white.png',
  buttonDown: 'ancient_tan_pressed.png',
  buttonActive: 'outline_yellow.png',
  card: 'ancient_tan.png',
  cardUncommon: 'outline_green.png',
  cardRare: 'outline_yellow.png',
  cardSelected: 'outline_red.png',
};

export const kitTextureKey = (frame: UiFrame): string => `ui-kit-${frame}`;

const active = new Set<UiFrame>();

export const activateUiKitFrames = (frames: readonly UiFrame[]): void => {
  for (const f of frames) active.add(f);
};

export const resetUiKitFrames = (): void => active.clear();

/** Size, slice and border of `frame` as actually painted in the atlas. */
export const uiFrameDef = (frame: UiFrame): UiFrameDef =>
  active.has(frame) ? UI_KIT_FRAME : UI_FRAMES[frame];
