import { afterEach, describe, expect, it } from 'vitest';
import { UI_FRAMES, UI_FRAME_IDS } from './uiArt';
import {
  UI_KIT_FILES,
  UI_KIT_FRAME,
  activateUiKitFrames,
  kitTextureKey,
  resetUiKitFrames,
  uiFrameDef,
} from './uiKit';

afterEach(() => resetUiKitFrames());

describe('uiKit', () => {
  it('maps only known UI frames, never the hotbar slots or the bar', () => {
    for (const id of Object.keys(UI_KIT_FILES)) expect(UI_FRAME_IDS).toContain(id);
    for (const id of ['slot', 'slotHover', 'slotSelected', 'bar']) expect(UI_KIT_FILES).not.toHaveProperty(id);
  });

  it('gives frames that swap into each other (button, card states) the same kit size', () => {
    expect(UI_KIT_FRAME.w).toBe(UI_KIT_FRAME.h);
    expect(UI_KIT_FRAME.slice * 2).toBeLessThan(UI_KIT_FRAME.w);
    expect(UI_KIT_FRAME.border).toBeLessThanOrEqual(UI_KIT_FRAME.slice);
  });

  it('reports the generated definition until a frame is activated, then the kit one', () => {
    expect(uiFrameDef('panel')).toBe(UI_FRAMES.panel);
    activateUiKitFrames(['panel']);
    expect(uiFrameDef('panel')).toBe(UI_KIT_FRAME);
    expect(uiFrameDef('button')).toBe(UI_FRAMES.button);
  });

  it('uses one texture key per frame', () => {
    expect(kitTextureKey('panel')).not.toBe(kitTextureKey('button'));
  });
});
