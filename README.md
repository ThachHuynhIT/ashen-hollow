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

Nguyên tắc: **luật tách khỏi hiển thị**, tick cố định 10/s, deterministic theo seed. Chi tiết ở [docs/GDD.md](docs/GDD.md) và [spec tổng](docs/superpowers/specs/2026-10-16-crowned-kingdoms-design.md).

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
