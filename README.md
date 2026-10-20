# Crowned Kingdoms

Roguelite xây vương quốc + tự động đánh, 2D pixel art, web-first. Trước đây tên _Chín Vương Miện_ / _Nine Crowns_ (repo cũ `ashen-hollow`).

> Một vương quốc nhỏ, chín ngai vàng. Mỗi năm chơi một thẻ, rồi xem quân mình tự đánh.

## Chạy thử

```bash
npm install
npm run dev        # http://localhost:5173 (cũng mở được từ điện thoại cùng mạng LAN)
```

| Lệnh                | Việc                                                                                           |
| ------------------- | ---------------------------------------------------------------------------------------------- |
| `npm run dev`       | Dev server (Vite)                                                                              |
| `npm run build`     | Type check + build production vào `dist/`                                                      |
| `npm run preview`   | Chạy thử bản build                                                                             |
| `npm test`          | Unit test (Vitest)                                                                             |
| `npm run lint`      | ESLint (gồm luật cấm `game/`, `data/`, `core/` import Phaser hay dùng hàm không deterministic) |
| `npm run typecheck` | `tsc --noEmit`                                                                                 |

## Điều khiển

Menu chính → **Ván mới** → **Chọn vua** (Lúa Mì, Đá Núi hoặc Phép Thuật; seed ngẫu nhiên, đổi được) → ván 15 năm: mỗi năm rút 3 thẻ, chơi 1 thẻ lên bàn 5×5 (hoặc **bán** 1 thẻ lấy vàng), rồi bấm **Ra trận** và xem quân tự đánh; thẻ chưa dùng ở lại tay sang năm sau (chỉ rút thêm cho đủ 3 lá); có thể **Can Thiệp** giữa trận; mất hết 3 mạng thì thua, qua năm 15 thì thắng.

Luật G2 ngắn gọn:

- **Vàng:** thu mỗi đầu năm (công trình kinh tế, Ngai) và thưởng sau trận thắng; dùng để **đổi bài** (giá 1, 2, 4, … mỗi lần trong năm), **mua ô khoá** kề ô đã mở (giá 4, 6, 8, …) và nuôi lính đánh thuê. Bán một thẻ được +2 vàng.
- **Cấp và Bùa:** chơi lại đúng thẻ công trình đã có thì lên cấp (tối đa 5); thẻ Bùa gắn lên công trình hợp loại (tối đa 4 stack); thẻ sách có hiệu ứng riêng (Dời Nhà, Gương Chép Bùa, Khai Hoang…). Công trình lân cận có thể cộng chỉ số cho nhau.
- **Lịch kẻ địch:** 15 năm, hai vua địch tấn công mỗi vua 3 lần (năm còn lại là Thổ Phỉ); thắng lần thứ 3 thì chinh phục vua đó và chọn 1 trong 3 thẻ của họ. Cờ hiệu của vua địch đổi quân của họ.

Phím tắt:

- **Chọn vua:** `1` `2` `3` chọn vua · `Enter` bắt đầu · `Esc` về menu.
- **Vương quốc (lên kế hoạch):** `1` `2` `3` chọn thẻ (hoặc kéo thẻ thả lên ô) · `S` bán lá đang chọn · `R` đổi bài · `D` mở **Bộ bài** · `L` mở bảng lịch 15 năm · `Enter` xác nhận ✓ khi đã ngắm ô, hoặc **Ra trận** khi đã chơi/bán · `Esc` huỷ thẻ đang chọn (hoặc đóng bảng đang mở) · `Enter` nhận phần thưởng/thẻ chinh phục khi bảng mở. Bấm ô khoá kề ô đã mở để mua (✓ Mua / ✕).
- **Trận:** `P` tạm dừng · `1` `2` `3` tốc độ · `Space` hoặc `B` bật/tắt ngắm **Can Thiệp** · `Esc` huỷ ngắm (hoặc đóng bảng đợt địch) · `Enter` hoặc `Space` tiếp tục khi có bảng tổng kết. Nút **Tự bắn: Bật/Tắt** cho Đá Tảng tự rơi vào chỗ đông địch nhất (chung hồi chiêu với Can Thiệp); nút **Địch** xem lại các đợt quân; bấm vào nhà hoặc lính (khi không đang ngắm) để xem thông tin.
- **Lập kế hoạch:** bấm vào nhà trên bàn (khi không đang chọn thẻ) để xem thông tin.
- **Kết thúc ván:** `Enter` ván mới · `Esc` về menu.

## Kiến trúc

```
src/
  core/       Hạ tầng thuần: EventBus, Rng/hashSeed, SimClock, SpatialHash, geom, noise — không phụ thuộc Phaser
  data/       Dữ liệu và kiểu: bảng màu thế giới Hearth 32, bảng màu UI (vua, thẻ, đơn vị, hằng số ván/trận)
  game/       Luật: run/ (ván), cards/, battle/ (trận), sim/ (headless + bot), testing/ — deterministic, không Phaser; từ G3: lưu ván
  render/     Art sinh bằng code (pixel, bitmap, dual-grid, art UI) và texture atlas
  ui/         Theme (khung 9-slice, nút gỗ), ContentBox, Tooltip, logic bố cục thuần
  scenes/     Boot → Preload → MainMenu → KingSelect → Realm + PlanningHud/BattleHud → RunEnd
docs/         GDD, ART_STYLE, ROADMAP, spec và plan (docs/superpowers)
```

Chạy một ván không giao diện (bot `random`): `runHeadless({ seed: 1, kingId: 'wheat' })` trong `src/game/sim/headless.ts` (xem `headless.test.ts`).

Nguyên tắc: **luật tách khỏi hiển thị**, tick cố định 10/s, deterministic theo seed. Chi tiết ở [docs/GDD.md](docs/GDD.md) và [spec tổng](docs/superpowers/specs/2026-10-16-crowned-kingdoms-design.md).

## Tài liệu

- [docs/GDD.md](docs/GDD.md) — thiết kế game rút gọn
- [docs/ART_STYLE.md](docs/ART_STYLE.md) — quy chuẩn pixel art, bảng màu Hearth 32, UI kiểu Stardew
- [docs/ROADMAP.md](docs/ROADMAP.md) — dự án con G0–G5

## Trạng thái

- [x] **G0** — nền UI & dọn dẹp: xoá colony sim, hạ tầng chuyển sang `src/core`, UI kiểu Stardew, menu chính, bảng màu Hearth 32, ESLint deterministic.
- [x] **G1** — lõi chơi được (ván 10 năm, Vua Lúa Mì, trận tự động + can thiệp, headless + bot `random`).
- [x] **G2** — bùa, lân cận, cấp, vàng, 3 vua (Lúa Mì, Đá Núi, Phép Thuật), lịch 15 năm, chinh phục, chọn vua; khung giao diện Kenney Pixel UI Pack (CC0).
- [ ] **G3** — ván đầy đủ 30 năm: hội đồng, nhiệm vụ, boss, lưu ván.
- [ ] **G4** — đủ 9 vua, perk, meta-progression.
- [ ] **G5** — cân bằng, âm thanh, juice, mobile, PWA.

Lịch sử colony sim (Phase 0–1) vẫn còn trong git, nhánh `phase1-core-loop`.
