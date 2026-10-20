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

Menu chính → **Ván mới** vào thẳng Vua Lúa Mì (seed ngẫu nhiên), ván 10 năm: mỗi năm rút 3 thẻ, chơi 1 thẻ lên bàn 5×5 (hoặc bỏ 1 thẻ), trận tự bắt đầu ngay rồi xem quân tự đánh; thẻ chưa dùng ở lại tay sang năm sau (chỉ rút thêm cho đủ 3 lá); có thể **Can Thiệp** giữa trận; mất hết 3 mạng thì thua, qua năm 10 thì thắng.

Phím tắt:

- **Vương quốc (lên kế hoạch):** `1` `2` `3` chọn thẻ · `S` bỏ lá đang chọn (nút **Bỏ bài**) · `Enter` xác nhận ✓ khi đã ngắm ô · `Esc` huỷ thẻ đang chọn (hoặc đóng bảng thám báo) · `Enter` nhận phần thưởng khi bảng thưởng mở.
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
  scenes/     Boot → Preload → MainMenu → Realm + PlanningHud/BattleHud → RunEnd (từ G2: KingSelect…)
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
- [ ] **G2** — bùa, lân cận, cấp, vàng, 3 vua, chinh phục.
- [ ] **G3** — ván đầy đủ 30 năm: hội đồng, nhiệm vụ, boss, lưu ván.
- [ ] **G4** — đủ 9 vua, perk, meta-progression.
- [ ] **G5** — cân bằng, âm thanh, juice, mobile, PWA.

Lịch sử colony sim (Phase 0–1) vẫn còn trong git, nhánh `phase1-core-loop`.
