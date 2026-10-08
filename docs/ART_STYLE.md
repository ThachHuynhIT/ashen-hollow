# Ashen Hollow — Art Style Guide

Quy chuẩn bắt buộc cho mọi asset hình. Placeholder art sinh bằng code (`src/render/terrainArt.ts`) cũng tuân theo file này.

## Kích thước

| Thứ                   | Kích thước            | Ghi chú                                                            |
| --------------------- | --------------------- | ------------------------------------------------------------------ |
| Tile địa hình         | **16×16 px**          | Vẽ theo dual-grid: 16 mặt nạ góc + 2 biến thể nền cho mỗi loại đất |
| Cây chết              | 16×24                 | Gốc (chân) ở hàng dưới cùng                                        |
| Tảng đá / đống xương  | 16×12 / 12×8          |                                                                    |
| Nhân vật              | 16×24                 | Chân ở hàng dưới cùng                                              |
| Lều / Kho / Tháp canh | 24×20 / 32×24 / 16×40 | Sprite đứng trên mép dưới của footprint                            |
| Cọc tường             | 8×12                  | Rải dọc đường kéo → tường mọi góc mà không xoay sprite             |
| Boss                  | 48×48 – 64×64         |                                                                    |
| Icon item             | 16×16                 |                                                                    |
| Icon công nghệ        | 48×48                 |                                                                    |
| Policy Card           | 64×96                 |                                                                    |
| Portrait UI           | 32×32                 | Ghép layer như sprite                                              |

## Thế giới tự do: không có ô nào được thấy

- **Địa hình dual-grid.** Ô hiển thị lệch nửa ô so với ô dữ liệu, nên mép giữa hai loại đất nằm _bên trong_ tile chứ không trùng đường lưới. Mỗi loại đất chỉ cần **16 tile mặt nạ góc** (bit: trên-trái 1, trên-phải 2, dưới-trái 4, dưới-phải 8) thay vì 47 ô autotile. Logic: `src/render/dualGrid.ts` (có test).
- **Thứ tự lớp đất** (thấp → cao): nước đen < đầm < cỏ chết < nền rừng < đồi < đất nguyền < vách đá. Lớp cao hơn đè lên và có **viền (rim)** 1 px ở mép.
- Mép đất vẽ **hữu cơ, có dither** — không bao giờ là đường thẳng theo lưới.
- **Mọi sprite neo ở chân** (origin 0.5, 1) và **xếp chiều sâu theo y của chân** (y-sort): thứ ở thấp hơn trên màn hình vẽ đè lên.
- **Bóng đổ** elip 1–2 px dưới chân, màu `void` mờ.
- **Không xoay sprite.** Hướng thể hiện bằng frame 4/8 hướng; tường chéo = chuỗi cọc nhỏ.
- Vật thể tự do (cây, đá) nên **che bớt mép đất** để giấu chỗ lặp tile.

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
- Màn hình cảm ứng mặc định ≥ 2× để công trình và vật thể lớn hơn đầu ngón tay.

## Pipeline (khi có art thật)

`.aseprite` → script xuất spritesheet + JSON (`tools/`) → `public/assets/atlases/` → load trong `PreloadScene`. Thay `buildPlaceholderAtlas` theo từng nhóm asset.

## Nguồn asset tạm

Pack CC0/CC-BY từ itch.io, Kenney, OpenGameArt — ghi vào `CREDITS.md` kèm license. AI chỉ dùng cho moodboard/concept, không dùng làm sprite cuối.
