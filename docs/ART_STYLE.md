# Chín Vương Miện — Art Style Guide

Quy chuẩn bắt buộc cho mọi asset hình. Art tạm sinh bằng code (`src/render/*Art.ts`) cũng tuân theo file này. Nguồn chuẩn: spec tổng §11 ([2026-10-16-nine-crowns-design.md](superpowers/specs/2026-10-16-nine-crowns-design.md)).

Không khí: **fantasy ấm áp, dễ thương** — vương quốc nhỏ, lính chibi, đồng lúa, rừng cây, giao diện gỗ + giấy kem kiểu Stardew Valley.

## Kích thước

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
