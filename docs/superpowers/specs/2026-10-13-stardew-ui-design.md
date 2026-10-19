# UI kiểu Stardew Valley (Design Spec)

- **Ngày:** 2026-10-13
- **Trạng thái:** chờ duyệt
- **Liên quan:** [ART_STYLE.md](../../ART_STYLE.md) · [Phase 1 spec](2026-10-08-phase1-core-loop-design.md) §7 (HUD hiện tại)
- **Điều kiện bắt đầu:** Phase 1 (`phase1-core-loop`) đã review xong và merge. Spec này làm lại HUD được viết ở Phase 1 Task 14.

## 1. Mục tiêu & tiêu chí hoàn thành

Thay giao diện "panel mực tối + chữ serif" hiện tại bằng giao diện **giống hẳn Stardew Valley**: khung gỗ nâu dày, lõi giấy kem, chữ nâu đậm có bóng, hotbar ô vuông dưới giữa, hộp đồng hồ góc phải trên, tooltip giấy kem, thông báo dạng toast. Thế giới game (địa hình, cây, công trình, colonist) **không đổi**.

**Done khi:**

1. Mọi phần HUD, menu chính, tooltip và toast vẽ bằng texture UI sinh bằng code (§4), không còn `Rectangle` mực tối nào làm nền UI.
2. Bố cục đúng §5 trên desktop 1280×720 và mobile 375×812: không chữ nào đè nhau, không phần nào tràn khỏi màn hình, mọi vùng chạm ≥ 44×44 px.
3. Mọi chức năng HUD của Phase 1 vẫn chạy y như cũ: tốc độ, zoom, đổi tab Lệnh/Xây, chọn công cụ Q/E/R/T/F, chọn công trình, snap, ✓/✕ trên mobile, bấm thẻ colonist để camera theo, thông tin dưới con trỏ, thông báo sự kiện.
4. `npm run lint && npm run typecheck && npm test && npm run build` đều exit 0; test mới cho `uiArt` (§9) pass.

**Ngoài phạm vi:**
- Đổi font: giữ `FONT_UI` hiện tại; font pixel tiếng Việt là việc riêng sau này.
- Bảng colonist chi tiết, cây công nghệ, inventory: chưa có chức năng nên chưa có UI.
- Âm thanh UI.
- Art vẽ tay: spec này chỉ làm art sinh bằng code, nhưng thiết kế sao cho sau này thay bằng file Aseprite chỉ phải sửa một module (§4.4).

## 2. Quyết định đã chốt (từ brainstorming)

| Câu hỏi | Chọn |
|---|---|
| Giống Stardew ở mức nào | **Giống hẳn**: tông ấm, gỗ nâu, giấy kem (không pha tông dark fantasy vào UI) |
| Phạm vi | HUD trong game · Menu chính · Tooltip & toast. **Không** đổi font. |
| Nguồn art | **Sinh bằng code** (người dùng đã cân nhắc pack Sprout Lands free nhưng license chỉ phi thương mại, nên chọn tự sinh để không vướng license) |
| Bảng màu | UI có **bảng màu riêng**; bảng "Ashen 32" của thế giới giữ nguyên |

## 3. Bảng màu UI (`src/data/uiPalette.ts`)

UI là **ngoại lệ có chủ đích** của luật "mọi pixel lấy từ Ashen 32": UI ấm và sáng để tương phản với thế giới u tối, giống cách Stardew đặt khung gỗ lên mọi cảnh. `ART_STYLE.md` được cập nhật để ghi luật mới: *pixel UI lấy từ `UI_PALETTE`, pixel thế giới lấy từ `PALETTE`.*

```ts
export const UI_PALETTE = {
  outline: 0x2b1408,   // viền ngoài cùng, gần đen nâu
  woodDark: 0x5b2c0f,  // bóng gỗ, rãnh vân
  wood: 0xb5651d,      // thân gỗ
  woodLight: 0xe0a050, // gờ sáng, highlight vân
  cream: 0xf5deb3,     // lõi panel
  creamDark: 0xd9b77a, // bóng trong lõi, viền ô hotbar
  creamLight: 0xfff4dc,// lõi tooltip, ô đang hover
  text: 0x3b1d0a,      // chữ chính
  textShadow: 0xd9b77a,// bóng chữ (lệch +1,+1) trên nền kem
  gold: 0xf2c94c,      // số tài nguyên, sao
  select: 0xd03a2c,    // viền ô hotbar đang chọn (đỏ kiểu Stardew)
  good: 0x5a9e3a,      // thanh nhu cầu đầy
  warn: 0xe08a1e,      // thanh nhu cầu thấp
  bad: 0xb8322a,       // thanh nhu cầu nguy hiểm, lỗi đặt
  sky: [0xf6b26b, 0xf08a5d, 0xb85c7a, 0x6b4a8a], // gradient trời menu, trên → dưới
} as const;
```

## 4. Art UI sinh bằng code

### 4.1 Module `src/render/uiArt.ts` (thuần TS, không Phaser, có test)

Theo đúng mẫu của `terrainArt.ts`: mỗi hàm `paintX(canvas: PixelCanvas, ox, oy)` vẽ pixel vào `PixelCanvas`, chỉ dùng màu từ `UI_PALETTE`.

Mỗi khung là một **ô nguồn 9-slice** có kích thước và độ dày góc cố định:

| Frame | Ô nguồn | Góc (slice) | Mô tả |
|---|---|---|---|
| `panel` | 24×24 | 8 | Viền `outline` 1 px → gỗ 4 px (gờ trên/trái `woodLight` 1 px, thân `wood`, vân `woodDark` dạng đoạn ngang 2–4 px theo `pixelHash`, bóng dưới/phải `woodDark` 1 px) → rãnh `woodDark` 1 px → lõi `cream`, 1 px bóng trong `creamDark` ở mép trên/trái lõi. Góc bo: bỏ 2 pixel ở mỗi góc ngoài (trong suốt). |
| `button` | 16×16 | 5 | Như `panel` nhưng gỗ 2 px, lõi `cream` |
| `buttonHover` | 16×16 | 5 | Lõi `creamLight` |
| `buttonDown` | 16×16 | 5 | Lõi `creamDark`, gờ sáng chuyển xuống dưới/phải (cảm giác lõm) |
| `buttonActive` | 16×16 | 5 | Như `button`, thêm viền trong `gold` 1 px |
| `slot` | 18×18 | 4 | Ô hotbar: viền `woodDark` 1 px, mép trong `creamDark` 1 px, lõi `cream`, không có gỗ dày |
| `slotSelected` | 18×18 | 4 | Như `slot`, viền ngoài thay bằng `select` dày 2 px |
| `tooltip` | 12×12 | 4 | Viền `outline` 1 px, mép `woodDark` 1 px, lõi `creamLight`; mỏng và nhẹ hơn panel |
| `bar` | 8×6 | 2 | Khung thanh nhu cầu: viền `outline`, lõi `woodDark` (phần trống) |

Ngoài khung còn có hai mảnh trang trí vẽ không giãn:
- `clockDial` 28×28: đĩa nửa tròn gỗ có mặt trời/trăng nhỏ, dùng trong hộp đồng hồ (§5.1).
- `firefly` 3×3: chấm `gold` có quầng `woodLight`, dùng cho menu chính (§6).

### 4.2 Texture & atlas

- Thêm `UI_KEY = 'ui'` trong `src/render/atlas.ts`. `buildUiTexture(scene)` gọi các hàm `paint*` vào một `PixelCanvas` riêng rồi `addCanvas` thành texture `ui` với frame theo tên ở bảng §4.1, đặt trong `PreloadScene` cạnh các texture hiện có.
- Icon tài nguyên/công cụ/công trình **dùng lại** frame của texture `sprites` hiện tại (`iconFrame`, `buildingFrame`); không vẽ icon mới.

### 4.3 Vẽ lên màn hình

- Mọi khung dùng `scene.add.nineslice(x, y, UI_KEY, frame, w, h, slice, slice, slice, slice)`.
- **Scale viền nguyên lần:** `uiScale = 2` khi `min(width, height) ≥ 600`, ngược lại `1`; tính lại khi `resize`. `uiScale` chỉ quyết định độ dày pixel của viền: nineslice được tạo với kích thước `logic / uiScale` rồi `setScale(uiScale)`. Kích thước logic (px màn hình) của mọi nút/ô trong spec này là cố định và luôn ≥ 44 px, không phụ thuộc `uiScale`.
- Chữ: `FONT_UI`, màu `UI_PALETTE.text`, bóng `setShadow(1, 1, textShadow, 0, false, true)`. Số tài nguyên dùng màu `text` trên lõi kem (vàng `gold` chỉ dùng có viền `outline` trong hộp đồng hồ, vì vàng trên kem không đủ tương phản).

### 4.4 Ranh giới để sau này thay art vẽ tay

Mọi chỗ dùng UI chỉ gọi frame theo **tên** (`'panel'`, `'slotSelected'`…) qua `UI_KEY` và đọc độ dày slice từ một bảng hằng `UI_FRAMES: Record<UiFrame, { w; h; slice }>` xuất từ `uiArt.ts`. Thay bằng atlas Aseprite = nạp file atlas với cùng tên frame + sửa bảng `UI_FRAMES`; không phải sửa HUD.

## 5. Bố cục HUD (`HudScene`)

`MARGIN = 10` px từ mép màn hình. Mọi toạ độ tính lại trong `layout()` khi resize (giữ cơ chế hiện có).

### 5.1 Hộp đồng hồ — phải trên
- Panel `panel` ~ 150×74 px logic. Bên trái là `clockDial`; bên phải hai dòng chữ:
  - `Ngày {n}` với `n = floor(tick / DAY_TICKS) + 1`.
  - Giờ trong ngày `HH:MM` với ngày bắt đầu 06:00: `minutes = (tick % DAY_TICKS) / DAY_TICKS * 1440 + 360`, lấy mod 1440. Cập nhật mỗi khi phút hiển thị đổi (không set text mỗi frame).
  - Kim/mặt trời trên `clockDial` quay theo tỉ lệ thời gian trong ngày.
- Ngay dưới, cùng chiều rộng: hàng 4 nút `button` ❚❚ / 1× / 2× / 3×; tốc độ đang chạy dùng `buttonActive`.

### 5.2 Hộp tài nguyên — dưới hộp đồng hồ
- Panel cùng chiều rộng, mỗi tài nguyên một dòng: icon (frame `sprites` hiện có) + tên + số căn phải. Thứ tự theo `RESOURCE_IDS`.
- Khi số thay đổi: chữ số nảy nhẹ (tween scale 1 → 1.2 → 1 trong 150 ms).

### 5.3 Hotbar — dưới giữa
- Một panel `panel` chứa một hàng ô `slot` vuông **48 px logic**, cách nhau 4 px, căn giữa ngang.
- Ô đầu là nút đổi tab (nhãn "Lệnh"/"Xây" như hiện tại), ngăn với các ô còn lại bằng vạch `woodDark` 2 px.
- **Tab Lệnh:** Chặt (Q) · Đào (E) · Hái (R) · Bỏ đánh dấu (T) · Tường (F). **Tab Xây:** các công trình `playerBuildable` theo thứ tự `BUILDING_IDS` (trừ `wallStake`, vì Tường đã ở tab Lệnh), mỗi ô có phím tắt nếu có `hotkey`.
- Trong ô: icon ở giữa (scale nguyên lần lớn nhất vừa 32 px), phím tắt ở góc trái trên (chữ 11 px), giá ở góc phải dưới cho công trình (chỉ số tổng tài nguyên chính, đầy đủ ở tooltip).
- Ô đang chọn dùng `slotSelected`; hover dùng lõi `creamLight` (đổi frame sang biến thể hover tạm thời, không tween).
- Mobile: nếu hotbar rộng hơn `width − 2·MARGIN` thì giảm khoảng cách về 2 px, sau đó giảm ô xuống 44 px; nếu vẫn không vừa thì cho phép **cuộn ngang** bằng kéo trong vùng hotbar (không bao giờ dưới 44 px).
- Hàng phụ ngay trên hotbar khi cần (giữ logic hiện có): nút Snap (khi đang đặt công trình) và ✓ Đặt / ✕ Huỷ (touch, ghost đang chờ) — đều là `button`.

### 5.4 Thẻ colonist — trái trên
- Mỗi colonist một panel `panel` 168×48 px logic (≥ 44 px, sửa lỗi cũ thẻ cao 30 px): tên (dòng 1), việc đang làm (dòng 2, chữ nhỏ 11 px), hai thanh Đói/Ngủ dạng `bar` xếp dọc bên phải, màu `good` > 50, `warn` 20–50, `bad` < 20.
- Colonist chết: thẻ mờ 50% và hiện "Đã chết".
- Bấm thẻ → `ui:focus-colonist` như hiện tại. Nhiều colonist hơn chiều cao màn hình cho phép → chỉ hiện số thẻ vừa, thẻ cuối là "+N".

### 5.5 Toast thông báo — trái dưới (thay log 3 dòng)
- Mỗi sự kiện `log` → một hộp `tooltip` cao 32 px logic, chữ một dòng (cắt bằng "…" nếu quá dài), trượt vào từ trái (200 ms), giữ 5 s, mờ dần (400 ms).
- Tối đa 4 toast; toast mới đẩy toast cũ lên, toast thứ 5 làm toast cũ nhất biến mất ngay.
- **Gộp:** nếu toast mới có cùng chữ với một toast đang hiện thì toast đó thành "… ×2", "×3"… và reset thời gian giữ, không thêm hộp mới (thay cho luật gộp "Đã xây xong" theo frame của Phase 1).
- Trên mobile, toast đặt ngay trên hàng hotbar để không bị ngón tay che.

### 5.6 Tooltip — theo con trỏ
- Một instance `Tooltip` dùng chung: hộp `tooltip` tự co giãn theo nội dung, rộng tối đa 220 px logic, đặt lệch (+16, +16) so với con trỏ, lật sang trái/lên trên nếu tràn màn hình.
- **Nội dung:**
  - Ô công trình: tên (đậm), dòng giá (icon + số, mỗi tài nguyên; màu `bad` nếu kho không đủ), một dòng mô tả `descVi`.
  - Ô công cụ lệnh: tên + gợi ý thao tác (dùng `TOOL_HINTS` hiện có, bản mouse hoặc touch).
  - Nút tốc độ/zoom: tên ngắn ("Tạm dừng", "Tốc độ 2×", "Phóng to").
  - **Thông tin dưới con trỏ trên bản đồ** (địa hình, vật thể, colonist, công trình — nội dung `describeTerrain`/thông tin chọn hiện có): hiện trong cùng tooltip khi con trỏ đứng yên trên bản đồ 300 ms, thay cho hộp `info` cố định hiện tại. Thực thể đang được chọn (`entity:select`) thì hiện trong một panel cố định trên hộp toast, không theo con trỏ.
- Mobile: bấm giữ 400 ms lên ô hotbar/nút → hiện tooltip phía trên ô đó cho tới khi nhả tay; nhả tay sau bấm giữ **không** kích hoạt nút.
- Dòng gợi ý trạng thái (`status`, ví dụ "Kéo để đánh dấu cây cần chặt") giữ nguyên chức năng, hiển thị trong một hộp `tooltip` ngay trên hotbar.

### 5.7 Zoom & debug
- Nút zoom +/− là `button` xếp dọc ở phải dưới, trên hotbar nếu hai phần chồng nhau.
- Dòng debug (FPS/seed/toạ độ) giữ nguyên kiểu monospace, chỉ hiện ở dev.

## 6. Menu chính (`MainMenuScene`)

- **Nền:** gradient trời 4 dải `UI_PALETTE.sky` dạng dải ngang dither (không gradient mượt), 3 lớp đồi/cây silhouette sinh bằng `PixelCanvas` với màu tối dần, trôi ngang chậm theo tốc độ khác nhau (parallax 4/8/16 px/s, lặp vô tận).
- **Logo:** bảng `panel` lớn ở 1/3 trên màn hình, chữ "Ashen Hollow" cỡ theo bề rộng (giữ công thức clamp hiện có), màu `text` với bóng `textShadow` dày 2 px; phụ đề nhỏ bên dưới.
- **Nút:** "Chơi mới" và "Đổi seed" là `button` 200×52 px logic xếp dọc giữa màn hình; dòng seed hiện tại trong một hộp `tooltip` dưới các nút; footer giữ nguyên nội dung.
- **Đom đóm:** thay `embers` bằng 24 `firefly` bay lượn lờ (tween vị trí ngẫu nhiên + nhấp nháy alpha), giữ cơ chế tạo lại khi ra khỏi màn hình hiện có.

## 7. Kiến trúc mã

```
src/data/uiPalette.ts          UI_PALETTE (mới)
src/data/buildings.ts          thêm descVi vào BuildingDef + nội dung cho mọi công trình
src/render/uiArt.ts            paint* cho frame UI, UI_FRAMES (mới, thuần TS)
src/render/uiArt.test.ts       (mới)
src/render/atlas.ts            UI_KEY, buildUiTexture
src/scenes/PreloadScene.ts     gọi buildUiTexture
src/ui/theme.ts                textStyle mới (màu/bóng), createPanel, createButton vẽ lại
                               (giữ nguyên interface Button & ButtonOptions), uiScale
src/ui/Tooltip.ts              (mới) tooltip dùng chung + bấm giữ trên mobile
src/ui/hud/ClockBox.ts         (mới) §5.1
src/ui/hud/ResourceBox.ts      (mới) §5.2
src/ui/hud/Hotbar.ts           (mới) §5.3
src/ui/hud/ColonistPanel.ts    (mới) §5.4
src/ui/hud/ToastStack.ts       (mới) §5.5
src/scenes/HudScene.ts         chỉ còn: tạo các phần trên, nghe EventBus, chuyển dữ liệu, layout()
src/scenes/MainMenuScene.ts    §6
docs/ART_STYLE.md              luật UI_PALETTE, bảng frame UI
```

**Ranh giới:**
- Mỗi phần HUD là một class nhận `scene` và hàm callback, có `layout(...)` và `destroy()`, **không** đọc `GameWorld` trực tiếp; `HudScene` đọc world/bus rồi gọi `update(...)` với dữ liệu thuần (ví dụ `ColonistPanel.update(rows: ColonistRow[])`).
- Logic thuần (tính giờ từ tick, chọn màu thanh, gộp toast, tính vị trí tooltip có lật, co hotbar trên mobile) tách thành hàm export không phụ thuộc Phaser để test được bằng Vitest (đặt trong `src/ui/hud/layout.ts`, không import Phaser).
- `src/sim`, `src/data`, `src/core` không đổi ngoài `descVi` — luật ESLint không import Phaser vẫn giữ.

## 8. Xử lý lỗi & trường hợp biên

- Màn hình rất hẹp (< 360 px): hotbar cuộn (§5.3), thẻ colonist thu còn tên + thanh (ẩn dòng việc), hộp đồng hồ và tài nguyên giữ nguyên rộng 150 px.
- Màn hình thấp (< 500 px, điện thoại ngang): số thẻ colonist giới hạn theo chiều cao còn lại giữa hộp trên và hotbar.
- Tooltip không bao giờ ra ngoài màn hình; nếu cả hai phía đều tràn thì kẹp vào mép.
- Đổi scene/ván mới: mọi phần HUD gỡ listener qua `destroy()` (giữ cơ chế `unsubscribers` hiện có); texture `ui` chỉ tạo một lần (kiểm tra `textures.exists`).
- Tooltip, toast và hotbar không nhận input xuyên qua xuống bản đồ: con trỏ trên UI không gây chọn/đặt trên bản đồ (giữ cơ chế chặn hiện có của HudScene).

## 9. Kiểm thử

**Vitest:**
- `uiArt`: mỗi frame trong `UI_FRAMES` vẽ đúng kích thước; 2 pixel góc ngoài của `panel` trong suốt; mọi pixel không trong suốt thuộc `UI_PALETTE` (không có màu lạ); `slot` và `slotSelected` khác nhau ở viền nhưng giống nhau ở lõi.
- `layout.ts`: giờ từ tick (tick 0 → "Ngày 1 06:00", `DAY_TICKS/2` → "18:00", `DAY_TICKS` → "Ngày 2 06:00"); màu thanh theo ngưỡng (biên 20 và 50); gộp toast (trùng chữ → ×2, giữ tối đa 4); vị trí tooltip lật khi chạm mép phải/dưới và kẹp khi tràn cả hai; co hotbar (đủ chỗ → 48 px/gap 4; hẹp → gap 2 → 44 px → cuộn).
- `buildings`: mọi công trình `playerBuildable` có `descVi` không rỗng.

**Trình duyệt (preview), desktop 1280×720 và mobile 375×812:**
- Chụp màn hình HUD và menu chính; kiểm tra không đè/tràn, vùng chạm ≥ 44 px (đo bằng inspect).
- Chơi lại kịch bản Phase 1: đánh dấu cây, xây kho và tường, đổi tốc độ, zoom, chọn colonist, bấm giữ ô hotbar trên mobile để xem tooltip; console không lỗi.

## 10. Rủi ro

| Rủi ro | Giảm thiểu |
|---|---|
| UI ấm lệch tông thế giới tối | Đã được người dùng chọn có chủ đích; ghi vào ART_STYLE. Nếu sau playtest thấy chướng, chỉ cần đổi `UI_PALETTE` |
| Vẽ lại HudScene làm vỡ chức năng Phase 1 | Giữ nguyên interface `createButton`, các event bus và hotkey; kịch bản Phase 1 chạy lại trong browser là tiêu chí Done |
| Hotbar không vừa mobile khi thêm công trình ở Phase 2 | Cơ chế co + cuộn ngang ở §5.3 có sẵn từ đầu |
| Chữ serif trên nền kem pixel trông lạc | Bóng chữ 1 px + cỡ chữ nguyên; đổi font pixel là việc riêng đã ghi ở ngoài phạm vi |
| Art sinh bằng code kém hơn art vẽ tay | Ranh giới `UI_FRAMES` (§4.4) cho phép thay bằng atlas Aseprite mà không sửa HUD |
