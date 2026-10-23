# Crowned Kingdoms — Art Style Guide

Quy chuẩn bắt buộc cho mọi asset hình. Art tạm sinh bằng code (`src/render/*Art.ts`) cũng tuân theo file này. Nguồn chuẩn: spec tổng §11 ([2026-10-16-crowned-kingdoms-design.md](superpowers/specs/2026-10-16-crowned-kingdoms-design.md)).

Không khí: **fantasy ấm áp, dễ thương** — vương quốc nhỏ, lính chibi, đồng lúa, rừng cây, giao diện gỗ + giấy kem kiểu Stardew Valley.

Nguồn luật màu/kích thước mở: **yêu cầu chủ dự án ngày 23/10/2026**, thay thế giới hạn cũ. Không giới hạn RGB hoặc số lượng màu cho thế giới và UI; giữ các export/màu cũ để tương thích.

## Kích thước theo metadata

Giữ ô logic **32 px** và sân logic **384 px**, không đổi mô phỏng theo art. Kích thước canvas/frame là số nguyên dương, khai báo và kiểm đúng metadata (đơn vị theo `UnitDef.sprite`, UI qua `uiFrameDef`); không có danh sách kích thước đóng. Bảng dưới ghi các kích thước hiện tại để tham khảo. G3e giữ công trình 32×40, Ngai 32×48 và kích thước lính hiện tại, không biến chúng thành giới hạn chung.

| Thứ                        | Kích thước             | Ghi chú                                                                        |
| -------------------------- | ---------------------- | ------------------------------------------------------------------------------ |
| Tile cánh đồng             | 16×16                  | Dual-grid (cỏ < cỏ hoa < đường đất < cát; ao là nước)                          |
| Ô bàn cờ                   | 32×32                  | Ô mở trống (đất xới viền cỏ), ô khoá (cỏ rậm + cọc rào + biển giá), bệ Ngai đá |
| Công trình                 | 32×40                  | Đứng trên mép dưới ô, phần cao 8 px tràn lên ô phía Bắc (y-sort)               |
| Ngai                       | 32×48                  |                                                                                |
| Lính nhỏ chibi             | 16×16                  | Dân quân, sói, nhện, xương…; đầu ≈ 40% chiều cao                               |
| Lính cao                   | 16×24                  | Người cầm vũ khí dài, pháp sư, kỵ binh                                         |
| Lính lớn                   | 24×24 / 24×32          | Người đá, gấu, cổ thụ, rồng sắt, khổng lồ đồng, thần chết                      |
| Boss                       | 48×48                  |                                                                                |
| Đạn / hiệu ứng             | 4×4 – 8×8              | Tia lửa, mũi tên (4 hướng + 4 chéo, vẽ riêng, không xoay), đá, bùn             |
| Tảng đá can thiệp          | 16×16 + bóng 24×8      |                                                                                |
| Tranh thẻ                  | 32×24                  | Cửa sổ tranh trong `CardView`                                                  |
| Icon loại thẻ / tài nguyên | 16×16                  |                                                                                |
| Chân dung vua              | 32×32                  | Ghép trong ô chọn vua                                                          |
| Khung thẻ (UI)             | ô nguồn 24×32, slice 8 | `card`, `cardUncommon`, `cardRare`, `cardSelected`                             |

## Màu sắc

`PALETTE` (Hearth 32, `src/data/palette.ts`) và `UI_PALETTE` (`src/data/uiPalette.ts`) là các màu semantic hiện hữu để tương thích, không phải danh sách RGB bắt buộc hoặc giới hạn số màu.

Ngôn ngữ thị giác: tông ấm, bão hoà vừa; bóng nâu–mận; **xanh dương = phe mình, đỏ = phe địch**, kết hợp hình/viền để phân biệt phe. Mép sprite chỉ alpha **0/255**; bóng riêng được alpha **128** khi có khai báo.

## Giao diện (UI)

Các màu semantic và kích thước khung bên dưới mô tả skin hiện hữu, không giới hạn màu/kích thước của skin mới. Nút dùng `createButton`, tooltip dùng `Tooltip`, hộp tự định cỡ dùng `ContentBox`; giữ các primitive này khi thay art.

**Luật:** màu UI theo metadata mở, không bắt buộc thuộc `UI_PALETTE`. UI giữ tông ấm và sáng (khung gỗ nâu, lõi giấy kem, chữ nâu đậm có bóng) giống Stardew Valley; giữ tương phản và ý nghĩa trạng thái.

**Ngoại lệ có đăng ký:** các khung panel/tooltip/nút/thẻ lấy từ bộ [Pixel UI Pack](https://kenney.nl/assets/pixel-ui-pack) của Kenney (CC0, `public/assets/ui/kenney-pixel-ui/`, đăng ký trong `docs/assets.manifest.yml`) được nạp đè lên khung sinh ra bởi `paintUiFrame` (xem `src/render/uiKit.ts`) — màu của chúng không thuộc `UI_PALETTE`. Ô hotbar, thanh, decor vẫn sinh từ `UI_PALETTE`; file kit thiếu/lỗi thì rơi về khung sinh.

- Art UI sinh bằng code trong `src/render/uiArt.ts` (kiểm kích thước theo metadata, góc/slice/border và trạng thái), đóng gói thành texture `ui` trong `PreloadScene` (`buildUiTexture`).
- Mọi khung là **9-slice**, vẽ bằng `createPanel` (`src/ui/theme.ts`) theo kích thước logic. Viền scale nguyên lần: `uiScale = 2` khi cạnh ngắn màn hình ≥ 600 px, ngược lại `1`.
- Chữ trên nền kem: `FONT_UI`, màu `text`, bóng `textShadow` lệch (+1, +1). Vàng `gold` không dùng cho chữ trên nền kem (không đủ tương phản).
- Lớp phủ trên thế giới (ô hợp lệ/không hợp lệ, vòng ngắm, mũi tên mép) dùng `good`, `bad`, `gold` của `UI_PALETTE`.

| Frame                                                    | Ô nguồn | Góc (slice) | Viền (border) | Dùng cho                                            |
| -------------------------------------------------------- | ------- | ----------- | ------------- | --------------------------------------------------- |
| `panel`                                                  | 24×24   | 8           | 6             | Bảng logo, panel HUD, bảng phụ                      |
| `button` / `buttonHover` / `buttonDown` / `buttonActive` | 16×16   | 5           | 4             | Nút; hover lõi sáng, bấm lõm, đang bật viền vàng    |
| `slot` / `slotHover` / `slotSelected`                    | 18×18   | 4           | 2 / 2 / 3     | Ô lịch, ô chọn vua; đang chọn viền đỏ `select` 2 px |
| `tooltip`                                                | 12×12   | 4           | 2             | Tooltip, toast, dòng hướng dẫn                      |
| `bar`                                                    | 8×6     | 2           | 1             | Khung thanh (HP Ngai, thông thạo)                   |
| `clockDial` (không giãn)                                 | 28×28   | —           | —             | Mặt đồng hồ (dự phòng, chưa dùng ở G0)              |
| `firefly` (không giãn)                                   | 3×3     | —           | —             | Đom đóm menu                                        |

Khung thẻ theo độ hiếm (thêm vào texture `ui` từ G1): thường = viền `wood`; vừa = viền đôi `woodLight`; hiếm = viền trong `gold`; đang chọn = viền ngoài `select` 2 px.

**Menu chính:** trời 4 dải `UI_PALETTE.sky` nối bằng dither 2×2, 3 lớp đồi/cây silhouette (`woodDark` → `text` → `outline`, xa → gần) trôi parallax 4/8/16 px/s, cỡ pixel nguyên `menuPixelScale`.

## Quy tắc vẽ

- Ánh sáng từ **trên-trái**: viền trên-trái sáng hơn, viền dưới-phải tối hơn.
- Không anti-aliasing, blur, glow mờ hoặc gradient mượt; dither thưa nếu cần chuyển tông.
- Đơn vị vẽ bằng `paintBitmap` với ký tự màu cố định: `c` = màu vải → màu chủ của vua; `o` = viền → `outline` (phe mình) hoặc `redDark` (phe địch, kèm 1 pixel cờ `red`). Atlas sinh hai biến thể `unit_<id>_ally` và `unit_<id>_foe`.
- Hoạt ảnh: idle 2 frame, đi 2 frame (nhún 1 px), đánh 2 frame; 6–8 fps idle/đi, 10–12 fps đánh.
- **Không xoay sprite**; lật ngang để quay trái/phải được phép. **Neo ở chân** (origin 0.5, 1) và xếp chiều sâu theo y của chân (y-sort).
- Chi tiết 1 px trên tile phải thưa (≤ 10% diện tích) để đơn vị đứng trên vẫn đọc được.

## Hiển thị

- Game chạy `pixelArt: true` (nearest-neighbour) và **zoom số nguyên** (vương quốc: zoom 2; trận: `max(1, floor(min(width, height + 96) / 384))`). Không bao giờ scale lẻ; sprite/scroll hiển thị snap pixel, không sửa float của world để snap render. Chữ `FONT_UI` vẽ ở kích thước hiển thị gốc, không scale texture text theo tỷ lệ lẻ; kiểm độ rõ/glyph tiếng Việt bằng browser.

## Pipeline art sinh bằng code

- Giữ `PixelCanvas`/`pixelHash` (`pixel.ts`), `paintBitmap` (`bitmap.ts`), `dualGrid.ts`. Module mới (thuần TS, kiểm geometry/alpha theo metadata) đến từ G1: `fieldArt.ts`, `plotArt.ts`, `buildingArt.ts`, `unitArt.ts`, `cardArt.ts`, `iconArt.ts`, `fxArt.ts` (đã có từ G1); `portraitArt.ts` chưa làm (G2+).
- `atlas.ts` dựng texture `ui` (G0), `field-tiles` và `sprites` (một atlas thế giới, mỗi chiều ≤ 4096), frame theo tên: `building_<cardId>`, `unit_<id>_<team>_<anim><n>`, `card_art_<cardId>`, `icon_<id>`, `fx_<id>`.

## Ranh giới thay art thật

Hợp đồng **từ G1** (spec §11.4): mọi chỗ dùng sprite chỉ gọi frame theo tên qua các hàm `*Frame(...)` trong `atlas.ts`. Thay bằng atlas Aseprite = xuất atlas với **cùng tên frame** (`.aseprite` → spritesheet + JSON → `public/assets/atlases/`), nạp trong `PreloadScene` dưới cùng key; không sửa scene. Riêng UI: nạp dưới key `ui` thay cho `buildUiTexture`, khai báo metadata kích thước/slice/border và đọc qua `uiFrameDef`.

## Nguồn asset tạm

Pack CC0/CC-BY từ itch.io, Kenney, OpenGameArt — ghi vào `CREDITS.md` kèm license. AI chỉ dùng cho moodboard/concept, không dùng làm sprite cuối.

## Asset ngoài & AI

- Mọi asset ngoài phải qua [ASSET_LICENSES.md](ASSET_LICENSES.md) và được ghi vào [ASSET_MANIFEST.md](ASSET_MANIFEST.md) (dữ liệu ở `docs/assets.manifest.yml`) + `CREDITS.md` trước khi commit. Không tự tải rồi commit chỉ vì thấy URL.
- AI chỉ dùng cho moodboard/concept/silhouette/color/sprite draft; không đưa thẳng vào atlas. Pipeline: `concept → native-size draft → color cleanup → manual pixel cleanup → animation → review → atlas`.
- Asset chưa đạt yêu cầu: đánh dấu TODO, không tự ý đổi native size/projection, không xoay sprite, giữ nguyên frame name khi thay art.
- Checklist nghiệm thu: đúng native size theo metadata · đúng projection · màu mở, phân biệt phe/trạng thái · mép alpha 0/255, bóng riêng alpha 128 có khai báo · không anti-aliasing/blur/gradient mượt · ánh sáng trên-trái · silhouette đọc được ở 1× · origin (0.5, 1) · đúng frame name · license đã ghi.
