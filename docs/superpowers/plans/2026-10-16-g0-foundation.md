# G0 — Nền UI & dọn dẹp Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Xoá toàn bộ colony sim, chuyển hạ tầng dùng lại sang `src/core` (và separation sang `src/game/battle/steering.ts`), gỡ `bitecs`, rồi dựng nền UI kiểu Stardew (`UI_PALETTE`, art UI sinh bằng code, `layout.ts`, texture `ui`, `theme.ts`, `ContentBox`, `Tooltip`), menu chính "Chín Vương Miện", bảng màu thế giới Hearth 32, luật ESLint deterministic và tài liệu mới — app vẫn boot vào menu, "Ván mới" bị vô hiệu ("Sắp có").

**Architecture:** Thứ tự: dọn trước (Task 1–2: xoá colony sim, chuyển hạ tầng, ESLint §12.4) để mọi task sau xây trên cây sạch và được ESLint mới kiểm; sau đó dựng UI từ dưới lên: dữ liệu + art thuần TS có test (`uiPalette.ts`, `uiArt.ts`, `layout.ts`) → texture + theme Phaser (`atlas.ts`, `theme.ts`) → widget dùng chung (`ContentBox`, `Tooltip`) → menu (`menuLayout.ts` thuần có test + `MainMenuScene`) → bảng màu Hearth 32 → tài liệu → kiểm tra trình duyệt. Phần thuần (art, bố cục, separation, bảng màu) nằm ngoài Phaser và có Vitest; phần Phaser kiểm bằng lint/typecheck/build và trình duyệt.

**Tech Stack:** TypeScript 6 (strict, `noUncheckedIndexedAccess`) · Phaser 4.2.1 · Vite 8 · Vitest 5 · ESLint 10 + typescript-eslint 8 (flat config).

**Spec:** `docs/superpowers/specs/2026-10-16-nine-crowns-design.md` — plan này chỉ làm **G0** (§14 "G0 — Nền UI & dọn dẹp", mục 1–8 và "Done khi"), dựa trên §2, §10.1, §10.2, §11 (đặc biệt §11.1), §12 (§12.2, §12.3, §12.4). Code UI dùng lại từ `docs/superpowers/plans/2026-10-15-stardew-ui.md` (Task 1, 2 rút gọn, 3, 4, 9) đã được chép đầy đủ vào plan này — implementer **không cần** đọc plan cũ.

**Repo:** `D:\WorkSpace\ashen-hollow`, nhánh `g0-foundation` (đã chứa `ui-stardew`). Trong Git Bash trên Windows, chạy mọi lệnh npm/npx kèm `< /dev/null` (nếu không có thể treo). Nếu trình duyệt vẫn hiện code cũ thì khởi động lại `npm run dev`.

## Global Constraints

- G0 chỉ làm §14 G0 mục 1–8; không thêm tính năng của G1+ (không `RunState`, không `RealmScene`, không thẻ, không lưu).
- Xoá đúng danh sách §12.3; thư mục `src/sim/` biến mất; gỡ dependency `bitecs`.
- Chuyển theo §12.2: `src/sim/random.ts` → `src/core/random.ts` (không đổi nội dung); `SimClock` (+test), `SpatialHash` (+test), `noise.ts` → `src/core/`; `geom.ts` → `src/core/geom.ts` chỉ giữ `Vec2`, `Bounds`, `distance`, `distanceSq`, `vec`, thay `Math.hypot` bằng `Math.sqrt`; `src/core/events.ts` giữ `EventBus`; separation → `src/game/battle/steering.ts` (§8.11).
- `src/game`, `src/data`, `src/core` không import `phaser` hay `**/scenes/**`, `**/render/**`, `**/ui/**`, `**/platform/**`, `**/audio/**`; `src/data` cũng không import `**/game/**` (§12.4). Test file chịu cùng luật.
- Trong `src/game`, `src/data`, `src/core`: cấm `Math.random`, `Math.hypot`, `Math.sin`, `Math.cos`, `Math.tan`, `Math.atan2`, `Math.exp`, `Math.log`, `Math.pow`, `Date.now`, `performance.now`; chỉ dùng `+ − × ÷` và `Math.sqrt/floor/ceil/round/min/max/abs` (§8.12).
- `PALETTE` = Hearth 32 (§11.1), giữ tên export `PALETTE`, `PaletteColor`, `toCss`; đúng 32 màu khác nhau. Phông nền game (`main.ts`) = `PALETTE.outline`.
- Pixel thế giới chỉ từ `PALETTE`; pixel UI (khung, nút, lớp phủ, nền menu) chỉ từ `UI_PALETTE`; giá trị `UI_PALETTE` chép nguyên văn (UI spec §3).
- Giữ `FONT_UI`; chữ trên nền kem màu `UI_PALETTE.text`, bóng `textShadow` (+1, +1).
- `MARGIN = 10`; `uiScale = 2` khi `min(width, height) ≥ 600`, ngược lại `1`; mọi vùng chạm ≥ 44×44 px logic; bố cục tính lại trong `layout()` khi resize; "Desktop" = 1280×720, "mobile" = 375×812.
- Tooltip bấm giữ 400 ms trên cảm ứng; texture `ui` chỉ tạo một lần (`textures.exists`).
- Menu (§10.2): logo "Chín Vương Miện", phụ đề "Một vương quốc nhỏ, chín ngai vàng"; nút 200×52 xếp dọc; bỏ nút "Đổi seed" và dòng seed; nút của tính năng chưa có thì ẩn; G0: chỉ có "Ván mới" bị vô hiệu ("Sắp có").
- Nhãn màn tải: "Đang dựng vương quốc…".
- Chữ cho người chơi bằng tiếng Việt; id/tên trong code bằng tiếng Anh.
- Phaser scene được dùng lại khi restart: đặt lại trường per-game ở đầu `create()`.
- Cuối **mọi** task: `npm run lint < /dev/null && npm run typecheck < /dev/null && npm test < /dev/null && npm run build < /dev/null` đều exit 0. Commit bằng `git add` từng đường dẫn cụ thể (không `git add -A`/`.`); message kết thúc bằng một dòng trống rồi `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Không sửa `docs/superpowers/specs/*` và các plan cũ trong `docs/superpowers/plans/`.

## Review Focus

1. **Điện thoại xoay ngang / màn nhỏ (812×375, 320×480):** logo, nút và dòng phiên bản không đè nhau và không tràn màn hình; khi sau này có nhiều nút hơn, chồng nút dịch lên chứ không đè footer → test trong Task 7 ("fits a landscape phone (812×375) and a small 320×480 screen", "moves a tall stack up instead of running into the footer").
2. **Kéo cửa sổ qua ngưỡng 600 px khi menu đang mở (`uiScale` 1 ↔ 2):** viền đổi đúng 1×/2× ở đúng ngưỡng, bố cục tính lại, không đè → test trong Task 4 ("switches exactly at 600 px on either side") + bước kiểm resize ở Task 10.
3. **Bấm, rê chuột, bấm giữ trên nút "Ván mới" đang vô hiệu (chuột và cảm ứng):** không chuyển scene, không đổi frame hover, không lỗi console, không tooltip kẹt → bước kiểm ở Task 10 (đo `input.enabled`, bấm thử, bấm giữ 600 ms).
4. **Lách luật deterministic** bằng `const { random } = Math`, `Math['hypot']`, `performance.now()` trong `src/core`, hay `src/data` import luật từ `src/game` → file tạm ở Task 2 phải bị ESLint báo đủ từng dòng.
5. **Đơn vị trùng tâm nhau, đơn vị đứng ngay tâm công trình, đơn vị bay trên công trình** (separation): không chia cho 0, không NaN, tách theo trục (1, 0), công trình không bao giờ bị đẩy, đơn vị bay không bị công trình đẩy → test trong Task 1 ("splits units on exactly the same spot along (1, 0)", "pushes a unit standing on a structure centre out along (1, 0)", "lets flying units pass over structures").

---

## File Structure

| File | Trách nhiệm |
|---|---|
| `src/game/battle/steering.ts` (mới) | `separationPush`: separation §8.11 thuần, deterministic, nhận mảng SoA |
| `src/game/battle/steering.test.ts` (mới) | Test separation (đẩy, cap, trùng tâm, snapshot, công trình, đơn vị bay) |
| `src/core/random.ts`, `SimClock.ts` (+test), `SpatialHash.ts` (+test), `noise.ts` (chuyển) | Hạ tầng thuần dùng lại (chỉ đổi đường dẫn; `SpatialHash` đổi import `./geom`) |
| `src/core/geom.ts` (chuyển + rút gọn), `src/core/geom.test.ts` (viết lại) | `Vec2`, `Bounds`, `vec`, `distance` (`Math.sqrt`), `distanceSq` |
| `src/core/events.ts` (viết lại) | `EventBus` giữ nguyên; `GameEvents` chỉ còn sự kiện không phụ thuộc kiểu đã xoá |
| `src/render/dualGrid.test.ts` (viết lại) | Cùng 4 test, dùng lưới ASCII tự chứa thay cho `data/terrain` + `terrainFixture` đã xoá |
| `src/scenes/keys.ts`, `src/main.ts` (sửa) | Chỉ còn Boot → Preload → MainMenu |
| `eslint.config.js` (viết lại khối luật) | §12.4: cấm import + cấm hàm không deterministic |
| `src/data/uiPalette.ts` (mới) | `UI_PALETTE`, `UI_COLORS` |
| `src/render/uiArt.ts` (mới), `uiArt.test.ts` (mới) | Frame UI 9-slice, đom đóm, mặt đồng hồ; nền menu (trời dither, đồi) |
| `src/ui/hud/layout.ts` (mới), `layout.test.ts` (mới) | Hằng + logic UI thuần dùng chung (scale, toast, tooltip, hàng ô, cuộn) |
| `src/render/atlas.ts` (viết lại) | `toCanvas`, `packShelves`, `addPixelTexture`, `UI_KEY`, `buildUiTexture` |
| `src/scenes/PreloadScene.ts` (sửa) | Nhãn "Đang dựng vương quốc…", tạo texture `ui` |
| `src/ui/theme.ts` (viết lại) | `textStyle`, `addUiText`, `uiScale`, `frameBorder`, `createPanel`, `bindPress`, `createButton` (+ `setEnabled`), `TooltipHost` |
| `src/ui/ContentBox.ts`, `src/ui/Tooltip.ts` (mới) | Khung tự co giãn quanh `TooltipContent`; tooltip dùng chung |
| `src/ui/menuLayout.ts` (mới), `menuLayout.test.ts` (mới) | Bố cục menu thuần: logo, chồng nút, footer |
| `src/scenes/MainMenuScene.ts` (viết lại) | Menu §10.2 kiểu Stardew |
| `src/data/palette.ts` (viết lại), `palette.test.ts` (mới) | Hearth 32 + test 32 màu |
| `index.html` (sửa) | Nền/`theme-color` = `outline`, tiêu đề, mô tả, favicon vương miện |
| `docs/GDD.md`, `docs/ROADMAP.md`, `docs/ART_STYLE.md`, `CLAUDE.md`, `README.md`, `CREDITS.md`, `package.json` (viết lại/sửa) | Tài liệu khớp game mới |
| Xoá (§12.3) | `src/sim/**` còn lại, `src/data/{buildings,colonists,doodads,names,resources,terrain}.ts`, `src/data/data.test.ts`, `src/render/{ColonistRenderer,DebugOverlay,DesignationMarkers,EntityRenderer,PlacementPreview,TerrainRenderer,WallPreview}.ts`, `src/render/terrainArt.ts`, `src/platform/CameraController.ts`, `src/scenes/{WorldScene,HudScene}.ts` |

Giữ nguyên không sửa: `src/render/pixel.ts`, `src/render/bitmap.ts` (+test), `src/render/dualGrid.ts`, `src/scenes/BootScene.ts`, `src/core/events.test.ts`, `src/vite-env.d.ts`, `vite.config.ts`, `tsconfig.json`, `.github/workflows/ci.yml`.

---

### Task 1: Xoá colony sim, chuyển hạ tầng, gỡ `bitecs`

**Files:**
- Create: `src/game/battle/steering.ts`, `src/game/battle/steering.test.ts`
- Move: `src/sim/random.ts` → `src/core/random.ts`; `src/sim/SimClock.ts` → `src/core/SimClock.ts`; `src/sim/SimClock.test.ts` → `src/core/SimClock.test.ts`; `src/sim/spatial/SpatialHash.ts` → `src/core/SpatialHash.ts`; `src/sim/spatial/SpatialHash.test.ts` → `src/core/SpatialHash.test.ts`; `src/sim/geom.ts` → `src/core/geom.ts`; `src/sim/geom.test.ts` → `src/core/geom.test.ts`; `src/sim/noise.ts` → `src/core/noise.ts`
- Modify: `src/core/SpatialHash.ts:1` (import), `src/core/geom.ts` (viết lại), `src/core/geom.test.ts` (viết lại), `src/core/events.ts` (viết lại), `src/render/dualGrid.test.ts` (viết lại), `src/render/atlas.ts` (viết lại), `src/scenes/keys.ts`, `src/scenes/PreloadScene.ts`, `src/scenes/MainMenuScene.ts` (menu tạm), `src/main.ts`, `package.json`, `package-lock.json`
- Delete: mọi file §12.3 (liệt kê ở Step 6)

**Interfaces:**
- Consumes: không có gì từ task trước.
- Produces:
  - `src/game/battle/steering.ts`: `interface SeparationBodies { readonly count: number; readonly x, y, radius, fixed, flying: ArrayLike<number> }` (`fixed`/`flying` là 0/1), `separationPush(bodies: SeparationBodies, pushMax: number, outX: Float64Array, outY: Float64Array): void` (G1 gọi với `BATTLE.separationPushMax`).
  - `src/core/geom.ts`: `Vec2 { x; y }`, `Bounds { minX; minY; maxX; maxY }`, `vec(x, y): Vec2`, `distanceSq(a, b): number`, `distance(a, b): number`.
  - `src/core/random.ts`: `Rng` (`next`, `int`, `pick`, `getState`, `setState`), `hashSeed(text): number` — không đổi.
  - `src/core/SimClock.ts`: `SimClock`, `TICKS_PER_SECOND`, `TICK_MS`, `GAME_SPEEDS`, `type GameSpeed` — không đổi.
  - `src/core/SpatialHash.ts`: `SpatialHash` — không đổi API. `src/core/noise.ts`: `valueNoise2D`, `fractalNoise2D` — không đổi.
  - `src/core/events.ts`: `GameEvents { 'clock:speed'; log; 'ui:set-speed'; 'ui:toggle-pause' }`, `EventBus<Events>`, `createGameBus()`.
  - `src/render/atlas.ts`: `toCanvas(art: PixelCanvas): HTMLCanvasElement`, `packShelves(sprites, maxWidth = 256): { placed; height }` (đều export).
  - `src/scenes/keys.ts`: `SCENES = { boot: 'Boot', preload: 'Preload', mainMenu: 'MainMenu' }` (bỏ `world`, `hud`, `WorldSceneData`).

Ghi chú quyết định: separation được viết lại theo đúng §8.11 (cặp chồng nhau `d < rA + rB`, mỗi bên `min(overlap/2, pushMax)`, trùng tâm → trục (1, 0), công trình đẩy một chiều đơn vị không bay ra khỏi bán kính của nó) thay vì chép nguyên `movementSystem` (code cũ dùng bán kính/lực cố định, kiểm tra nav grid và áp tuần tự — các thứ này không còn trong game mới). Công trình đẩy **toàn bộ** phần chồng (không cap) để đơn vị không bao giờ đứng trong công trình. Hàm nhận mảng `ArrayLike<number>` để G1 truyền thẳng mảng typed của `BattleWorld`. `GameEvents` chỉ giữ các mục của §12.5 không cần kiểu chưa có (`RunState`, `BattleSetup`…); G1 thêm phần còn lại.

- [ ] **Step 1: Viết test thất bại cho separation**

Tạo `src/game/battle/steering.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { separationPush, type SeparationBodies } from './steering';

interface Body {
  x: number;
  y?: number;
  r: number;
  fixed?: boolean;
  flying?: boolean;
}

const bodies = (list: readonly Body[]): SeparationBodies => ({
  count: list.length,
  x: list.map((b) => b.x),
  y: list.map((b) => b.y ?? 0),
  radius: list.map((b) => b.r),
  fixed: list.map((b) => (b.fixed ? 1 : 0)),
  flying: list.map((b) => (b.flying ? 1 : 0)),
});

/** Run separation and return the pushes as [dx, dy] per body (−0 normalised to 0). */
const push = (list: readonly Body[], pushMax = 10): [number, number][] => {
  const outX = new Float64Array(list.length);
  const outY = new Float64Array(list.length);
  separationPush(bodies(list), pushMax, outX, outY);
  return list.map((_, i) => [outX[i]! + 0, outY[i]! + 0]);
};

describe('separationPush', () => {
  it('pushes two overlapping units apart by half the overlap each', () => {
    expect(
      push([
        { x: 0, r: 4 },
        { x: 6, r: 4 },
      ]),
    ).toEqual([
      [-1, 0],
      [1, 0],
    ]);
  });

  it('caps each push at pushMax', () => {
    expect(
      push(
        [
          { x: 0, r: 4 },
          { x: 2, r: 4 },
        ],
        1,
      ),
    ).toEqual([
      [-1, 0],
      [1, 0],
    ]);
  });

  it('leaves bodies that only touch alone', () => {
    expect(
      push([
        { x: 0, r: 4 },
        { x: 8, r: 4 },
      ]),
    ).toEqual([
      [0, 0],
      [0, 0],
    ]);
  });

  it('splits units on exactly the same spot along (1, 0)', () => {
    expect(
      push(
        [
          { x: 5, y: 5, r: 4 },
          { x: 5, y: 5, r: 4 },
        ],
        1,
      ),
    ).toEqual([
      [-1, 0],
      [1, 0],
    ]);
  });

  it('normalises the direction with a square root', () => {
    const [a, b] = push([
      { x: 0, y: 0, r: 4 },
      { x: 3, y: 4, r: 4 },
    ]);
    expect(a![0]).toBeCloseTo(-0.9);
    expect(a![1]).toBeCloseTo(-1.2);
    expect(b![0]).toBeCloseTo(0.9);
    expect(b![1]).toBeCloseTo(1.2);
  });

  it('computes every pair from the same snapshot (order of pairs does not leak)', () => {
    // Pairs (0,1) and (1,2) each overlap by 2; the middle unit is pushed both ways.
    expect(
      push([
        { x: 0, r: 4 },
        { x: 6, r: 4 },
        { x: 12, r: 4 },
      ]),
    ).toEqual([
      [-1, 0],
      [0, 0],
      [1, 0],
    ]);
  });

  it('gives mirrored pushes when the bodies are listed the other way round', () => {
    const forward = push([
      { x: 0, r: 4 },
      { x: 6, r: 4 },
    ]);
    const backward = push([
      { x: 6, r: 4 },
      { x: 0, r: 4 },
    ]);
    expect(backward).toEqual([forward[1], forward[0]]);
  });

  it('lets a structure push a ground unit fully out without moving itself', () => {
    expect(
      push(
        [
          { x: 0, r: 12, fixed: true },
          { x: 10, r: 4 },
        ],
        1,
      ),
    ).toEqual([
      [0, 0],
      [6, 0],
    ]);
    expect(
      push(
        [
          { x: 10, r: 4 },
          { x: 0, r: 12, fixed: true },
        ],
        1,
      ),
    ).toEqual([
      [6, 0],
      [0, 0],
    ]);
  });

  it('pushes a unit standing on a structure centre out along (1, 0)', () => {
    expect(
      push([
        { x: 0, r: 12, fixed: true },
        { x: 0, r: 4 },
      ]),
    ).toEqual([
      [0, 0],
      [16, 0],
    ]);
  });

  it('lets flying units pass over structures', () => {
    expect(
      push([
        { x: 0, r: 12, fixed: true },
        { x: 10, r: 4, flying: true },
      ]),
    ).toEqual([
      [0, 0],
      [0, 0],
    ]);
  });

  it('never pushes two structures', () => {
    expect(
      push([
        { x: 0, r: 12, fixed: true },
        { x: 5, r: 12, fixed: true },
      ]),
    ).toEqual([
      [0, 0],
      [0, 0],
    ]);
  });

  it('still separates flying units from each other', () => {
    expect(
      push([
        { x: 0, r: 4, flying: true },
        { x: 6, r: 4, flying: true },
      ]),
    ).toEqual([
      [-1, 0],
      [1, 0],
    ]);
  });

  it('clears stale values in the output arrays', () => {
    const outX = new Float64Array([9, 9]);
    const outY = new Float64Array([9, 9]);
    separationPush(
      bodies([
        { x: 0, r: 1 },
        { x: 50, r: 1 },
      ]),
      1,
      outX,
      outY,
    );
    expect([...outX, ...outY]).toEqual([0, 0, 0, 0]);
  });
});
```

- [ ] **Step 2: Chạy test để thấy thất bại**

Run: `npm test -- src/game/battle/steering.test.ts < /dev/null`
Expected: FAIL — `Failed to resolve import "./steering"`.

- [ ] **Step 3: Viết `steering.ts`**

Tạo `src/game/battle/steering.ts`:

```ts
/**
 * Separation (spec §8.11), carried over from the colony sim's movementSystem: bodies that
 * overlap (centre distance < rA + rB) are pushed apart.
 *
 * - Two units: each moves min(overlap / 2, pushMax) away from the other.
 * - A structure (`fixed`) never moves; it pushes a non-flying unit fully out of its radius.
 *   Flying units ignore structures. Two structures never push each other.
 * - Exactly coincident centres split along the fixed axis (1, 0), as the old code did.
 *
 * Deterministic: pushes are computed from the positions as given (a snapshot) and only
 * accumulated into `outX`/`outY`, so the caller applies them all at once (§8.9 step 5);
 * pairs are visited in index order; only + − × ÷, Math.sqrt and Math.min are used.
 * Arrays may be typed arrays (BattleWorld struct-of-arrays) or plain arrays.
 */
export interface SeparationBodies {
  readonly count: number;
  readonly x: ArrayLike<number>;
  readonly y: ArrayLike<number>;
  readonly radius: ArrayLike<number>;
  /** 1 = structure (tower, building, throne), 0 = unit. */
  readonly fixed: ArrayLike<number>;
  /** 1 = flying unit, 0 = ground unit. */
  readonly flying: ArrayLike<number>;
}

/** Below this centre distance two bodies count as coincident. */
const COINCIDENT = 1e-3;

/** Writes each body's separation push into outX/outY (indices 0..count-1, zeroed first). */
export const separationPush = (
  bodies: SeparationBodies,
  pushMax: number,
  outX: Float64Array,
  outY: Float64Array,
): void => {
  const { count, x, y, radius, fixed, flying } = bodies;
  outX.fill(0, 0, count);
  outY.fill(0, 0, count);
  for (let i = 0; i < count; i++) {
    for (let j = i + 1; j < count; j++) {
      const fixedI = fixed[i] === 1;
      const fixedJ = fixed[j] === 1;
      if (fixedI && fixedJ) continue;
      if ((fixedI && flying[j] === 1) || (fixedJ && flying[i] === 1)) continue;
      const minDist = radius[i]! + radius[j]!;
      let dx = x[j]! - x[i]!;
      let dy = y[j]! - y[i]!;
      let d = Math.sqrt(dx * dx + dy * dy);
      if (d >= minDist) continue;
      if (d < COINCIDENT) {
        dx = 1;
        dy = 0;
        d = 0;
      } else {
        dx /= d;
        dy /= d;
      }
      const overlap = minDist - d;
      if (fixedI) {
        outX[j] = outX[j]! + dx * overlap;
        outY[j] = outY[j]! + dy * overlap;
      } else if (fixedJ) {
        outX[i] = outX[i]! - dx * overlap;
        outY[i] = outY[i]! - dy * overlap;
      } else {
        const push = Math.min(overlap / 2, pushMax);
        outX[i] = outX[i]! - dx * push;
        outY[i] = outY[i]! - dy * push;
        outX[j] = outX[j]! + dx * push;
        outY[j] = outY[j]! + dy * push;
      }
    }
  }
};
```

- [ ] **Step 4: Chạy test để thấy pass**

Run: `npm test -- src/game/battle/steering.test.ts < /dev/null`
Expected: PASS (13 tests).

- [ ] **Step 5: Chuyển hạ tầng sang `src/core`**

```bash
git mv src/sim/random.ts src/core/random.ts
git mv src/sim/SimClock.ts src/core/SimClock.ts
git mv src/sim/SimClock.test.ts src/core/SimClock.test.ts
git mv src/sim/spatial/SpatialHash.ts src/core/SpatialHash.ts
git mv src/sim/spatial/SpatialHash.test.ts src/core/SpatialHash.test.ts
git mv src/sim/geom.ts src/core/geom.ts
git mv src/sim/geom.test.ts src/core/geom.test.ts
git mv src/sim/noise.ts src/core/noise.ts
```

Trong `src/core/SpatialHash.ts`, đổi dòng 1:

```ts
import type { Bounds } from '../geom';
```

thành

```ts
import type { Bounds } from './geom';
```

Thay toàn bộ `src/core/geom.ts` (bỏ `Shape` và các hàm chồng lấn — sau khi xoá colony sim không còn ai dùng; `Math.hypot` → `Math.sqrt`, `** 2` → nhân):

```ts
/**
 * Continuous 2D geometry in world pixels. Only + − × ÷ and Math.sqrt, so results are
 * bit-identical on every JS engine (spec §8.12).
 */
export interface Vec2 {
  x: number;
  y: number;
}

/** Axis-aligned bounds, inclusive min / exclusive max. */
export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export const vec = (x: number, y: number): Vec2 => ({ x, y });

export const distanceSq = (a: Vec2, b: Vec2): number => {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
};

export const distance = (a: Vec2, b: Vec2): number => Math.sqrt(distanceSq(a, b));
```

Thay toàn bộ `src/core/geom.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { distance, distanceSq, vec } from './geom';

describe('geom', () => {
  it('builds vectors', () => {
    expect(vec(3, -4)).toEqual({ x: 3, y: -4 });
  });

  it('measures squared and plain distance', () => {
    expect(distanceSq(vec(0, 0), vec(3, 4))).toBe(25);
    expect(distance(vec(0, 0), vec(3, 4))).toBe(5);
    expect(distance(vec(-1, -1), vec(-1, -1))).toBe(0);
  });

  it('is symmetric', () => {
    expect(distance(vec(2, 7), vec(-5, 1))).toBe(distance(vec(-5, 1), vec(2, 7)));
  });
});
```

- [ ] **Step 6: Xoá colony sim (§12.3) và gỡ `bitecs`**

```bash
git rm -r -q src/sim
git rm -q src/data/buildings.ts src/data/colonists.ts src/data/doodads.ts src/data/names.ts \
  src/data/resources.ts src/data/terrain.ts src/data/data.test.ts
git rm -q src/render/ColonistRenderer.ts src/render/DebugOverlay.ts src/render/DesignationMarkers.ts \
  src/render/EntityRenderer.ts src/render/PlacementPreview.ts src/render/TerrainRenderer.ts \
  src/render/WallPreview.ts src/render/terrainArt.ts
git rm -q src/platform/CameraController.ts src/scenes/WorldScene.ts src/scenes/HudScene.ts
npm uninstall bitecs < /dev/null
```

Expected: `ls src/sim` báo "No such file or directory"; `package.json` không còn khối `"bitecs"` trong `dependencies` (chỉ còn `"phaser": "^4.2.1"`).

- [ ] **Step 7: Viết lại `src/core/events.ts`**

Thay toàn bộ file:

```ts
import type { GameSpeed } from './SimClock';

/**
 * Typed event bus between game logic and the UI layers. Kept engine-free so it can be
 * unit-tested. G0 only keeps the events that do not depend on run/battle types; the rest
 * of spec §12.5 (`run:*`, `battle:*`, `ui:command`, …) is added with those types in G1.
 */
export interface GameEvents {
  'clock:speed': { speed: GameSpeed };
  /** A line for the toast stack. */
  log: { text: string };
  'ui:set-speed': { speed: GameSpeed };
  'ui:toggle-pause': Record<string, never>;
}

type Handler<T> = (payload: T) => void;

export class EventBus<Events extends object> {
  private handlers = new Map<keyof Events, Set<Handler<never>>>();

  on<K extends keyof Events>(event: K, handler: Handler<Events[K]>): () => void {
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set();
      this.handlers.set(event, set);
    }
    set.add(handler as Handler<never>);
    return () => this.off(event, handler);
  }

  off<K extends keyof Events>(event: K, handler: Handler<Events[K]>): void {
    this.handlers.get(event)?.delete(handler as Handler<never>);
  }

  emit<K extends keyof Events>(event: K, payload: Events[K]): void {
    const set = this.handlers.get(event);
    if (!set) return;
    for (const handler of [...set]) (handler as Handler<Events[K]>)(payload);
  }

  clear(): void {
    this.handlers.clear();
  }
}

/** One bus per running game session; recreated when a new run starts. */
export const createGameBus = (): EventBus<GameEvents> => new EventBus<GameEvents>();
```

(`src/core/events.test.ts` giữ nguyên — nó chỉ test `EventBus`.)

- [ ] **Step 8: Viết lại `src/render/dualGrid.test.ts`**

Test cũ import `src/data/terrain.ts` và `src/sim/testing/terrainFixture.ts` (đã xoá). Thay toàn bộ file bằng bản tự chứa, cùng 4 test, cùng thứ tự ưu tiên (nước < cỏ < vách đá):

```ts
import { describe, expect, it } from 'vitest';
import { computeDualGrid, type TerrainSource } from './dualGrid';

/** Test terrains, lowest priority first (index = priority). */
const W = 0; // water
const G = 1; // grass
const C = 2; // cliff
const LEGEND: Record<string, number> = { '~': W, '.': G, '#': C };
const priorityOf = (t: number): number => t;

/** One char per data cell; reads outside the grid clamp to the nearest cell. */
const gridFromAscii = (rows: readonly string[]): TerrainSource => {
  const height = rows.length;
  const width = rows[0]?.length ?? 0;
  const cells = rows.map((row) =>
    [...row].map((ch) => {
      const t = LEGEND[ch];
      if (t === undefined) throw new Error(`Unknown terrain char '${ch}'`);
      return t;
    }),
  );
  return {
    width,
    height,
    getClamped: (cx, cy) =>
      cells[Math.max(0, Math.min(height - 1, cy))]![Math.max(0, Math.min(width - 1, cx))]!,
  };
};

/** Mask at display tile (x, y) for terrain t, or -1. */
const maskAt = (dg: ReturnType<typeof computeDualGrid>, t: number, x: number, y: number) =>
  dg.layers.get(t)?.[y * dg.width + x] ?? -1;

describe('computeDualGrid', () => {
  it('has one more display tile than data cells on each axis', () => {
    const dg = computeDualGrid(gridFromAscii(['..', '..']), priorityOf);
    expect([dg.width, dg.height]).toEqual([3, 3]);
  });

  it('a uniform area is a full tile (mask 15) of that terrain only', () => {
    const dg = computeDualGrid(gridFromAscii(['..', '..']), priorityOf);
    for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) expect(maskAt(dg, G, x, y)).toBe(15);
    expect([...dg.layers.keys()]).toEqual([G]);
  });

  it('a boundary draws the lower terrain full and the higher one on its corners', () => {
    // Cells: water | grass.  Display tile (1,0) corners: TL=water TR=grass BL=water BR=grass.
    const dg = computeDualGrid(gridFromAscii(['~.']), priorityOf);
    expect(maskAt(dg, W, 1, 0)).toBe(15);
    expect(maskAt(dg, G, 1, 0)).toBe(2 | 8);
    // Edge tiles clamp to the nearest cell.
    expect(maskAt(dg, W, 0, 0)).toBe(15);
    expect(maskAt(dg, G, 0, 0)).toBe(-1);
    expect(maskAt(dg, G, 2, 1)).toBe(15);
    expect(maskAt(dg, W, 2, 1)).toBe(-1);
  });

  it('a higher layer also covers corners of even higher terrain (no holes underneath)', () => {
    // Corners around display tile (1,1): TL=water TR=grass BL=cliff BR=grass.
    const dg = computeDualGrid(gridFromAscii(['~.', '#.']), priorityOf);
    expect(maskAt(dg, W, 1, 1)).toBe(15);
    expect(maskAt(dg, G, 1, 1)).toBe(2 | 4 | 8);
    expect(maskAt(dg, C, 1, 1)).toBe(4);
  });
});
```

- [ ] **Step 9: Rút gọn `src/render/atlas.ts`**

Atlas sprite colony (`buildPlaceholderAtlas` + `terrainArt.ts`) bị xoá; giữ `toCanvas`, `packShelves` (export để task sau và G1 dùng). Thay toàn bộ file:

```ts
import type { PixelCanvas } from './pixel';

/**
 * Turns generated pixel art into Phaser textures. Scenes refer to frames by name only, so
 * an Aseprite atlas with the same frame names can replace any generated texture (spec
 * §11.4). The UI atlas comes next in G0; world sprites (`field-tiles`, `sprites`) in G1.
 */

export const toCanvas = (art: PixelCanvas): HTMLCanvasElement => {
  const canvas = document.createElement('canvas');
  canvas.width = art.width;
  canvas.height = art.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');
  ctx.putImageData(new ImageData(art.data, art.width, art.height), 0, 0);
  return canvas;
};

/** Pack sprites left-to-right in shelves. Small and good enough for generated art. */
export const packShelves = (sprites: { name: string; art: PixelCanvas }[], maxWidth = 256) => {
  let x = 0;
  let y = 0;
  let shelf = 0;
  const placed = sprites.map((s) => {
    if (x + s.art.width > maxWidth) {
      x = 0;
      y += shelf + 1;
      shelf = 0;
    }
    const p = { ...s, x, y };
    x += s.art.width + 1;
    shelf = Math.max(shelf, s.art.height);
    return p;
  });
  return { placed, height: y + shelf };
};
```

- [ ] **Step 10: Scene còn lại: `keys.ts`, `PreloadScene.ts`, menu tạm, `main.ts`**

Thay toàn bộ `src/scenes/keys.ts`:

```ts
export const SCENES = {
  boot: 'Boot',
  preload: 'Preload',
  mainMenu: 'MainMenu',
} as const;
```

Thay toàn bộ `src/scenes/PreloadScene.ts` (bỏ `buildPlaceholderAtlas`; nhãn tải đổi ở Task 5):

```ts
import Phaser from 'phaser';
import { PALETTE } from '../data/palette';
import { textStyle } from '../ui/theme';
import { SCENES } from './keys';

/** Loads (or, for now, generates) every shared asset before the menu appears. */
export class PreloadScene extends Phaser.Scene {
  constructor() {
    super(SCENES.preload);
  }

  preload(): void {
    const { width, height } = this.scale;
    const label = this.add
      .text(width / 2, height / 2, 'Đang thắp lửa…', textStyle(16, PALETTE.boneGrey))
      .setOrigin(0.5);
    this.load.on(Phaser.Loader.Events.PROGRESS, (p: number) => {
      label.setText(`Đang thắp lửa… ${Math.round(p * 100)}%`);
    });
    // Real assets (atlases, audio) will be queued here with this.load.*.
  }

  create(): void {
    this.scene.start(SCENES.mainMenu);
  }
}
```

Thay toàn bộ `src/scenes/MainMenuScene.ts` bằng menu tạm (thay hẳn ở Task 7):

```ts
import Phaser from 'phaser';
import { PALETTE, toCss } from '../data/palette';
import { createButton, FONT_TITLE, textStyle, type Button } from '../ui/theme';
import { SCENES } from './keys';

/**
 * Temporary menu while the colony sim is gone: the title and one disabled "Ván mới"
 * button. Replaced by the Stardew-style menu later in G0.
 */
export class MainMenuScene extends Phaser.Scene {
  private title!: Phaser.GameObjects.Text;
  private newRunButton!: Button;

  constructor() {
    super(SCENES.mainMenu);
  }

  create(): void {
    this.cameras.main.setBackgroundColor(toCss(PALETTE.void));
    this.title = this.add
      .text(0, 0, 'Chín Vương Miện', {
        ...textStyle(40, PALETTE.parchment, FONT_TITLE),
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    this.newRunButton = createButton(this, 0, 0, 'Ván mới — Sắp có', {
      width: 200,
      height: 52,
      fontSize: 18,
      onClick: () => undefined,
    });
    this.newRunButton.container.setAlpha(0.5);

    this.layout();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this);
    });
  }

  private layout(): void {
    const { width, height } = this.scale;
    this.title.setPosition(width / 2, height / 3);
    this.newRunButton.container.setPosition(width / 2, height / 2 + 26);
  }
}
```

Thay toàn bộ `src/main.ts` (bỏ `WorldScene`, `HudScene`; nền đổi sang `outline` ở Task 8):

```ts
import Phaser from 'phaser';
import { PALETTE, toCss } from './data/palette';
import { BootScene } from './scenes/BootScene';
import { MainMenuScene } from './scenes/MainMenuScene';
import { PreloadScene } from './scenes/PreloadScene';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: toCss(PALETTE.void),
  // Nearest-neighbour sampling + rounded positions: crisp pixel art at integer zoom.
  pixelArt: true,
  scale: {
    // Canvas fills the window 1:1; zoom is handled by the camera in whole steps.
    mode: Phaser.Scale.RESIZE,
    width: window.innerWidth,
    height: window.innerHeight,
  },
  input: {
    // Mouse + up to two simultaneous touches (pinch).
    activePointers: 3,
  },
  scene: [BootScene, PreloadScene, MainMenuScene],
});

if (import.meta.env.DEV) {
  (window as unknown as { game: Phaser.Game }).game = game;
}
```

- [ ] **Step 11: Kiểm tra không còn tham chiếu tới code đã xoá**

Run: `grep -rnE "from '(\./|\.\./)+(sim|platform)/|bitecs|WorldScene|HudScene|terrainArt|buildPlaceholderAtlas" src package.json`
Expected: không in dòng nào (exit 1).

- [ ] **Step 12: Lint, typecheck, test, build**

Run: `npm run lint < /dev/null && npm run typecheck < /dev/null && npm test < /dev/null && npm run build < /dev/null`
Expected: tất cả exit 0; Vitest: 7 file, 34 test pass (`events`, `SimClock`, `SpatialHash`, `geom`, `bitmap`, `dualGrid`, `steering`).

- [ ] **Step 13: Kiểm tra nhanh trong trình duyệt**

Run: `npm run dev` (nền), mở `http://localhost:5173`.
Expected: "Đang thắp lửa…" rồi menu tạm: chữ "Chín Vương Miện" và một nút mờ "Ván mới — Sắp có"; bấm nút không có gì xảy ra; console không lỗi.

- [ ] **Step 14: Commit**

```bash
git add src/game/battle/steering.ts src/game/battle/steering.test.ts src/core/geom.ts src/core/geom.test.ts \
  src/core/SpatialHash.ts src/core/events.ts src/render/dualGrid.test.ts src/render/atlas.ts \
  src/scenes/keys.ts src/scenes/PreloadScene.ts src/scenes/MainMenuScene.ts src/main.ts \
  package.json package-lock.json
git status --short
git commit -m "$(cat <<'EOF'
refactor: remove the colony sim, move shared infra to src/core, drop bitecs

Separation is rewritten per spec §8.11 in src/game/battle/steering.ts. The
main menu is a temporary title + disabled "Ván mới" until the Stardew menu.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

Expected trước khi commit: `git status --short` chỉ liệt kê các file trên (dạng `M`/`A`/`R`) và các file đã `git rm` (dạng `D`); không có dòng `??` nào trong `src/`.

---

### Task 2: ESLint §12.4 — tách lớp và cấm hàm không deterministic

**Files:**
- Modify: `eslint.config.js` (viết lại toàn bộ)
- Test (tạm, xoá trước commit): `src/game/__eslint_probe.ts`, `src/data/__eslint_probe.ts`, `src/core/__eslint_probe.ts`

**Interfaces:**
- Consumes: `src/game/battle/steering.ts` (`separationPush`), `src/scenes/keys.ts` (`SCENES`) từ Task 1 — chỉ để file tạm import.
- Produces: luật ESLint mà mọi task sau phải qua: `src/game|data|core/**/*.ts` không import `phaser` hay `**/scenes/**`, `**/render/**`, `**/ui/**`, `**/platform/**`, `**/audio/**`, không dùng `Math.random/hypot/sin/cos/tan/atan2/exp/log/pow`, `Date.now`, `performance.now`; `src/data/**/*.ts` thêm cấm `**/game/**`.

Ghi chú: khối thứ hai ghi đè `no-restricted-imports` cho `src/data` (flat config: khối sau thắng cho cùng rule) và phải lặp lại cả danh sách presentation. Đã thử trước: `no-restricted-properties` bắt cả `const { random } = Math` và `Math['hypot']`; pattern `**/render/**` khớp import tương đối `'../render/atlas'`.

- [ ] **Step 1: Viết file tạm vi phạm luật (test thất bại trước khi có luật)**

Tạo `src/game/__eslint_probe.ts`:

```ts
import Phaser from 'phaser';
import { SCENES } from '../scenes/keys';

const { random } = Math;
export const probe = (): number =>
  Math.random() + random() + Math['hypot'](3, 4) + Date.now() + Phaser.Math.Between(0, 1) + SCENES.boot.length;
```

Tạo `src/data/__eslint_probe.ts`:

```ts
import { separationPush } from '../game/battle/steering';

export const probe = separationPush;
```

Tạo `src/core/__eslint_probe.ts`:

```ts
export const probe = (): number => performance.now() + Math.sin(1) + Math.pow(2, 3);
```

- [ ] **Step 2: Chạy ESLint để thấy luật cũ không bắt được**

Run: `npx eslint src/game/__eslint_probe.ts src/data/__eslint_probe.ts src/core/__eslint_probe.ts < /dev/null; echo "exit $?"`
Expected: luật cũ chỉ cấm `phaser` trong `src/sim|data|core` nên **không** có lỗi nào ở `src/game/__eslint_probe.ts` và không có lỗi `no-restricted-properties` nào; in `exit 0`.

- [ ] **Step 3: Viết lại `eslint.config.js`**

Thay toàn bộ file:

```js
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/** Layers that game rules, data and core helpers must never depend on. */
const PRESENTATION = ['**/scenes/**', '**/render/**', '**/ui/**', '**/platform/**', '**/audio/**'];

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'public'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.browser } },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
  {
    // Rules, data and core helpers stay engine-agnostic and deterministic (spec §8.12, §12.4)
    // so they can be unit-tested, run headless and replayed bit for bit.
    files: ['src/game/**/*.ts', 'src/data/**/*.ts', 'src/core/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [{ name: 'phaser', message: 'game/, data/ and core/ must stay engine-agnostic.' }],
          patterns: [
            {
              group: PRESENTATION,
              message: 'game/, data/ and core/ must not depend on presentation or platform code.',
            },
          ],
        },
      ],
      'no-restricted-properties': [
        'error',
        ...['random', 'hypot', 'sin', 'cos', 'tan', 'atan2', 'exp', 'log', 'pow'].map(
          (property) => ({
            object: 'Math',
            property,
            message: 'Non-deterministic or engine-dependent; see spec §8.12.',
          }),
        ),
        { object: 'Date', property: 'now', message: 'Wall-clock time is non-deterministic.' },
        {
          object: 'performance',
          property: 'now',
          message: 'Wall-clock time is non-deterministic.',
        },
      ],
    },
  },
  {
    // Data is plain values and types: it must not import rules either.
    files: ['src/data/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [{ name: 'phaser', message: 'data/ must stay engine-agnostic.' }],
          patterns: [
            {
              group: ['**/game/**', ...PRESENTATION],
              message:
                'data/ holds only values and types; it must not import rules or presentation.',
            },
          ],
        },
      ],
    },
  },
);
```

- [ ] **Step 4: Chạy ESLint trên file tạm để thấy luật mới bắt đủ**

Run: `npx eslint src/game/__eslint_probe.ts src/data/__eslint_probe.ts src/core/__eslint_probe.ts < /dev/null; echo "exit $?"`
Expected: `exit 1` và đúng 10 lỗi:
- `src/core/__eslint_probe.ts`: `'performance.now' is restricted…`, `'Math.sin' is restricted…`, `'Math.pow' is restricted…` (`no-restricted-properties`).
- `src/data/__eslint_probe.ts`: `'../game/battle/steering' import is restricted from being used by a pattern. data/ holds only values and types…` (`no-restricted-imports`).
- `src/game/__eslint_probe.ts`: `'phaser' import is restricted…`, `'../scenes/keys' import is restricted from being used by a pattern…`, hai lần `'Math.random' is restricted…` (dòng destructuring và dòng gọi), `'Math.hypot' is restricted…`, `'Date.now' is restricted…`.

- [ ] **Step 5: Xoá file tạm**

```bash
rm src/game/__eslint_probe.ts src/data/__eslint_probe.ts src/core/__eslint_probe.ts
```

Run: `git status --short`
Expected: chỉ còn ` M eslint.config.js`.

- [ ] **Step 6: Lint, typecheck, test, build**

Run: `npm run lint < /dev/null && npm run typecheck < /dev/null && npm test < /dev/null && npm run build < /dev/null`
Expected: tất cả exit 0 (code hiện có trong `src/core` không dùng hàm bị cấm: `geom.ts` đã dùng `Math.sqrt`).

- [ ] **Step 7: Commit**

```bash
git add eslint.config.js
git commit -m "$(cat <<'EOF'
build(lint): keep game/, data/ and core/ engine-agnostic and deterministic

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: `UI_PALETTE` và art UI sinh bằng code

**Files:**
- Create: `src/data/uiPalette.ts`
- Create: `src/render/uiArt.ts`
- Test: `src/render/uiArt.test.ts`

**Interfaces:**
- Consumes: `PixelCanvas`, `pixelHash` từ `src/render/pixel.ts`.
- Produces:
  - `UI_PALETTE` (đúng UI spec §3: `outline`, `woodDark`, `wood`, `woodLight`, `cream`, `creamDark`, `creamLight`, `text`, `textShadow`, `gold`, `select`, `good`, `warn`, `bad`, `sky[4]`), `UI_COLORS: readonly number[]`.
  - `UI_FRAME_IDS`, `type UiFrame = 'panel' | 'button' | 'buttonHover' | 'buttonDown' | 'buttonActive' | 'slot' | 'slotHover' | 'slotSelected' | 'tooltip' | 'bar'`.
  - `interface UiFrameDef { w; h; slice; border }`, `UI_FRAMES: Readonly<Record<UiFrame, UiFrameDef>>`.
  - `UI_DECOR_IDS`, `type UiDecor = 'clockDial' | 'firefly'`, `UI_DECOR: Record<UiDecor, { w; h }>`.
  - `DIAL = { cx: 14, cy: 15, faceR: 9, height: 21 }`.
  - `paintUiFrame(frame: UiFrame): PixelCanvas`, `paintUiDecor(decor: UiDecor): PixelCanvas`.

Ghi chú: đây là UI plan Task 1 nguyên văn (chỉ chú thích đầu `uiPalette.ts` đổi "Ashen 32/thế giới u tối" thành "PALETTE (Hearth 32)" vì bảng màu thế giới đổi ở Task 8; mọi giá trị giữ nguyên). Hàm art dạng `paintX(): PixelCanvas` rồi `atlas.ts` xếp kệ (`packShelves`) và `blit`. `slotHover` là biến thể hover của ô; `border` là độ dày viền trang trí để tính lề chữ. `uiArt.ts` nằm trong `src/render` nên được dùng `Math.hypot` (luật deterministic chỉ áp cho `game/data/core`).

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
 * UI palette — the deliberate exception to "every pixel from PALETTE": the interface is
 * warm and bright (wood frames, cream paper) so it reads over the world, the way Stardew
 * puts a wooden frame over every scene. World pixels still come from PALETTE (Hearth 32).
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
Expected: PASS (9 tests).

- [ ] **Step 6: Lint, typecheck, test, build**

Run: `npm run lint < /dev/null && npm run typecheck < /dev/null && npm test < /dev/null && npm run build < /dev/null`
Expected: tất cả exit 0; 8 file, 43 test.

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

### Task 4: Logic UI thuần dùng chung (`layout.ts`)

**Files:**
- Create: `src/ui/hud/layout.ts`
- Test: `src/ui/hud/layout.test.ts`

**Interfaces:**
- Consumes: không có (file thuần, không import gì).
- Produces (tất cả từ `src/ui/hud/layout.ts`, không import Phaser):
  - Hằng: `TOUCH_TARGET = 44`, `MARGIN = 10`, `GAP = 4`, `SPEED_GAP = 2`, `LONG_PRESS_MS = 400`, `MAP_DWELL_MS = 300`, `DRAG_SLOP = 8`, `TOOLTIP_MAX_W = 220`, `TOOLTIP_OFFSET = 16`, `TOOLTIP_EDGE = 4`, `TOAST = { max: 4, holdMs: 5000, slideMs: 200, fadeMs: 400, height: 32, gap: 4, maxWidth: 320 }`, `TOAST_STACK_H = 144`, `HOTBAR = { slot: 48, minSlot: 44, gap: 4, minGap: 2, divider: 2 }`.
  - Kiểu: `Rect { x; y; w; h }`, `Size { w; h }`, `Point { x; y }`, `TooltipPart { text; color?; icon?: { key; frame } }`, `TooltipLine = readonly TooltipPart[]`, `TooltipContent { title?; lines }`, `ToastEntry { id; text; count; shownAt }`, `ToastPush { list; entry; merged; dropped }`, `HotbarFit { slot; gap; width; scroll }`.
  - Hàm: `textContent(lines: readonly string[]): TooltipContent`, `uiScaleFor(w, h): 1 | 2`, `pushToast(list, text, now, id): ToastPush`, `ellipsize(text, maxWidth, measure): string`, `toastText(entry, maxWidth, measure): string`, `placeTooltip(pointer, size, screen): Point`, `placeAbove(anchor, size, screen): Point`, `hotbarWidth(count, slot, gap)`, `hotbarSlotX(index, slot, gap)`, `fitHotbar(count, available): HotbarFit`, `clampScroll(offset, content, view)`, `iconScale(w, h, box = 32)`, `overlapsX(a, b): boolean`.

Ghi chú: UI plan Task 2 rút gọn đúng danh sách của spec §14 G0 mục 3. **Bỏ:** `clockAt`, `clockLabel`, `dialPoint`, `ClockReading`, `needColor`, `costTotal`, `CARD`, `CardLayout`, `layoutCards`, `visibleCards`, `RIGHT_COLUMN_W`, `descVi` và mọi sửa `buildings.ts`/`data.test.ts` (đã xoá ở Task 1). Vì bỏ `needColor`, file không còn import `UI_PALETTE`; vì bỏ đồng hồ, không còn import `DAY_TICKS`. Test giữ nguyên các ca của phần còn lại (chữ mẫu đổi từ colony sang game mới) và thêm một ca ngưỡng 600 px (Review Focus 2).

- [ ] **Step 1: Viết test thất bại**

Tạo `src/ui/hud/layout.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  clampScroll,
  ellipsize,
  fitHotbar,
  hotbarSlotX,
  hotbarWidth,
  iconScale,
  overlapsX,
  placeAbove,
  placeTooltip,
  pushToast,
  textContent,
  toastText,
  uiScaleFor,
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

  it('switches exactly at 600 px on either side', () => {
    expect(uiScaleFor(599, 1000)).toBe(1);
    expect(uiScaleFor(1000, 599)).toBe(1);
    expect(uiScaleFor(600, 1000)).toBe(2);
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
    const first = pushToast([], 'Đã mở ô mới.', 0, 1);
    const second = pushToast(first.list, 'Đã mở ô mới.', 1000, 2);
    expect(second.merged).toBe(true);
    expect(second.list).toHaveLength(1);
    expect(second.list[0]).toMatchObject({ id: 1, count: 2, shownAt: 1000 });
    expect(toastText(second.list[0]!, 1000, chars)).toBe('Đã mở ô mới. ×2');
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
    const t: ToastEntry = { id: 1, text: 'Quân địch nổi cơn cuồng nộ!', count: 3, shownAt: 0 };
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
});

describe('helpers', () => {
  it('detects horizontal overlap (touching is not overlap)', () => {
    expect(overlapsX({ x: 0, w: 10 }, { x: 10, w: 5 })).toBe(false);
    expect(overlapsX({ x: 0, w: 11 }, { x: 10, w: 5 })).toBe(true);
  });

  it('turns description lines into tooltip content (first line = title)', () => {
    expect(textContent(['Tháp Cung', 'Bắn tên vào địch gần Ngai nhất.'])).toEqual({
      title: 'Tháp Cung',
      lines: [[{ text: 'Bắn tên vào địch gần Ngai nhất.' }]],
    });
    expect(textContent([])).toEqual({ title: undefined, lines: [] });
  });
});
```

- [ ] **Step 2: Chạy test để thấy thất bại**

Run: `npm test -- src/ui/hud/layout.test.ts < /dev/null`
Expected: FAIL — `Failed to resolve import "./layout"`.

- [ ] **Step 3: Viết `layout.ts`**

Tạo `src/ui/hud/layout.ts`:

```ts
/**
 * Pure UI maths shared by every screen (no Phaser) so it can be unit-tested: border scale,
 * toast merging, tooltip placement, slot-row fitting and scrolling. Sizes are logical
 * screen px.
 */

/** Minimum touch target (Apple/Google guidance). */
export const TOUCH_TARGET = 44;
export const MARGIN = 10;
export const GAP = 4;
/** Gap between the speed buttons of a speed row (pause/1×/2×/3×). */
export const SPEED_GAP = 2;
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

// --- misc ----------------------------------------------------------------------------------

/** Horizontal spans overlap (touching edges do not). */
export const overlapsX = (a: Pick<Rect, 'x' | 'w'>, b: Pick<Rect, 'x' | 'w'>): boolean =>
  a.x < b.x + b.w && b.x < a.x + a.w;
```

- [ ] **Step 4: Chạy test để thấy pass**

Run: `npm test -- src/ui/hud/layout.test.ts < /dev/null`
Expected: PASS (21 tests).

- [ ] **Step 5: Lint, typecheck, test, build**

Run: `npm run lint < /dev/null && npm run typecheck < /dev/null && npm test < /dev/null && npm run build < /dev/null`
Expected: tất cả exit 0; 9 file, 64 test.

- [ ] **Step 6: Commit**

```bash
git add src/ui/hud/layout.ts src/ui/hud/layout.test.ts
git commit -m "$(cat <<'EOF'
feat(ui): shared pure layout logic (scale, toasts, tooltip placement, slot rows)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Texture `ui`, `PreloadScene` và `theme.ts` vẽ lại

**Files:**
- Modify: `src/render/atlas.ts` (viết lại toàn bộ)
- Modify: `src/scenes/PreloadScene.ts` (viết lại toàn bộ)
- Rewrite: `src/ui/theme.ts`

**Interfaces:**
- Consumes: `UI_FRAME_IDS`, `UI_DECOR_IDS`, `UI_FRAMES`, `paintUiFrame`, `paintUiDecor`, `UiFrame` (Task 3); `UI_PALETTE` (Task 3); `TOUCH_TARGET`, `LONG_PRESS_MS`, `DRAG_SLOP`, `uiScaleFor`, `Rect`, `TooltipContent` (Task 4); `toCanvas`, `packShelves` (Task 1); `toCss` (`src/data/palette.ts`).
- Produces:
  - `atlas.ts`: `UI_KEY = 'ui'`, `toCanvas`, `packShelves`, `addPixelTexture(textures, key: string, art: PixelCanvas): void`, `buildUiTexture(textures: Phaser.Textures.TextureManager): void`.
  - `theme.ts`: `FONT_UI`, `FONT_TITLE`, `FONT_DEBUG`, `TOUCH_TARGET` (re-export), `textStyle(size, color = UI_PALETTE.text, family = FONT_UI)`, `addUiText(scene, x, y, text, size, color?): Phaser.GameObjects.Text`, `uiScale(scene): 1 | 2`, `frameBorder(scene, frame: UiFrame): number`, `interface UiBox { image: NineSlice; width; height; resize(w, h); setFrame(frame) }`, `createPanel(scene, frame, width, height, originX = 0, originY = 0): UiBox`, `interface TooltipHost { showAtPointer(content, owner); showAbove(content, anchor: Rect, owner); hide(owner) }`, `interface TooltipSource { host: TooltipHost; content: () => TooltipContent | null }`, `type PressState = 'idle' | 'hover' | 'down'`, `interface PressOptions { onClick; onState?; tooltip? }`, `bindPress(scene, target: NineSlice, options): void`, `ButtonOptions { width?; height?; fontSize?; icon?; onClick; tooltip? }`, `Button { container; setActive(active); setLabel(label); setVisible(visible); setEnabled(enabled) }`, `createButton(scene, x, y, label, options): Button`.

Ghi chú: UI plan Task 3 nguyên văn, với hai điểm thích nghi: (1) `atlas.ts` viết lại cả file vì `terrainArt.ts` và `buildPlaceholderAtlas` đã xoá ở Task 1 (import `PixelCanvas` thành import giá trị vì `buildUiTexture` gọi `new PixelCanvas`); (2) `Button` thêm `setEnabled` (mờ `0.55`, tắt input, về frame `button`) để menu hiện "Ván mới" bị vô hiệu; `setVisible(true)` không bật lại input của nút đang bị vô hiệu. Nhãn tải đổi thành "Đang dựng vương quốc…", màu `UI_PALETTE.creamLight` (chữ UI trên nền tối). API Phaser 4 đã kiểm trong `node_modules/phaser/types/phaser.d.ts`: `scene.add.nineslice(x, y, texture, frame, width, height, leftWidth, rightWidth, topHeight, bottomHeight)`, `NineSlice.setSize(width, height)`, `NineSlice.setFrame(frame, updateSize?, updateOrigin?)` + `updateUVs()`, `Text.setShadow(x, y, color, blur, shadowStroke, shadowFill)`, `textures.addCanvas(key, canvas): CanvasTexture | null`, `Pointer.wasTouch`, `Pointer.getDistance()`, `disableInteractive()`; `InputPlugin.enable` bật lại input có sẵn (`input.enabled = true`) khi gọi `setInteractive()` lần nữa, nên con trỏ tay của lần đầu được giữ.

Task này không có unit test (mọi thứ phụ thuộc scene Phaser); phần thuần đã test ở Task 3–4. Sau task này menu tạm vẫn chạy, nút đã là khung gỗ.

- [ ] **Step 1: Viết lại `src/render/atlas.ts`**

Thay toàn bộ file:

```ts
import type Phaser from 'phaser';
import { PixelCanvas } from './pixel';
import { UI_DECOR_IDS, UI_FRAME_IDS, paintUiDecor, paintUiFrame } from './uiArt';

/**
 * Turns generated pixel art into Phaser textures. Scenes refer to frames by name only, so
 * an Aseprite atlas with the same frame names can replace any generated texture (spec
 * §11.4). World sprites (`field-tiles`, `sprites`) are added here from G1.
 */

/** UI frames (nine-slice sources) and decorations, named as in uiArt.ts. */
export const UI_KEY = 'ui';

export const toCanvas = (art: PixelCanvas): HTMLCanvasElement => {
  const canvas = document.createElement('canvas');
  canvas.width = art.width;
  canvas.height = art.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');
  ctx.putImageData(new ImageData(art.data, art.width, art.height), 0, 0);
  return canvas;
};

/** Pack sprites left-to-right in shelves. Small and good enough for generated art. */
export const packShelves = (sprites: { name: string; art: PixelCanvas }[], maxWidth = 256) => {
  let x = 0;
  let y = 0;
  let shelf = 0;
  const placed = sprites.map((s) => {
    if (x + s.art.width > maxWidth) {
      x = 0;
      y += shelf + 1;
      shelf = 0;
    }
    const p = { ...s, x, y };
    x += s.art.width + 1;
    shelf = Math.max(shelf, s.art.height);
    return p;
  });
  return { placed, height: y + shelf };
};

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

- [ ] **Step 2: Viết lại `src/scenes/PreloadScene.ts`**

Thay toàn bộ file:

```ts
import Phaser from 'phaser';
import { UI_PALETTE } from '../data/uiPalette';
import { buildUiTexture } from '../render/atlas';
import { textStyle } from '../ui/theme';
import { SCENES } from './keys';

const LOADING_LABEL = 'Đang dựng vương quốc…';

/** Loads (or, for now, generates) every shared asset before the menu appears. */
export class PreloadScene extends Phaser.Scene {
  constructor() {
    super(SCENES.preload);
  }

  preload(): void {
    const { width, height } = this.scale;
    const label = this.add
      .text(width / 2, height / 2, LOADING_LABEL, textStyle(16, UI_PALETTE.creamLight))
      .setOrigin(0.5);
    this.load.on(Phaser.Loader.Events.PROGRESS, (p: number) => {
      label.setText(`${LOADING_LABEL} ${Math.round(p * 100)}%`);
    });
    // Real assets (atlases, audio) will be queued here with this.load.*.
  }

  create(): void {
    buildUiTexture(this.textures);
    this.scene.start(SCENES.mainMenu);
  }
}
```

- [ ] **Step 3: Viết lại `src/ui/theme.ts`**

Thay toàn bộ file:

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
  /** Disabled: dimmed, ignores hover and clicks (e.g. a feature that is not built yet). */
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
      if (value && enabled) {
        box.image.setInteractive();
      } else {
        box.image.disableInteractive();
        state = 'idle';
        refresh();
      }
    },
    setEnabled: (value) => {
      enabled = value;
      container.setAlpha(value ? 1 : DISABLED_ALPHA);
      if (value && container.visible) {
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
Expected: tất cả exit 0 (64 test).

- [ ] **Step 5: Kiểm tra nhanh trong trình duyệt**

Run: `npm run dev` (nền), mở `http://localhost:5173`.
Expected: "Đang dựng vương quốc…" (có thể chỉ thoáng qua) rồi menu tạm; nút "Ván mới — Sắp có" là khung gỗ lõi kem, mờ; console không lỗi. Trong console: `game.textures.exists('ui')` → `true`; `game.textures.get('ui').getFrameNames().length` → `12`.

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

### Task 6: `ContentBox` và `Tooltip` dùng chung

**Files:**
- Create: `src/ui/ContentBox.ts`
- Create: `src/ui/Tooltip.ts`

**Interfaces:**
- Consumes: `addUiText`, `createPanel`, `frameBorder`, `UiBox`, `TooltipHost` (Task 5); `placeTooltip`, `placeAbove`, `TOOLTIP_MAX_W`, `Rect`, `Size`, `TooltipContent` (Task 4); `UiFrame` (Task 3).
- Produces:
  - `class ContentBox { constructor(scene, frame: UiFrame, maxWidth: number, options?: { fontSize?: number; blocking?: boolean }); readonly container; width; height; visible; setMaxWidth(w); setContent(content | null); refresh(); setPosition(x, y): this; destroy() }` — `setContent` bỏ qua nếu nội dung không đổi (so `JSON.stringify`); `blocking: true` làm khung interactive để chặn click xuống thế giới.
  - `class Tooltip implements TooltipHost { constructor(scene); shownBy: string | null; showAtPointer(content, owner); showAbove(content, anchor, owner); hide(owner); refresh(); destroy() }` — depth 1000, không interactive (không bao giờ chặn input).

UI plan Task 4 nguyên văn. Bấm giữ 400 ms và "nhả tay sau bấm giữ không kích hoạt nút" đã nằm trong `bindPress` (Task 5); `Tooltip` chỉ lo hiển thị và vị trí. Không có unit test (Phaser); vị trí lật/kẹp đã test ở Task 4. G0 chưa có màn nào dùng hai class này (menu §10.2 không còn hộp seed); G1 dùng cho HUD.

- [ ] **Step 1: Viết `src/ui/ContentBox.ts`**

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

- [ ] **Step 2: Viết `src/ui/Tooltip.ts`**

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

- [ ] **Step 3: Lint, typecheck, test, build**

Run: `npm run lint < /dev/null && npm run typecheck < /dev/null && npm test < /dev/null && npm run build < /dev/null`
Expected: tất cả exit 0.

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

### Task 7: Menu chính kiểu Stardew (§10.2)

**Files:**
- Modify: `src/render/uiArt.ts` (thêm nền menu ở cuối file)
- Modify: `src/render/uiArt.test.ts` (đổi khối import, thêm `describe('menu backdrop')`)
- Create: `src/ui/menuLayout.ts`
- Test: `src/ui/menuLayout.test.ts`
- Rewrite: `src/scenes/MainMenuScene.ts`

**Interfaces:**
- Consumes: `UI_PALETTE`, `PixelCanvas`, `pixelHash` (Task 3); `UI_KEY`, `addPixelTexture` (Task 5); `addUiText`, `createButton`, `createPanel`, `frameBorder`, `FONT_TITLE`, `textStyle`, `Button` (+ `setEnabled`), `UiBox` (Task 5); `Point`, `Size` (Task 4); `toCss`.
- Produces:
  - Từ `uiArt.ts`: `MENU_SKY_H = 256`, `menuPixelScale(screenHeight): number`, `paintSky(): PixelCanvas` (4×256), `interface HillLayer { height; base; amp; freq; color; trees }`, `HILL_LAYERS: readonly HillLayer[]` (3 lớp xa → gần), `HILL_W = 128`, `paintHills(layer: number): PixelCanvas`.
  - Từ `menuLayout.ts`: `MENU_BUTTON = { w: 200, h: 52, gap: 12 }`, `MENU_FOOTER_H = 28`, `interface MenuLayout { logo: Point; buttons: Point[]; footer: Point }`, `layoutMenu(screen: Size, logo: Size, buttonCount: number): MenuLayout`.
  - `MainMenuScene` (key `SCENES.mainMenu`), trường runtime đọc được trong console dev: `logo: UiBox`, `title`, `subtitle`, `footer: Text`, `buttons: Button[]`, `fireflies: Image[]`.

Ghi chú: UI plan Task 9 với thay đổi §10.2: logo "Chín Vương Miện", phụ đề "Một vương quốc nhỏ, chín ngai vàng"; bỏ nút "Đổi seed", hộp seed, `randomSeed`, phím Enter và `WorldSceneData` (Chọn vua lo seed từ G2). Danh sách nút là `MENU_ENTRIES`; nút của tính năng chưa có không nằm trong danh sách (ẩn); G0 chỉ có "Ván mới — Sắp có" bị vô hiệu (`setEnabled(false)`). Phép tính vị trí của menu cũ được tách ra `layoutMenu` thuần (có test) và thêm luật dịch chồng nút lên khi chạm footer (Review Focus 1). Footer chỉ còn `v${__APP_VERSION__}` (bỏ chữ "Phase 0 prototype"). Màu đồi/cây lấy từ `UI_PALETTE` (xa → gần: `woodDark`, `text`, `outline`); trời là 4 dải `UI_PALETTE.sky` nối bằng dither Bayer 2×2; `menuPixelScale` chọn cỡ pixel nguyên sao cho 256 hàng trời luôn phủ hết chiều cao màn hình.

- [ ] **Step 1: Viết test thất bại cho nền menu**

Trong `src/render/uiArt.test.ts`, đổi khối import từ `./uiArt`:

```ts
import {
  UI_DECOR,
  UI_DECOR_IDS,
  UI_FRAMES,
  UI_FRAME_IDS,
  paintUiDecor,
  paintUiFrame,
  type UiFrame,
} from './uiArt';
```

thành:

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

- [ ] **Step 2: Viết test thất bại cho bố cục menu**

Tạo `src/ui/menuLayout.test.ts`:

```ts
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
```

- [ ] **Step 3: Chạy test để thấy thất bại**

Run: `npm test -- src/render/uiArt.test.ts src/ui/menuLayout.test.ts < /dev/null`
Expected: FAIL — `uiArt.test.ts`: `menuPixelScale is not a function` (và các export mới khác chưa có); `menuLayout.test.ts`: `Failed to resolve import "./menuLayout"`.

- [ ] **Step 4: Thêm nền menu vào cuối `src/render/uiArt.ts`**

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

- [ ] **Step 5: Viết `src/ui/menuLayout.ts`**

```ts
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
```

- [ ] **Step 6: Chạy test để thấy pass**

Run: `npm test -- src/render/uiArt.test.ts src/ui/menuLayout.test.ts < /dev/null`
Expected: PASS (`uiArt.test.ts` 14 test, gồm 5 test mới; `menuLayout.test.ts` 6 test).

- [ ] **Step 7: Thay toàn bộ `src/scenes/MainMenuScene.ts`**

```ts
import Phaser from 'phaser';
import { toCss } from '../data/palette';
import { UI_PALETTE } from '../data/uiPalette';
import { UI_KEY, addPixelTexture } from '../render/atlas';
import { HILL_LAYERS, MENU_SKY_H, menuPixelScale, paintHills, paintSky } from '../render/uiArt';
import { MENU_BUTTON, layoutMenu } from '../ui/menuLayout';
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
import { SCENES } from './keys';

const TITLE = 'Chín Vương Miện';
const SUBTITLE = 'Một vương quốc nhỏ, chín ngai vàng';
const SKY_KEY = 'menu-sky';
const hillKey = (layer: number): string => `menu-hills-${layer}`;
/** Drift speed of each hill layer, far → near (screen px per second). */
const PARALLAX = [4, 8, 16] as const;
const FIREFLIES = 24;

/**
 * One §10.2 menu button. Buttons of features that do not exist yet are simply not listed
 * ("Tiếp tục" G3, "Vương Miện" G4, "Cài đặt" G5). G0 lists "Ván mới" disabled ("Sắp có")
 * because King select / Realm arrive in G1.
 */
interface MenuEntry {
  readonly label: string;
  readonly enabled: boolean;
  readonly onClick: () => void;
}

const MENU_ENTRIES: readonly MenuEntry[] = [
  { label: 'Ván mới — Sắp có', enabled: false, onClick: () => undefined },
];

export class MainMenuScene extends Phaser.Scene {
  private pix = 2;
  private sky!: Phaser.GameObjects.TileSprite;
  private hills: Phaser.GameObjects.TileSprite[] = [];
  private fireflies: Phaser.GameObjects.Image[] = [];
  private logo!: UiBox;
  private title!: Phaser.GameObjects.Text;
  private subtitle!: Phaser.GameObjects.Text;
  private footer!: Phaser.GameObjects.Text;
  private buttons: Button[] = [];

  constructor() {
    super(SCENES.mainMenu);
  }

  create(): void {
    this.hills = [];
    this.fireflies = [];
    this.buttons = [];
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
      .text(0, 0, TITLE, {
        ...textStyle(48, UI_PALETTE.text, FONT_TITLE),
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setShadow(2, 2, toCss(UI_PALETTE.textShadow), 0, false, true);
    this.subtitle = addUiText(this, 0, 0, SUBTITLE, 14).setOrigin(0.5, 0).setAlign('center');

    this.buttons = MENU_ENTRIES.map((entry) => {
      const button = createButton(this, 0, 0, entry.label, {
        width: MENU_BUTTON.w,
        height: MENU_BUTTON.h,
        fontSize: 18,
        onClick: entry.onClick,
      });
      button.setEnabled(entry.enabled);
      return button;
    });
    this.footer = this.add
      .text(0, 0, `v${__APP_VERSION__}`, textStyle(11, UI_PALETTE.creamLight))
      .setOrigin(0.5);

    this.layout();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this);
    });
  }

  update(_time: number, delta: number): void {
    this.hills.forEach((hill, i) => {
      hill.tilePositionX += ((PARALLAX[i] ?? 0) * delta) / 1000 / this.pix;
    });
  }

  private layout(): void {
    const { width, height } = this.scale;

    this.pix = menuPixelScale(height);
    const texW = Math.ceil(width / this.pix) + 1;
    this.sky.setSize(texW, MENU_SKY_H).setScale(this.pix);
    this.hills.forEach((hill, i) =>
      hill.setSize(texW, HILL_LAYERS[i]!.height).setScale(this.pix).setPosition(0, height),
    );
    for (const fly of this.fireflies) fly.setScale(this.pix);

    // Logo board size from its text (title size: same clamp as before).
    const inset = frameBorder(this, 'panel') + 16;
    const titleSize = Phaser.Math.Clamp(Math.floor(width / 14), 28, 64);
    this.title.setFontSize(titleSize);
    this.subtitle.setWordWrapWidth(Math.min(520, width - 32 - inset * 2));
    const logoW = Math.min(width - 16, Math.max(this.title.width, this.subtitle.width) + inset * 2);
    const logoH = inset * 2 + this.title.height + 4 + this.subtitle.height;

    const m = layoutMenu({ w: width, h: height }, { w: logoW, h: logoH }, this.buttons.length);
    this.logo.resize(logoW, logoH);
    this.logo.image.setPosition(m.logo.x, m.logo.y);
    const logoTop = m.logo.y - logoH / 2;
    this.title.setPosition(m.logo.x, logoTop + inset + this.title.height / 2);
    this.subtitle.setPosition(m.logo.x, logoTop + inset + this.title.height + 4);
    this.buttons.forEach((button, i) => {
      const at = m.buttons[i]!;
      button.container.setPosition(at.x, at.y);
    });
    this.footer.setPosition(m.footer.x, m.footer.y);
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
}
```

- [ ] **Step 8: Lint, typecheck, test, build**

Run: `npm run lint < /dev/null && npm run typecheck < /dev/null && npm test < /dev/null && npm run build < /dev/null`
Expected: tất cả exit 0; 10 file, 75 test.

- [ ] **Step 9: Kiểm tra nhanh**

Run: `npm run dev` (nền), mở `http://localhost:5173`.
Expected: trời hoàng hôn 4 dải có dither ở chỗ nối, 3 lớp đồi trôi ngang với tốc độ khác nhau (gần nhanh nhất), bảng gỗ "Chín Vương Miện" + phụ đề ở 1/3 trên, một nút gỗ mờ "Ván mới — Sắp có" 200×52 ở giữa, dòng `v0.0.1` ở đáy, 24 đom đóm nhấp nháy; rê chuột/bấm nút không đổi gì; console không lỗi.

- [ ] **Step 10: Commit**

```bash
git add src/render/uiArt.ts src/render/uiArt.test.ts src/ui/menuLayout.ts src/ui/menuLayout.test.ts \
  src/scenes/MainMenuScene.ts
git commit -m "$(cat <<'EOF'
feat(menu): Nine Crowns main menu with dusk sky, parallax hills and fireflies

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Bảng màu thế giới Hearth 32 và nền trang

**Files:**
- Rewrite: `src/data/palette.ts`
- Test: `src/data/palette.test.ts`
- Modify: `src/main.ts` (nền `outline`)
- Modify: `index.html` (nền, `theme-color`, tiêu đề, mô tả, favicon)

**Interfaces:**
- Consumes: không có.
- Produces: `PALETTE` (Hearth 32, đúng 32 khoá của §11.1: `outline`, `shadow`, `plum`, `leafDark`, `grassDark`, `leaf`, `grass`, `grassLight`, `meadow`, `soilDark`, `soil`, `path`, `sand`, `wheat`, `wheatLight`, `waterDeep`, `water`, `waterLight`, `stoneDark`, `stone`, `stoneLight`, `skin`, `skinShadow`, `cream`, `white`, `red`, `redDark`, `orange`, `gold`, `blue`, `purple`, `teal`), `type PaletteColor = keyof typeof PALETTE`, `toCss(color): string` (không đổi).

Ghi chú: sau Task 7 chỉ còn `src/main.ts` dùng khoá của bảng Ashen cũ (`PALETTE.void`); `theme.ts`, `PreloadScene.ts`, `MainMenuScene.ts` chỉ dùng `toCss`/`UI_PALETTE`. `index.html` đổi nền và `theme-color` sang `#2a1a14` (= `outline`) để không loé màu cũ trước khi canvas hiện; favicon vẽ lại thành vương miện `gold` trên nền `outline`.

- [ ] **Step 1: Viết test thất bại**

Tạo `src/data/palette.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { PALETTE, toCss } from './palette';

describe('Hearth 32 palette', () => {
  it('has exactly 32 distinct 24-bit colours', () => {
    const colors = Object.values(PALETTE);
    expect(colors).toHaveLength(32);
    expect(new Set(colors).size).toBe(32);
    for (const c of colors) {
      expect(Number.isInteger(c)).toBe(true);
      expect(c).toBeGreaterThanOrEqual(0);
      expect(c).toBeLessThanOrEqual(0xffffff);
    }
  });

  it('keeps the outline, ally blue and enemy red the spec relies on', () => {
    expect(PALETTE.outline).toBe(0x2a1a14);
    expect(PALETTE.blue).toBe(0x4a6fc8);
    expect(PALETTE.red).toBe(0xd04a3a);
    expect(PALETTE.redDark).toBe(0x8e2d2b);
  });
});

describe('toCss', () => {
  it('pads to six hex digits', () => {
    expect(toCss(PALETTE.outline)).toBe('#2a1a14');
    expect(toCss(0x00000a)).toBe('#00000a');
  });
});
```

- [ ] **Step 2: Chạy test để thấy thất bại**

Run: `npm test -- src/data/palette.test.ts < /dev/null`
Expected: FAIL — `expected undefined to be 2759188` (bảng cũ không có `outline`) và `TypeError: Cannot read properties of undefined (reading 'toString')` ở test `toCss`. (Test "32 distinct" pass cả với bảng cũ — Ashen cũng có 32 màu.)

- [ ] **Step 3: Viết lại `src/data/palette.ts`**

Thay toàn bộ file:

```ts
/**
 * "Hearth 32" — the locked world palette. Every world pixel (field, plots, buildings,
 * units, card pictures) comes from this list; UI pixels come from UI_PALETTE
 * (src/data/uiPalette.ts). See docs/ART_STYLE.md.
 *
 * Visual language: warm, medium saturation, shadows in brown–plum (never black or cold
 * violet); blue = our side, red = the enemy.
 */
export const PALETTE = {
  // Darks / outlines
  outline: 0x2a1a14,
  shadow: 0x4a2f27,
  plum: 0x6b3f5a,
  // Plants
  leafDark: 0x2f5a35,
  grassDark: 0x3f6b2a,
  leaf: 0x4a8a3f,
  grass: 0x5d9b3a,
  grassLight: 0x8cc455,
  meadow: 0xb8d86a,
  // Earth
  soilDark: 0x6b4423,
  soil: 0x9a6634,
  path: 0xc89458,
  sand: 0xe8c68a,
  // Wheat
  wheat: 0xe8b84a,
  wheatLight: 0xf6dc7a,
  // Water
  waterDeep: 0x2f6f9a,
  water: 0x4a9ac8,
  waterLight: 0x8fd0e8,
  // Stone
  stoneDark: 0x5e5a66,
  stone: 0x8c8794,
  stoneLight: 0xc2bcc4,
  // Skin, light cloth
  skin: 0xf2c49b,
  skinShadow: 0xc98a64,
  cream: 0xfaf0d7,
  white: 0xfffbf0,
  // Accents
  red: 0xd04a3a,
  redDark: 0x8e2d2b,
  orange: 0xf08a3a,
  gold: 0xf6c445,
  blue: 0x4a6fc8,
  purple: 0x8a5ab8,
  teal: 0x3aa89a,
} as const;

export type PaletteColor = keyof typeof PALETTE;

export const toCss = (color: number): string => `#${color.toString(16).padStart(6, '0')}`;
```

- [ ] **Step 4: Đổi nền game trong `src/main.ts`**

Đổi dòng

```ts
  backgroundColor: toCss(PALETTE.void),
```

thành

```ts
  backgroundColor: toCss(PALETTE.outline),
```

- [ ] **Step 5: Cập nhật `index.html`**

Thay toàn bộ file:

```html
<!doctype html>
<html lang="vi">
  <head>
    <meta charset="UTF-8" />
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover"
    />
    <meta name="theme-color" content="#2a1a14" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta
      name="description"
      content="Chín Vương Miện — roguelite xây vương quốc nhỏ và tự động đánh."
    />
    <title>Chín Vương Miện</title>
    <link
      rel="icon"
      href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 8 8' shape-rendering='crispEdges'%3E%3Crect width='8' height='8' fill='%232a1a14'/%3E%3Crect x='1' y='2' width='1' height='3' fill='%23f6c445'/%3E%3Crect x='3' y='1' width='2' height='4' fill='%23f6c445'/%3E%3Crect x='6' y='2' width='1' height='3' fill='%23f6c445'/%3E%3Crect x='1' y='5' width='6' height='2' fill='%23f6c445'/%3E%3Crect x='3' y='5' width='2' height='1' fill='%23d04a3a'/%3E%3C/svg%3E"
    />
    <style>
      html,
      body {
        margin: 0;
        padding: 0;
        width: 100%;
        height: 100%;
        overflow: hidden;
        background: #2a1a14;
        /* Stop the browser from scrolling/zooming the page on touch gestures. */
        touch-action: none;
        overscroll-behavior: none;
        -webkit-user-select: none;
        user-select: none;
        -webkit-tap-highlight-color: transparent;
      }
      #game {
        position: fixed;
        inset: 0;
      }
      #game canvas {
        display: block;
        /* Keep pixels crisp when the browser upscales on high-DPI screens. */
        image-rendering: pixelated;
      }
    </style>
  </head>
  <body>
    <div id="game"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

- [ ] **Step 6: Chạy test để thấy pass, rồi kiểm tra không còn khoá Ashen**

Run: `npm test -- src/data/palette.test.ts < /dev/null`
Expected: PASS (3 tests).

Run: `grep -rnE "PALETTE\.(void|ink|nightViolet|dusk|shadowPlum|ashGrey|boneGrey|bone|parchment|ember|flame|candle|emberDark|blood|ghostGreen|veilViolet)\b" src`
Expected: không in dòng nào.

- [ ] **Step 7: Lint, typecheck, test, build**

Run: `npm run lint < /dev/null && npm run typecheck < /dev/null && npm test < /dev/null && npm run build < /dev/null`
Expected: tất cả exit 0; 11 file, 78 test.

- [ ] **Step 8: Commit**

```bash
git add src/data/palette.ts src/data/palette.test.ts src/main.ts index.html
git commit -m "$(cat <<'EOF'
feat(art): Hearth 32 world palette, outline page background and crown favicon

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: Tài liệu cho game mới

**Files:**
- Rewrite: `docs/GDD.md`, `docs/ROADMAP.md`, `docs/ART_STYLE.md`, `CLAUDE.md`, `README.md`, `CREDITS.md`
- Modify: `package.json` (trường `description`)

**Interfaces:**
- Consumes: tên file/hàm/hằng từ Task 1–8 (tài liệu phải khớp code).
- Produces: tài liệu khớp spec G0 mục 8 (GDD tóm tắt spec, ROADMAP bảng G0–G5, ART_STYLE §11, CLAUDE.md kiến trúc mới không còn luật colony, README, mô tả `package.json`).

Ghi chú: `CREDITS.md` không có trong danh sách của spec nhưng đang ghi `bitECS` và `terrainArt.ts` (đã gỡ) — sửa cho khỏi sai, và ghi license MIT của Phaser skills trong `.claude/skills`.

- [ ] **Step 1: Viết lại `docs/GDD.md`**

Thay toàn bộ file:

````markdown
# Chín Vương Miện — Game Design Document (rút gọn)

> Bản tóm tắt sống của thiết kế. Nguồn chuẩn cho mọi con số, luật và nội dung: [spec tổng](superpowers/specs/2026-10-16-nine-crowns-design.md). Khi một cơ chế thay đổi, sửa spec trước, rồi file này, rồi code.
> Lộ trình: [ROADMAP.md](ROADMAP.md) · Quy chuẩn hình ảnh: [ART_STYLE.md](ART_STYLE.md)

## Elevator pitch

Bạn là vua của một vương quốc nhỏ trên bàn cờ 5×5. Mỗi năm rút 3 thẻ, chơi 1 thẻ — dựng trại lính, tháp cung, ruộng lúa, gắn bùa — rồi xem quân mình **tự động đánh** với đạo quân của một vua láng giềng trong 30–60 giây trên cánh đồng quanh vương quốc. Sống qua năm 30 là thắng; mất hết 3 mạng là thua.

**Thể loại:** roguelite xây vương quốc + tự động đánh · 2D pixel art · fantasy ấm áp, dễ thương (lính chibi, đồng lúa, giao diện gỗ + giấy kem kiểu Stardew Valley) · web-first, PWA. Tên tạm "Chín Vương Miện" (_Nine Crowns_); repo và package vẫn là `ashen-hollow`.

## Vòng một năm (spec §3.2)

Đầu năm (thuế, tăng trưởng, rút bài) → **Lập kế hoạch** (xem lịch và trinh sát đạo quân địch, đổi bài, mở ô, chơi đúng 1 thẻ hoặc bỏ lượt) → **Trận** tự động → Sau trận → Thưởng (thắng: chọn 1 trong 3 thẻ) → Chinh phục (thắng một vua ở lần tấn công thứ 3) → Hội đồng (năm 5, 10, 15, 20, 25: chọn 1 sắc lệnh) → Lưu.

## Các hệ thống chính

| Hệ thống                 | Tóm tắt                                                                                                                        | Spec      |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------ | --------- |
| Ván                      | 30 năm, 3 mạng, vàng (thuế, thắng trận, chinh phục, bỏ lượt); boss năm 10/20/30                                                 | §3        |
| Bàn cờ                   | 5×5, mở sẵn 3×3 giữa, Ngai ở tâm; mở thêm ô bằng vàng/sách phép/sắc lệnh; lân cận trực giao                                    | §4        |
| Thẻ                      | Ngai · Lính · Tháp · Kinh tế/Hỗ trợ · Bùa (cộng dồn) · Sách phép; chơi trùng = lên cấp (tối đa 5); hiệu ứng mô tả bằng dữ liệu  | §4–§5     |
| Vua                      | 9 vua: Lúa Mì, Đá Núi, Phép Thuật, Rừng Xanh, Thuỷ Triều, Lò Rèn, Đồng Hồ, Ánh Trăng, Du Mục — mỗi vua 1 Ngai + 9 thẻ + 3 perk | §6        |
| Kẻ địch                  | 6 vua địch mỗi ván theo lịch cố định, Thổ Phỉ, Liên Quân; ngân sách quân tăng 15%/năm; xem trước chính xác từng đợt            | §3.5–§3.6 |
| Trận                     | Mô phỏng deterministic 10 tick/s trên cánh đồng 384 px; lính sinh từ ô, tháp bắn, địch vào từ mép; một kỹ năng can thiệp       | §8        |
| Sắc lệnh, nhiệm vụ, boss | 18 sắc lệnh, 13 nhiệm vụ, 3 boss                                                                                               | §7        |
| Meta                     | Điểm Vương Miện cuối ván mở vua, perk, thẻ và độ khó Gai 0–5                                                                   | §9.1–§9.2 |
| Lưu                      | IndexedDB: ván giữa các năm + meta                                                                                             | §9.3      |

## Thắng / Thua

- **Thua trận:** Ngai về 0 máu → mất 1 mạng. **Thua ván:** hết mạng.
- **Thắng ván:** sống qua năm 30 (thắng boss 3 = "Vương Miện Vàng").

## Nguyên tắc kỹ thuật

- **Luật tách khỏi hiển thị.** `src/game` (luật), `src/data` (dữ liệu), `src/core` (hạ tầng thuần) không import Phaser hay `scenes/render/ui/platform/audio`; `src/data` không import `src/game` (ESLint chặn).
- **Deterministic.** Không `Math.random`, `Date.now`, `performance.now`, `Math.hypot/sin/cos/tan/atan2/exp/log/pow` trong `src/game`, `src/core`, `src/data`; ngẫu nhiên đi qua `Rng` + `hashSeed` theo luồng (`'draw'`, `'army'`, …). Cùng `BattleSetup` + cùng lệnh can thiệp → cùng kết quả từng bit.
- **Data-driven.** Mọi con số gameplay ở `src/data/*`.

## Trạng thái

G0 (nền UI & dọn dẹp) xong: colony sim đã xoá, hạ tầng chuyển sang `src/core`, UI kiểu Stardew (khung gỗ, tooltip), menu chính, bảng màu Hearth 32. Chưa chơi được — "Ván mới" mở ở G1. Xem [ROADMAP.md](ROADMAP.md).
````

- [ ] **Step 2: Viết lại `docs/ROADMAP.md`**

Thay toàn bộ file:

````markdown
# Lộ trình — Chín Vương Miện

Game đổi thể loại từ colony sim sang **roguelite xây vương quốc + tự động đánh**. Toàn bộ thiết kế nằm trong [spec tổng](superpowers/specs/2026-10-16-nine-crowns-design.md); spec chia thành 6 dự án con G0–G5, mỗi dự án con có plan riêng trong `docs/superpowers/plans/` và kết thúc bằng một bản chạy được. Lịch sử colony sim (Phase 0–1) vẫn còn trong git (nhánh `phase1-core-loop` được lưu trữ, không merge).

Điều kiện chung của mọi "Done khi": `npm run lint && npm run typecheck && npm test && npm run build` exit 0. Thứ tự phụ thuộc: **G0 → G1 → G2 → G3 → G4 → G5**; trong G5, âm thanh và juice có thể làm song song từ sau G2, cân bằng chỉ sau G4.

| G   | Tên                                                   | Nội dung chính                                                                                                                                                                                                     | Done khi                                                                                                                                                                  |
| --- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| G0  | Nền UI & dọn dẹp                                      | Xoá colony sim, chuyển hạ tầng sang `src/core`, gỡ `bitecs`; `UI_PALETTE` + art UI, `layout.ts`, texture `ui`, `ContentBox`/`Tooltip`, menu kiểu Stardew; bảng màu Hearth 32; ESLint deterministic; tài liệu     | Không còn file colony; không import `src/sim`; test `uiArt` + `layout` + `PALETTE` pass; menu đúng §10.2 ở 1280×720 và 375×812; ESLint chặn `phaser`/`Math.random` trong `src/game` |
| G1  | Lõi chơi được (ván ngắn 10 năm)                       | `RunState` + `applyCommand`, vòng năm, `composeArmy`, trận §8 (trừ boss), can thiệp, Vua Lúa Mì + 4 thẻ trung lập + Thổ Phỉ; `RealmScene`, `PlanningHudScene`, `BattleHudScene`, `RunEndScene` tối giản; headless + bot `random` | Chơi trọn ván 10 năm ở hai bố cục; test deterministic + benchmark pass; headless 3 seed; xem trước đạo quân khớp trận                                                     |
| G2  | Chiều sâu: bùa, lân cận, cấp, vàng, 3 vua, chinh phục | Cấp, Bùa, lân cận, vàng đầy đủ, đổi bài, mua ô; Vua Lúa Mì/Đá Núi/Phép Thuật; `KingSelectScene`, bảng Bộ bài, lịch + Trinh sát; ván 15 năm, chinh phục                                                            | Ba vua chơi tới năm 15; mỗi thẻ G2 có test; chinh phục hai vua trong một ván thử; bố cục §10.3–10.6 đúng hai kích thước                                                    |
| G3  | Ván đầy đủ: hội đồng, nhiệm vụ, boss, 30 năm, lưu ván | Lịch đầy đủ, Liên Quân, sắc lệnh, nhiệm vụ, 3 boss; dữ liệu phía địch của 6 vua còn lại; lưu ván IndexedDB, nút "Tiếp tục"                                                                                         | Headless 30 năm 3 vua × 3 seed; chơi tay qua boss 1 và một hội đồng; tải lại trang khôi phục đúng §9.3                                                                     |
| G4  | Đủ 9 vua, perk, meta-progression                      | 6 vua còn lại, 27 perk, hai thẻ trung lập meta; Điểm Vương Miện, thông thạo, mở khoá, độ khó Gai; `CrownsScene`                                                                                                    | 9 vua chơi được; Du Mục khoá đúng điều kiện; mở khoá còn sau khi tải lại trang; headless 9 vua × 3 seed                                                                   |
| G5  | Cân bằng, âm thanh, juice, mobile, đóng gói           | `tools/balance.ts` + bot `greedy`; âm thanh và nhạc sinh bằng code, juice, `SettingsScene`; safe-area, chặn kéo-làm-mới; PWA                                                                                       | Toàn bộ "Done khi" §1 của spec (tỉ lệ thắng của bot 35–65% mỗi vua, chênh lệch ≤ 15 điểm %)                                                                               |

## Kiểm thử mỗi G

- Vitest cho dữ liệu, luật và trận (spec §13.1–13.3).
- Trình duyệt: chụp màn hình các scene mới ở 1280×720 và 375×812; không chữ đè/tràn, vùng chạm ≥ 44 px, console không lỗi (spec §13.4).
````

- [ ] **Step 3: Viết lại `docs/ART_STYLE.md`**

Thay toàn bộ file:

````markdown
# Chín Vương Miện — Art Style Guide

Quy chuẩn bắt buộc cho mọi asset hình. Art tạm sinh bằng code (`src/render/*Art.ts`) cũng tuân theo file này. Nguồn chuẩn: spec tổng §11 ([2026-10-16-nine-crowns-design.md](superpowers/specs/2026-10-16-nine-crowns-design.md)).

Không khí: **fantasy ấm áp, dễ thương** — vương quốc nhỏ, lính chibi, đồng lúa, rừng cây, giao diện gỗ + giấy kem kiểu Stardew Valley.

## Kích thước

| Thứ                        | Kích thước                | Ghi chú                                                                         |
| -------------------------- | ------------------------- | ------------------------------------------------------------------------------- |
| Tile cánh đồng             | 16×16                     | Dual-grid (cỏ < cỏ hoa < đường đất < cát; ao là nước)                           |
| Ô bàn cờ                   | 32×32                     | Ô mở trống (đất xới viền cỏ), ô khoá (cỏ rậm + cọc rào + biển giá), bệ Ngai đá  |
| Công trình                 | 32×40                     | Đứng trên mép dưới ô, phần cao 8 px tràn lên ô phía Bắc (y-sort)                |
| Ngai                       | 32×48                     |                                                                                 |
| Lính nhỏ chibi             | 16×16                     | Dân quân, sói, nhện, xương…; đầu ≈ 40% chiều cao                                |
| Lính cao                   | 16×24                     | Người cầm vũ khí dài, pháp sư, kỵ binh                                          |
| Lính lớn                   | 24×24 / 24×32             | Người đá, gấu, cổ thụ, rồng sắt, khổng lồ đồng, thần chết                       |
| Boss                       | 48×48                     |                                                                                 |
| Đạn / hiệu ứng             | 4×4 – 8×8                 | Tia lửa, mũi tên (4 hướng + 4 chéo, vẽ riêng, không xoay), đá, bùn              |
| Tảng đá can thiệp          | 16×16 + bóng 24×8         |                                                                                 |
| Tranh thẻ                  | 32×24                     | Cửa sổ tranh trong `CardView`                                                   |
| Icon loại thẻ / tài nguyên | 16×16                     |                                                                                 |
| Chân dung vua              | 32×32                     | Ghép trong ô chọn vua                                                           |
| Khung thẻ (UI)             | ô nguồn 24×32, slice 8    | `card`, `cardUncommon`, `cardRare`, `cardSelected`                              |

## Bảng màu thế giới "Hearth 32"

Định nghĩa duy nhất tại `src/data/palette.ts` (`PALETTE`, có test: đúng 32 màu khác nhau). **Mọi pixel của thế giới** — cánh đồng, ô, công trình, đơn vị, tranh trong thẻ — **chỉ lấy từ bảng này.** Xuất palette `.gpl` cho Aseprite từ file này.

- **Tối / viền:** outline, shadow, plum — bóng đổ nâu–mận, không đen thuần, không tím lạnh.
- **Cây cỏ:** leafDark, grassDark, leaf, grass, grassLight, meadow. **Đất:** soilDark, soil, path, sand. **Lúa:** wheat, wheatLight.
- **Nước:** waterDeep, water, waterLight. **Đá:** stoneDark, stone, stoneLight.
- **Da, vải sáng:** skin, skinShadow, cream, white.
- **Điểm nhấn:** red, redDark, orange, gold, blue, purple, teal.

Ngôn ngữ thị giác: tông ấm, bão hoà vừa; **xanh dương = phe mình, đỏ = phe địch**. Bóng đổ elip dùng `shadow` alpha 50%. Phông nền game (`src/main.ts`) = `outline`.

## Giao diện (UI)

**Luật:** pixel UI (khung, nút, thẻ, lớp phủ trên thế giới, nền menu) chỉ lấy từ `UI_PALETTE` (`src/data/uiPalette.ts`); pixel thế giới chỉ lấy từ `PALETTE`. UI cố ý ấm và sáng (khung gỗ nâu, lõi giấy kem, chữ nâu đậm có bóng) giống Stardew Valley. Nếu sau playtest thấy chướng, chỉ đổi `UI_PALETTE`.

- Art UI sinh bằng code trong `src/render/uiArt.ts` (có test: kích thước, góc bo, chỉ màu UI), đóng gói thành texture `ui` trong `PreloadScene` (`buildUiTexture`).
- Mọi khung là **9-slice**, vẽ bằng `createPanel` (`src/ui/theme.ts`) theo kích thước logic. Viền scale nguyên lần: `uiScale = 2` khi cạnh ngắn màn hình ≥ 600 px, ngược lại `1`.
- Chữ trên nền kem: `FONT_UI`, màu `text`, bóng `textShadow` lệch (+1, +1). Vàng `gold` không dùng cho chữ trên nền kem (không đủ tương phản).
- Lớp phủ trên thế giới (ô hợp lệ/không hợp lệ, vòng ngắm, mũi tên mép) dùng `good`, `bad`, `gold` của `UI_PALETTE`.

| Frame                                                    | Ô nguồn | Góc (slice) | Viền (border) | Dùng cho                                                     |
| -------------------------------------------------------- | ------- | ----------- | ------------- | ------------------------------------------------------------ |
| `panel`                                                  | 24×24   | 8           | 6             | Bảng logo, panel HUD, bảng phụ                               |
| `button` / `buttonHover` / `buttonDown` / `buttonActive` | 16×16   | 5           | 4             | Nút; hover lõi sáng, bấm lõm, đang bật viền vàng             |
| `slot` / `slotHover` / `slotSelected`                    | 18×18   | 4           | 2 / 2 / 3     | Ô lịch, ô chọn vua; đang chọn viền đỏ `select` 2 px          |
| `tooltip`                                                | 12×12   | 4           | 2             | Tooltip, toast, dòng hướng dẫn                               |
| `bar`                                                    | 8×6     | 2           | 1             | Khung thanh (HP Ngai, thông thạo)                            |
| `clockDial` (không giãn)                                 | 28×28   | —           | —             | Mặt đồng hồ (dự phòng, chưa dùng ở G0)                       |
| `firefly` (không giãn)                                   | 3×3     | —           | —             | Đom đóm menu                                                 |

Khung thẻ theo độ hiếm (thêm vào texture `ui` từ G1): thường = viền `wood`; vừa = viền đôi `woodLight`; hiếm = viền trong `gold`; đang chọn = viền ngoài `select` 2 px.

**Menu chính:** trời 4 dải `UI_PALETTE.sky` nối bằng dither 2×2, 3 lớp đồi/cây silhouette (`woodDark` → `text` → `outline`, xa → gần) trôi parallax 4/8/16 px/s, cỡ pixel nguyên `menuPixelScale`.

## Quy tắc vẽ

- Ánh sáng từ **trên-trái**: viền trên-trái sáng hơn, viền dưới-phải tối hơn.
- Không anti-aliasing, không gradient mượt; dither thưa nếu cần chuyển tông.
- Đơn vị vẽ bằng `paintBitmap` với ký tự màu cố định: `c` = màu vải → màu chủ của vua; `o` = viền → `outline` (phe mình) hoặc `redDark` (phe địch, kèm 1 pixel cờ `red`). Atlas sinh hai biến thể `unit_<id>_ally` và `unit_<id>_foe`.
- Hoạt ảnh: idle 2 frame, đi 2 frame (nhún 1 px), đánh 2 frame; 6–8 fps idle/đi, 10–12 fps đánh.
- **Không xoay sprite**; lật ngang để quay trái/phải được phép. **Neo ở chân** (origin 0.5, 1) và xếp chiều sâu theo y của chân (y-sort).
- Chi tiết 1 px trên tile phải thưa (≤ 10% diện tích) để đơn vị đứng trên vẫn đọc được.

## Hiển thị

- Game chạy `pixelArt: true` (nearest-neighbour) và **zoom số nguyên** (vương quốc: zoom 2; trận: `max(1, floor(min(width, height + 96) / 384))`). Không bao giờ scale lẻ.

## Pipeline art sinh bằng code

- Giữ `PixelCanvas`/`pixelHash` (`pixel.ts`), `paintBitmap` (`bitmap.ts`), `dualGrid.ts`. Module mới (thuần TS, có test màu) đến từ G1: `fieldArt.ts`, `plotArt.ts`, `buildingArt.ts`, `unitArt.ts`, `cardArt.ts` (chỉ `UI_PALETTE`), `iconArt.ts`, `fxArt.ts`, `portraitArt.ts`.
- `atlas.ts` dựng texture `ui` (G0), `field-tiles` và `sprites` (một atlas cho mọi sprite thế giới, từ G1), frame theo tên: `building_<cardId>`, `unit_<id>_<team>_<anim><n>`, `card_art_<cardId>`, `icon_<id>`, `fx_<id>`.

## Ranh giới thay art thật

Mọi chỗ dùng sprite chỉ gọi frame theo tên qua các hàm `*Frame(...)` trong `atlas.ts`. Thay bằng atlas Aseprite = xuất atlas với **cùng tên frame** (`.aseprite` → spritesheet + JSON → `public/assets/atlases/`), nạp trong `PreloadScene` dưới cùng key; không sửa scene. Riêng UI: nạp dưới key `ui` thay cho `buildUiTexture`, rồi sửa `UI_FRAMES` (kích thước, slice, border).

## Nguồn asset tạm

Pack CC0/CC-BY từ itch.io, Kenney, OpenGameArt — ghi vào `CREDITS.md` kèm license. AI chỉ dùng cho moodboard/concept, không dùng làm sprite cuối.
````

- [ ] **Step 4: Viết lại `CLAUDE.md`**

Thay toàn bộ file:

````markdown
# CLAUDE.md

Guidance for AI coding assistants working in this repo.

## Project

Chín Vương Miện (_Nine Crowns_, working title; repo/package `ashen-hollow`) — a kingdom-building roguelite auto-battler: each year draw 3 cards, play 1 onto a 5×5 kingdom board, then watch your army fight a neighbouring king automatically. Phaser 4 + TypeScript (strict) + Vite + Vitest, generated pixel art, Stardew-style UI, web-first. The binding design is `docs/superpowers/specs/2026-10-16-nine-crowns-design.md` (Vietnamese), split into sub-projects G0–G5, each with its own plan in `docs/superpowers/plans/`. Summary docs: `docs/GDD.md`, `docs/ART_STYLE.md`, `docs/ROADMAP.md` (check it before starting a feature).

## Commands

```bash
npm run dev        # Vite dev server :5173
npm test           # Vitest (src/**/*.test.ts)
npm run lint       # ESLint
npm run typecheck  # tsc --noEmit
npm run build      # typecheck + production build
```

Run `npm run lint && npm run typecheck && npm test && npm run build` before calling work done. In Git Bash on Windows, run npm/npx with `< /dev/null` or they can hang.

## Architecture rules

- **Layers** (spec §12.1): `src/core` (pure infra: `EventBus`/`GameEvents`, `Rng`/`hashSeed`, `SimClock`, `SpatialHash`, `geom`, `noise`), `src/data` (values and types only), `src/game` (rules: run, cards, battle, save), `src/render` (generated art + Phaser renderers), `src/ui` (theme, shared widgets, HUD parts), `src/scenes`, `src/platform`, `src/audio`.
- **`src/game`, `src/data`, `src/core` must not import Phaser or `scenes/render/ui/platform/audio`; `src/data` must not import `src/game`** (ESLint `no-restricted-imports`, spec §12.4). Test files there obey the same rules.
- **Determinism** (spec §8.12): `src/game`, `src/data`, `src/core` never use `Math.random`, `Date.now`, `performance.now`, `Math.hypot/sin/cos/tan/atan2/exp/log/pow` (ESLint `no-restricted-properties`); only `+ − × ÷` and `Math.sqrt/floor/ceil/round/min/max/abs`. Randomness goes through `Rng` (`src/core/random.ts`) seeded per stream with `hashSeed`; the battle uses no `Rng` at all (ties broken by id/plot). Never let `Map`/`Set` iteration order decide a simulation result — sort by id first. Battles advance in `SimClock` fixed ticks (10/s).
- **Data-driven:** every gameplay number lives in `src/data/*`.
- **Logic ↔ UI:** render/UI/scenes only read state and send intents through the typed `EventBus` (`src/core/events.ts`). Scenes launched with `scene.launch` start next frame — pass initial state in launch data, don't rely on events emitted in `create`.
- **Phaser scene instances are reused** across restarts: reset per-game fields at the top of `create()`.
- **Pixel art:** world colours only from `PALETTE` (Hearth 32, `src/data/palette.ts`); UI colours (frames, cards, overlays, menu backdrop) only from `UI_PALETTE` (`src/data/uiPalette.ts`) — see `docs/ART_STYLE.md`. Integer camera zoom only; sprites anchored at their feet and depth-sorted by that y; never rotate sprites (horizontal flip is fine). Sprites are referenced only by frame name (spec §11.4).
- **UI:** frames are nine-slices from the generated `ui` texture referenced by name (`UI_FRAMES` in `src/render/uiArt.ts`); size them in logical px with `createPanel` (`src/ui/theme.ts`), never with raw `Rectangle` backgrounds. Buttons come from `createButton`, tooltips from `Tooltip` (hover, or 400 ms long-press on touch), self-sizing boxes from `ContentBox`. Pure UI maths lives in `src/ui/hud/layout.ts` and `src/ui/menuLayout.ts` (tested). Every touch target is ≥ 44×44 logical px; recompute positions in `layout()` on resize; "desktop" = 1280×720, "mobile" = 375×812, `width ≥ 768` uses the desktop layout.
- **HUD text:** use `FONT_UI` — it must cover Vietnamese precomposed glyphs (Georgia does not). Player-facing text is Vietnamese; ids in code are English.

## Phaser 4 notes

Official Phaser 4 agent skills live in `.claude/skills/*/SKILL.md` (also shipped in `node_modules/phaser/skills/`) — v3→v4 migration, cameras, input, tilemaps, sprites (NineSlice)… Read those instead of relying on Phaser 3 knowledge, and check signatures in `node_modules/phaser/types/phaser.d.ts`. Notable: `roundPixels` defaults false (set via `pixelArt: true`), FX/masks are now filters, `Geom.Point` → `Vector2`, `TileSprite` was rewritten (no texture cropping, supports atlas frames).

## Dev server gotcha (Windows)

Vite's watcher can read a file before the write finishes and serve stale code; `vite.config.ts` sets `server.watch.awaitWriteFinish`. If the browser still shows old behaviour, restart `npm run dev`. Note the served module is transformed (`0.5` → `.5`), so don't grep it for exact literals.
````

- [ ] **Step 5: Viết lại `README.md`**

Thay toàn bộ file:

````markdown
# Chín Vương Miện

Roguelite xây vương quốc + tự động đánh, 2D pixel art, web-first. Tên tạm _Nine Crowns_; repo và package vẫn là `ashen-hollow`.

> Một vương quốc nhỏ, chín ngai vàng. Mỗi năm chơi một thẻ, rồi xem quân mình tự đánh.

## Chạy thử

```bash
npm install
npm run dev        # http://localhost:5173 (cũng mở được từ điện thoại cùng mạng LAN)
```

| Lệnh                | Việc                                                                         |
| ------------------- | ---------------------------------------------------------------------------- |
| `npm run dev`       | Dev server (Vite)                                                            |
| `npm run build`     | Type check + build production vào `dist/`                                    |
| `npm run preview`   | Chạy thử bản build                                                           |
| `npm test`          | Unit test (Vitest)                                                           |
| `npm run lint`      | ESLint (gồm luật cấm `game/`, `data/`, `core/` import Phaser hay dùng hàm không deterministic) |
| `npm run typecheck` | `tsc --noEmit`                                                               |

## Điều khiển

Hiện mới có menu chính: nút **Ván mới** đang hiện "Sắp có" (mở ở G1). Bảng phím tắt của vương quốc và trận nằm trong spec §10.4 và §10.7 và sẽ được ghi vào đây khi các màn đó có.

## Kiến trúc

```
src/
  core/       Hạ tầng thuần: EventBus, Rng/hashSeed, SimClock, SpatialHash, geom, noise — không phụ thuộc Phaser
  data/       Dữ liệu và kiểu: bảng màu thế giới Hearth 32, bảng màu UI (từ G1: vua, thẻ, đơn vị, hằng số ván/trận)
  game/       Luật: trận (separation trong battle/steering.ts; từ G1: ván, thẻ, trận đầy đủ, lưu) — deterministic, không Phaser
  render/     Art sinh bằng code (pixel, bitmap, dual-grid, art UI) và texture atlas
  ui/         Theme (khung 9-slice, nút gỗ), ContentBox, Tooltip, logic bố cục thuần
  scenes/     Boot → Preload → MainMenu (từ G1: KingSelect, Realm + HUD, RunEnd…)
docs/         GDD, ART_STYLE, ROADMAP, spec và plan (docs/superpowers)
```

Nguyên tắc: **luật tách khỏi hiển thị**, tick cố định 10/s, deterministic theo seed. Chi tiết ở [docs/GDD.md](docs/GDD.md) và [spec tổng](docs/superpowers/specs/2026-10-16-nine-crowns-design.md).

## Tài liệu

- [docs/GDD.md](docs/GDD.md) — thiết kế game rút gọn
- [docs/ART_STYLE.md](docs/ART_STYLE.md) — quy chuẩn pixel art, bảng màu Hearth 32, UI kiểu Stardew
- [docs/ROADMAP.md](docs/ROADMAP.md) — dự án con G0–G5

## Trạng thái

- [x] **G0** — nền UI & dọn dẹp: xoá colony sim, hạ tầng chuyển sang `src/core`, UI kiểu Stardew, menu chính, bảng màu Hearth 32, ESLint deterministic.
- [ ] **G1** — lõi chơi được (ván ngắn 10 năm).
- [ ] **G2** — bùa, lân cận, cấp, vàng, 3 vua, chinh phục.
- [ ] **G3** — ván đầy đủ 30 năm: hội đồng, nhiệm vụ, boss, lưu ván.
- [ ] **G4** — đủ 9 vua, perk, meta-progression.
- [ ] **G5** — cân bằng, âm thanh, juice, mobile, PWA.

Lịch sử colony sim (Phase 0–1) vẫn còn trong git, nhánh `phase1-core-loop`.
````

- [ ] **Step 6: Viết lại `CREDITS.md`**

Thay toàn bộ file:

````markdown
# Credits

## Code & tools

- [Phaser](https://phaser.io) — MIT
- Phaser 4 agent skills in `.claude/skills/` — from [phaserjs/phaser](https://github.com/phaserjs/phaser), MIT (see `.claude/skills/PHASER-LICENSE.md`)

## Art & audio

All current art is procedurally generated placeholder art (`src/render/*Art.ts`).
Add every third-party asset here with its author, source URL and license (CC0 / CC-BY …) when it is imported.
````

- [ ] **Step 7: Đổi mô tả trong `package.json`**

Đổi dòng

```json
  "description": "Dark fantasy colony builder — 2D pixel art, free placement, web-first.",
```

thành

```json
  "description": "Nine Crowns (Chín Vương Miện) — kingdom-building roguelite auto-battler, 2D pixel art, web-first.",
```

- [ ] **Step 8: Căn bảng và kiểm tra tài liệu không còn nhắc code đã xoá**

Run: `npx prettier --write docs/GDD.md docs/ROADMAP.md docs/ART_STYLE.md CLAUDE.md README.md CREDITS.md < /dev/null`
Expected: prettier in 6 dòng tên file, exit 0.

Run: `grep -nE "bitECS|bitecs|src/sim|colonist|terrainArt|HudScene|WorldScene|Ashen 32" docs/GDD.md docs/ROADMAP.md docs/ART_STYLE.md CLAUDE.md README.md CREDITS.md package.json`
Expected: không in dòng nào (ROADMAP/README/GDD chỉ nhắc lịch sử bằng cụm "colony sim", không chứa các từ khoá trên).

- [ ] **Step 9: Lint, typecheck, test, build**

Run: `npm run lint < /dev/null && npm run typecheck < /dev/null && npm test < /dev/null && npm run build < /dev/null`
Expected: tất cả exit 0.

- [ ] **Step 10: Commit**

```bash
git add docs/GDD.md docs/ROADMAP.md docs/ART_STYLE.md CLAUDE.md README.md CREDITS.md package.json
git commit -m "$(cat <<'EOF'
docs: rewrite GDD, roadmap, art style, CLAUDE.md and README for Nine Crowns

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: Kiểm tra toàn bộ G0 (lệnh + trình duyệt)

**Files:**
- Không tạo/sửa file nào nếu mọi bước đạt. Nếu một bước không đạt: sửa ở file của task sở hữu, chạy lại bước đó và lệnh ở Step 1, rồi commit bằng `git add <đường dẫn cụ thể>` với message `fix(...): …` kết thúc bằng dòng `Co-Authored-By` như các task trên.

**Interfaces:**
- Consumes: toàn bộ Task 1–9; trường runtime của `MainMenuScene` (`logo`, `title`, `subtitle`, `footer`, `buttons`, `fireflies`) và `window.game` (chỉ có ở dev).
- Produces: bằng chứng "Done khi" của G0 (§14).

- [ ] **Step 1: Bốn lệnh**

Run: `npm run lint < /dev/null && npm run typecheck < /dev/null && npm test < /dev/null && npm run build < /dev/null`
Expected: cả bốn exit 0; Vitest 11 file, 78 test pass (gồm `uiArt.test.ts`, `layout.test.ts`, `palette.test.ts`).

- [ ] **Step 2: Không còn file nào của §12.3, không import `src/sim`, không `bitecs`**

Run:

```bash
for f in src/sim src/data/buildings.ts src/data/colonists.ts src/data/doodads.ts src/data/names.ts \
  src/data/resources.ts src/data/terrain.ts src/data/data.test.ts src/render/ColonistRenderer.ts \
  src/render/DebugOverlay.ts src/render/DesignationMarkers.ts src/render/EntityRenderer.ts \
  src/render/PlacementPreview.ts src/render/TerrainRenderer.ts src/render/WallPreview.ts \
  src/render/terrainArt.ts src/platform/CameraController.ts src/scenes/WorldScene.ts src/scenes/HudScene.ts; do
  if [ -e "$f" ]; then echo "STILL THERE: $f"; fi
done; echo "deleted-files check done"
grep -rnE "from '(\./|\.\./)+sim/" src || echo "no imports of src/sim"
grep -n "bitecs" package.json package-lock.json || echo "no bitecs"
ls src/core
```

Expected: chỉ in `deleted-files check done`, `no imports of src/sim`, `no bitecs`; `ls src/core` liệt kê `events.test.ts events.ts geom.test.ts geom.ts noise.ts random.ts SimClock.test.ts SimClock.ts SpatialHash.test.ts SpatialHash.ts`.

- [ ] **Step 3: ESLint vẫn chặn `phaser` và `Math.random` trong `src/game` (file tạm rồi xoá)**

```bash
cat > src/game/__eslint_probe.ts <<'EOF'
import Phaser from 'phaser';

export const probe = (): number => Math.random() + Phaser.Math.Between(0, 1);
EOF
npx eslint src/game/__eslint_probe.ts < /dev/null; echo "exit $?"
rm src/game/__eslint_probe.ts
git status --short
```

Expected: 2 lỗi (`'phaser' import is restricted…`, `'Math.random' is restricted…`), `exit 1`; sau khi xoá, `git status --short` không in gì.

- [ ] **Step 4: Trình duyệt — desktop 1280×720**

Chạy `npm run dev` (nền; hoặc công cụ preview với cấu hình chạy `npm run dev`, cổng 5173 — không commit file cấu hình), mở `http://localhost:5173` ở viewport 1280×720.

1. Chụp màn hình menu: trời dither, 3 lớp đồi trôi, bảng gỗ "Chín Vương Miện" + "Một vương quốc nhỏ, chín ngai vàng", một nút "Ván mới — Sắp có" mờ, `v0.0.1` ở đáy, đom đóm; không chữ nào đè nhau.
2. Đo bố cục trong console:

```js
(() => {
  const s = game.scene.getScene('MainMenu');
  const { width, height } = s.scale;
  const r = (o) => {
    const b = o.getBounds();
    return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) };
  };
  const parts = { logo: r(s.logo.image), title: r(s.title), subtitle: r(s.subtitle), footer: r(s.footer) };
  s.buttons.forEach((b, i) => (parts[`button${i}`] = r(b.container)));
  const off = Object.entries(parts)
    .filter(([, p]) => p.x < 0 || p.y < 0 || p.x + p.w > width || p.y + p.h > height)
    .map(([k]) => k);
  const hit = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  const boxes = ['logo', 'footer', ...s.buttons.map((_, i) => `button${i}`)];
  const overlaps = [];
  for (let i = 0; i < boxes.length; i++)
    for (let j = i + 1; j < boxes.length; j++)
      if (hit(parts[boxes[i]], parts[boxes[j]])) overlaps.push(`${boxes[i]} x ${boxes[j]}`);
  const l = parts.logo;
  const outsideLogo = ['title', 'subtitle'].filter((k) => {
    const p = parts[k];
    return p.x < l.x || p.y < l.y || p.x + p.w > l.x + l.w || p.y + p.h > l.y + l.h;
  });
  return { width, height, off, overlaps, outsideLogo, button0: parts.button0, uiScale: s.logo.image.scaleX };
})()
```

Expected: `off: []`, `overlaps: []`, `outsideLogo: []`, `button0.w = 200`, `button0.h = 52`, `uiScale: 2`.

3. Nút bị vô hiệu (Review Focus 3): `game.scene.getScene('MainMenu').buttons[0].container.alpha` → `0.55`; `game.scene.getScene('MainMenu').buttons[0].container.list[0].input.enabled` → `false`. Rê chuột lên nút: frame không đổi, con trỏ không thành bàn tay. Bấm nút: `game.scene.getScenes(true).map((x) => x.scene.key)` vẫn là `['MainMenu']`.
4. Vùng chạm: mọi object đang bật input và đang hiện phải ≥ 44×44:

```js
(() => {
  const s = game.scene.getScene('MainMenu');
  const out = [];
  const walk = (o) => {
    if (o.list) o.list.forEach(walk);
    const shown = o.visible && (!o.parentContainer || o.parentContainer.visible);
    if (o.input && o.input.enabled && shown) {
      const b = o.getBounds();
      if (b.width < 44 || b.height < 44) out.push([o.type, Math.round(b.width), Math.round(b.height)]);
    }
  };
  s.children.list.forEach(walk);
  return out;
})()
```

Expected: `[]` (G0 chưa có nút nào bật).

5. Khởi động lại scene (G1 sẽ quay về menu): chạy `game.scene.getScene('MainMenu').scene.restart()` hai lần, đợi 1 s, rồi `game.scene.getScene('MainMenu').fireflies.length` → `24` và `game.scene.getScene('MainMenu').children.list.filter((o) => o.type === 'Image').length` → `24`; console không có lỗi/cảnh báo texture trùng key.
6. Kéo qua ngưỡng 600 px (Review Focus 2): đổi viewport 1280×720 → 599×800 → 600×800 → 1280×720; sau mỗi lần chạy lại đoạn đo ở mục 2. Expected: `off`, `overlaps`, `outsideLogo` luôn rỗng; `uiScale` = `1` ở 599×800, `2` ở 600×800, `2` khi về 1280×720.
7. Console trình duyệt không có lỗi.

- [ ] **Step 5: Trình duyệt — mobile 375×812 và màn ngang**

Đổi viewport sang 375×812 (giả lập cảm ứng), tải lại trang.

1. Chụp màn hình menu: bảng logo vừa ngang màn hình (không bị cắt), phụ đề xuống dòng nếu cần, nút ở giữa, footer ở đáy.
2. Chạy lại đoạn đo bố cục ở Step 4.2. Expected: `off: []`, `overlaps: []`, `outsideLogo: []`, `uiScale: 1`.
3. Bấm (chạm) nút "Ván mới — Sắp có" và bấm giữ 600 ms rồi nhả: không chuyển scene, không tooltip hiện/kẹt, console không lỗi.
4. Chạy lại đoạn đo vùng chạm ở Step 4.4. Expected: `[]`.
5. Đổi viewport sang 812×375 (điện thoại xoay ngang), tải lại, chạy lại đoạn đo bố cục (Review Focus 1). Expected: `off`, `overlaps`, `outsideLogo` rỗng.
6. Console không lỗi. Trả viewport về mặc định khi xong.

- [ ] **Step 6: Trạng thái cuối**

Run: `git status --short && git log --oneline -10`
Expected: `git status --short` không in gì; log có 9 commit của Task 1–9 (cộng commit `fix(...)` nếu Step 1–5 phải sửa).

---

## Tự rà soát (đối chiếu spec §14 G0)

| Yêu cầu G0 | Task |
|---|---|
| 1. Xoá §12.3, chuyển hạ tầng §12.2 (gồm separation → `steering.ts`), gỡ `bitecs`, menu chỉ có "Ván mới" vô hiệu ("Sắp có") | Task 1 (menu tạm), Task 7 (menu thật) |
| 2. UI plan Task 1 nguyên văn | Task 3 |
| 3. UI plan Task 2 rút gọn (đúng danh sách giữ/bỏ) | Task 4 |
| 4. UI plan Task 3; nhãn "Đang dựng vương quốc…" | Task 5 |
| 5. UI plan Task 4 | Task 6 |
| 6. UI plan Task 9 với §10.2 | Task 7 |
| 7. Hearth 32, `main.ts` nền `outline` | Task 8 |
| 8. ESLint §12.4; GDD, ROADMAP, ART_STYLE, CLAUDE.md, README, mô tả `package.json` | Task 2, Task 9 |
| Done: không còn file §12.3; không import `src/sim`; test `uiArt` + `layout` + `PALETTE` 32 màu; menu §10.2 hai bố cục, console sạch; ESLint chặn `phaser`/`Math.random` trong `src/game` bằng file tạm | Task 10 (Step 1–5), Task 2 (Step 1–5) |

Số test theo từng mốc (để implementer đối chiếu): Task 1 → 34, Task 3 → 43, Task 4 → 64, Task 7 → 75, Task 8 → 78.
