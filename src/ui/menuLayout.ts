import type { Point, Size } from './hud/layout';

/** Main menu buttons (spec §10.2). */
export const MENU_BUTTON = { w: 200, h: 52, gap: 12 } as const;
/** Height kept free at the bottom for the version footer. */
export const MENU_FOOTER_H = 28;

export interface MenuLayout {
  /** Centre of the logo board. */
  logo: Point;
  /** Centre of each visible button, top to bottom. */
  buttons: Point[];
  /** Centre of the footer line. */
  footer: Point;
}

/**
 * Logo board on the upper third, the visible buttons stacked under it from mid-screen.
 * When the stack would run into the footer (short landscape phones) the stack moves up
 * to end just above the footer, and the logo moves up with it so they never overlap.
 */
export const layoutMenu = (screen: Size, logo: Size, buttonCount: number): MenuLayout => {
  const cx = screen.w / 2;
  const logoMinY = logo.h / 2 + 8;
  const stackH = buttonCount * MENU_BUTTON.h + Math.max(0, buttonCount - 1) * MENU_BUTTON.gap;
  const limit = screen.h - MENU_FOOTER_H - 8;
  let logoY = Math.max(logoMinY, screen.h / 3);
  let top = Math.max(logoY + logo.h / 2 + 24, screen.h * 0.5);
  if (top + stackH > limit) {
    top = limit - stackH;
    logoY = Math.max(logoMinY, Math.min(logoY, top - 8 - logo.h / 2));
    top = Math.max(top, logoY + logo.h / 2 + 8);
  }
  const buttons = Array.from({ length: buttonCount }, (_, i) => ({
    x: cx,
    y: top + MENU_BUTTON.h / 2 + i * (MENU_BUTTON.h + MENU_BUTTON.gap),
  }));
  return {
    logo: { x: cx, y: logoY },
    buttons,
    footer: { x: cx, y: screen.h - MENU_FOOTER_H / 2 },
  };
};
