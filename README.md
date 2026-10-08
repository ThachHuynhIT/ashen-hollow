# Ashen Hollow

Dark fantasy colony builder · 2D pixel art · hex grid · real-time with active pause · web-first.

> Thung lũng bị nguyền. Ban ngày xây dựng, ban đêm sống sót.

## Chạy thử

```bash
npm install
npm run dev        # http://localhost:5173 (cũng mở được từ điện thoại cùng mạng LAN)
```

| Lệnh                | Việc                                       |
| ------------------- | ------------------------------------------ |
| `npm run dev`       | Dev server (Vite)                          |
| `npm run build`     | Type check + build production vào `dist/`  |
| `npm run preview`   | Chạy thử bản build                         |
| `npm test`          | Unit test (Vitest)                         |
| `npm run lint`      | ESLint (gồm luật cấm `sim/` import Phaser) |
| `npm run typecheck` | `tsc --noEmit`                             |

## Điều khiển (Phase 0)

|                   | Chuột / bàn phím                        | Cảm ứng                    |
| ----------------- | --------------------------------------- | -------------------------- |
| Kéo bản đồ        | Kéo chuột (mọi nút), WASD / mũi tên     | Kéo 1 ngón                 |
| Zoom              | Lăn chuột, `+` / `-`, nút góc phải dưới | Chụm 2 ngón, nút `+` / `−` |
| Chọn hex          | Click                                   | Chạm                       |
| Tạm dừng / tốc độ | `Space`, `1` `2` `3`, nút góc phải trên | Nút góc phải trên          |
| Về menu           | `Esc`                                   | —                          |

## Kiến trúc

```
src/
  hex/        Toán hex thuần (axial, offset odd-r, layout pixel) — có test
  sim/        Mô phỏng: ECS (bitECS), map gen, RNG seed, đồng hồ tick cố định — không phụ thuộc Phaser
  data/       Số liệu & bảng màu (terrain, palette) — data-driven
  core/       Event bus có kiểu giữa world ↔ UI
  render/     Vẽ bằng Phaser: atlas placeholder, HexMapRenderer
  platform/   Input/camera (chuột, phím, cảm ứng, pinch)
  scenes/     Boot → Preload → MainMenu → World (+ Hud overlay)
  ui/         Theme, nút bấm
docs/         GDD, ART_STYLE, ROADMAP
```

Nguyên tắc: **sim tách khỏi render**, tick cố định 10/s, deterministic theo seed. Chi tiết ở [docs/GDD.md](docs/GDD.md).

## Tài liệu

- [docs/GDD.md](docs/GDD.md) — thiết kế game rút gọn
- [docs/ART_STYLE.md](docs/ART_STYLE.md) — quy chuẩn pixel art, hình hex, bảng màu
- [docs/ROADMAP.md](docs/ROADMAP.md) — kế hoạch đầy đủ theo phase

## Trạng thái

- [x] **Phase 0** — nền móng: Vite + TS + Phaser 4 + bitECS + Vitest + ESLint/Prettier + CI; map hex procedural; camera pan/zoom/pinch; hover/chọn hex; HUD tốc độ; responsive mobile.
- [ ] Phase 1 — core loop (colonist, job, pathfinding A* hex trong worker, xây dựng)
