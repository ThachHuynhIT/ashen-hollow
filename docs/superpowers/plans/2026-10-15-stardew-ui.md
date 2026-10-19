# UI kiểu Stardew Valley — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thay HUD "panel mực tối + chữ serif" và menu chính bằng giao diện giống Stardew Valley (khung gỗ nâu dày, lõi giấy kem, chữ nâu có bóng, hotbar ô vuông, hộp đồng hồ, tooltip, toast), vẽ hoàn toàn bằng texture UI sinh bằng code, mà không làm mất chức năng HUD nào của Phase 1.

**Architecture:** Art UI là các hàm thuần TS trong `src/render/uiArt.ts` (không Phaser, có test) vẽ vào `PixelCanvas`, được đóng gói thành texture `ui` trong `PreloadScene` và vẽ lên màn hình bằng `nineslice` qua `createPanel` (`src/ui/theme.ts`). HUD được tách thành các class nhỏ trong `src/ui/hud/*` (mỗi class có `layout()`/`destroy()`, không đọc `GameWorld`); mọi phép tính thuần (giờ từ tick, màu thanh, gộp toast, đặt tooltip, co hotbar, bố cục thẻ) nằm trong `src/ui/hud/layout.ts` và được test bằng Vitest. `HudScene` chỉ còn nghe `EventBus`, đọc world, chuyển dữ liệu thuần cho các phần và gọi `layout()`.

**Tech Stack:** TypeScript (strict) · Phaser 4.2.1 · bitECS 0.4 · Vitest 5 · Vite 8.

**Spec:** `docs/superpowers/specs/2026-10-13-stardew-ui-design.md`

**Repo:** `D:\WorkSpace\ashen-hollow`, nhánh `ui-stardew`. Trong shell Git Bash trên Windows, chạy mọi lệnh npm/npx kèm `< /dev/null` (nếu không có thể treo). Nếu trình duyệt vẫn hiện code cũ thì khởi động lại `npm run dev` (xem `CLAUDE.md`).

## Global Constraints

- `src/sim`, `src/data`, `src/core` không import Phaser (ESLint `no-restricted-imports`); trong phạm vi này `src/data` chỉ thêm `uiPalette.ts` và trường `descVi`.
- Pixel UI chỉ lấy từ `UI_PALETTE` (`src/data/uiPalette.ts`), pixel thế giới chỉ lấy từ `PALETTE`; giá trị `UI_PALETTE` chép nguyên văn từ spec §3.
- Giữ `FONT_UI` hiện tại; không đổi font, không thêm âm thanh.
- `MARGIN = 10` px từ mép màn hình; mọi toạ độ tính lại trong `layout()` khi resize.
- `uiScale = 2` khi `min(width, height) ≥ 600`, ngược lại `1`; nineslice tạo ở kích thước `logic / uiScale` rồi `setScale(uiScale)`. Kích thước logic không phụ thuộc `uiScale`.
- Mọi vùng chạm ≥ 44×44 px logic. Ô hotbar 48 px, cách 4 px → cách 2 px → ô 44 px → cuộn ngang; không bao giờ dưới 44 px.
- Chữ trên nền kem: `FONT_UI`, màu `UI_PALETTE.text`, `setShadow(1, 1, textShadow, 0, false, true)`.
- Tooltip rộng tối đa 220 px, lệch (+16, +16) so với con trỏ, lật/kẹp khi tràn; bấm giữ 400 ms trên cảm ứng; thông tin bản đồ hiện sau 300 ms đứng yên.
- Toast: hộp `tooltip` cao 32 px, trượt vào 200 ms, giữ 5 s, mờ 400 ms, tối đa 4, trùng chữ → "… ×N".
- Thẻ colonist 168×48 px; thanh nhu cầu `good` > 50, `warn` 20–50, `bad` < 20.
- Giữ nguyên interface `Button` và các trường hiện có của `ButtonOptions`, mọi event bus và mọi phím tắt của Phase 1.
- Texture `ui` chỉ tạo một lần (`textures.exists`).
- Chữ cho người chơi bằng tiếng Việt, viết hoa đầu câu.
- Trước khi coi một task là xong: `npm test`, `npm run lint`, `npm run typecheck` đều pass. Commit bằng `git add` từng đường dẫn cụ thể; message kết thúc bằng một dòng trống rồi `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Dòng nhật ký dài trên điện thoại 375 px lặp lại nhiều lần** ("Lê Văn Tám đã chết vì kiệt sức." ×3): chữ phải cắt bằng "…" nhưng vẫn giữ hậu tố "×3" và không tràn hộp → test trong Task 2 ("keeps the ×N suffix when the text is cut").
2. **Tooltip rộng hơn cả màn hình** (màn 320 px, tooltip 300+ px): phải dính vào mép trái/trên, không bao giờ toạ độ âm → test trong Task 2 ("sticks to the edge when it is bigger than the screen").
3. **Điện thoại xoay ngang, rất ít chiều cao** cho thẻ colonist: vẫn hiện ít nhất một thẻ (khi đó là thẻ "+N"), không thẻ nào chồng lên hotbar → test trong Task 2 ("always leaves room for one card" và "shows only +N when one slot is left").
4. **Cùng một sự kiện lặp lại khi chồng toast đã đầy và toast trùng là toast cũ nhất**: phải gộp thành ×2, không làm rơi toast nào → test trong Task 2 ("merging into the oldest of a full stack drops nothing").
5. **Đồng hồ ở tick cuối ngày và qua nửa đêm**: phải ra "05:59" và "00:00", không bao giờ "24:00" hay "06:00" sớm → test trong Task 2 ("passes midnight without hour 24 and ends the day at 05:59").

---

## File Structure

| File | Trách nhiệm |
|---|---|
| `src/data/uiPalette.ts` (mới) | `UI_PALETTE` và `UI_COLORS` (danh sách phẳng để test/kiểm tra) |
| `src/render/uiArt.ts` (mới) | `paintUiFrame`, `paintUiDecor`, `UI_FRAMES`, `UI_DECOR`, `DIAL`; nền menu `paintSky`, `paintHills`, `menuPixelScale` |
| `src/render/uiArt.test.ts` (mới) | Kích thước frame, góc bo, chỉ màu UI, slot/slotSelected, nền menu |
| `src/ui/hud/layout.ts` (mới) | Hằng bố cục + logic thuần: `uiScaleFor`, đồng hồ, `needColor`, toast, tooltip, hotbar, thẻ, kiểu `TooltipContent` |
| `src/ui/hud/layout.test.ts` (mới) | Test toàn bộ logic thuần |
| `src/data/buildings.ts` (sửa) | `descVi` trong `BuildingDef` + nội dung |
| `src/data/data.test.ts` (sửa) | Test `descVi` không rỗng |
| `src/render/atlas.ts` (sửa) | `UI_KEY`, `buildUiTexture`, `addPixelTexture` |
| `src/scenes/PreloadScene.ts` (sửa) | Gọi `buildUiTexture` |
| `src/ui/theme.ts` (viết lại) | `textStyle`, `addUiText`, `uiScale`, `frameBorder`, `createPanel`, `bindPress`, `createButton` (nineslice), `TooltipHost` |
| `src/ui/ContentBox.ts` (mới) | Khung tự co giãn quanh `TooltipContent` (dùng cho tooltip, panel chọn, gợi ý, seed) |
| `src/ui/Tooltip.ts` (mới) | Tooltip dùng chung: theo chuột / phía trên ô khi bấm giữ |
| `src/ui/hud/ClockBox.ts` (mới) | §5.1: đồng hồ + hàng nút tốc độ |
| `src/ui/hud/ResourceBox.ts` (mới) | §5.2: tài nguyên, số nảy khi đổi |
| `src/ui/hud/Hotbar.ts` (mới) | §5.3: ô tab, ô lệnh/công trình, chọn/hover, co và cuộn |
| `src/ui/hud/ColonistPanel.ts` (mới) | §5.4: thẻ colonist, thanh Đói/Ngủ, "+N" |
| `src/ui/hud/ToastStack.ts` (mới) | §5.5: toast trượt/giữ/mờ/gộp |
| `src/scenes/HudScene.ts` (viết lại) | Ghép các phần, nghe bus, tooltip bản đồ, panel chọn, gợi ý, zoom, `layout()` |
| `src/scenes/MainMenuScene.ts` (viết lại) | §6: trời dither, 3 lớp đồi parallax, bảng logo, nút gỗ, đom đóm |
| `docs/ART_STYLE.md`, `CLAUDE.md`, `README.md` (sửa) | Luật `UI_PALETTE`, bảng frame, ranh giới HUD, bảng điều khiển |

Thứ tự task khác gợi ý ban đầu ở một chỗ: logic thuần `layout.ts` (Task 2) đi **trước** `theme.ts` (Task 3) vì `theme.ts` cần `uiScaleFor`, `TooltipContent` và các hằng của nó.

---

### Task 1: `UI_PALETTE` và art UI sinh bằng code

**Files:**
- Create: `src/data/uiPalette.ts`
- Create: `src/render/uiArt.ts`
- Test: `src/render/uiArt.test.ts`

**Interfaces:**
- Consumes: `PixelCanvas`, `pixelHash` từ `src/render/pixel.ts`.
- Produces:
  - `UI_PALETTE` (đúng spec §3), `UI_COLORS: readonly number[]`.
  - `UI_FRAME_IDS`, `type UiFrame = 'panel' | 'button' | 'buttonHover' | 'buttonDown' | 'buttonActive' | 'slot' | 'slotHover' | 'slotSelected' | 'tooltip' | 'bar'`.
  - `interface UiFrameDef { w; h; slice; border }`, `UI_FRAMES: Readonly<Record<UiFrame, UiFrameDef>>`.
  - `UI_DECOR_IDS`, `type UiDecor = 'clockDial' | 'firefly'`, `UI_DECOR: Record<UiDecor, { w; h }>`.
  - `DIAL = { cx: 14, cy: 15, faceR: 9, height: 21 }`.
  - `paintUiFrame(frame: UiFrame): PixelCanvas`, `paintUiDecor(decor: UiDecor): PixelCanvas`.

Ghi chú: spec §4.1 mô tả hàm dạng `paintX(canvas, ox, oy)`, nhưng `terrainArt.ts` thực tế dùng `paintX(): PixelCanvas` rồi `atlas.ts` xếp kệ (`packShelves`) và `blit`. Plan theo đúng code hiện có. Bảng frame thêm `slotHover` (spec §5.3 yêu cầu "biến thể hover" của ô) và trường `border` (độ dày viền trang trí, để tính lề chữ; thay bằng atlas Aseprite thì sửa luôn trường này).

- [ ] **Step 1: Viết test thất bại**

Tạo `src/render/uiArt.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { UI_COLORS, UI_PALETTE } from '../data/uiPalette';
import type { PixelCanvas } from './pixel';
import {
  UI_DECOR,
  UI_DECOR_IDS,
  UI_FRAMES,
  UI_FRAME_IDS,
  paintUiDecor,
  paintUiFrame,
  type UiFrame,
} from './uiArt';

const colorAt = (c: PixelCanvas, x: number, y: number): number => {
  const i = (y * c.width + x) * 4;
  return (c.data[i]! << 16) | (c.data[i + 1]! << 8) | c.data[i + 2]!;
};

/** Opaque pixels whose colour is not in UI_PALETTE, as "x,y:#rrggbb". */
const foreignColors = (c: PixelCanvas): string[] => {
  const bad: string[] = [];
  for (let y = 0; y < c.height; y++) {
    for (let x = 0; x < c.width; x++) {
      if (c.alphaAt(x, y) === 0) continue;
      const color = colorAt(c, x, y);
      if (!UI_COLORS.includes(color)) bad.push(`${x},${y}:#${color.toString(16)}`);
    }
  }
  return bad;
};

const CORE: Record<UiFrame, number> = {
  panel: UI_PALETTE.cream,
  button: UI_PALETTE.cream,
  buttonHover: UI_PALETTE.creamLight,
  buttonDown: UI_PALETTE.creamDark,
  buttonActive: UI_PALETTE.cream,
  slot: UI_PALETTE.cream,
  slotHover: UI_PALETTE.creamLight,
  slotSelected: UI_PALETTE.cream,
  tooltip: UI_PALETTE.creamLight,
  bar: UI_PALETTE.woodDark,
};

describe('uiArt frames', () => {
  it('paints every frame at its declared size with a stretchable middle', () => {
    for (const id of UI_FRAME_IDS) {
      const def = UI_FRAMES[id];
      const art = paintUiFrame(id);
      expect([art.width, art.height], id).toEqual([def.w, def.h]);
      expect(def.slice * 2, id).toBeLessThan(Math.min(def.w, def.h));
      expect(def.border, id).toBeLessThanOrEqual(def.slice);
    }
  });

  it('fills each core with the right cream (or the empty bar colour)', () => {
    for (const id of UI_FRAME_IDS) {
      const art = paintUiFrame(id);
      const cx = Math.floor(art.width / 2);
      const cy = Math.floor(art.height / 2);
      expect(art.alphaAt(cx, cy), id).toBe(255);
      expect(colorAt(art, cx, cy), id).toBe(CORE[id]);
    }
  });

  it('cuts the outer corners of the wood frames', () => {
    for (const id of ['panel', 'button', 'buttonHover', 'buttonDown', 'buttonActive'] as const) {
      const art = paintUiFrame(id);
      const w = art.width - 1;
      const h = art.height - 1;
      const cut = [
        [0, 0], [1, 0], [0, 1],
        [w, 0], [w - 1, 0], [w, 1],
        [0, h], [1, h], [0, h - 1],
        [w, h], [w - 1, h], [w, h - 1],
      ];
      for (const [x, y] of cut) expect(art.alphaAt(x!, y!), `${id} ${x},${y}`).toBe(0);
      expect(colorAt(art, 2, 0), id).toBe(UI_PALETTE.outline);
      expect(colorAt(art, 1, 1), id).toBe(UI_PALETTE.outline);
    }
  });

  it('uses only UI_PALETTE colours', () => {
    for (const id of UI_FRAME_IDS) expect(foreignColors(paintUiFrame(id)), id).toEqual([]);
    for (const id of UI_DECOR_IDS) expect(foreignColors(paintUiDecor(id)), id).toEqual([]);
  });

  it('slot and slotSelected share the core but not the edge', () => {
    const slot = paintUiFrame('slot');
    const selected = paintUiFrame('slotSelected');
    for (let y = 3; y < 15; y++) {
      for (let x = 3; x < 15; x++) expect(colorAt(selected, x, y)).toBe(colorAt(slot, x, y));
    }
    expect(colorAt(slot, 0, 9)).toBe(UI_PALETTE.woodDark);
    expect(colorAt(selected, 0, 9)).toBe(UI_PALETTE.select);
    expect(colorAt(selected, 1, 9)).toBe(UI_PALETTE.select);
  });

  it('lights the pressed button from the bottom-right', () => {
    const up = paintUiFrame('button');
    const down = paintUiFrame('buttonDown');
    expect(colorAt(up, 1, 8)).toBe(UI_PALETTE.woodLight);
    expect(colorAt(down, 1, 8)).toBe(UI_PALETTE.woodDark);
    expect(colorAt(down, 14, 8)).toBe(UI_PALETTE.woodLight);
  });

  it('rings the active button core in gold', () => {
    const active = paintUiFrame('buttonActive');
    expect(colorAt(active, 4, 8)).toBe(UI_PALETTE.gold);
    expect(colorAt(active, 11, 8)).toBe(UI_PALETTE.gold);
  });
});

describe('uiArt decorations', () => {
  it('paints decorations at their declared size', () => {
    for (const id of UI_DECOR_IDS) {
      const art = paintUiDecor(id);
      expect([art.width, art.height], id).toEqual([UI_DECOR[id].w, UI_DECOR[id].h]);
    }
  });

  it('gives the firefly a gold heart and a soft halo', () => {
    const fly = paintUiDecor('firefly');
    expect(colorAt(fly, 1, 1)).toBe(UI_PALETTE.gold);
    expect(colorAt(fly, 1, 0)).toBe(UI_PALETTE.woodLight);
    expect(fly.alphaAt(0, 0)).toBe(0);
  });
});
```

- [ ] **Step 2: Chạy test để thấy thất bại**

Run: `npm test -- src/render/uiArt.test.ts < /dev/null`
Expected: FAIL — `Failed to resolve import "../data/uiPalette"` (module chưa tồn tại).

- [ ] **Step 3: Viết bảng màu UI**

Tạo `src/data/uiPalette.ts`:

```ts
/**
 * UI palette — the deliberate exception to "every pixel from Ashen 32": the interface is
 * warm and bright (wood frames, cream paper) so it reads against the dark world, the way
 * Stardew puts a wooden frame over every scene. World pixels still come from PALETTE.
 * See docs/ART_STYLE.md.
 */
export const UI_PALETTE = {
  outline: 0x2b1408, // viền ngoài cùng, gần đen nâu
  woodDark: 0x5b2c0f, // bóng gỗ, rãnh vân
  wood: 0xb5651d, // thân gỗ
  woodLight: 0xe0a050, // gờ sáng, highlight vân
  cream: 0xf5deb3, // lõi panel
  creamDark: 0xd9b77a, // bóng trong lõi, viền ô hotbar
  creamLight: 0xfff4dc, // lõi tooltip, ô đang hover
  text: 0x3b1d0a, // chữ chính
  textShadow: 0xd9b77a, // bóng chữ (lệch +1,+1) trên nền kem
  gold: 0xf2c94c, // số tài nguyên, sao
  select: 0xd03a2c, // viền ô hotbar đang chọn (đỏ kiểu Stardew)
  good: 0x5a9e3a, // thanh nhu cầu đầy
  warn: 0xe08a1e, // thanh nhu cầu thấp
  bad: 0xb8322a, // thanh nhu cầu nguy hiểm, lỗi đặt
  sky: [0xf6b26b, 0xf08a5d, 0xb85c7a, 0x6b4a8a], // gradient trời menu, trên → dưới
} as const;

/** Every colour of UI_PALETTE in one flat list (the sky gradient expanded). */
export const UI_COLORS: readonly number[] = Object.values(UI_PALETTE).flatMap((value) =>
  typeof value === 'number' ? [value] : [...value],
);
```

- [ ] **Step 4: Viết `uiArt.ts`**

Tạo `src/render/uiArt.ts`:

```ts
import { UI_PALETTE } from '../data/uiPalette';
import { PixelCanvas, pixelHash } from './pixel';

/**
 * Procedural UI art in the Stardew style: thick wood frames around a cream core, lit from
 * the top-left. Pure TS (no Phaser) so it is unit-tested; colours only from UI_PALETTE.
 * Every frame is a nine-slice source. To switch to hand-drawn art, load an Aseprite atlas
 * under UI_KEY with the same frame names and edit UI_FRAMES — nothing in the HUD changes.
 */

export const UI_FRAME_IDS = [
  'panel',
  'button',
  'buttonHover',
  'buttonDown',
  'buttonActive',
  'slot',
  'slotHover',
  'slotSelected',
  'tooltip',
  'bar',
] as const;
export type UiFrame = (typeof UI_FRAME_IDS)[number];

export interface UiFrameDef {
  /** Source size in texture pixels. */
  readonly w: number;
  readonly h: number;
  /** Nine-slice corner size, the same on all four sides. */
  readonly slice: number;
  /** Thickness of the decorative edge (texture px); content starts this far in. */
  readonly border: number;
}

export const UI_FRAMES: Readonly<Record<UiFrame, UiFrameDef>> = {
  panel: { w: 24, h: 24, slice: 8, border: 6 },
  button: { w: 16, h: 16, slice: 5, border: 4 },
  buttonHover: { w: 16, h: 16, slice: 5, border: 4 },
  buttonDown: { w: 16, h: 16, slice: 5, border: 4 },
  buttonActive: { w: 16, h: 16, slice: 5, border: 4 },
  slot: { w: 18, h: 18, slice: 4, border: 2 },
  slotHover: { w: 18, h: 18, slice: 4, border: 2 },
  slotSelected: { w: 18, h: 18, slice: 4, border: 3 },
  tooltip: { w: 12, h: 12, slice: 4, border: 2 },
  bar: { w: 8, h: 6, slice: 2, border: 1 },
};

/** Decorations drawn unstretched. */
export const UI_DECOR_IDS = ['clockDial', 'firefly'] as const;
export type UiDecor = (typeof UI_DECOR_IDS)[number];

export const UI_DECOR: Readonly<Record<UiDecor, { readonly w: number; readonly h: number }>> = {
  clockDial: { w: 28, h: 28 },
  firefly: { w: 3, h: 3 },
};

/** The dial's half disc: centre of its flat bottom edge, face radius, painted height. */
export const DIAL = { cx: 14, cy: 15, faceR: 9, height: 21 } as const;

const P = UI_PALETTE;

const strokeRect = (
  c: PixelCanvas,
  x: number,
  y: number,
  w: number,
  h: number,
  color: number,
): void => {
  c.fillRect(x, y, w, 1, color);
  c.fillRect(x, y + h - 1, w, 1, color);
  c.fillRect(x, y, 1, h, color);
  c.fillRect(x + w - 1, y, 1, h, color);
};

/** Cut each outer corner (corner pixel + its two neighbours) and close it diagonally. */
const roundCorners = (c: PixelCanvas): void => {
  const w = c.width - 1;
  const h = c.height - 1;
  const corners: [number, number, number, number][] = [
    [0, 0, 1, 1],
    [w, 0, -1, 1],
    [0, h, 1, -1],
    [w, h, -1, -1],
  ];
  for (const [x, y, dx, dy] of corners) {
    c.set(x, y, 0, 0);
    c.set(x + dx, y, 0, 0);
    c.set(x, y + dy, 0, 0);
    c.set(x + dx, y + dy, P.outline);
  }
};

interface WoodFrame {
  readonly w: number;
  readonly h: number;
  /** Wood thickness between the outline and the groove. */
  readonly wood: number;
  readonly core: number;
  /** Bevel lit from the bottom-right instead of the top-left (pressed look). */
  readonly pressed?: boolean;
  /** 1 px gold ring just inside the groove (active button). */
  readonly gold?: boolean;
  readonly seed: number;
}

/** Short horizontal woodDark grain dashes (2–4 px) inside the wood band. */
const paintGrain = (c: PixelCanvas, f: WoodFrame): void => {
  const groove = 1 + f.wood;
  const inBand = (x: number, y: number): boolean => {
    const insideOuter = x >= 2 && y >= 2 && x <= f.w - 3 && y <= f.h - 3;
    const insideGroove = x >= groove && y >= groove && x <= f.w - 1 - groove && y <= f.h - 1 - groove;
    return insideOuter && !insideGroove;
  };
  for (let y = 2; y <= f.h - 3; y++) {
    for (let x = 2; x <= f.w - 3; x++) {
      if (!inBand(x, y) || pixelHash(x, y, f.seed) >= 0.12) continue;
      const len = 2 + Math.floor(pixelHash(y, x, f.seed + 1) * 3);
      for (let i = 0; i < len && inBand(x + i, y); i++) c.set(x + i, y, P.woodDark);
      x += len;
    }
  }
};

/** outline → wood (lit edge, grain, shaded edge) → groove → core with an inner shadow. */
const paintWoodFrame = (f: WoodFrame): PixelCanvas => {
  const c = new PixelCanvas(f.w, f.h);
  c.fillRect(0, 0, f.w, f.h, P.wood);
  if (f.wood >= 3) paintGrain(c, f);
  const lit = f.pressed ? P.woodDark : P.woodLight;
  const shade = f.pressed ? P.woodLight : P.woodDark;
  c.fillRect(1, 1, f.w - 2, 1, lit);
  c.fillRect(1, 1, 1, f.h - 2, lit);
  c.fillRect(1, f.h - 2, f.w - 2, 1, shade);
  c.fillRect(f.w - 2, 1, 1, f.h - 2, shade);
  strokeRect(c, 0, 0, f.w, f.h, P.outline);
  const g = 1 + f.wood;
  strokeRect(c, g, g, f.w - 2 * g, f.h - 2 * g, P.woodDark);
  const k = g + 1;
  c.fillRect(k, k, f.w - 2 * k, f.h - 2 * k, f.core);
  if (f.gold) {
    strokeRect(c, k, k, f.w - 2 * k, f.h - 2 * k, P.gold);
  } else {
    c.fillRect(k, k, f.w - 2 * k, 1, P.creamDark);
    c.fillRect(k, k, 1, f.h - 2 * k, P.creamDark);
  }
  roundCorners(c);
  return c;
};

/** Hotbar slot: thin outer ring (1 or 2 px), creamDark inner edge, flat core. */
const paintSlot = (outer: number, outerWidth: number, core: number): PixelCanvas => {
  const { w, h } = UI_FRAMES.slot;
  const c = new PixelCanvas(w, h);
  c.fillRect(0, 0, w, h, core);
  for (let i = 0; i < outerWidth; i++) strokeRect(c, i, i, w - 2 * i, h - 2 * i, outer);
  strokeRect(c, outerWidth, outerWidth, w - 2 * outerWidth, h - 2 * outerWidth, P.creamDark);
  return c;
};

const paintTooltip = (): PixelCanvas => {
  const { w, h } = UI_FRAMES.tooltip;
  const c = new PixelCanvas(w, h);
  c.fillRect(0, 0, w, h, P.creamLight);
  strokeRect(c, 0, 0, w, h, P.outline);
  strokeRect(c, 1, 1, w - 2, h - 2, P.woodDark);
  return c;
};

const paintBar = (): PixelCanvas => {
  const { w, h } = UI_FRAMES.bar;
  const c = new PixelCanvas(w, h);
  c.fillRect(0, 0, w, h, P.woodDark);
  strokeRect(c, 0, 0, w, h, P.outline);
  return c;
};

const wood = (frame: UiFrame, rest: Omit<WoodFrame, 'w' | 'h'>): PixelCanvas =>
  paintWoodFrame({ w: UI_FRAMES[frame].w, h: UI_FRAMES[frame].h, ...rest });

export const paintUiFrame = (frame: UiFrame): PixelCanvas => {
  switch (frame) {
    case 'panel':
      return wood(frame, { wood: 4, core: P.cream, seed: 1 });
    case 'button':
      return wood(frame, { wood: 2, core: P.cream, seed: 2 });
    case 'buttonHover':
      return wood(frame, { wood: 2, core: P.creamLight, seed: 2 });
    case 'buttonDown':
      return wood(frame, { wood: 2, core: P.creamDark, pressed: true, seed: 2 });
    case 'buttonActive':
      return wood(frame, { wood: 2, core: P.cream, gold: true, seed: 2 });
    case 'slot':
      return paintSlot(P.woodDark, 1, P.cream);
    case 'slotHover':
      return paintSlot(P.woodDark, 1, P.creamLight);
    case 'slotSelected':
      return paintSlot(P.select, 2, P.cream);
    case 'tooltip':
      return paintTooltip();
    case 'bar':
      return paintBar();
  }
};

/** Wooden half disc on a plank, a sun on the morning side and a moon on the evening side. */
const paintClockDial = (): PixelCanvas => {
  const { w, h } = UI_DECOR.clockDial;
  const c = new PixelCanvas(w, h);
  const { cx, cy, faceR } = DIAL;
  for (let y = 0; y <= cy; y++) {
    for (let x = 0; x < w; x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      if (d > 13) continue;
      let color: number;
      if (d > 12) color = P.outline;
      else if (d > faceR + 1) color = x + y < cx + cy - 6 ? P.woodLight : P.wood;
      else if (d > faceR) color = P.woodDark;
      else color = P.creamLight;
      c.set(x, y, color);
    }
  }
  // Plank under the disc.
  c.fillRect(1, cy + 1, w - 2, 4, P.wood);
  c.fillRect(1, cy + 1, w - 2, 1, P.woodLight);
  c.fillRect(1, cy + 4, w - 2, 1, P.woodDark);
  strokeRect(c, 0, cy, w, 6, P.outline);
  // Sun (morning, left) and crescent moon (evening, right) on the face.
  c.fillRect(7, cy - 4, 2, 2, P.gold);
  c.set(21, cy - 5, P.creamDark);
  c.set(20, cy - 4, P.creamDark);
  c.set(20, cy - 3, P.creamDark);
  c.set(21, cy - 2, P.creamDark);
  return c;
};

const paintFirefly = (): PixelCanvas => {
  const c = new PixelCanvas(UI_DECOR.firefly.w, UI_DECOR.firefly.h);
  c.set(1, 0, P.woodLight);
  c.set(0, 1, P.woodLight);
  c.set(2, 1, P.woodLight);
  c.set(1, 2, P.woodLight);
  c.set(1, 1, P.gold);
  return c;
};

export const paintUiDecor = (decor: UiDecor): PixelCanvas => {
  switch (decor) {
    case 'clockDial':
      return paintClockDial();
    case 'firefly':
      return paintFirefly();
  }
};
```

- [ ] **Step 5: Chạy test để thấy pass**

Run: `npm test -- src/render/uiArt.test.ts < /dev/null`
Expected: PASS (10 tests).

- [ ] **Step 6: Lint + typecheck**

Run: `npm run lint < /dev/null && npm run typecheck < /dev/null`
Expected: cả hai exit 0.

- [ ] **Step 7: Commit**

```bash
git add src/data/uiPalette.ts src/render/uiArt.ts src/render/uiArt.test.ts
git commit -m "$(cat <<'EOF'
feat(ui): UI_PALETTE and generated Stardew-style frame art

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Logic HUD thuần (`layout.ts`) và `descVi` cho công trình

**Files:**
- Create: `src/ui/hud/layout.ts`
- Test: `src/ui/hud/layout.test.ts`
- Modify: `src/data/buildings.ts:69-84` (interface `BuildingDef`), `src/data/buildings.ts:98-169` (dữ liệu)
- Modify: `src/data/data.test.ts` (thêm một test vào `describe('Phase 1 game data')`)

**Interfaces:**
- Consumes: `DAY_TICKS` (`src/data/colonists.ts`), `UI_PALETTE` (Task 1).
- Produces (tất cả từ `src/ui/hud/layout.ts`, không import Phaser):
  - Hằng: `TOUCH_TARGET = 44`, `MARGIN = 10`, `GAP = 4`, `SPEED_GAP = 2`, `RIGHT_COLUMN_W = 182`, `LONG_PRESS_MS = 400`, `MAP_DWELL_MS = 300`, `DRAG_SLOP = 8`, `TOOLTIP_MAX_W = 220`, `TOOLTIP_OFFSET = 16`, `TOOLTIP_EDGE = 4`, `TOAST = { max: 4, holdMs: 5000, slideMs: 200, fadeMs: 400, height: 32, gap: 4, maxWidth: 320 }`, `TOAST_STACK_H = 144`, `HOTBAR = { slot: 48, minSlot: 44, gap: 4, minGap: 2, divider: 2 }`, `CARD = { w: 168, compactW: 120, h: 48, gap: 4 }`.
  - Kiểu: `Rect { x; y; w; h }`, `Size { w; h }`, `Point { x; y }`, `TooltipPart { text; color?; icon?: { key; frame } }`, `TooltipLine = readonly TooltipPart[]`, `TooltipContent { title?; lines }`, `ClockReading { day; time; fraction }`, `ToastEntry { id; text; count; shownAt }`, `ToastPush { list; entry; merged; dropped }`, `HotbarFit { slot; gap; width; scroll }`, `CardLayout { x; y; w; compact; slots }`.
  - Hàm: `textContent(lines: readonly string[]): TooltipContent`, `uiScaleFor(w, h): 1 | 2`, `clockAt(tick): ClockReading`, `clockLabel(r): string`, `dialPoint(fraction, radius): Point`, `needColor(value): number`, `pushToast(list, text, now, id): ToastPush`, `ellipsize(text, maxWidth, measure): string`, `toastText(entry, maxWidth, measure): string`, `placeTooltip(pointer, size, screen): Point`, `placeAbove(anchor, size, screen): Point`, `hotbarWidth(count, slot, gap)`, `hotbarSlotX(index, slot, gap)`, `fitHotbar(count, available): HotbarFit`, `clampScroll(offset, content, view)`, `iconScale(w, h, box = 32)`, `costTotal(cost)`, `layoutCards(screen, rightColumn, bottom): CardLayout`, `visibleCards(count, slots): { shown; more }`, `overlapsX(a, b): boolean`.
  - `BuildingDef.descVi: string` (bắt buộc, mọi công trình).

Ghi chú quyết định: hộp đồng hồ + hàng 4 nút tốc độ ≥ 44 px không vừa 150 px (4·44 + 3·2 = 182), nên cột phải rộng `RIGHT_COLUMN_W = 182` cho đồng hồ, hàng tốc độ và tài nguyên, cố định trên mọi màn hình. `GAP = 4` để thẻ colonist (168) và cột phải (182) vừa cạnh nhau trên 375 px (10 + 168 + 4 ≤ 375 − 10 − 182).

- [ ] **Step 1: Viết test thất bại cho `layout.ts`**

Tạo `src/ui/hud/layout.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { DAY_TICKS } from '../../data/colonists';
import { UI_PALETTE } from '../../data/uiPalette';
import {
  clampScroll,
  clockAt,
  clockLabel,
  costTotal,
  dialPoint,
  ellipsize,
  fitHotbar,
  hotbarSlotX,
  hotbarWidth,
  iconScale,
  layoutCards,
  needColor,
  overlapsX,
  placeAbove,
  placeTooltip,
  pushToast,
  textContent,
  toastText,
  uiScaleFor,
  visibleCards,
  type ToastEntry,
} from './layout';

/** Fake text measure: every character is 10 px wide. */
const chars = (s: string): number => s.length * 10;

describe('uiScaleFor', () => {
  it('uses 2× borders only when the short side is at least 600 px', () => {
    expect(uiScaleFor(1280, 720)).toBe(2);
    expect(uiScaleFor(600, 600)).toBe(2);
    expect(uiScaleFor(375, 812)).toBe(1);
    expect(uiScaleFor(812, 375)).toBe(1);
  });
});

describe('clock', () => {
  it('starts day 1 at 06:00', () => {
    expect(clockLabel(clockAt(0))).toBe('Ngày 1 06:00');
  });

  it('reaches 18:00 at half a day', () => {
    expect(clockAt(DAY_TICKS / 2).time).toBe('18:00');
  });

  it('rolls over to day 2 at 06:00', () => {
    expect(clockLabel(clockAt(DAY_TICKS))).toBe('Ngày 2 06:00');
  });

  it('passes midnight without hour 24 and ends the day at 05:59', () => {
    expect(clockAt(DAY_TICKS * 0.75).time).toBe('00:00');
    expect(clockLabel(clockAt(DAY_TICKS - 1))).toBe('Ngày 1 05:59');
  });

  it('reports the fraction of the day for the dial', () => {
    expect(clockAt(DAY_TICKS * 1.25).fraction).toBeCloseTo(0.25);
  });

  it('moves the dial marker from the left horizon over the top to the right', () => {
    expect(dialPoint(0, 7)).toEqual({ x: -7, y: 0 });
    expect(dialPoint(0.5, 7)).toEqual({ x: 0, y: -7 });
    expect(dialPoint(1, 7)).toEqual({ x: 7, y: 0 });
  });
});

describe('needColor', () => {
  it('is good above 50, warn from 20 to 50, bad below 20', () => {
    expect(needColor(100)).toBe(UI_PALETTE.good);
    expect(needColor(50.1)).toBe(UI_PALETTE.good);
    expect(needColor(50)).toBe(UI_PALETTE.warn);
    expect(needColor(20)).toBe(UI_PALETTE.warn);
    expect(needColor(19.9)).toBe(UI_PALETTE.bad);
    expect(needColor(0)).toBe(UI_PALETTE.bad);
  });
});

describe('toasts', () => {
  it('adds new toasts at the bottom', () => {
    let list: ToastEntry[] = [];
    list = pushToast(list, 'a', 0, 1).list;
    list = pushToast(list, 'b', 10, 2).list;
    expect(list.map((t) => t.text)).toEqual(['a', 'b']);
  });

  it('merges the same text into ×2 and restarts its timer', () => {
    const first = pushToast([], 'Đã xây xong Kho.', 0, 1);
    const second = pushToast(first.list, 'Đã xây xong Kho.', 1000, 2);
    expect(second.merged).toBe(true);
    expect(second.list).toHaveLength(1);
    expect(second.list[0]).toMatchObject({ id: 1, count: 2, shownAt: 1000 });
    expect(toastText(second.list[0]!, 1000, chars)).toBe('Đã xây xong Kho. ×2');
  });

  it('keeps at most four and drops the oldest at once', () => {
    let list: ToastEntry[] = [];
    for (let i = 1; i <= 4; i++) list = pushToast(list, `t${i}`, i, i).list;
    const r = pushToast(list, 't5', 5, 5);
    expect(r.list.map((t) => t.text)).toEqual(['t2', 't3', 't4', 't5']);
    expect(r.dropped.map((t) => t.id)).toEqual([1]);
  });

  it('merging into the oldest of a full stack drops nothing', () => {
    let list: ToastEntry[] = [];
    for (let i = 1; i <= 4; i++) list = pushToast(list, `t${i}`, i, i).list;
    const r = pushToast(list, 't1', 9, 5);
    expect(r.merged).toBe(true);
    expect(r.dropped).toEqual([]);
    expect(r.list.map((t) => [t.text, t.count])).toEqual([
      ['t1', 2],
      ['t2', 1],
      ['t3', 1],
      ['t4', 1],
    ]);
  });

  it('leaves text that fits and cuts the rest with …', () => {
    expect(ellipsize('Kho', 100, chars)).toBe('Kho');
    expect(ellipsize('abcdefghij', 50, chars)).toBe('abcd…');
  });

  it('keeps the ×N suffix when the text is cut', () => {
    const t: ToastEntry = { id: 1, text: 'Lê Văn Tám đã chết vì kiệt sức.', count: 3, shownAt: 0 };
    const out = toastText(t, 150, chars);
    expect(out.endsWith('… ×3')).toBe(true);
    expect(chars(out)).toBeLessThanOrEqual(150);
  });
});

describe('tooltip placement', () => {
  const screen = { w: 1280, h: 720 };
  const size = { w: 200, h: 80 };

  it('sits below-right of the pointer', () => {
    expect(placeTooltip({ x: 100, y: 100 }, size, screen)).toEqual({ x: 116, y: 116 });
  });

  it('flips left at the right edge and up at the bottom edge', () => {
    expect(placeTooltip({ x: 1200, y: 100 }, size, screen)).toEqual({ x: 984, y: 116 });
    expect(placeTooltip({ x: 100, y: 700 }, size, screen)).toEqual({ x: 116, y: 604 });
  });

  it('clamps to the edge when neither side fits', () => {
    expect(placeTooltip({ x: 200, y: 100 }, { w: 300, h: 80 }, { w: 375, h: 812 })).toEqual({
      x: 71,
      y: 116,
    });
  });

  it('sticks to the edge when it is bigger than the screen', () => {
    expect(placeTooltip({ x: 150, y: 150 }, { w: 400, h: 900 }, { w: 320, h: 640 })).toEqual({
      x: 4,
      y: 4,
    });
  });

  it('puts a long-press tooltip above the control, or below when there is no room', () => {
    const phone = { w: 375, h: 812 };
    const tip = { w: 120, h: 40 };
    expect(placeAbove({ x: 100, y: 700, w: 48, h: 48 }, tip, phone)).toEqual({ x: 64, y: 654 });
    expect(placeAbove({ x: 0, y: 700, w: 48, h: 48 }, tip, phone)).toEqual({ x: 4, y: 654 });
    expect(placeAbove({ x: 100, y: 10, w: 48, h: 48 }, tip, phone)).toEqual({ x: 64, y: 64 });
  });
});

describe('hotbar', () => {
  it('uses 48 px slots and 4 px gaps when there is room', () => {
    expect(fitHotbar(6, 400)).toEqual({ slot: 48, gap: 4, width: 314, scroll: false });
  });

  it('tightens the gaps first, then shrinks slots to 44 px', () => {
    expect(fitHotbar(6, 310)).toEqual({ slot: 48, gap: 2, width: 302, scroll: false });
    expect(fitHotbar(6, 290)).toEqual({ slot: 44, gap: 2, width: 278, scroll: false });
  });

  it('scrolls instead of going under 44 px', () => {
    expect(fitHotbar(6, 250)).toEqual({ slot: 44, gap: 2, width: 278, scroll: true });
  });

  it('puts a divider after the tab slot', () => {
    expect(hotbarSlotX(0, 48, 4)).toBe(0);
    expect(hotbarSlotX(1, 48, 4)).toBe(58);
    expect(hotbarSlotX(2, 48, 4)).toBe(110);
    expect(hotbarWidth(3, 48, 4)).toBe(hotbarSlotX(2, 48, 4) + 48);
  });

  it('clamps the scroll offset to the content', () => {
    expect(clampScroll(50, 278, 250)).toBe(28);
    expect(clampScroll(-5, 278, 250)).toBe(0);
    expect(clampScroll(10, 200, 250)).toBe(0);
  });

  it('scales icons by the largest whole factor that fits 32 px, never below 1', () => {
    expect(iconScale(8, 8)).toBe(4);
    expect(iconScale(16, 16)).toBe(2);
    expect(iconScale(24, 20)).toBe(1);
    expect(iconScale(16, 40)).toBe(1);
  });

  it('labels a building with the total of its cost', () => {
    expect(costTotal({ wood: 15, stone: 10 })).toBe(25);
    expect(costTotal({})).toBe(0);
  });
});

describe('colonist cards', () => {
  it('sit beside the clock column on desktop and on a 375 px phone', () => {
    expect(layoutCards({ w: 1280, h: 720 }, { x: 1088, y: 10, w: 182, h: 180 }, 600)).toEqual({
      x: 10,
      y: 10,
      w: 168,
      compact: false,
      slots: 11,
    });
    expect(layoutCards({ w: 375, h: 812 }, { x: 183, y: 10, w: 182, h: 180 }, 700).y).toBe(10);
  });

  it('go compact under 360 px and drop below the column when they do not fit beside it', () => {
    const cards = layoutCards({ w: 320, h: 640 }, { x: 128, y: 10, w: 182, h: 180 }, 560);
    expect(cards).toMatchObject({ x: 10, y: 194, w: 120, compact: true });
  });

  it('always leaves room for one card', () => {
    expect(layoutCards({ w: 812, h: 375 }, { x: 620, y: 10, w: 182, h: 180 }, 50).slots).toBe(1);
  });

  it('turns the last card into +N when they do not all fit', () => {
    expect(visibleCards(3, 11)).toEqual({ shown: 3, more: 0 });
    expect(visibleCards(5, 3)).toEqual({ shown: 2, more: 3 });
  });

  it('shows only +N when one slot is left', () => {
    expect(visibleCards(3, 1)).toEqual({ shown: 0, more: 3 });
  });
});

describe('helpers', () => {
  it('detects horizontal overlap (touching is not overlap)', () => {
    expect(overlapsX({ x: 0, w: 10 }, { x: 10, w: 5 })).toBe(false);
    expect(overlapsX({ x: 0, w: 11 }, { x: 10, w: 5 })).toBe(true);
  });

  it('turns description lines into tooltip content (first line = title)', () => {
    expect(textContent(['Kho', 'Công trình của bạn'])).toEqual({
      title: 'Kho',
      lines: [[{ text: 'Công trình của bạn' }]],
    });
    expect(textContent([])).toEqual({ title: undefined, lines: [] });
  });
});
```

- [ ] **Step 2: Viết test thất bại cho `descVi`**

Trong `src/data/data.test.ts`, thêm vào cuối khối `describe('Phase 1 game data', () => { … })` (trước dấu `});` đóng khối):

```ts
  it('every player building has a Vietnamese description for its tooltip', () => {
    for (const id of BUILDING_IDS) {
      if (!BUILDINGS[id].playerBuildable) continue;
      expect(BUILDINGS[id].descVi.trim().length, id).toBeGreaterThan(0);
    }
  });
```

- [ ] **Step 3: Chạy test để thấy thất bại**

Run: `npm test -- src/ui/hud/layout.test.ts src/data/data.test.ts < /dev/null`
Expected: FAIL — `layout.test.ts` báo `Failed to resolve import "./layout"`; `data.test.ts` báo `TypeError: Cannot read properties of undefined (reading 'trim')`.

- [ ] **Step 4: Viết `layout.ts`**

Tạo `src/ui/hud/layout.ts`:

```ts
import { DAY_TICKS } from '../../data/colonists';
import { UI_PALETTE } from '../../data/uiPalette';

/**
 * Pure HUD maths (no Phaser) so it can be unit-tested: clock, need colours, toast merging,
 * tooltip placement, hotbar fitting and card layout. Sizes are logical screen px.
 */

/** Minimum touch target (Apple/Google guidance). */
export const TOUCH_TARGET = 44;
export const MARGIN = 10;
export const GAP = 4;
export const SPEED_GAP = 2;
/** Clock box, speed row and resource box share this width: 4 speed buttons ≥ 44 px. */
export const RIGHT_COLUMN_W = 4 * TOUCH_TARGET + 3 * SPEED_GAP;
export const LONG_PRESS_MS = 400;
export const MAP_DWELL_MS = 300;
/** A press that moved further than this (screen px) is a drag, not a click. */
export const DRAG_SLOP = 8;
export const TOOLTIP_MAX_W = 220;
export const TOOLTIP_OFFSET = 16;
export const TOOLTIP_EDGE = 4;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface Size {
  w: number;
  h: number;
}
export interface Point {
  x: number;
  y: number;
}

// --- tooltip content ---------------------------------------------------------------------

export interface TooltipPart {
  readonly text: string;
  readonly color?: number;
  readonly icon?: { readonly key: string; readonly frame: string };
}
export type TooltipLine = readonly TooltipPart[];
export interface TooltipContent {
  readonly title?: string;
  readonly lines: readonly TooltipLine[];
}

/** Description lines → tooltip content; the first line becomes the title. */
export const textContent = (lines: readonly string[]): TooltipContent => ({
  title: lines[0],
  lines: lines.slice(1).map((text) => [{ text }]),
});

// --- scale ---------------------------------------------------------------------------------

/** 2× pixel borders when the short side has room for them, 1× on phones. */
export const uiScaleFor = (width: number, height: number): 1 | 2 =>
  Math.min(width, height) >= 600 ? 2 : 1;

// --- clock ---------------------------------------------------------------------------------

export interface ClockReading {
  /** 1-based day number. */
  day: number;
  /** "HH:MM", the day starting at 06:00. */
  time: string;
  /** 0..1 through the current day (for the dial). */
  fraction: number;
}

const DAY_START_MINUTES = 6 * 60;

export const clockAt = (tick: number): ClockReading => {
  const inDay = tick % DAY_TICKS;
  const minutes = Math.floor((inDay / DAY_TICKS) * 1440 + DAY_START_MINUTES) % 1440;
  const hh = String(Math.floor(minutes / 60)).padStart(2, '0');
  const mm = String(minutes % 60).padStart(2, '0');
  return { day: Math.floor(tick / DAY_TICKS) + 1, time: `${hh}:${mm}`, fraction: inDay / DAY_TICKS };
};

export const clockLabel = (r: ClockReading): string => `Ngày ${r.day} ${r.time}`;

/** Marker on the dial's half disc: left horizon (0) → top (0.5) → right horizon (1). */
export const dialPoint = (fraction: number, radius: number): Point => {
  const angle = Math.PI * (1 + fraction);
  // `+ 0` turns -0 into 0.
  return {
    x: Math.round(Math.cos(angle) * radius) + 0,
    y: Math.round(Math.sin(angle) * radius) + 0,
  };
};

// --- needs ---------------------------------------------------------------------------------

export const needColor = (value: number): number =>
  value > 50 ? UI_PALETTE.good : value >= 20 ? UI_PALETTE.warn : UI_PALETTE.bad;

// --- toasts --------------------------------------------------------------------------------

export const TOAST = {
  max: 4,
  holdMs: 5_000,
  slideMs: 200,
  fadeMs: 400,
  height: 32,
  gap: 4,
  maxWidth: 320,
} as const;

/** Space kept for a full toast stack (so the panel above it doesn't jump). */
export const TOAST_STACK_H = TOAST.max * (TOAST.height + TOAST.gap);

export interface ToastEntry {
  readonly id: number;
  readonly text: string;
  readonly count: number;
  readonly shownAt: number;
}

export interface ToastPush {
  /** Oldest first; the newest is drawn at the bottom. */
  list: ToastEntry[];
  /** The toast that was added, or the one that absorbed the repeat. */
  entry: ToastEntry;
  merged: boolean;
  /** Toasts pushed out by the fifth one (remove at once, no fade). */
  dropped: ToastEntry[];
}

export const pushToast = (
  list: readonly ToastEntry[],
  text: string,
  now: number,
  id: number,
): ToastPush => {
  const same = list.find((t) => t.text === text);
  if (same) {
    const entry: ToastEntry = { ...same, count: same.count + 1, shownAt: now };
    return { list: list.map((t) => (t === same ? entry : t)), entry, merged: true, dropped: [] };
  }
  const entry: ToastEntry = { id, text, count: 1, shownAt: now };
  const all = [...list, entry];
  const dropped = all.slice(0, Math.max(0, all.length - TOAST.max));
  return { list: all.slice(dropped.length), entry, merged: false, dropped };
};

/** Longest prefix of `text` + "…" that measures ≤ maxWidth (unchanged if it already fits). */
export const ellipsize = (
  text: string,
  maxWidth: number,
  measure: (s: string) => number,
): string => {
  if (measure(text) <= maxWidth) return text;
  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (measure(`${text.slice(0, mid).trimEnd()}…`) <= maxWidth) lo = mid;
    else hi = mid - 1;
  }
  return `${text.slice(0, lo).trimEnd()}…`;
};

/** One-line toast label: the text cut to fit, keeping the " ×N" repeat suffix. */
export const toastText = (
  t: ToastEntry,
  maxWidth: number,
  measure: (s: string) => number,
): string => {
  const suffix = t.count > 1 ? ` ×${t.count}` : '';
  return ellipsize(t.text, maxWidth - (suffix ? measure(suffix) : 0), measure) + suffix;
};

// --- tooltip placement ---------------------------------------------------------------------

const placeAxis = (pointer: number, size: number, screen: number): number => {
  const after = pointer + TOOLTIP_OFFSET;
  if (after + size <= screen - TOOLTIP_EDGE) return after;
  const before = pointer - TOOLTIP_OFFSET - size;
  if (before >= TOOLTIP_EDGE) return before;
  return Math.max(TOOLTIP_EDGE, Math.min(after, screen - TOOLTIP_EDGE - size));
};

/** Below-right of the pointer; flips left/up at the edges; clamps when neither side fits. */
export const placeTooltip = (pointer: Point, size: Size, screen: Size): Point => ({
  x: Math.round(placeAxis(pointer.x, size.w, screen.w)),
  y: Math.round(placeAxis(pointer.y, size.h, screen.h)),
});

/** Centred above a control (touch long-press); below it when there is no room above. */
export const placeAbove = (anchor: Rect, size: Size, screen: Size): Point => {
  const centred = anchor.x + anchor.w / 2 - size.w / 2;
  const x = Math.max(TOOLTIP_EDGE, Math.min(centred, screen.w - TOOLTIP_EDGE - size.w));
  const above = anchor.y - 6 - size.h;
  const y =
    above >= TOOLTIP_EDGE
      ? above
      : Math.max(TOOLTIP_EDGE, Math.min(anchor.y + anchor.h + 6, screen.h - TOOLTIP_EDGE - size.h));
  return { x: Math.round(x), y: Math.round(y) };
};

// --- hotbar --------------------------------------------------------------------------------

export const HOTBAR = { slot: 48, minSlot: 44, gap: 4, minGap: 2, divider: 2 } as const;

/** Row width: `count` slots, gaps, and a divider (+ one more gap) after the tab slot. */
export const hotbarWidth = (count: number, slot: number, gap: number): number =>
  count * slot + (count - 1) * gap + HOTBAR.divider + gap;

/** Left edge of slot `index` inside the row. */
export const hotbarSlotX = (index: number, slot: number, gap: number): number =>
  index * (slot + gap) + (index > 0 ? HOTBAR.divider + gap : 0);

export interface HotbarFit {
  slot: number;
  gap: number;
  /** Content width at this slot/gap (wider than the view when scrolling). */
  width: number;
  scroll: boolean;
}

/** 48/4 → 48/2 → 44/2 → 44/2 with horizontal scrolling. Never below 44 px. */
export const fitHotbar = (count: number, available: number): HotbarFit => {
  const tries: [number, number][] = [
    [HOTBAR.slot, HOTBAR.gap],
    [HOTBAR.slot, HOTBAR.minGap],
    [HOTBAR.minSlot, HOTBAR.minGap],
  ];
  for (const [slot, gap] of tries) {
    const width = hotbarWidth(count, slot, gap);
    if (width <= available) return { slot, gap, width, scroll: false };
  }
  return {
    slot: HOTBAR.minSlot,
    gap: HOTBAR.minGap,
    width: hotbarWidth(count, HOTBAR.minSlot, HOTBAR.minGap),
    scroll: true,
  };
};

export const clampScroll = (offset: number, content: number, view: number): number =>
  Math.max(0, Math.min(offset, Math.max(0, content - view)));

/** Largest whole scale that fits `box` px, but never below 1 (pixel art is never shrunk). */
export const iconScale = (w: number, h: number, box = 32): number =>
  Math.max(1, Math.floor(box / Math.max(w, h)));

/** Slot cost label: the total of all resources (the full breakdown is in the tooltip). */
export const costTotal = (cost: Readonly<Partial<Record<string, number>>>): number =>
  Object.values(cost).reduce<number>((sum, n) => sum + (n ?? 0), 0);

// --- colonist cards ------------------------------------------------------------------------

export const CARD = { w: 168, compactW: 120, h: 48, gap: 4 } as const;

export interface CardLayout {
  x: number;
  y: number;
  w: number;
  /** < 360 px: name + bars only. */
  compact: boolean;
  /** How many cards fit before `bottom`; the last one becomes "+N" when there are more. */
  slots: number;
}

/** Top-left beside the clock column, or under it when there is no room beside it. */
export const layoutCards = (screen: Size, rightColumn: Rect, bottom: number): CardLayout => {
  const compact = screen.w < 360;
  const w = compact ? CARD.compactW : CARD.w;
  const beside = MARGIN + w + GAP <= rightColumn.x;
  const y = beside ? MARGIN : rightColumn.y + rightColumn.h + GAP;
  const slots = Math.max(1, Math.floor((bottom - y + CARD.gap) / (CARD.h + CARD.gap)));
  return { x: MARGIN, y, w, compact, slots };
};

export const visibleCards = (count: number, slots: number): { shown: number; more: number } =>
  count <= slots ? { shown: count, more: 0 } : { shown: slots - 1, more: count - (slots - 1) };

// --- misc ----------------------------------------------------------------------------------

/** Horizontal spans overlap (touching edges do not). */
export const overlapsX = (a: Pick<Rect, 'x' | 'w'>, b: Pick<Rect, 'x' | 'w'>): boolean =>
  a.x < b.x + b.w && b.x < a.x + a.w;
```

- [ ] **Step 5: Thêm `descVi`**

Trong `src/data/buildings.ts`, trong `interface BuildingDef`, ngay sau dòng `readonly nameVi: string;` thêm:

```ts
  /** One line for the build tooltip (what it is for). */
  readonly descVi: string;
```

Trong `BUILDINGS`, thêm `descVi` ngay sau `nameVi` của từng công trình:

```ts
    nameVi: 'Lửa Thiêng',
    descVi: 'Trái tim của làng: colonist mang tài nguyên về đây, lãnh thổ toả quanh ngọn lửa.',
```

```ts
    nameVi: 'Lều',
    descVi: 'Chỗ ngủ cho 2 colonist; ngủ trong lều hồi sức nhanh gấp đôi ngủ ngoài trời.',
```

```ts
    nameVi: 'Kho',
    descVi: 'Nơi cất tài nguyên gần chỗ khai thác để colonist đỡ phải vác hàng đi xa.',
```

```ts
    nameVi: 'Tháp Canh',
    descVi: 'Chòi cao để canh gác làng khi quái vật kéo đến.',
```

```ts
    nameVi: 'Đuốc',
    descVi: 'Một ngọn đuốc soi sáng góc làng quanh nó.',
```

```ts
    nameVi: 'Cọc tường',
    descVi: 'Một đoạn cọc gỗ của tường rào, chắn đường đi qua.',
```

- [ ] **Step 6: Chạy test để thấy pass**

Run: `npm test -- src/ui/hud/layout.test.ts src/data/data.test.ts < /dev/null`
Expected: PASS (toàn bộ test hai file).

- [ ] **Step 7: Lint + typecheck**

Run: `npm run lint < /dev/null && npm run typecheck < /dev/null`
Expected: exit 0 (ESLint không báo import Phaser trong `src/data`).

- [ ] **Step 8: Commit**

```bash
git add src/ui/hud/layout.ts src/ui/hud/layout.test.ts src/data/buildings.ts src/data/data.test.ts
git commit -m "$(cat <<'EOF'
feat(hud): pure layout logic (clock, toasts, tooltip, hotbar, cards) and building descriptions

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Texture `ui`, `PreloadScene` và `theme.ts` vẽ lại

**Files:**
- Modify: `src/render/atlas.ts` (import ở đầu file; thêm `UI_KEY`, `addPixelTexture`, `buildUiTexture` ở cuối)
- Modify: `src/scenes/PreloadScene.ts:3,24-27`
- Rewrite: `src/ui/theme.ts`

**Interfaces:**
- Consumes: `UI_FRAME_IDS`, `UI_DECOR_IDS`, `UI_FRAMES`, `paintUiFrame`, `paintUiDecor`, `UiFrame` (Task 1); `TOUCH_TARGET`, `LONG_PRESS_MS`, `DRAG_SLOP`, `uiScaleFor`, `Rect`, `TooltipContent` (Task 2).
- Produces:
  - `atlas.ts`: `UI_KEY = 'ui'`, `addPixelTexture(textures, key: string, art: PixelCanvas): void`, `buildUiTexture(textures: Phaser.Textures.TextureManager): void`.
  - `theme.ts`: `FONT_UI`, `FONT_TITLE`, `FONT_DEBUG`, `TOUCH_TARGET` (re-export), `textStyle(size, color = UI_PALETTE.text, family = FONT_UI)`, `addUiText(scene, x, y, text, size, color?): Phaser.GameObjects.Text`, `uiScale(scene): 1 | 2`, `frameBorder(scene, frame: UiFrame): number`, `interface UiBox { image: NineSlice; width; height; resize(w, h); setFrame(frame) }`, `createPanel(scene, frame, width, height, originX = 0, originY = 0): UiBox`, `interface TooltipHost { showAtPointer(content, owner); showAbove(content, anchor: Rect, owner); hide(owner) }`, `interface TooltipSource { host: TooltipHost; content: () => TooltipContent | null }`, `type PressState = 'idle' | 'hover' | 'down'`, `interface PressOptions { onClick; onState?; tooltip? }`, `bindPress(scene, target: NineSlice, options): void`, `ButtonOptions` (giữ nguyên + `tooltip?: TooltipSource` tuỳ chọn), `Button` (giữ nguyên), `createButton(scene, x, y, label, options): Button`.

Ghi chú: spec §4.2 viết `buildUiTexture(scene)`; plan dùng `TextureManager` giống `buildPlaceholderAtlas(textures)` hiện có. `ButtonOptions` chỉ thêm một trường **tuỳ chọn** `tooltip`, nên mọi lời gọi cũ vẫn biên dịch nguyên vẹn. API Phaser 4 đã kiểm tra trong `node_modules/phaser`: `scene.add.nineslice(x, y, texture, frame, width, height, left, right, top, bottom)`, `NineSlice.setSize` cập nhật luôn hit area, `NineSlice.setFrame(frame, false, false)` + `updateUVs()` để đổi frame cùng kích thước mà không đổi size, `Text.setShadow(x, y, color, blur, shadowStroke, shadowFill)`, `textures.addCanvas(key, canvas)`; input bỏ qua object nằm trong container ẩn (`InputManager.inputCandidate` kiểm tra `parentContainer`), và `globalTopOnly` khiến mọi object interactive của HUD chặn click xuống `WorldScene`.

Task này không có unit test (mọi thứ phụ thuộc scene Phaser); phần thuần đã được test ở Task 1–2. Sau task này HUD cũ vẫn chạy, nhưng nút đã là khung gỗ và chữ mặc định của `textStyle` đổi sang nâu đậm — vài dòng chữ HUD cũ trên nền tối sẽ khó đọc cho tới Task 8, đó là trạng thái chuyển tiếp chấp nhận được.

- [ ] **Step 1: Thêm texture UI vào `atlas.ts`**

Trong `src/render/atlas.ts`, thêm import ngay sau khối `import { … } from './terrainArt';`:

```ts
import { UI_DECOR_IDS, UI_FRAME_IDS, paintUiDecor, paintUiFrame } from './uiArt';
```

Ngay sau `export const SPRITES_KEY = 'sprites';` thêm:

```ts
/** UI frames (nine-slice sources) and decorations, named as in uiArt.ts. */
export const UI_KEY = 'ui';
```

Thêm vào cuối file:

```ts
/** Upload one generated canvas as its own texture (no-op if the key already exists). */
export const addPixelTexture = (
  textures: Phaser.Textures.TextureManager,
  key: string,
  art: PixelCanvas,
): void => {
  if (textures.exists(key)) return;
  if (!textures.addCanvas(key, toCanvas(art))) throw new Error(`Failed to create texture ${key}`);
};

/**
 * The UI atlas: every UI_FRAMES frame and UI_DECOR decoration under its own name, so the
 * HUD only ever refers to frames by name (swap for an Aseprite atlas with the same names).
 */
export const buildUiTexture = (textures: Phaser.Textures.TextureManager): void => {
  if (textures.exists(UI_KEY)) return;
  const sprites: { name: string; art: PixelCanvas }[] = [
    ...UI_FRAME_IDS.map((id) => ({ name: id, art: paintUiFrame(id) })),
    ...UI_DECOR_IDS.map((id) => ({ name: id, art: paintUiDecor(id) })),
  ];
  const width = 128;
  const { placed, height } = packShelves(sprites, width);
  const sheet = new PixelCanvas(width, height);
  for (const p of placed) sheet.blit(p.art, p.x, p.y);
  const texture = textures.addCanvas(UI_KEY, toCanvas(sheet));
  if (!texture) throw new Error('Failed to create UI texture');
  for (const p of placed) texture.add(p.name, 0, p.x, p.y, p.art.width, p.art.height);
};
```

- [ ] **Step 2: Gọi trong `PreloadScene`**

Trong `src/scenes/PreloadScene.ts`, đổi dòng import:

```ts
import { buildPlaceholderAtlas, buildUiTexture } from '../render/atlas';
```

và thân `create()`:

```ts
  create(): void {
    buildPlaceholderAtlas(this.textures);
    buildUiTexture(this.textures);
    this.scene.start(SCENES.mainMenu);
  }
```

- [ ] **Step 3: Viết lại `src/ui/theme.ts`**

Thay toàn bộ nội dung file:

```ts
import type Phaser from 'phaser';
import { toCss } from '../data/palette';
import { UI_PALETTE } from '../data/uiPalette';
import { UI_KEY } from '../render/atlas';
import { UI_FRAMES, type UiFrame } from '../render/uiArt';
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
  UI_FRAMES[frame].border * uiScale(scene);

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
  const { slice } = UI_FRAMES[frame];
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

let nextPressId = 0;

/**
 * Button behaviour for any nine-slice: hover/down states, click on release (only if the
 * press started here and didn't turn into a drag), tooltip on hover or long-press.
 */
export const bindPress = (
  scene: Phaser.Scene,
  target: Phaser.GameObjects.NineSlice,
  { onClick, onState, tooltip }: PressOptions,
): void => {
  const owner = `press-${nextPressId++}`;
  let timer: Phaser.Time.TimerEvent | null = null;
  let down = false;
  let longPressed = false;
  const stopTimer = (): void => {
    timer?.remove(false);
    timer = null;
  };
  const anchor = (): Rect => {
    const b = target.getBounds();
    return { x: b.x, y: b.y, w: b.width, h: b.height };
  };

  target
    .setInteractive({ useHandCursor: true })
    .on('pointerover', (pointer: Phaser.Input.Pointer) => {
      if (pointer.wasTouch) return;
      onState?.(down ? 'down' : 'hover');
      const content = tooltip?.content();
      if (tooltip && content) tooltip.host.showAtPointer(content, owner);
    })
    .on('pointerout', () => {
      stopTimer();
      down = false;
      longPressed = false;
      onState?.('idle');
      tooltip?.host.hide(owner);
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
    .once('destroy', () => {
      stopTimer();
      tooltip?.host.hide(owner);
    });
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
}

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
  bindPress(scene, box.image, {
    onClick,
    tooltip,
    onState: (next) => {
      state = next;
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
        state = 'idle';
        refresh();
      }
    },
  };
};
```

- [ ] **Step 4: Lint, typecheck, test, build**

Run: `npm run lint < /dev/null && npm run typecheck < /dev/null && npm test < /dev/null && npm run build < /dev/null`
Expected: tất cả exit 0.

- [ ] **Step 5: Kiểm tra nhanh trong trình duyệt**

Run: `npm run dev` (nền), mở `http://localhost:5173`.
Expected: menu chính hiện hai nút khung gỗ lõi kem (hover sáng hơn, bấm lõm xuống); vào game, các nút tốc độ/toolbar cũ cũng là khung gỗ và vẫn bấm được; console không lỗi.

- [ ] **Step 6: Commit**

```bash
git add src/render/atlas.ts src/scenes/PreloadScene.ts src/ui/theme.ts
git commit -m "$(cat <<'EOF'
feat(ui): ui texture atlas, nine-slice panels and wood buttons in theme

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: `ContentBox` và `Tooltip` dùng chung

**Files:**
- Create: `src/ui/ContentBox.ts`
- Create: `src/ui/Tooltip.ts`

**Interfaces:**
- Consumes: `addUiText`, `createPanel`, `frameBorder`, `UiBox`, `TooltipHost` (Task 3); `placeTooltip`, `placeAbove`, `TOOLTIP_MAX_W`, `Rect`, `Size`, `TooltipContent` (Task 2); `UiFrame` (Task 1).
- Produces:
  - `class ContentBox { constructor(scene, frame: UiFrame, maxWidth: number, options?: { fontSize?: number; blocking?: boolean }); readonly container; width; height; visible; setMaxWidth(w); setContent(content | null); refresh(); setPosition(x, y): this; destroy() }` — `setContent` bỏ qua nếu nội dung không đổi (so `JSON.stringify`); `blocking: true` làm khung interactive để chặn click xuống bản đồ.
  - `class Tooltip implements TooltipHost { constructor(scene); shownBy: string | null; showAtPointer(content, owner); showAbove(content, anchor, owner); hide(owner); refresh(); destroy() }` — depth 1000, không interactive (không bao giờ chặn input).

Bấm giữ 400 ms và "nhả tay sau bấm giữ không kích hoạt nút" đã nằm trong `bindPress` (Task 3); `Tooltip` chỉ lo hiển thị và vị trí. Không có unit test (Phaser); vị trí lật/kẹp đã test ở Task 2.

- [ ] **Step 1: Viết `ContentBox.ts`**

```ts
import type Phaser from 'phaser';
import type { UiFrame } from '../render/uiArt';
import type { TooltipContent } from './hud/layout';
import { addUiText, createPanel, frameBorder, type UiBox } from './theme';

/** Space between a frame's border and its text. */
const PAD = 6;
const LINE_GAP = 2;
const PART_GAP = 6;
const ICON_SCALE = 2;

export interface ContentBoxOptions {
  fontSize?: number;
  /** Make the frame interactive so clicks on it never reach the map. */
  blocking?: boolean;
}

/**
 * A UI frame that sizes itself around TooltipContent: a bold title, then lines made of
 * text and icon parts. Used for the tooltip, the selected-thing panel, the status hint and
 * the menu's seed tag. Hidden while it has no content.
 */
export class ContentBox {
  readonly container: Phaser.GameObjects.Container;
  private readonly box: UiBox;
  private readonly items: (Phaser.GameObjects.Text | Phaser.GameObjects.Image)[] = [];
  private readonly fontSize: number;
  private content: TooltipContent | null = null;
  private key = '';

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly frame: UiFrame,
    private maxWidth: number,
    { fontSize = 13, blocking = false }: ContentBoxOptions = {},
  ) {
    this.fontSize = fontSize;
    this.box = createPanel(scene, frame, 32, 32);
    if (blocking) this.box.image.setInteractive();
    this.container = scene.add.container(0, 0, [this.box.image]).setVisible(false);
  }

  get width(): number {
    return this.box.width;
  }

  get height(): number {
    return this.box.height;
  }

  get visible(): boolean {
    return this.container.visible;
  }

  setMaxWidth(width: number): void {
    if (width === this.maxWidth) return;
    this.maxWidth = width;
    this.render();
  }

  setContent(content: TooltipContent | null): void {
    const key = content ? JSON.stringify(content) : '';
    if (key === this.key) return;
    this.key = key;
    this.content = content;
    this.render();
  }

  /** Re-measure after a uiScale change (the border thickness differs). */
  refresh(): void {
    this.render();
  }

  setPosition(x: number, y: number): this {
    this.container.setPosition(Math.round(x), Math.round(y));
    return this;
  }

  destroy(): void {
    this.container.destroy();
  }

  private render(): void {
    for (const item of this.items) item.destroy();
    this.items.length = 0;
    const content = this.content;
    if (!content || (!content.title && content.lines.length === 0)) {
      this.container.setVisible(false);
      return;
    }
    this.container.setVisible(true);
    const inset = frameBorder(this.scene, this.frame) + PAD;
    const wrap = Math.max(40, this.maxWidth - inset * 2);
    let y = inset;
    let right = inset;
    if (content.title) {
      const title = addUiText(this.scene, inset, y, content.title, this.fontSize + 1)
        .setFontStyle('bold')
        .setWordWrapWidth(wrap);
      this.add(title);
      y += title.height + LINE_GAP;
      right = Math.max(right, inset + title.width);
    }
    for (const line of content.lines) {
      let x = inset;
      let lineHeight = 0;
      for (const part of line) {
        if (part.icon) {
          const icon = this.scene.add
            .image(x, y, part.icon.key, part.icon.frame)
            .setOrigin(0, 0)
            .setScale(ICON_SCALE);
          this.add(icon);
          right = Math.max(right, x + icon.displayWidth);
          x += icon.displayWidth + 2;
          lineHeight = Math.max(lineHeight, icon.displayHeight);
        }
        if (part.text) {
          const text = addUiText(this.scene, x, y, part.text, this.fontSize, part.color);
          if (line.length === 1) text.setWordWrapWidth(wrap);
          this.add(text);
          right = Math.max(right, x + text.width);
          x += text.width + PART_GAP;
          lineHeight = Math.max(lineHeight, text.height);
        }
      }
      y += lineHeight + LINE_GAP;
    }
    this.box.resize(
      Math.ceil(Math.min(this.maxWidth, right + inset)),
      Math.ceil(y - LINE_GAP + inset),
    );
  }

  private add(item: Phaser.GameObjects.Text | Phaser.GameObjects.Image): void {
    this.items.push(item);
    this.container.add(item);
  }
}
```

- [ ] **Step 2: Viết `Tooltip.ts`**

```ts
import type Phaser from 'phaser';
import { ContentBox } from './ContentBox';
import {
  TOOLTIP_MAX_W,
  placeAbove,
  placeTooltip,
  type Rect,
  type Size,
  type TooltipContent,
} from './hud/layout';
import type { TooltipHost } from './theme';

/**
 * The one tooltip of a scene: follows the mouse (+16, +16, flipping at the edges), or sits
 * above a long-pressed control on touch. Never interactive, so it never blocks input.
 */
export class Tooltip implements TooltipHost {
  private readonly box: ContentBox;
  private owner: string | null = null;
  private followPointer = false;

  constructor(private readonly scene: Phaser.Scene) {
    this.box = new ContentBox(scene, 'tooltip', TOOLTIP_MAX_W);
    this.box.container.setDepth(1000);
    scene.input.on('pointermove', this.onPointerMove, this);
  }

  /** Who is showing the tooltip right now (null = hidden). */
  get shownBy(): string | null {
    return this.owner;
  }

  showAtPointer(content: TooltipContent, owner: string): void {
    this.owner = owner;
    this.followPointer = true;
    this.box.setContent(content);
    const pointer = this.scene.input.activePointer;
    this.moveTo(pointer.x, pointer.y);
  }

  showAbove(content: TooltipContent, anchor: Rect, owner: string): void {
    this.owner = owner;
    this.followPointer = false;
    this.box.setContent(content);
    const { x, y } = placeAbove(anchor, this.size(), this.screen());
    this.box.setPosition(x, y);
  }

  hide(owner: string): void {
    if (this.owner !== owner) return;
    this.owner = null;
    this.followPointer = false;
    this.box.setContent(null);
  }

  refresh(): void {
    this.box.refresh();
  }

  destroy(): void {
    this.scene.input.off('pointermove', this.onPointerMove, this);
    this.box.destroy();
  }

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    if (this.followPointer) this.moveTo(pointer.x, pointer.y);
  }

  private moveTo(px: number, py: number): void {
    const { x, y } = placeTooltip({ x: px, y: py }, this.size(), this.screen());
    this.box.setPosition(x, y);
  }

  private size(): Size {
    return { w: this.box.width, h: this.box.height };
  }

  private screen(): Size {
    return { w: this.scene.scale.width, h: this.scene.scale.height };
  }
}
```

- [ ] **Step 3: Lint + typecheck + test**

Run: `npm run lint < /dev/null && npm run typecheck < /dev/null && npm test < /dev/null`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add src/ui/ContentBox.ts src/ui/Tooltip.ts
git commit -m "$(cat <<'EOF'
feat(ui): self-sizing content box and shared tooltip

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: `ClockBox` và `ResourceBox`

**Files:**
- Create: `src/ui/hud/ClockBox.ts`
- Create: `src/ui/hud/ResourceBox.ts`

**Interfaces:**
- Consumes: `UI_KEY`, `SPRITES_KEY`, `iconFrame` (`src/render/atlas.ts`); `DIAL`, `UI_DECOR` (Task 1); `clockAt`, `dialPoint`, `RIGHT_COLUMN_W`, `SPEED_GAP`, `TOUCH_TARGET`, `Rect` (Task 2); `addUiText`, `createButton`, `createPanel`, `frameBorder`, `uiScale`, `Button`, `TooltipHost`, `UiBox` (Task 3); `GameSpeed` (`src/sim/SimClock.ts`, type-only); `RESOURCES`, `RESOURCE_IDS`, `ResourceId`.
- Produces:
  - `CLOCK_H = 74`; `class ClockBox { constructor(scene, tooltip: TooltipHost, onSpeed: (speed: GameSpeed) => void); setTick(tick: number): void; setSpeed(speed: GameSpeed): void; layout(right: number, top: number): Rect; destroy(): void }` — `Rect` trả về bao cả hộp đồng hồ và hàng nút tốc độ.
  - `class ResourceBox { constructor(scene); update(stock: Readonly<Record<ResourceId, number>>): void; layout(right: number, top: number): Rect; destroy(): void }`.

Ghi chú: "kim/mặt trời quay" được làm bằng một chấm `firefly` **di chuyển** dọc cung trên mặt đồng hồ theo `dialPoint` (luật art cấm xoay sprite). Chữ đồng hồ chỉ `setText` khi phút hiển thị đổi.

- [ ] **Step 1: Viết `ClockBox.ts`**

```ts
import type Phaser from 'phaser';
import { UI_KEY } from '../../render/atlas';
import { DIAL, UI_DECOR } from '../../render/uiArt';
import type { GameSpeed } from '../../sim/SimClock';
import {
  addUiText,
  createButton,
  createPanel,
  frameBorder,
  uiScale,
  type Button,
  type TooltipHost,
  type UiBox,
} from '../theme';
import {
  RIGHT_COLUMN_W,
  SPEED_GAP,
  TOUCH_TARGET,
  clockAt,
  dialPoint,
  type Rect,
} from './layout';

const SPEEDS: readonly GameSpeed[] = [0, 1, 2, 3];
const SPEED_LABELS: Record<GameSpeed, string> = { 0: '❚❚', 1: '1×', 2: '2×', 3: '3×' };
const SPEED_TIPS: Record<GameSpeed, string> = {
  0: 'Tạm dừng',
  1: 'Tốc độ 1×',
  2: 'Tốc độ 2×',
  3: 'Tốc độ 3×',
};
export const CLOCK_H = 74;
/** Gap between the clock box and the speed row. */
const ROW_GAP = 4;

/** Top-right: dial + "Ngày n" / "HH:MM", with the speed buttons right under it. */
export class ClockBox {
  private readonly panel: UiBox;
  private readonly dial: Phaser.GameObjects.Image;
  private readonly sun: Phaser.GameObjects.Image;
  private readonly dayText: Phaser.GameObjects.Text;
  private readonly timeText: Phaser.GameObjects.Text;
  private readonly speedButtons = new Map<GameSpeed, Button>();
  private shown = '';
  private fraction = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    tooltip: TooltipHost,
    onSpeed: (speed: GameSpeed) => void,
  ) {
    this.panel = createPanel(scene, 'panel', RIGHT_COLUMN_W, CLOCK_H);
    this.panel.image.setInteractive();
    this.dial = scene.add.image(0, 0, UI_KEY, 'clockDial').setOrigin(0, 0);
    this.sun = scene.add.image(0, 0, UI_KEY, 'firefly');
    this.dayText = addUiText(scene, 0, 0, '', 15).setOrigin(0, 1);
    this.timeText = addUiText(scene, 0, 0, '', 15).setOrigin(0, 0);
    for (const speed of SPEEDS) {
      this.speedButtons.set(
        speed,
        createButton(scene, 0, 0, SPEED_LABELS[speed], {
          fontSize: 14,
          onClick: () => onSpeed(speed),
          tooltip: { host: tooltip, content: () => ({ title: SPEED_TIPS[speed], lines: [] }) },
        }),
      );
    }
  }

  setTick(tick: number): void {
    const reading = clockAt(tick);
    const key = `${reading.day} ${reading.time}`;
    if (key !== this.shown) {
      this.shown = key;
      this.dayText.setText(`Ngày ${reading.day}`);
      this.timeText.setText(reading.time);
    }
    this.fraction = reading.fraction;
    this.placeSun();
  }

  setSpeed(speed: GameSpeed): void {
    for (const [s, button] of this.speedButtons) button.setActive(s === speed);
  }

  /** Right edge at `right`; returns the box and the speed row together. */
  layout(right: number, top: number): Rect {
    const s = uiScale(this.scene);
    const left = right - RIGHT_COLUMN_W;
    const border = frameBorder(this.scene, 'panel');
    this.panel.resize(RIGHT_COLUMN_W, CLOCK_H);
    this.panel.image.setPosition(left, top);
    this.dial
      .setScale(s)
      .setPosition(left + border + 4, top + Math.round((CLOCK_H - DIAL.height * s) / 2));
    this.sun.setScale(s);
    const textX = this.dial.x + UI_DECOR.clockDial.w * s + 8;
    this.dayText.setPosition(textX, top + CLOCK_H / 2 - 1);
    this.timeText.setPosition(textX, top + CLOCK_H / 2 + 1);
    const rowTop = top + CLOCK_H + ROW_GAP;
    SPEEDS.forEach((speed, i) => {
      this.speedButtons
        .get(speed)
        ?.container.setPosition(
          left + TOUCH_TARGET / 2 + i * (TOUCH_TARGET + SPEED_GAP),
          rowTop + TOUCH_TARGET / 2,
        );
    });
    this.placeSun();
    return { x: left, y: top, w: RIGHT_COLUMN_W, h: CLOCK_H + ROW_GAP + TOUCH_TARGET };
  }

  destroy(): void {
    for (const obj of [this.panel.image, this.dial, this.sun, this.dayText, this.timeText]) {
      obj.destroy();
    }
    for (const button of this.speedButtons.values()) button.container.destroy();
    this.speedButtons.clear();
  }

  private placeSun(): void {
    const s = this.dial.scaleX;
    const p = dialPoint(this.fraction, DIAL.faceR - 2);
    this.sun.setPosition(this.dial.x + (DIAL.cx + p.x) * s, this.dial.y + (DIAL.cy + p.y - 1) * s);
  }
}
```

- [ ] **Step 2: Viết `ResourceBox.ts`**

```ts
import type Phaser from 'phaser';
import { RESOURCES, RESOURCE_IDS, type ResourceId } from '../../data/resources';
import { SPRITES_KEY, iconFrame } from '../../render/atlas';
import { addUiText, createPanel, frameBorder, type UiBox } from '../theme';
import { RIGHT_COLUMN_W, type Rect } from './layout';

const ROW_H = 22;
const ICON_W = 16;

interface ResourceRow {
  readonly icon: Phaser.GameObjects.Image;
  readonly name: Phaser.GameObjects.Text;
  readonly value: Phaser.GameObjects.Text;
  last: number | null;
}

/** Under the clock: one row per resource (icon, name, right-aligned amount). */
export class ResourceBox {
  private readonly panel: UiBox;
  private readonly rows = new Map<ResourceId, ResourceRow>();

  constructor(private readonly scene: Phaser.Scene) {
    this.panel = createPanel(scene, 'panel', RIGHT_COLUMN_W, 64);
    this.panel.image.setInteractive();
    for (const r of RESOURCE_IDS) {
      this.rows.set(r, {
        icon: scene.add.image(0, 0, SPRITES_KEY, iconFrame(r)).setOrigin(0, 0.5).setScale(2),
        name: addUiText(scene, 0, 0, RESOURCES[r].nameVi, 14).setOrigin(0, 0.5),
        value: addUiText(scene, 0, 0, '0', 14).setOrigin(1, 0.5),
        last: null,
      });
    }
  }

  update(stock: Readonly<Record<ResourceId, number>>): void {
    for (const r of RESOURCE_IDS) {
      const row = this.rows.get(r)!;
      const amount = stock[r];
      if (row.last === amount) continue;
      const bounce = row.last !== null;
      row.last = amount;
      row.value.setText(String(amount));
      if (!bounce) continue;
      // Nudge the number: 1 → 1.2 → 1 in 150 ms.
      this.scene.tweens.killTweensOf(row.value);
      row.value.setScale(1);
      this.scene.tweens.add({
        targets: row.value,
        scale: 1.2,
        duration: 75,
        yoyo: true,
        ease: 'Quad.easeOut',
      });
    }
  }

  layout(right: number, top: number): Rect {
    const pad = frameBorder(this.scene, 'panel') + 4;
    const left = right - RIGHT_COLUMN_W;
    const h = pad * 2 + RESOURCE_IDS.length * ROW_H;
    this.panel.resize(RIGHT_COLUMN_W, h);
    this.panel.image.setPosition(left, top);
    RESOURCE_IDS.forEach((r, i) => {
      const row = this.rows.get(r)!;
      const y = top + pad + ROW_H * (i + 0.5);
      row.icon.setPosition(left + pad, y);
      row.name.setPosition(left + pad + ICON_W + 6, y);
      row.value.setPosition(right - pad, y);
    });
    return { x: left, y: top, w: RIGHT_COLUMN_W, h };
  }

  destroy(): void {
    this.panel.image.destroy();
    for (const row of this.rows.values()) {
      this.scene.tweens.killTweensOf(row.value);
      row.icon.destroy();
      row.name.destroy();
      row.value.destroy();
    }
    this.rows.clear();
  }
}
```

- [ ] **Step 3: Lint + typecheck + test**

Run: `npm run lint < /dev/null && npm run typecheck < /dev/null && npm test < /dev/null`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add src/ui/hud/ClockBox.ts src/ui/hud/ResourceBox.ts
git commit -m "$(cat <<'EOF'
feat(hud): clock box with speed row and resource box

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: `Hotbar`

**Files:**
- Create: `src/ui/hud/Hotbar.ts`

**Interfaces:**
- Consumes: `UI_PALETTE`; `addUiText`, `bindPress`, `createPanel`, `frameBorder`, `TooltipHost`, `UiBox` (Task 3); `HOTBAR`, `MARGIN`, `clampScroll`, `fitHotbar`, `hotbarSlotX`, `iconScale`, `HotbarFit`, `Rect`, `TooltipContent` (Task 2).
- Produces:
  - `interface HotbarSlot { id: string; icon: { key; frame }; hotkey?: string; cost?: string; tooltip: () => TooltipContent | null; onClick: () => void }`.
  - `interface HotbarTab { onToggle: () => void; tooltip: () => TooltipContent | null }`.
  - `class Hotbar { constructor(scene, tooltip: TooltipHost, tab: HotbarTab); setTab(label: string, slots: readonly HotbarSlot[]): void; setSelected(id: string | null): void; layout(screenW: number, screenH: number): Rect; destroy(): void }` — `layout` trả về rect của panel hotbar (màn hình). Sau `setTab` phải gọi `layout` (số ô đổi).

Hành vi: ô đầu là nút đổi tab (nhãn `⇄\nXây` / `⇄\nLệnh`), sau nó một vạch `woodDark` 2 px; ô đang chọn dùng `slotSelected`, hover dùng `slotHover` (đổi frame, không tween); icon giữa ô, scale nguyên lần lớn nhất vừa 32 px; phím tắt góc trái trên, giá góc phải dưới (chữ 11 px). Khi không vừa `width − 2·MARGIN` thì co theo `fitHotbar`; nếu vẫn không vừa thì kéo ngang trong vùng hotbar để cuộn — ô nằm ngoài khung nhìn bị ẩn (Phaser 4 chỉ còn mask dạng filter, nên dùng ẩn ô thay cho mask), và cú kéo không kích hoạt ô (`bindPress` bỏ click khi di chuyển > `DRAG_SLOP`).

- [ ] **Step 1: Viết `Hotbar.ts`**

```ts
import type Phaser from 'phaser';
import { UI_PALETTE } from '../../data/uiPalette';
import { addUiText, bindPress, createPanel, frameBorder, type TooltipHost, type UiBox } from '../theme';
import {
  HOTBAR,
  MARGIN,
  clampScroll,
  fitHotbar,
  hotbarSlotX,
  iconScale,
  type HotbarFit,
  type Rect,
  type TooltipContent,
} from './layout';

export interface HotbarSlot {
  readonly id: string;
  readonly icon: { readonly key: string; readonly frame: string };
  readonly hotkey?: string;
  readonly cost?: string;
  readonly tooltip: () => TooltipContent | null;
  readonly onClick: () => void;
}

export interface HotbarTab {
  readonly onToggle: () => void;
  readonly tooltip: () => TooltipContent | null;
}

/** Icons are scaled to fit this box inside a slot (screen px). */
const ICON_BOX = 32;

interface SlotSpec {
  readonly icon?: { readonly key: string; readonly frame: string };
  readonly hotkey?: string;
  readonly cost?: string;
  readonly tooltip: () => TooltipContent | null;
  readonly onClick: () => void;
}

interface SlotView {
  /** null = the tab toggle. */
  readonly id: string | null;
  readonly container: Phaser.GameObjects.Container;
  readonly box: UiBox;
  readonly icon: Phaser.GameObjects.Image | null;
  readonly label: Phaser.GameObjects.Text | null;
  readonly hotkey: Phaser.GameObjects.Text | null;
  readonly cost: Phaser.GameObjects.Text | null;
  hovered: boolean;
}

/** Bottom-centre row of square slots: tab toggle | orders or buildings. */
export class Hotbar {
  private readonly panel: UiBox;
  private readonly divider: Phaser.GameObjects.Rectangle;
  private readonly tabView: SlotView;
  private slots: SlotView[] = [];
  private selected: string | null = null;
  private fit: HotbarFit = fitHotbar(1, Number.POSITIVE_INFINITY);
  private view = { left: 0, top: 0, width: 0 };
  private scroll = 0;
  private drag: { pointerId: number; startX: number; startScroll: number } | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly tooltip: TooltipHost,
    tab: HotbarTab,
  ) {
    this.panel = createPanel(scene, 'panel', 64, 64);
    this.panel.image.setInteractive().on('pointerdown', this.beginDrag, this);
    this.divider = scene.add
      .rectangle(0, 0, HOTBAR.divider, HOTBAR.slot, UI_PALETTE.woodDark)
      .setOrigin(0, 0);
    this.tabView = this.createView(null, { onClick: tab.onToggle, tooltip: tab.tooltip });
    scene.input.on('pointermove', this.onDragMove, this);
    scene.input.on('pointerup', this.endDrag, this);
  }

  /** Replace the slots after the tab toggle. Call layout() afterwards. */
  setTab(label: string, slots: readonly HotbarSlot[]): void {
    this.tabView.label?.setText(label);
    for (const view of this.slots) view.container.destroy();
    this.slots = slots.map((slot) => this.createView(slot.id, slot));
    this.scroll = 0;
    this.refreshFrames();
  }

  setSelected(id: string | null): void {
    this.selected = id;
    this.refreshFrames();
  }

  layout(screenW: number, screenH: number): Rect {
    const pad = frameBorder(this.scene, 'panel') + 2;
    const available = screenW - 2 * MARGIN - 2 * pad;
    this.fit = fitHotbar(this.slots.length + 1, available);
    const viewW = this.fit.scroll ? available : this.fit.width;
    const w = viewW + 2 * pad;
    const h = this.fit.slot + 2 * pad;
    const x = Math.round((screenW - w) / 2);
    const y = screenH - MARGIN - h;
    this.panel.resize(w, h);
    this.panel.image.setPosition(x, y);
    this.view = { left: x + pad, top: y + pad, width: viewW };
    this.scroll = clampScroll(this.scroll, this.fit.width, viewW);
    this.positionSlots();
    return { x, y, w, h };
  }

  destroy(): void {
    this.scene.input.off('pointermove', this.onDragMove, this);
    this.scene.input.off('pointerup', this.endDrag, this);
    for (const view of [this.tabView, ...this.slots]) view.container.destroy();
    this.slots = [];
    this.divider.destroy();
    this.panel.image.destroy();
  }

  private createView(id: string | null, spec: SlotSpec): SlotView {
    const { scene } = this;
    const box = createPanel(scene, 'slot', HOTBAR.slot, HOTBAR.slot);
    const children: Phaser.GameObjects.GameObject[] = [box.image];
    let icon: Phaser.GameObjects.Image | null = null;
    if (spec.icon) {
      const frame = scene.textures.getFrame(spec.icon.key, spec.icon.frame);
      icon = scene.add
        .image(0, 0, spec.icon.key, spec.icon.frame)
        .setScale(iconScale(frame.width, frame.height, ICON_BOX));
      children.push(icon);
    }
    const label = id === null ? addUiText(scene, 0, 0, '', 12).setOrigin(0.5).setAlign('center') : null;
    const hotkey = spec.hotkey ? addUiText(scene, 0, 0, spec.hotkey, 11) : null;
    const cost = spec.cost ? addUiText(scene, 0, 0, spec.cost, 11).setOrigin(1, 1) : null;
    for (const text of [label, hotkey, cost]) if (text) children.push(text);
    const container = scene.add.container(0, 0, children);
    const view: SlotView = { id, container, box, icon, label, hotkey, cost, hovered: false };
    box.image.on('pointerdown', this.beginDrag, this);
    bindPress(scene, box.image, {
      onClick: spec.onClick,
      tooltip: { host: this.tooltip, content: spec.tooltip },
      onState: (state) => {
        view.hovered = state !== 'idle';
        this.refreshFrame(view);
      },
    });
    return view;
  }

  private refreshFrames(): void {
    for (const view of [this.tabView, ...this.slots]) this.refreshFrame(view);
  }

  private refreshFrame(view: SlotView): void {
    const selected = view.id !== null && view.id === this.selected;
    view.box.setFrame(selected ? 'slotSelected' : view.hovered ? 'slotHover' : 'slot');
  }

  private positionSlots(): void {
    const { slot, gap } = this.fit;
    const { left, top, width } = this.view;
    const inView = (x: number, w: number): boolean => x >= left - 0.5 && x + w <= left + width + 0.5;
    [this.tabView, ...this.slots].forEach((view, i) => {
      const x = left + hotbarSlotX(i, slot, gap) - this.scroll;
      this.placeSlot(view, x, top, slot);
      const visible = inView(x, slot);
      view.container.setVisible(visible);
      if (visible) view.box.image.setInteractive();
      else view.box.image.disableInteractive();
    });
    const dividerX = left + slot + gap - this.scroll;
    this.divider
      .setPosition(dividerX, top)
      .setSize(HOTBAR.divider, slot)
      .setVisible(inView(dividerX, HOTBAR.divider));
  }

  private placeSlot(view: SlotView, x: number, y: number, size: number): void {
    view.container.setPosition(x, y);
    view.box.resize(size, size);
    const inset = frameBorder(this.scene, 'slotSelected') + 1;
    view.icon?.setPosition(size / 2, size / 2);
    view.label?.setPosition(size / 2, size / 2);
    view.hotkey?.setPosition(inset, inset - 1);
    view.cost?.setPosition(size - inset, size - inset + 1);
  }

  private beginDrag(pointer: Phaser.Input.Pointer): void {
    if (!this.fit.scroll) return;
    this.drag = { pointerId: pointer.id, startX: pointer.x, startScroll: this.scroll };
  }

  private onDragMove(pointer: Phaser.Input.Pointer): void {
    const drag = this.drag;
    if (!drag || pointer.id !== drag.pointerId || !pointer.isDown) return;
    const next = clampScroll(
      drag.startScroll - (pointer.x - drag.startX),
      this.fit.width,
      this.view.width,
    );
    if (next === this.scroll) return;
    this.scroll = next;
    this.positionSlots();
  }

  private endDrag(pointer: Phaser.Input.Pointer): void {
    if (this.drag?.pointerId === pointer.id) this.drag = null;
  }
}
```

- [ ] **Step 2: Lint + typecheck + test**

Run: `npm run lint < /dev/null && npm run typecheck < /dev/null && npm test < /dev/null`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/ui/hud/Hotbar.ts
git commit -m "$(cat <<'EOF'
feat(hud): Stardew-style hotbar with tab slot, hover/selected frames and drag scroll

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: `ColonistPanel` và `ToastStack`

**Files:**
- Create: `src/ui/hud/ColonistPanel.ts`
- Create: `src/ui/hud/ToastStack.ts`

**Interfaces:**
- Consumes: `UI_PALETTE`; `addUiText`, `bindPress`, `createPanel`, `frameBorder`, `UiBox` (Task 3); `CARD`, `needColor`, `visibleCards`, `CardLayout`, `TOAST`, `pushToast`, `toastText`, `ToastEntry`, `Rect` (Task 2).
- Produces:
  - `interface ColonistRow { eid: number; name: string; job: string; hunger: number; rest: number; dead: boolean }`.
  - `class ColonistPanel { constructor(scene, onFocus: (eid: number) => void); update(rows: readonly ColonistRow[]): void; layout(cards: CardLayout): Rect; destroy(): void }`.
  - `class ToastStack { constructor(scene); push(text: string): void; update(now: number): void; layout(x: number, bottom: number, maxWidth: number): Rect; destroy(): void }` — `now` là `scene.time.now`.

Ghi chú: thẻ colonist dùng frame `button` (gỗ 2 px) thay vì `panel` (gỗ 4 px): ở `uiScale = 2`, viền `panel` dày 12 px mỗi phía chỉ còn 24 px lõi trong thẻ cao 48 px, không đủ cho hai dòng chữ; frame `button` còn 32 px lõi và có sẵn trạng thái hover/bấm cho thẻ bấm được. Colonist chết: thẻ mờ 50%, dòng việc "Đã chết" (do `HudScene` truyền vào), thanh về 0.

- [ ] **Step 1: Viết `ColonistPanel.ts`**

```ts
import type Phaser from 'phaser';
import { UI_PALETTE } from '../../data/uiPalette';
import { addUiText, bindPress, createPanel, frameBorder, type UiBox } from '../theme';
import { CARD, needColor, visibleCards, type CardLayout, type Rect } from './layout';

/** What one card shows; HudScene builds these from the world. */
export interface ColonistRow {
  readonly eid: number;
  readonly name: string;
  readonly job: string;
  readonly hunger: number;
  readonly rest: number;
  readonly dead: boolean;
}

const BAR = { w: 40, h: 10, gap: 4 } as const;
const BAR_LABELS = ['Đói', 'Ngủ'] as const;

interface BarView {
  readonly frame: UiBox;
  readonly fill: Phaser.GameObjects.Rectangle;
  readonly label: Phaser.GameObjects.Text;
  x: number;
  y: number;
}

interface CardView {
  readonly container: Phaser.GameObjects.Container;
  readonly box: UiBox;
  readonly name: Phaser.GameObjects.Text;
  readonly job: Phaser.GameObjects.Text;
  readonly bars: BarView[];
  /** null for the "+N" card. */
  eid: number | null;
}

/** Colonist cards, top-left. Tapping a card follows that colonist. */
export class ColonistPanel {
  private rows: readonly ColonistRow[] = [];
  private views: CardView[] = [];
  private cards: CardLayout | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly onFocus: (eid: number) => void,
  ) {}

  update(rows: readonly ColonistRow[]): void {
    const countChanged = rows.length !== this.rows.length;
    this.rows = rows;
    this.render(countChanged);
  }

  layout(cards: CardLayout): Rect {
    this.cards = cards;
    const count = this.render(true);
    return { x: cards.x, y: cards.y, w: cards.w, h: Math.max(0, count * (CARD.h + CARD.gap) - CARD.gap) };
  }

  destroy(): void {
    for (const view of this.views) view.container.destroy();
    this.views = [];
  }

  /** Returns the number of visible cards. */
  private render(relayout: boolean): number {
    const cards = this.cards;
    if (!cards) return 0;
    const { shown, more } = visibleCards(this.rows.length, cards.slots);
    const needed = shown + (more > 0 ? 1 : 0);
    let place = relayout;
    while (this.views.length < needed) {
      this.views.push(this.createView());
      place = true;
    }
    this.views.forEach((view, i) => {
      view.container.setVisible(i < needed);
      if (i >= needed) return;
      if (place) this.place(view, cards, i);
      const row = this.rows[i];
      if (i < shown && row) this.fill(view, row, cards.compact);
      else this.fillMore(view, more);
    });
    return needed;
  }

  private createView(): CardView {
    const { scene } = this;
    const box = createPanel(scene, 'button', CARD.w, CARD.h);
    const name = addUiText(scene, 0, 0, '', 13);
    const job = addUiText(scene, 0, 0, '', 11).setOrigin(0, 1);
    const bars: BarView[] = BAR_LABELS.map((text) => ({
      frame: createPanel(scene, 'bar', BAR.w, BAR.h),
      fill: scene.add.rectangle(0, 0, 1, 1, UI_PALETTE.good).setOrigin(0, 0),
      label: addUiText(scene, 0, 0, text, 10).setOrigin(1, 0.5),
      x: 0,
      y: 0,
    }));
    const container = scene.add.container(0, 0, [
      box.image,
      name,
      job,
      ...bars.flatMap((bar) => [bar.frame.image, bar.fill, bar.label]),
    ]);
    const view: CardView = { container, box, name, job, bars, eid: null };
    bindPress(scene, box.image, {
      onClick: () => {
        if (view.eid !== null) this.onFocus(view.eid);
      },
      onState: (state) =>
        box.setFrame(state === 'down' ? 'buttonDown' : state === 'hover' ? 'buttonHover' : 'button'),
    });
    return view;
  }

  private place(view: CardView, cards: CardLayout, index: number): void {
    view.container.setPosition(cards.x, cards.y + index * (CARD.h + CARD.gap));
    view.box.resize(cards.w, CARD.h);
    const inset = frameBorder(this.scene, 'button') + 4;
    view.name.setPosition(inset, inset - 2);
    view.job.setPosition(inset, CARD.h - inset + 2);
    const barX = cards.w - inset - BAR.w;
    view.bars.forEach((bar, i) => {
      bar.x = barX;
      bar.y = Math.round(CARD.h / 2 - BAR.h - BAR.gap / 2 + i * (BAR.h + BAR.gap));
      bar.frame.resize(BAR.w, BAR.h);
      bar.frame.image.setPosition(bar.x, bar.y);
      bar.label.setPosition(bar.x - 3, bar.y + BAR.h / 2);
    });
  }

  private fill(view: CardView, row: ColonistRow, compact: boolean): void {
    view.eid = row.eid;
    view.name.setText(row.name);
    view.job.setText(row.job).setVisible(!compact);
    view.container.setAlpha(row.dead ? 0.5 : 1);
    const edge = frameBorder(this.scene, 'bar');
    [row.hunger, row.rest].forEach((value, i) => {
      const bar = view.bars[i]!;
      const v = Math.max(0, Math.min(100, value));
      bar.frame.image.setVisible(true);
      bar.label.setVisible(!compact);
      bar.fill
        .setVisible(v > 0)
        .setFillStyle(needColor(v))
        .setPosition(bar.x + edge, bar.y + edge)
        .setSize(((BAR.w - 2 * edge) * v) / 100, BAR.h - 2 * edge);
    });
  }

  private fillMore(view: CardView, more: number): void {
    view.eid = null;
    view.name.setText(`+${more}`);
    view.job.setVisible(false);
    view.container.setAlpha(1);
    for (const bar of view.bars) {
      bar.frame.image.setVisible(false);
      bar.fill.setVisible(false);
      bar.label.setVisible(false);
    }
  }
}
```

- [ ] **Step 2: Viết `ToastStack.ts`**

```ts
import type Phaser from 'phaser';
import { addUiText, createPanel, frameBorder, type UiBox } from '../theme';
import { TOAST, pushToast, toastText, type Rect, type ToastEntry } from './layout';

const TEXT_PAD = 6;

interface ToastView {
  entry: ToastEntry;
  readonly container: Phaser.GameObjects.Container;
  readonly box: UiBox;
  readonly text: Phaser.GameObjects.Text;
  fading: boolean;
}

/**
 * Event log as toasts (bottom-left): slide in, stay 5 s, fade out. Up to four; a repeat of
 * a visible toast becomes "… ×N" and restarts its timer instead of adding a box.
 */
export class ToastStack {
  private list: ToastEntry[] = [];
  private readonly views = new Map<number, ToastView>();
  private nextId = 1;
  private x = 0;
  private bottom = 0;
  private maxWidth: number = TOAST.maxWidth;

  constructor(private readonly scene: Phaser.Scene) {}

  push(text: string): void {
    const result = pushToast(this.list, text, this.scene.time.now, this.nextId++);
    this.list = result.list;
    for (const gone of result.dropped) this.removeView(gone.id);
    if (result.merged) {
      const view = this.views.get(result.entry.id);
      if (view) {
        view.entry = result.entry;
        view.fading = false;
        this.scene.tweens.killTweensOf(view.container);
        view.container.setAlpha(1).setX(this.x);
        this.render(view);
      }
    } else {
      const view = this.createView(result.entry);
      this.views.set(result.entry.id, view);
      // Start just off the left edge of the screen, then slide in.
      view.container.setX(-view.box.width - 4);
      this.scene.tweens.add({
        targets: view.container,
        x: this.x,
        duration: TOAST.slideMs,
        ease: 'Quad.easeOut',
      });
    }
    this.stack();
  }

  /** Start fading toasts whose 5 s are up. `now` = scene.time.now. */
  update(now: number): void {
    for (const view of this.views.values()) {
      if (view.fading || now - view.entry.shownAt < TOAST.holdMs) continue;
      view.fading = true;
      const id = view.entry.id;
      this.scene.tweens.add({
        targets: view.container,
        alpha: 0,
        duration: TOAST.fadeMs,
        onComplete: () => {
          this.list = this.list.filter((t) => t.id !== id);
          this.removeView(id);
          this.stack();
        },
      });
    }
  }

  /** Toasts grow upwards from `bottom`, left edge at `x`. */
  layout(x: number, bottom: number, maxWidth: number): Rect {
    this.x = x;
    this.bottom = bottom;
    this.maxWidth = maxWidth;
    for (const view of this.views.values()) {
      this.render(view);
      if (!this.scene.tweens.isTweening(view.container)) view.container.setX(x);
    }
    this.stack();
    const h = TOAST.max * (TOAST.height + TOAST.gap) - TOAST.gap;
    return { x, y: bottom - h, w: maxWidth, h };
  }

  destroy(): void {
    for (const id of [...this.views.keys()]) this.removeView(id);
    this.list = [];
  }

  private createView(entry: ToastEntry): ToastView {
    const box = createPanel(this.scene, 'tooltip', 32, TOAST.height);
    box.image.setInteractive();
    const text = addUiText(this.scene, 0, 0, '', 13).setOrigin(0, 0.5);
    const container = this.scene.add.container(this.x, 0, [box.image, text]);
    const view: ToastView = { entry, container, box, text, fading: false };
    this.render(view);
    return view;
  }

  private render(view: ToastView): void {
    const inset = frameBorder(this.scene, 'tooltip') + TEXT_PAD;
    const label = toastText(view.entry, this.maxWidth - 2 * inset, (s) => view.text.setText(s).width);
    view.text.setText(label).setPosition(inset, TOAST.height / 2);
    view.box.resize(Math.ceil(view.text.width + 2 * inset), TOAST.height);
  }

  /** Newest at the bottom, older ones pushed up. */
  private stack(): void {
    const n = this.list.length;
    this.list.forEach((t, i) => {
      this.views
        .get(t.id)
        ?.container.setY(this.bottom - TOAST.height - (n - 1 - i) * (TOAST.height + TOAST.gap));
    });
  }

  private removeView(id: number): void {
    const view = this.views.get(id);
    if (!view) return;
    this.scene.tweens.killTweensOf(view.container);
    view.container.destroy();
    this.views.delete(id);
  }
}
```

- [ ] **Step 3: Lint + typecheck + test**

Run: `npm run lint < /dev/null && npm run typecheck < /dev/null && npm test < /dev/null`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add src/ui/hud/ColonistPanel.ts src/ui/hud/ToastStack.ts
git commit -m "$(cat <<'EOF'
feat(hud): colonist cards with need bars and merging toast stack

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Viết lại `HudScene`

**Files:**
- Rewrite: `src/scenes/HudScene.ts`

**Interfaces:**
- Consumes: mọi thứ từ Task 2–7 (`Tooltip`, `ContentBox`, `ClockBox`, `ResourceBox`, `ColonistPanel`/`ColonistRow`, `Hotbar`/`HotbarSlot`, `ToastStack`, `createButton`, `textStyle`, `FONT_DEBUG`, `TOUCH_TARGET`, `Button`, `TooltipSource`, `GAP`, `MAP_DWELL_MS`, `MARGIN`, `RIGHT_COLUMN_W`, `TOAST`, `TOAST_STACK_H`, `costTotal`, `layoutCards`, `overlapsX`, `textContent`, `Rect`, `TooltipContent`, `TooltipLine`); `BuildingDef.descVi` (Task 2); `HudSceneData` từ `WorldScene` (không đổi).
- Produces: `class HudScene` (key `SCENES.hud`), cùng `create(data: HudSceneData)` như cũ.

**Hành vi Phase 1 phải giữ (đối chiếu từ `HudScene` hiện tại):**
1. Nút tốc độ: ❚❚ → `ui:toggle-pause`, 1×/2×/3× → `ui:set-speed`; nút đang chạy sáng theo `clock:speed`, khởi tạo theo `world.clock.speed`.
2. Thời gian chơi: thay dòng trạng thái bằng hộp đồng hồ, cập nhật theo `clock:tick` (khởi tạo theo `world.clock.tick`).
3. Tài nguyên từ `world.stock.snapshot()` lúc tạo và theo `stock:changed`.
4. Thẻ colonist (cả người đã chết) từ `query(Colonist)` lúc tạo và mỗi `clock:tick`; bấm thẻ → `ui:focus-colonist`.
5. Thông tin dưới con trỏ (`cursor:move`): colonist → vật thể → địa hình (`describeTerrain`), giờ hiện trong tooltip sau 300 ms đứng yên.
6. Thực thể đang chọn (`entity:select`), cập nhật mỗi tick: panel cố định trên vùng toast.
7. `camera:zoom` → dòng debug; dòng debug (FPS/zoom/seed/toạ độ) chỉ ở dev.
8. `log` → toast.
9. `build:mode` → `buildKind`, `pending = false`, sang tab Xây nếu có công trình, ô được chọn, nút Bám lưới bật theo `snap`, gợi ý, layout.
10. `tool:changed` → `tool`, `pending = false`, sang tab Lệnh nếu có công cụ (**Tường giờ ở tab Lệnh** theo spec §5.3), ô được chọn, gợi ý, layout.
11. `build:status` (chỉ khi đang xây hoặc đang vẽ tường) → `pending`, lỗi `PLACEMENT_HELP[reason]` màu `bad` hoặc trả về gợi ý.
12. `build:placed` → `pending = false`, "Đã đặt X." màu `good`.
13. Ô đổi tab Lệnh/Xây.
14. Nút Bám lưới (khi đang đặt công trình) → `ui:toggle-snap`.
15. ✓ Đặt / ✕ Huỷ (khi ghost cảm ứng đang chờ) → `ui:build-confirm` / `ui:build-cancel`; Đặt luôn sáng.
16. Nút zoom +/− → `ui:zoom-step` ±1.
17. Resize → layout; SHUTDOWN → gỡ listener bus + `destroy()` mọi phần; reset trạng thái mỗi ván ở đầu `create()`.
18. Con trỏ trên UI không chọn/đặt trên bản đồ: mọi khung HUD đều interactive (Phaser `globalTopOnly` dừng sự kiện ở scene trên cùng); tooltip không interactive.

Bố cục: cột phải (đồng hồ + tốc độ + tài nguyên) ở phải trên; hotbar dưới giữa; ngay trên hotbar là hàng Bám lưới/✓/✕ rồi hộp gợi ý (căn giữa); zoom ở phải dưới, nâng lên trên hotbar nếu chồng (khi đó hàng giữa thu hẹp để tránh cột zoom); toast ở trái dưới, hoặc ngay trên chồng giữa nếu hotbar chiếm cả mép dưới (điện thoại); panel thực thể đang chọn nằm trên vùng dành cho 4 toast; thẻ colonist trái trên, số thẻ giới hạn bởi đỉnh hotbar.

- [ ] **Step 1: Thay toàn bộ `src/scenes/HudScene.ts`**

```ts
import { hasComponent, query } from 'bitecs';
import Phaser from 'phaser';
import type { EventBus, GameEvents, OrderTool } from '../core/events';
import { BUILDINGS, BUILDING_IDS, PLAYER_BUILDINGS, type BuildingId } from '../data/buildings';
import { DOODADS, DOODAD_IDS } from '../data/doodads';
import { PALETTE } from '../data/palette';
import { RESOURCES, RESOURCE_IDS } from '../data/resources';
import type { TerrainDef } from '../data/terrain';
import { UI_PALETTE } from '../data/uiPalette';
import { SPRITES_KEY, buildingFrame, iconFrame } from '../render/atlas';
import { carryOf, colonistAt, colonistName } from '../sim/colony/colonists';
import { designationOf } from '../sim/colony/designation';
import { Building, Colonist, Dead, Doodad, Needs } from '../sim/components';
import { entityAt, type GameWorld } from '../sim/GameWorld';
import type { JobKind } from '../sim/jobs/types';
import type { PlacementProblem } from '../sim/placement';
import { ContentBox } from '../ui/ContentBox';
import { ClockBox } from '../ui/hud/ClockBox';
import { ColonistPanel, type ColonistRow } from '../ui/hud/ColonistPanel';
import { Hotbar, type HotbarSlot } from '../ui/hud/Hotbar';
import {
  GAP,
  MAP_DWELL_MS,
  MARGIN,
  RIGHT_COLUMN_W,
  TOAST,
  TOAST_STACK_H,
  costTotal,
  layoutCards,
  overlapsX,
  textContent,
  type Rect,
  type TooltipContent,
  type TooltipLine,
} from '../ui/hud/layout';
import { ResourceBox } from '../ui/hud/ResourceBox';
import { ToastStack } from '../ui/hud/ToastStack';
import {
  createButton,
  FONT_DEBUG,
  textStyle,
  TOUCH_TARGET,
  type Button,
  type TooltipSource,
} from '../ui/theme';
import { Tooltip } from '../ui/Tooltip';
import { SCENES } from './keys';
import type { HudSceneData } from './WorldScene';

/** Tooltip owner for the map info under a resting mouse. */
const MAP_TIP = 'map';
const SNAP_W = 96;
const CONFIRM_W = 76;
const SELECTED_MAX_W = 260;
const STATUS_MAX_W = 420;

type Tab = 'orders' | 'build';

/** Order tab, in hotbar order. Hotkeys mirror TOOL_KEYS in WorldScene — keep them in sync. */
const ORDER_TOOLS: readonly { tool: OrderTool; name: string; hotkey: string }[] = [
  { tool: 'chop', name: 'Chặt', hotkey: 'Q' },
  { tool: 'mine', name: 'Đào', hotkey: 'E' },
  { tool: 'forage', name: 'Hái', hotkey: 'R' },
  { tool: 'clear', name: 'Bỏ đánh dấu', hotkey: 'T' },
  { tool: 'wall', name: 'Tường', hotkey: 'F' },
];

/** Placement problems, phrased as what to do about them. */
const PLACEMENT_HELP: Record<PlacementProblem, string> = {
  outOfBounds: 'Quá sát mép bản đồ — dời vào trong.',
  terrain: 'Nền này không xây được — chọn chỗ đất khô.',
  building: 'Chồng lên công trình khác — dời ra một chút.',
  doodad: 'Vướng cây hoặc đá — chọn chỗ trống khác.',
  outOfTerritory: 'Ngoài lãnh thổ — đặt gần Lửa Thiêng hơn.',
};

const TOOL_HINTS: Record<OrderTool, { mouse: string; touch: string }> = {
  chop: {
    mouse: 'Kéo khung quanh cây chết để chặt.',
    touch: 'Chạm vào cây chết để đánh dấu chặt.',
  },
  mine: { mouse: 'Kéo khung quanh tảng đá để đào.', touch: 'Chạm vào tảng đá để đánh dấu đào.' },
  forage: {
    mouse: 'Kéo khung quanh nấm phát quang để hái.',
    touch: 'Chạm vào nấm để đánh dấu hái.',
  },
  clear: { mouse: 'Kéo khung để bỏ đánh dấu.', touch: 'Chạm vào vật đã đánh dấu để bỏ.' },
  wall: {
    mouse: 'Nhấn và kéo để vẽ tường. Chuột phải để thôi.',
    touch: 'Chạm điểm đầu, chạm điểm cuối, rồi bấm Đặt.',
  },
};

const JOB_LABELS: Record<JobKind, string> = {
  harvest: 'Đang khai thác',
  haulToDrop: 'Đang vác hàng về kho',
  deliver: 'Đang chở vật liệu',
  construct: 'Đang xây',
  eat: 'Đang ăn',
  sleep: 'Đang ngủ',
  idle: 'Đang nghỉ',
};

const HARVEST_LABELS = { chop: 'Đang chặt cây', mine: 'Đang đào đá', forage: 'Đang hái nấm' };

const describeTerrain = (t: TerrainDef): string[] => {
  const lines = [t.nameVi];
  if (!t.passable) lines.push('Không đi qua được');
  else if (t.speed === 1) lines.push('Đi lại bình thường');
  else lines.push(`Đi chậm, tốc độ ×${t.speed}`);
  lines.push(t.buildable ? 'Xây được' : 'Không xây được');
  if (t.defenseBonus) {
    lines.push(`Phòng thủ ${t.defenseBonus > 0 ? '+' : ''}${t.defenseBonus} khi đứng ở đây`);
  }
  return lines;
};

/**
 * Screen-space overlay (camera zoom 1, never scrolls). Builds the Stardew-style HUD parts,
 * reads world state for display and sends player intents back through the bus — it never
 * mutates the simulation.
 */
export class HudScene extends Phaser.Scene {
  private bus!: EventBus<GameEvents>;
  private world!: GameWorld;
  private isTouch = false;
  private tooltip!: Tooltip;
  private clock!: ClockBox;
  private resources!: ResourceBox;
  private colonists!: ColonistPanel;
  private hotbar!: Hotbar;
  private toasts!: ToastStack;
  private selectedPanel!: ContentBox;
  private status!: ContentBox;
  private debugLine!: Phaser.GameObjects.Text;
  private snapButton!: Button;
  private confirmButtons: Button[] = [];
  private zoomButtons: Button[] = [];
  private tab: Tab = 'orders';
  private shownTab: Tab | null = null;
  private cursor: { x: number; y: number } | null = null;
  private selected: number | null = null;
  private zoom = 1;
  private buildKind: BuildingId | null = null;
  private tool: OrderTool | null = null;
  private pending = false;
  /** Overrides the hint: a placement error or "Đã đặt …". */
  private message: { text: string; color: number } | null = null;
  private dwell: Phaser.Time.TimerEvent | null = null;
  private mapTipShown = false;
  private selectedBottom = 0;
  private unsubscribers: (() => void)[] = [];

  constructor() {
    super(SCENES.hud);
  }

  create({ bus, world, initialZoom, isTouch }: HudSceneData): void {
    // Scene instances are reused between games; reset per-game state.
    this.bus = bus;
    this.world = world;
    this.isTouch = isTouch;
    this.zoom = initialZoom;
    this.cursor = null;
    this.selected = null;
    this.buildKind = null;
    this.tool = null;
    this.pending = false;
    this.tab = 'orders';
    this.shownTab = null;
    this.message = null;
    this.dwell = null;
    this.mapTipShown = false;

    this.tooltip = new Tooltip(this);
    this.clock = new ClockBox(this, this.tooltip, (speed) =>
      speed === 0 ? bus.emit('ui:toggle-pause', {}) : bus.emit('ui:set-speed', { speed }),
    );
    this.resources = new ResourceBox(this);
    this.colonists = new ColonistPanel(this, (eid) => bus.emit('ui:focus-colonist', { eid }));
    this.toasts = new ToastStack(this);
    this.selectedPanel = new ContentBox(this, 'panel', SELECTED_MAX_W, { blocking: true });
    this.status = new ContentBox(this, 'tooltip', STATUS_MAX_W, { fontSize: 14, blocking: true });
    this.hotbar = new Hotbar(this, this.tooltip, {
      onToggle: () => this.showTab(this.tab === 'orders' ? 'build' : 'orders'),
      tooltip: () => ({
        title: this.tab === 'orders' ? 'Sang nhóm Xây' : 'Sang nhóm Lệnh',
        lines: [],
      }),
    });
    // FPS / seed / coordinates: developer readout, hidden in production builds.
    this.debugLine = this.add
      .text(0, 2, '', textStyle(10, PALETTE.ashGrey, FONT_DEBUG))
      .setOrigin(0.5, 0)
      .setVisible(import.meta.env.DEV);

    this.createButtons();
    this.subscribe();

    this.scale.on(Phaser.Scale.Events.RESIZE, this.onResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.onResize, this);
      for (const off of this.unsubscribers) off();
      this.dwell?.remove(false);
      this.dwell = null;
      for (const part of [
        this.tooltip,
        this.clock,
        this.resources,
        this.colonists,
        this.hotbar,
        this.toasts,
        this.selectedPanel,
        this.status,
      ]) {
        part.destroy();
      }
    });

    this.clock.setSpeed(world.clock.speed);
    this.clock.setTick(world.clock.tick);
    this.resources.update(world.stock.snapshot());
    this.refreshCards();
    this.showTab('orders');
  }

  update(): void {
    if (this.debugLine.visible) {
      const c = this.cursor;
      this.debugLine.setText(
        `${Math.round(this.game.loop.actualFps)} fps   zoom ${this.zoom}×   seed ${this.world.seed}` +
          (c ? `   x ${c.x} y ${c.y}` : ''),
      );
    }
    this.toasts.update(this.time.now);
  }

  // --- construction -------------------------------------------------------------------

  private tip(title: string): TooltipSource {
    return { host: this.tooltip, content: () => ({ title, lines: [] }) };
  }

  private createButtons(): void {
    this.snapButton = createButton(this, 0, 0, 'Bám lưới', {
      width: SNAP_W,
      fontSize: 13,
      onClick: () => this.bus.emit('ui:toggle-snap', {}),
      tooltip: this.tip('Bám lưới 8 px (giữ Shift)'),
    });
    this.confirmButtons = [
      createButton(this, 0, 0, '✓ Đặt', {
        width: CONFIRM_W,
        fontSize: 15,
        onClick: () => this.bus.emit('ui:build-confirm', {}),
      }),
      createButton(this, 0, 0, '✕ Huỷ', {
        width: CONFIRM_W,
        fontSize: 15,
        onClick: () => this.bus.emit('ui:build-cancel', {}),
      }),
    ];
    this.confirmButtons[0]!.setActive(true);
    this.zoomButtons = [
      createButton(this, 0, 0, '+', {
        fontSize: 20,
        onClick: () => this.bus.emit('ui:zoom-step', { direction: 1 }),
        tooltip: this.tip('Phóng to'),
      }),
      createButton(this, 0, 0, '−', {
        fontSize: 20,
        onClick: () => this.bus.emit('ui:zoom-step', { direction: -1 }),
        tooltip: this.tip('Thu nhỏ'),
      }),
    ];
  }

  private subscribe(): void {
    const { bus } = this;
    this.unsubscribers = [
      bus.on('cursor:move', (p) => {
        this.cursor = p;
        this.onCursorMoved();
      }),
      bus.on('entity:select', ({ eid }) => {
        this.selected = eid;
        this.refreshSelected();
      }),
      bus.on('camera:zoom', ({ zoom }) => {
        this.zoom = zoom;
      }),
      bus.on('clock:speed', ({ speed }) => this.clock.setSpeed(speed)),
      bus.on('clock:tick', ({ tick }) => {
        this.clock.setTick(tick);
        this.refreshCards();
        if (this.selected !== null) this.refreshSelected();
        if (this.mapTipShown) this.showMapTip();
      }),
      bus.on('stock:changed', ({ stock }) => this.resources.update(stock)),
      bus.on('log', ({ text }) => this.toasts.push(text)),
      bus.on('build:mode', ({ kind, snap }) => {
        this.buildKind = kind;
        this.pending = false;
        this.message = null;
        if (kind) this.showTab('build');
        this.snapButton.setActive(snap);
        this.refreshSelection();
        this.layout();
      }),
      bus.on('tool:changed', ({ tool }) => {
        this.tool = tool;
        this.pending = false;
        this.message = null;
        // Every order tool, the wall included, lives on the Lệnh tab.
        if (tool) this.showTab('orders');
        this.refreshSelection();
        this.layout();
      }),
      bus.on('build:status', ({ ok, reason, pending }) => {
        if (!this.buildKind && this.tool !== 'wall') return;
        this.pending = pending;
        this.message =
          !ok && reason ? { text: PLACEMENT_HELP[reason], color: UI_PALETTE.bad } : null;
        this.layout();
      }),
      bus.on('build:placed', ({ kind }) => {
        this.pending = false;
        this.message = { text: `Đã đặt ${BUILDINGS[kind].nameVi}.`, color: UI_PALETTE.good };
        this.layout();
      }),
    ];
  }

  // --- hotbar -------------------------------------------------------------------------

  private showTab(tab: Tab): void {
    this.tab = tab;
    if (this.shownTab === tab) return;
    this.shownTab = tab;
    // The tab slot names the *other* group.
    const other = tab === 'orders' ? 'Xây' : 'Lệnh';
    this.hotbar.setTab(`⇄\n${other}`, tab === 'orders' ? this.orderSlots() : this.buildSlots());
    this.refreshSelection();
    this.layout();
  }

  private orderSlots(): HotbarSlot[] {
    return ORDER_TOOLS.map(({ tool, name, hotkey }) => ({
      id: tool,
      icon: { key: SPRITES_KEY, frame: iconFrame(tool) },
      hotkey,
      tooltip: () => ({
        title: `${name} (${hotkey})`,
        lines: [[{ text: this.isTouch ? TOOL_HINTS[tool].touch : TOOL_HINTS[tool].mouse }]],
      }),
      onClick: () => this.bus.emit('ui:tool', { tool }),
    }));
  }

  private buildSlots(): HotbarSlot[] {
    return PLAYER_BUILDINGS.map((id) => {
      const def = BUILDINGS[id];
      return {
        id,
        icon: { key: SPRITES_KEY, frame: buildingFrame(id) },
        hotkey: def.hotkey,
        cost: String(costTotal(def.cost)),
        tooltip: () => this.buildingTooltip(id),
        onClick: () => this.bus.emit('ui:build', { kind: id }),
      };
    });
  }

  /** Name, one icon+amount per resource (red when the stock is short), description. */
  private buildingTooltip(id: BuildingId): TooltipContent {
    const def = BUILDINGS[id];
    const stock = this.world.stock.snapshot();
    const cost: TooltipLine = RESOURCE_IDS.filter((r) => def.cost[r] !== undefined).map((r) => {
      const amount = def.cost[r] ?? 0;
      return {
        text: String(amount),
        icon: { key: SPRITES_KEY, frame: iconFrame(r) },
        color: stock[r] < amount ? UI_PALETTE.bad : undefined,
      };
    });
    return {
      title: def.hotkey ? `${def.nameVi} (${def.hotkey})` : def.nameVi,
      lines: [cost, [{ text: def.descVi }]],
    };
  }

  private refreshSelection(): void {
    this.hotbar.setSelected(this.buildKind ?? this.tool);
  }

  private hintText(): string {
    if (this.buildKind) {
      const name = BUILDINGS[this.buildKind].nameVi;
      return this.isTouch
        ? `Chạm vào bản đồ để đặt ${name}, rồi bấm Đặt.`
        : `Nhấp để đặt ${name}. Giữ Shift để bám lưới, chuột phải để thôi.`;
    }
    if (this.tool) return this.isTouch ? TOOL_HINTS[this.tool].touch : TOOL_HINTS[this.tool].mouse;
    return '';
  }

  private statusContent(): TooltipContent | null {
    const text = this.message?.text ?? this.hintText();
    if (!text) return null;
    return { lines: [[{ text, color: this.message?.color }]] };
  }

  // --- layout -------------------------------------------------------------------------

  private onResize(): void {
    // Border thickness may have switched between 1× and 2×.
    this.status.refresh();
    this.selectedPanel.refresh();
    this.tooltip.refresh();
    this.layout();
  }

  private layout(): void {
    const { width, height } = this.scale;

    // Right column: clock + speed row, then resources.
    const right = width - MARGIN;
    const clock = this.clock.layout(right, MARGIN);
    const res = this.resources.layout(right, clock.y + clock.h + GAP);
    const rightColumn: Rect = {
      x: right - RIGHT_COLUMN_W,
      y: MARGIN,
      w: RIGHT_COLUMN_W,
      h: res.y + res.h - MARGIN,
    };

    // Hotbar: bottom centre.
    const bar = this.hotbar.layout(width, height);

    // Zoom: bottom-right, lifted above the hotbar when they would overlap.
    const zoomLeft = width - MARGIN - TOUCH_TARGET;
    const zoomLifted = overlapsX({ x: zoomLeft, w: TOUCH_TARGET }, bar);
    const zoomBottom = zoomLifted ? bar.y - GAP : height - MARGIN;
    this.zoomButtons.forEach((button, i) =>
      button.container.setPosition(
        zoomLeft + TOUCH_TARGET / 2,
        zoomBottom - TOUCH_TARGET / 2 - (1 - i) * (TOUCH_TARGET + GAP),
      ),
    );
    // The centre stack above the hotbar keeps clear of a lifted zoom column.
    const centreMax = zoomLifted ? width - 2 * (MARGIN + TOUCH_TARGET + GAP) : width - 2 * MARGIN;
    let stackTop = bar.y;

    // Placement row: snap (building) + ✓/✕ (touch ghost waiting), centred.
    const showSnap = this.buildKind !== null;
    this.snapButton.setVisible(showSnap);
    for (const button of this.confirmButtons) button.setVisible(this.pending);
    const row: { button: Button; w: number }[] = [
      ...(showSnap ? [{ button: this.snapButton, w: SNAP_W }] : []),
      ...(this.pending ? this.confirmButtons.map((button) => ({ button, w: CONFIRM_W })) : []),
    ];
    if (row.length > 0) {
      const rowW = row.reduce((sum, r) => sum + r.w, 0) + GAP * (row.length - 1);
      let x = (width - rowW) / 2;
      const y = stackTop - GAP - TOUCH_TARGET / 2;
      for (const { button, w } of row) {
        button.container.setPosition(Math.round(x + w / 2), Math.round(y));
        x += w + GAP;
      }
      stackTop -= GAP + TOUCH_TARGET;
    }

    // Status hint, just above.
    this.status.setMaxWidth(Math.min(STATUS_MAX_W, centreMax));
    this.status.setContent(this.statusContent());
    if (this.status.visible) {
      stackTop -= GAP + this.status.height;
      this.status.setPosition((width - this.status.width) / 2, stackTop);
    }

    // Toasts bottom-left — or above the centre stack when the hotbar spans the bottom edge.
    const leftW = Math.min(
      TOAST.maxWidth,
      width - 2 * MARGIN - (zoomLifted ? TOUCH_TARGET + GAP : 0),
    );
    const leftBottom = overlapsX({ x: MARGIN, w: leftW }, bar) ? stackTop - GAP : height - MARGIN;
    this.toasts.layout(MARGIN, leftBottom, leftW);
    // The selected-thing panel sits above the space kept for a full toast stack.
    this.selectedBottom = leftBottom - TOAST_STACK_H - GAP;
    this.selectedPanel.setMaxWidth(Math.min(SELECTED_MAX_W, leftW));
    this.placeSelected();

    // Colonist cards: top-left, as many as fit above the hotbar.
    this.colonists.layout(layoutCards({ w: width, h: height }, rightColumn, bar.y - GAP));

    this.debugLine.setPosition(width / 2, 2);
  }

  private placeSelected(): void {
    if (!this.selectedPanel.visible) return;
    this.selectedPanel.setPosition(MARGIN, this.selectedBottom - this.selectedPanel.height);
  }

  // --- content ------------------------------------------------------------------------

  private jobLabel(eid: number): string {
    if (hasComponent(this.world.ecs, eid, Dead)) return 'Đã chết';
    const job = this.world.jobs.get(eid);
    if (!job) return JOB_LABELS.idle;
    if (job.kind === 'harvest' && this.world.obstacles.has(job.target)) {
      const tool = designationOf(this.world, job.target);
      if (tool) return HARVEST_LABELS[tool];
    }
    return JOB_LABELS[job.kind];
  }

  private refreshCards(): void {
    const rows: ColonistRow[] = queryColonists(this.world).map((eid) => {
      const dead = hasComponent(this.world.ecs, eid, Dead);
      return {
        eid,
        name: colonistName(eid),
        job: this.jobLabel(eid),
        hunger: dead ? 0 : Needs.hunger[eid]!,
        rest: dead ? 0 : Needs.rest[eid]!,
        dead,
      };
    });
    this.colonists.update(rows);
  }

  private refreshSelected(): void {
    this.selectedPanel.setContent(
      this.selected === null ? null : textContent(this.describeEntity(this.selected)),
    );
    this.placeSelected();
  }

  // --- map tooltip --------------------------------------------------------------------

  private onCursorMoved(): void {
    this.dwell?.remove(false);
    this.dwell = null;
    this.hideMapTip();
    if (!this.cursor) return;
    this.dwell = this.time.delayedCall(MAP_DWELL_MS, () => {
      this.dwell = null;
      this.showMapTip();
    });
  }

  /** Map info under a resting mouse — never over HUD controls or another tooltip. */
  private showMapTip(): void {
    const overHud = this.input.hitTestPointer(this.input.activePointer).length > 0;
    const otherTip = this.tooltip.shownBy !== null && this.tooltip.shownBy !== MAP_TIP;
    const lines = this.describeCursor();
    if (overHud || otherTip || lines.length === 0) {
      this.hideMapTip();
      return;
    }
    this.tooltip.showAtPointer(textContent(lines), MAP_TIP);
    this.mapTipShown = true;
  }

  private hideMapTip(): void {
    if (!this.mapTipShown) return;
    this.mapTipShown = false;
    this.tooltip.hide(MAP_TIP);
  }

  /** Colonist, then object, then ground under the mouse. */
  private describeCursor(): string[] {
    const c = this.cursor;
    if (!c) return [];
    const { world } = this;
    const hovered = colonistAt(world, c.x, c.y) ?? entityAt(world, c.x, c.y);
    if (hovered !== null) return this.describeEntity(hovered);
    return describeTerrain(world.terrain.atWorld(c.x, c.y));
  }

  private describeEntity(eid: number): string[] {
    const { world } = this;
    if (hasComponent(world.ecs, eid, Colonist)) {
      const lines = [colonistName(eid), this.jobLabel(eid)];
      if (hasComponent(world.ecs, eid, Dead)) return lines;
      lines.push(`No bụng ${Math.round(Needs.hunger[eid]!)}/100`);
      lines.push(`Tỉnh táo ${Math.round(Needs.rest[eid]!)}/100`);
      lines.push(`Sức khoẻ ${Math.round(Needs.health[eid]!)}/100`);
      const carried = carryOf(eid);
      if (carried)
        lines.push(
          `Đang mang ${carried.amount} ${RESOURCES[carried.resource].nameVi.toLowerCase()}`,
        );
      return lines;
    }
    if (hasComponent(world.ecs, eid, Doodad)) {
      const def = DOODADS[DOODAD_IDS[Doodad.kind[eid]!]!];
      const lines = [def.nameVi];
      if (def.yields) {
        lines.push(
          `Khai thác được ${def.yields.amount} ${RESOURCES[def.yields.resource].nameVi.toLowerCase()}`,
        );
      }
      const tool = designationOf(world, eid);
      if (tool) lines.push('Đã đánh dấu');
      lines.push(def.blocksMovement ? 'Chắn đường đi' : 'Đi xuyên qua được');
      return lines;
    }
    if (hasComponent(world.ecs, eid, Building)) {
      const def = BUILDINGS[BUILDING_IDS[Building.kind[eid]!]!];
      return [def.nameVi, 'Công trình của bạn'];
    }
    return [];
  }
}

/** All colonists, alive or dead (cards stay to show who was lost). */
const queryColonists = (world: GameWorld): readonly number[] =>
  Array.from(query(world.ecs, [Colonist]));
```

- [ ] **Step 2: Lint, typecheck, test, build**

Run: `npm run lint < /dev/null && npm run typecheck < /dev/null && npm test < /dev/null && npm run build < /dev/null`
Expected: tất cả exit 0.

- [ ] **Step 3: Kiểm tra nhanh trên desktop**

Run: `npm run dev` (nền), mở `http://localhost:5173` ở 1280×720, bấm "Trò chơi mới".
Expected: đồng hồ "Ngày 1 06:00" + 4 nút tốc độ ở phải trên, hộp tài nguyên dưới nó, 3 thẻ colonist trái trên có thanh Đói/Ngủ, hotbar gỗ dưới giữa (ô ⇄ Xây, vạch, 5 ô Q/E/R/T/F); bấm ô ⇄ chuyển sang 4 công trình có phím Z/X/C/V và giá; rê chuột lên ô hiện tooltip kem; đứng yên trên bản đồ 300 ms hiện tooltip địa hình; console không lỗi.

- [ ] **Step 4: Commit**

```bash
git add src/scenes/HudScene.ts
git commit -m "$(cat <<'EOF'
feat(hud): rebuild HudScene from Stardew-style parts, keeping every Phase 1 behaviour

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: Menu chính kiểu Stardew

**Files:**
- Modify: `src/render/uiArt.ts` (thêm nền menu ở cuối file)
- Modify: `src/render/uiArt.test.ts` (thêm `describe('menu backdrop')`)
- Rewrite: `src/scenes/MainMenuScene.ts`

**Interfaces:**
- Consumes: `UI_PALETTE`, `PixelCanvas`, `pixelHash`; `UI_KEY`, `addPixelTexture` (Task 3); `ContentBox` (Task 4); `addUiText`, `createButton`, `createPanel`, `frameBorder`, `FONT_TITLE`, `textStyle`, `Button`, `UiBox` (Task 3).
- Produces (từ `uiArt.ts`): `MENU_SKY_H = 256`, `menuPixelScale(screenHeight): number`, `paintSky(): PixelCanvas` (4×256), `interface HillLayer { height; base; amp; freq; color; trees }`, `HILL_LAYERS: readonly HillLayer[]` (3 lớp xa → gần), `HILL_W = 128`, `paintHills(layer: number): PixelCanvas`.

Ghi chú: màu đồi/cây lấy từ `UI_PALETTE` (xa → gần: `woodDark`, `text`, `outline`) để mọi pixel menu vẫn thuộc bảng màu UI; trời là 4 dải `UI_PALETTE.sky` nối bằng dither Bayer 2×2. `menuPixelScale` chọn cỡ pixel nguyên sao cho 256 hàng trời luôn phủ hết chiều cao màn hình. Nhãn nút theo spec: "Chơi mới", "Đổi seed"; dòng seed "Seed: N" trong hộp `tooltip`.

- [ ] **Step 1: Viết test thất bại**

Trong `src/render/uiArt.test.ts`, đổi khối import từ `./uiArt` thành:

```ts
import {
  HILL_LAYERS,
  HILL_W,
  MENU_SKY_H,
  UI_DECOR,
  UI_DECOR_IDS,
  UI_FRAMES,
  UI_FRAME_IDS,
  menuPixelScale,
  paintHills,
  paintSky,
  paintUiDecor,
  paintUiFrame,
  type UiFrame,
} from './uiArt';
```

và thêm vào cuối file:

```ts
describe('menu backdrop', () => {
  it('picks a whole pixel size so the sky always covers the screen', () => {
    expect(menuPixelScale(400)).toBe(2);
    expect(menuPixelScale(720)).toBe(3);
    expect(menuPixelScale(812)).toBe(4);
    for (const h of [300, 720, 812, 1080, 1440]) {
      expect(MENU_SKY_H * menuPixelScale(h)).toBeGreaterThanOrEqual(h);
    }
  });

  it('paints four sky bands from top to bottom in UI colours', () => {
    const sky = paintSky();
    expect([sky.width, sky.height]).toEqual([4, MENU_SKY_H]);
    expect(colorAt(sky, 0, 0)).toBe(UI_PALETTE.sky[0]);
    expect(colorAt(sky, 0, MENU_SKY_H / 2 - 20)).toBe(UI_PALETTE.sky[1]);
    expect(colorAt(sky, 0, MENU_SKY_H - 1)).toBe(UI_PALETTE.sky[3]);
    expect(foreignColors(sky)).toEqual([]);
  });

  it('dithers between bands instead of a hard edge', () => {
    const sky = paintSky();
    const lastRowOfFirstBand = MENU_SKY_H / 4 - 1;
    const row = [0, 1, 2, 3].map((x) => colorAt(sky, x, lastRowOfFirstBand));
    expect(new Set(row)).toEqual(new Set([UI_PALETTE.sky[0], UI_PALETTE.sky[1]]));
  });

  it('paints three hill layers: transparent sky on top, solid ground at the bottom', () => {
    HILL_LAYERS.forEach((layer, i) => {
      const hills = paintHills(i);
      expect([hills.width, hills.height], `layer ${i}`).toEqual([HILL_W, layer.height]);
      for (let x = 0; x < HILL_W; x++) {
        expect(hills.alphaAt(x, 0), `layer ${i} x ${x}`).toBe(0);
        expect(hills.alphaAt(x, layer.height - 1), `layer ${i} x ${x}`).toBe(255);
      }
      expect(foreignColors(hills), `layer ${i}`).toEqual([]);
    });
  });

  it('rejects unknown hill layers', () => {
    expect(() => paintHills(HILL_LAYERS.length)).toThrow();
  });
});
```

- [ ] **Step 2: Chạy test để thấy thất bại**

Run: `npm test -- src/render/uiArt.test.ts < /dev/null`
Expected: FAIL — `menuPixelScale is not a function` (và các export mới khác chưa có).

- [ ] **Step 3: Thêm nền menu vào cuối `src/render/uiArt.ts`**

```ts
// --- main menu backdrop ------------------------------------------------------------------

/** Sky texture height (texture px); four bands of 64 rows. */
export const MENU_SKY_H = 256;

/** Whole pixel size for the menu backdrop: the sky texture always covers the screen. */
export const menuPixelScale = (screenHeight: number): number =>
  Math.max(2, Math.ceil(screenHeight / MENU_SKY_H));

const DITHER_ROWS = 6;
const BAYER = [
  [0, 2],
  [3, 1],
] as const;

/** Ordered 2×2 dither: `level` 1..DITHER_ROWS → more and more pixels of the next band. */
const ditherOn = (x: number, y: number, level: number): boolean =>
  (BAYER[y % 2]![x % 2]! + 0.5) / 4 < level / (DITHER_ROWS + 1);

/** Four flat sky bands (UI_PALETTE.sky, top → bottom) joined by dither; tiles horizontally. */
export const paintSky = (): PixelCanvas => {
  const bands = P.sky.length;
  const band = MENU_SKY_H / bands;
  const c = new PixelCanvas(4, MENU_SKY_H);
  for (let y = 0; y < MENU_SKY_H; y++) {
    const i = Math.floor(y / band);
    const own = P.sky[i]!;
    const next = P.sky[Math.min(i + 1, bands - 1)]!;
    const level = y - i * band - (band - DITHER_ROWS);
    for (let x = 0; x < 4; x++) c.set(x, y, level > 0 && ditherOn(x, y, level) ? next : own);
  }
  return c;
};

export interface HillLayer {
  /** Texture height. */
  readonly height: number;
  /** Mean ridge height above the bottom edge. */
  readonly base: number;
  /** Two sine waves (whole periods over HILL_W, so the layer tiles seamlessly). */
  readonly amp: readonly [number, number];
  readonly freq: readonly [number, number];
  readonly color: number;
  /** Chance per column of a pine silhouette on the ridge. */
  readonly trees: number;
}

/** Far → near: lower, darker, more trees. */
export const HILL_LAYERS: readonly HillLayer[] = [
  { height: 120, base: 70, amp: [14, 8], freq: [1, 3], color: P.woodDark, trees: 0 },
  { height: 90, base: 46, amp: [10, 6], freq: [2, 5], color: P.text, trees: 0.04 },
  { height: 60, base: 26, amp: [8, 4], freq: [3, 7], color: P.outline, trees: 0.07 },
];

export const HILL_W = 128;

export const paintHills = (layer: number): PixelCanvas => {
  const L = HILL_LAYERS[layer];
  if (!L) throw new Error(`Unknown hill layer ${layer}`);
  const c = new PixelCanvas(HILL_W, L.height);
  const ridge: number[] = [];
  for (let x = 0; x < HILL_W; x++) {
    const t = (x / HILL_W) * Math.PI * 2;
    const y = Math.round(
      L.height -
        L.base -
        L.amp[0] * Math.sin(t * L.freq[0] + layer) -
        L.amp[1] * Math.sin(t * L.freq[1] + layer * 2),
    );
    ridge.push(y);
    c.fillRect(x, y, 1, L.height - y, L.color);
  }
  // Pointed pines standing on the ridge (wrapping, so the seam stays invisible).
  for (let x = 0; x < HILL_W; x++) {
    if (pixelHash(x, layer, 77) >= L.trees) continue;
    const tall = 6 + Math.floor(pixelHash(layer, x, 78) * 7);
    const top = ridge[x]! - tall;
    for (let r = 0; r <= tall; r++) {
      const half = Math.floor(r / 3);
      for (let dx = -half; dx <= half; dx++) c.set((x + dx + HILL_W) % HILL_W, top + r, L.color);
    }
  }
  return c;
};
```

- [ ] **Step 4: Chạy test để thấy pass**

Run: `npm test -- src/render/uiArt.test.ts < /dev/null`
Expected: PASS (toàn bộ test của file, gồm 5 test mới).

- [ ] **Step 5: Thay toàn bộ `src/scenes/MainMenuScene.ts`**

```ts
import Phaser from 'phaser';
import { toCss } from '../data/palette';
import { UI_PALETTE } from '../data/uiPalette';
import { UI_KEY, addPixelTexture } from '../render/atlas';
import { HILL_LAYERS, MENU_SKY_H, menuPixelScale, paintHills, paintSky } from '../render/uiArt';
import { ContentBox } from '../ui/ContentBox';
import {
  addUiText,
  createButton,
  createPanel,
  FONT_TITLE,
  frameBorder,
  textStyle,
  type Button,
  type UiBox,
} from '../ui/theme';
import { SCENES, type WorldSceneData } from './keys';

const randomSeed = (): number => Math.floor(Math.random() * 1_000_000);

const SKY_KEY = 'menu-sky';
const hillKey = (layer: number): string => `menu-hills-${layer}`;
/** Drift speed of each hill layer, far → near (screen px per second). */
const PARALLAX = [4, 8, 16] as const;
const FIREFLIES = 24;
const BUTTON = { w: 200, h: 52 } as const;

export class MainMenuScene extends Phaser.Scene {
  private seed = randomSeed();
  private pix = 2;
  private sky!: Phaser.GameObjects.TileSprite;
  private hills: Phaser.GameObjects.TileSprite[] = [];
  private fireflies: Phaser.GameObjects.Image[] = [];
  private logo!: UiBox;
  private title!: Phaser.GameObjects.Text;
  private subtitle!: Phaser.GameObjects.Text;
  private seedBox!: ContentBox;
  private footer!: Phaser.GameObjects.Text;
  private startButton!: Button;
  private rerollButton!: Button;

  constructor() {
    super(SCENES.mainMenu);
  }

  create(): void {
    this.seed = randomSeed();
    this.hills = [];
    this.fireflies = [];
    this.pix = menuPixelScale(this.scale.height);
    this.cameras.main.setBackgroundColor(toCss(UI_PALETTE.sky[3]));

    // Dithered dusk sky, three drifting hill silhouettes, fireflies.
    addPixelTexture(this.textures, SKY_KEY, paintSky());
    HILL_LAYERS.forEach((_, i) => addPixelTexture(this.textures, hillKey(i), paintHills(i)));
    this.sky = this.add.tileSprite(0, 0, 4, MENU_SKY_H, SKY_KEY).setOrigin(0, 0);
    this.hills = HILL_LAYERS.map((layer, i) =>
      this.add.tileSprite(0, 0, 4, layer.height, hillKey(i)).setOrigin(0, 1),
    );
    this.createFireflies();

    // Logo board.
    this.logo = createPanel(this, 'panel', 200, 100, 0.5, 0.5);
    this.title = this.add
      .text(0, 0, 'Ashen Hollow', {
        ...textStyle(48, UI_PALETTE.text, FONT_TITLE),
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setShadow(2, 2, toCss(UI_PALETTE.textShadow), 0, false, true);
    this.subtitle = addUiText(this, 0, 0, 'Thung lũng bị nguyền · Dark Fantasy Colony Builder', 14)
      .setOrigin(0.5, 0)
      .setAlign('center');

    this.startButton = createButton(this, 0, 0, 'Chơi mới', {
      width: BUTTON.w,
      height: BUTTON.h,
      fontSize: 18,
      onClick: () => this.startGame(),
    });
    this.rerollButton = createButton(this, 0, 0, 'Đổi seed', {
      width: BUTTON.w,
      height: BUTTON.h,
      fontSize: 16,
      onClick: () => {
        this.seed = randomSeed();
        this.refreshSeed();
        this.layout();
      },
    });
    this.seedBox = new ContentBox(this, 'tooltip', 260, { fontSize: 14 });
    this.footer = this.add
      .text(0, 0, `Phase 0 prototype · v${__APP_VERSION__}`, textStyle(11, UI_PALETTE.creamLight))
      .setOrigin(0.5);

    this.refreshSeed();
    this.layout();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this);
    });

    this.input.keyboard?.once('keydown-ENTER', () => this.startGame());
  }

  update(_time: number, delta: number): void {
    this.hills.forEach((hill, i) => {
      hill.tilePositionX += ((PARALLAX[i] ?? 0) * delta) / 1000 / this.pix;
    });
  }

  private refreshSeed(): void {
    this.seedBox.setContent({ lines: [[{ text: `Seed: ${this.seed}` }]] });
  }

  private layout(): void {
    const { width, height } = this.scale;
    const cx = width / 2;

    this.pix = menuPixelScale(height);
    const texW = Math.ceil(width / this.pix) + 1;
    this.sky.setSize(texW, MENU_SKY_H).setScale(this.pix);
    this.hills.forEach((hill, i) =>
      hill
        .setSize(texW, HILL_LAYERS[i]!.height)
        .setScale(this.pix)
        .setPosition(0, height),
    );
    for (const fly of this.fireflies) fly.setScale(this.pix);

    // Logo board on the upper third (title size: same clamp as before).
    const inset = frameBorder(this, 'panel') + 16;
    const titleSize = Phaser.Math.Clamp(Math.floor(width / 14), 28, 64);
    this.title.setFontSize(titleSize);
    this.subtitle.setWordWrapWidth(Math.min(520, width - 32 - inset * 2));
    const logoW = Math.min(width - 16, Math.max(this.title.width, this.subtitle.width) + inset * 2);
    const logoH = inset * 2 + this.title.height + 4 + this.subtitle.height;
    const logoY = Math.max(logoH / 2 + 8, height / 3);
    this.logo.resize(logoW, logoH);
    this.logo.image.setPosition(cx, logoY);
    const logoTop = logoY - logoH / 2;
    this.title.setPosition(cx, logoTop + inset + this.title.height / 2);
    this.subtitle.setPosition(cx, logoTop + inset + this.title.height + 4);

    // Buttons stacked in the middle, then the seed tag.
    const buttonsTop = Math.max(logoTop + logoH + 24, height * 0.5);
    this.startButton.container.setPosition(cx, buttonsTop + BUTTON.h / 2);
    this.rerollButton.container.setPosition(cx, buttonsTop + BUTTON.h * 1.5 + 12);
    this.seedBox.refresh();
    this.seedBox.setPosition(cx - this.seedBox.width / 2, buttonsTop + BUTTON.h * 2 + 24);
    this.footer.setPosition(cx, height - 14);
  }

  /** Fireflies drift over the hills; one that wanders off screen comes back elsewhere. */
  private createFireflies(): void {
    for (let i = 0; i < FIREFLIES; i++) {
      const fly = this.add.image(0, 0, UI_KEY, 'firefly').setScale(this.pix);
      this.fireflies.push(fly);
      this.tweens.add({
        targets: fly,
        alpha: { from: 0.15, to: 1 },
        duration: Phaser.Math.Between(500, 1500),
        delay: Phaser.Math.Between(0, 1500),
        yoyo: true,
        repeat: -1,
      });
      this.respawn(fly);
      this.wander(fly);
    }
  }

  private respawn(fly: Phaser.GameObjects.Image): void {
    const { width, height } = this.scale;
    fly.setPosition(
      Phaser.Math.Between(0, width),
      Phaser.Math.Between(Math.floor(height * 0.3), height),
    );
  }

  private wander(fly: Phaser.GameObjects.Image): void {
    const { width, height } = this.scale;
    if (fly.x < -8 || fly.x > width + 8 || fly.y < -8 || fly.y > height + 8) this.respawn(fly);
    this.tweens.add({
      targets: fly,
      x: fly.x + Phaser.Math.Between(-60, 60),
      y: fly.y + Phaser.Math.Between(-40, 30),
      duration: Phaser.Math.Between(2000, 4000),
      ease: 'Sine.easeInOut',
      onComplete: () => this.wander(fly),
    });
  }

  private startGame(): void {
    const data: WorldSceneData = { seed: this.seed };
    this.scene.start(SCENES.world, data);
  }
}
```

- [ ] **Step 6: Lint, typecheck, test, build**

Run: `npm run lint < /dev/null && npm run typecheck < /dev/null && npm test < /dev/null && npm run build < /dev/null`
Expected: tất cả exit 0.

- [ ] **Step 7: Kiểm tra nhanh**

Run: `npm run dev` (nền), mở `http://localhost:5173`.
Expected: trời hoàng hôn 4 dải có dither ở chỗ nối, 3 lớp đồi trôi ngang với tốc độ khác nhau (gần nhanh nhất), bảng gỗ "Ashen Hollow" ở 1/3 trên, nút "Chơi mới"/"Đổi seed" 200×52, hộp "Seed: N" đổi khi bấm "Đổi seed", 24 đom đóm nhấp nháy; Enter vào game; console không lỗi.

- [ ] **Step 8: Commit**

```bash
git add src/render/uiArt.ts src/render/uiArt.test.ts src/scenes/MainMenuScene.ts
git commit -m "$(cat <<'EOF'
feat(menu): dusk sky, parallax hills, wooden logo board and fireflies

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: Tài liệu và kiểm tra toàn bộ

**Files:**
- Modify: `docs/ART_STYLE.md` (mục "Bảng màu", thêm mục "Giao diện (UI)")
- Modify: `CLAUDE.md` (mục "Architecture rules")
- Modify: `README.md` (bảng "Điều khiển")

**Interfaces:**
- Consumes: toàn bộ Task 1–9.
- Produces: tài liệu khớp code; bằng chứng kiểm tra (lệnh + trình duyệt).

- [ ] **Step 1: Cập nhật `docs/ART_STYLE.md`**

Thay dòng

```markdown
Định nghĩa duy nhất tại `src/data/palette.ts`. **Không dùng màu ngoài bảng.** Xuất palette `.gpl` cho Aseprite từ file này.
```

bằng

```markdown
Định nghĩa duy nhất tại `src/data/palette.ts`. **Mọi pixel của thế giới lấy từ bảng này, không dùng màu ngoài bảng.** Ngoại lệ duy nhất là giao diện, có bảng màu riêng (xem mục _Giao diện (UI)_). Xuất palette `.gpl` cho Aseprite từ file này.
```

Thêm ngay trước dòng `## Quy tắc vẽ`:

```markdown
## Giao diện (UI)

**Luật:** pixel UI lấy từ `UI_PALETTE` (`src/data/uiPalette.ts`), pixel thế giới lấy từ `PALETTE`. UI cố ý ấm và sáng (khung gỗ nâu, lõi giấy kem, chữ nâu đậm có bóng) để nổi trên thế giới u tối, giống Stardew Valley. Nếu sau playtest thấy chướng, chỉ đổi `UI_PALETTE`.

- Art UI sinh bằng code trong `src/render/uiArt.ts` (có test: kích thước, góc bo, chỉ màu UI), đóng gói thành texture `ui` trong `PreloadScene`.
- Mọi khung là **9-slice**, vẽ bằng `createPanel` (`src/ui/theme.ts`) theo kích thước logic. Viền scale nguyên lần: `uiScale = 2` khi cạnh ngắn màn hình ≥ 600 px, ngược lại `1`.
- Chữ trên nền kem: `FONT_UI`, màu `text`, bóng `textShadow` lệch (+1, +1). Vàng `gold` không dùng cho chữ trên nền kem (không đủ tương phản).
- Icon tài nguyên/công cụ/công trình dùng lại frame của texture `sprites`.

| Frame | Ô nguồn | Góc (slice) | Viền (border) | Dùng cho |
| --- | --- | --- | --- | --- |
| `panel` | 24×24 | 8 | 6 | Hộp đồng hồ, tài nguyên, hotbar, panel thực thể, bảng logo |
| `button` / `buttonHover` / `buttonDown` / `buttonActive` | 16×16 | 5 | 4 | Nút, thẻ colonist; hover lõi sáng, bấm lõm, đang bật viền vàng |
| `slot` / `slotHover` / `slotSelected` | 18×18 | 4 | 2 / 2 / 3 | Ô hotbar; đang chọn viền đỏ `select` 2 px |
| `tooltip` | 12×12 | 4 | 2 | Tooltip, toast, gợi ý trạng thái, dòng seed |
| `bar` | 8×6 | 2 | 1 | Khung thanh Đói/Ngủ |
| `clockDial` (không giãn) | 28×28 | — | — | Mặt đồng hồ; chấm mặt trời di chuyển dọc cung (không xoay) |
| `firefly` (không giãn) | 3×3 | — | — | Đom đóm menu, chấm mặt trời trên đồng hồ |

**Thay bằng art vẽ tay:** xuất atlas Aseprite với **cùng tên frame**, nạp dưới key `ui` thay cho `buildUiTexture`, rồi sửa `UI_FRAMES` (kích thước, slice, border). HUD chỉ gọi frame theo tên nên không phải sửa.

**Menu chính:** trời 4 dải `UI_PALETTE.sky` nối bằng dither 2×2, 3 lớp đồi/cây silhouette (`woodDark` → `text` → `outline`, xa → gần) trôi parallax 4/8/16 px/s, cỡ pixel nguyên `menuPixelScale`.
```

- [ ] **Step 2: Cập nhật `CLAUDE.md`**

Thay dòng

```markdown
- **Pixel art:** colours only from `PALETTE` (`src/data/palette.ts`); integer camera zoom only (`ZOOM_LEVELS`); sprites anchored at their feet and depth-sorted by that y; never rotate sprites.
```

bằng

```markdown
- **Pixel art:** world colours only from `PALETTE` (`src/data/palette.ts`); UI colours (frames, menu backdrop) only from `UI_PALETTE` (`src/data/uiPalette.ts`) — see docs/ART_STYLE.md; integer camera zoom only (`ZOOM_LEVELS`); sprites anchored at their feet and depth-sorted by that y; never rotate sprites.
- **HUD:** `HudScene` only wires the bus/world to parts in `src/ui/hud/*` (`ClockBox`, `ResourceBox`, `Hotbar`, `ColonistPanel`, `ToastStack`) plus the shared `Tooltip`; parts take plain data, have `layout()`/`destroy()` and never read `GameWorld`. Pure HUD maths lives in `src/ui/hud/layout.ts` (tested). UI frames are nine-slices from the `ui` texture referenced by name (`UI_FRAMES`); size them in logical px with `createPanel`, never with raw `Rectangle` backgrounds. Every HUD surface is interactive so clicks on it don't reach the map (Phaser `globalTopOnly`); the tooltip is not.
```

- [ ] **Step 3: Cập nhật `README.md`**

Trong bảng "Điều khiển", thay dòng Tường:

```markdown
| Tường                                                 | `F`, nhấn rồi kéo một đường                                          | Tab **Xây** → Tường: chạm đầu, chạm cuối, **Đặt**      |
```

bằng

```markdown
| Tường                                                 | `F`, nhấn rồi kéo một đường                                          | Tab **Lệnh** → Tường: chạm đầu, chạm cuối, **Đặt**     |
```

và thêm ngay sau dòng "Xem / chọn vật thể":

```markdown
| Xem tên / giá / cách dùng của nút                     | Rê chuột lên nút; đứng yên trên bản đồ để xem thông tin             | Bấm giữ nút (nhả tay không kích hoạt)                  |
```

Sau đó chạy `npx prettier --write README.md docs/ART_STYLE.md CLAUDE.md < /dev/null` để căn lại bảng.

- [ ] **Step 4: Kiểm tra toàn bộ bằng lệnh**

Run: `npm run lint < /dev/null && npm run typecheck < /dev/null && npm test < /dev/null && npm run build < /dev/null`
Expected: cả bốn exit 0; Vitest báo pass cả `uiArt.test.ts`, `layout.test.ts`, `data.test.ts` và các test cũ.

Run: `grep -rn "rectangle(" src/ui src/scenes/HudScene.ts src/scenes/MainMenuScene.ts`
Expected: chỉ còn vạch chia hotbar (`Hotbar.ts`) và phần tô thanh nhu cầu (`ColonistPanel.ts`), cả hai màu `UI_PALETTE`; không còn `Rectangle` nào làm nền UI.

- [ ] **Step 5: Kiểm tra trong trình duyệt — desktop 1280×720**

Chạy `npm run dev` (hoặc preview tool với cấu hình chạy `npm run dev`, cổng 5173), mở `http://localhost:5173` ở viewport 1280×720.

1. Chụp màn hình menu chính: bảng logo, hai nút, hộp seed, đồi trôi, đom đóm; không chữ nào đè nhau.
2. "Chơi mới". Chụp màn hình HUD: đồng hồ + 4 nút tốc độ + tài nguyên phải trên, 3 thẻ trái trên, hotbar dưới giữa, zoom phải dưới; không phần nào tràn khỏi màn hình.
3. Kịch bản Phase 1: Q → kéo khung quanh vài cây chết (ô Chặt viền đỏ, hộp gợi ý "Kéo khung quanh cây chết để chặt." trên hotbar); chờ colonist chặt, số Gỗ nảy khi tăng; X → đặt Kho (tab tự sang Xây, ô Kho viền đỏ, nút Bám lưới hiện, "Đã đặt Kho." màu xanh); khi xây xong hiện toast "Đã xây xong Kho."; F → vẽ một đoạn tường (tab sang Lệnh, ô Tường được chọn); Space/❚❚ tạm dừng (nút ❚❚ viền vàng), 1/2/3 đổi tốc độ; +/− zoom; bấm một thẻ colonist → camera theo, panel thông tin hiện trái dưới; rê chuột lên ô Tháp Canh → tooltip có giá (màu đỏ nếu thiếu đá) và mô tả; đứng yên trên bản đồ 300 ms → tooltip địa hình; Esc về menu rồi vào lại ván mới, HUD sạch.
4. Đo vùng chạm bằng console (`window.game` có ở dev):

```js
(() => {
  const s = game.scene.getScene('Hud');
  const out = [];
  const walk = (o) => {
    if (o.list) o.list.forEach(walk);
    const shown = o.visible && (!o.parentContainer || o.parentContainer.visible);
    if (o.input && o.input.enabled && shown) {
      const b = o.getBounds();
      if (b.width < 44 || b.height < 44) out.push([o.frame && o.frame.name, Math.round(b.width), Math.round(b.height)]);
    }
  };
  s.children.list.forEach(walk);
  return out;
})()
```

Expected: chỉ còn các mục frame `tooltip` (toast cao 32 px, hộp gợi ý) — là bề mặt chặn click, không phải nút; mọi nút/ô/thẻ ≥ 44×44.
5. Console trình duyệt không có lỗi.

- [ ] **Step 6: Kiểm tra trong trình duyệt — mobile 375×812**

Đổi viewport sang 375×812 (giả lập cảm ứng), tải lại trang.

1. Chụp màn hình menu và HUD: thẻ colonist và cột phải vừa cạnh nhau (thẻ kết thúc ở x ≤ 178, cột phải bắt đầu ở x = 183); hotbar 48 px vừa trong màn hình; zoom nằm trên hotbar; toast nằm ngay trên hotbar.
2. Bấm giữ ô Kho 400 ms → tooltip hiện phía trên ô; nhả tay → tooltip tắt và **không** vào chế độ xây.
3. Chạm ô Kho → chạm bản đồ → hàng "Bám lưới / ✓ Đặt / ✕ Huỷ" hiện ngay trên hotbar, hộp gợi ý trên hàng đó, không đè cột zoom; ✓ Đặt đặt công trình, ✕ Huỷ thoát.
4. Chạm thẻ colonist → camera theo; panel thông tin hiện trên vùng toast.
5. Chạy lại đoạn đo vùng chạm ở Step 5.4: kết quả như desktop.
6. Thu viewport còn 320×640: thẻ thu gọn (chỉ tên + thanh) và nằm dưới cột phải; hotbar vẫn vừa (ô 44 px). Ở 280×640 kéo ngang trong hotbar để cuộn, ô không bị kích hoạt khi kéo.
7. Console không lỗi.

- [ ] **Step 7: Commit**

```bash
git add docs/ART_STYLE.md CLAUDE.md README.md
git commit -m "$(cat <<'EOF'
docs: UI_PALETTE rule, UI frame table and Stardew HUD architecture

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```
