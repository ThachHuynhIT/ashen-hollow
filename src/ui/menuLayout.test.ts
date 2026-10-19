import { describe, expect, it } from 'vitest';
import { MENU_BUTTON, MENU_FOOTER_H, layoutMenu } from './menuLayout';

/** Logo board size measured in the browser: 2× borders on desktop, 1× on phones. */
const DESKTOP_LOGO = { w: 520, h: 150 };
const PHONE_LOGO = { w: 340, h: 100 };

const check = (screen: { w: number; h: number }, logo: { w: number; h: number }, n: number) => {
  const m = layoutMenu(screen, logo, n);
  const logoTop = m.logo.y - logo.h / 2;
  const logoBottom = m.logo.y + logo.h / 2;
  expect(logoTop).toBeGreaterThanOrEqual(0);
  m.buttons.forEach((b, i) => {
    const top = b.y - MENU_BUTTON.h / 2;
    const bottom = b.y + MENU_BUTTON.h / 2;
    expect(top, `button ${i} under the logo`).toBeGreaterThanOrEqual(logoBottom);
    expect(bottom, `button ${i} above the footer`).toBeLessThanOrEqual(screen.h - MENU_FOOTER_H);
    expect(b.x - MENU_BUTTON.w / 2, `button ${i} on screen`).toBeGreaterThanOrEqual(0);
    const next = m.buttons[i + 1];
    if (next) expect(next.y - b.y).toBe(MENU_BUTTON.h + MENU_BUTTON.gap);
  });
  return m;
};

describe('layoutMenu', () => {
  it('puts the logo on the upper third and the button at mid-screen on desktop', () => {
    const m = check({ w: 1280, h: 720 }, DESKTOP_LOGO, 1);
    expect(m.logo).toEqual({ x: 640, y: 240 });
    expect(m.buttons).toEqual([{ x: 640, y: 360 + MENU_BUTTON.h / 2 }]);
    expect(m.footer).toEqual({ x: 640, y: 720 - MENU_FOOTER_H / 2 });
  });

  it('fits a 375×812 phone', () => {
    check({ w: 375, h: 812 }, PHONE_LOGO, 1);
  });

  it('fits a landscape phone (812×375) and a small 320×480 screen', () => {
    check({ w: 812, h: 375 }, PHONE_LOGO, 1);
    check({ w: 320, h: 480 }, PHONE_LOGO, 1);
  });

  it('moves a tall stack up instead of running into the footer', () => {
    const m = check({ w: 812, h: 375 }, PHONE_LOGO, 3);
    expect(m.buttons[0]!.y - MENU_BUTTON.h / 2).toBeLessThan(375 * 0.5);
  });

  it('centres everything horizontally', () => {
    const m = layoutMenu({ w: 375, h: 812 }, PHONE_LOGO, 2);
    expect([m.logo.x, m.footer.x, ...m.buttons.map((b) => b.x)]).toEqual([
      187.5, 187.5, 187.5, 187.5,
    ]);
  });

  it('returns no buttons when none are visible', () => {
    expect(layoutMenu({ w: 375, h: 812 }, PHONE_LOGO, 0).buttons).toEqual([]);
  });
});
