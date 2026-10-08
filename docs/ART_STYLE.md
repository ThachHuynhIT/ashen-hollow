# Ashen Hollow — Art Style Guide

Quy chuẩn bắt buộc cho mọi asset hình. Placeholder art sinh bằng code (`src/render/terrainArt.ts`) cũng tuân theo file này.

## Kích thước

| Thứ                     | Kích thước               | Ghi chú                                           |
| ----------------------- | ------------------------ | ------------------------------------------------- |
| Hex tile                | **32×32 px**, pointy-top | Bước lưới: ngang 32, dọc 24 (hai hàng chồng 8 px) |
| Nhân vật                | 16×24                    | Đứng ở tâm hex, chân ở y = tâm + 6                |
| Công trình 1 hex        | 32×40                    | Phần nhô cao vượt lên trên tile                   |
| Boss / công trình 3 hex | 48×48 – 64×64            |                                                   |
| Icon item               | 16×16                    |                                                   |
| Icon công nghệ          | 48×48                    |                                                   |
| Policy Card             | 64×96                    |                                                   |
| Portrait UI             | 32×32                    | Ghép layer như sprite                             |

## Hình dạng hex (quan trọng)

Hex là hình **lục giác dẹt với cạnh xiên 2:1** — bậc thang pixel sạch, không răng cưa:

```
hàng 0      : trống
hàng 1–7    : nửa bề rộng = 2·y         (mỗi hàng rộng thêm 2 px mỗi bên)
hàng 8–23   : đủ 32 px (hai cạnh đứng)
hàng 24–31  : nửa bề rộng = 64 − 2·y
```

Các hex đặt theo lưới (32, 24) **phủ kín mặt phẳng, không hở, không chồng** — đã có unit test (`src/render/pixel.test.ts`). Khi vẽ trong Aseprite: dùng template mask này làm layer khoá, mọi pixel tile phải nằm trong mask.

> Ghi chú: kế hoạch ban đầu ghi 32×28; đã đổi sang 32×32 với cap 8 px vì chỉ kích thước này cho đường chéo 2:1 hoàn hảo và vẫn là ảnh affine của hex đều (toán axial giữ nguyên).

## Bảng màu "Ashen 32"

Định nghĩa duy nhất tại `src/data/palette.ts`. **Không dùng màu ngoài bảng.** Xuất palette `.gpl` cho Aseprite từ file này.

- **Bóng tối / hư không:** void, ink, nightViolet, dusk, shadowPlum — tông tím lạnh.
- **Đất & cây chết:** rotBrown, mud, peat, deadGrass, driedMoss, swampGreen, mossDark, pine.
- **Đá:** slateDark → stoneLight. **Nước:** blackWater, deepWater, waterSheen.
- **Điểm nhấn (hiếm):** ember/flame/candle (lửa = an toàn), blood, ghostGreen, veilViolet (Màn Sương).

Ngôn ngữ thị giác: **ấm = an toàn, lạnh = nguy hiểm.** Lửa và ánh sáng là màu ấm duy nhất bão hoà cao.

## Quy tắc vẽ

- Ánh sáng từ **trên-trái**: viền trên-trái sáng hơn, viền dưới-phải tối hơn.
- Không anti-aliasing, không gradient mượt; dither thưa nếu cần chuyển tông.
- Outline: chỉ cho nhân vật/quái (1 px, màu tối nhất của vật thể, không đen thuần).
- Chi tiết 1 px trên tile phải thưa (≤ 10% diện tích) để đơn vị đứng trên vẫn đọc được.
- Animation: 6–8 fps cho idle/work, 10–12 fps cho attack.

## Hiển thị

- Game chạy `pixelArt: true` (nearest-neighbour) và **zoom số nguyên** 1×–6×. Không bao giờ scale lẻ.
- Màn hình cảm ứng mặc định ≥ 2× để hex (64 px) lớn hơn đầu ngón tay.

## Pipeline (khi có art thật)

`.aseprite` → script xuất spritesheet + JSON (`tools/`) → `public/assets/atlases/` → load trong `PreloadScene`. Thay `buildPlaceholderAtlas` theo từng nhóm asset.

## Nguồn asset tạm

Pack CC0/CC-BY từ itch.io, Kenney, OpenGameArt — ghi vào `CREDITS.md` kèm license. AI chỉ dùng cho moodboard/concept, không dùng làm sprite cuối.
