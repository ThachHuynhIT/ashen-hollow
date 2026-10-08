# Ashen Hollow

Dark fantasy colony builder in 2D pixel art. Build anywhere — no grid. Real-time with active pause, web-first.

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

## Điều khiển

|                        | Chuột / bàn phím                                      | Cảm ứng                                   |
| ---------------------- | ----------------------------------------------------- | ----------------------------------------- |
| Kéo bản đồ             | Kéo chuột, WASD / mũi tên                             | Kéo 1 ngón                                |
| Zoom                   | Lăn chuột, `+` / `-`, nút góc phải dưới               | Chụm 2 ngón, nút `+` / `−`                |
| Xem / chọn vật thể     | Rê chuột để xem, click để chọn                        | Chạm                                      |
| Xây                    | `B` bật/tắt, `Z` Lều, `X` Kho, `C` Tháp; click để đặt | Chọn công trình, chạm bản đồ, bấm **Đặt** |
| Bám lưới 8 px          | Giữ `Shift` (hoặc nút **Bám lưới**)                   | Nút **Bám lưới**                          |
| Thôi xây               | Chuột phải hoặc `Esc`                                 | Nút **Huỷ** hoặc chạm lại nút công trình  |
| Tạm dừng / tốc độ      | `Space`, `1` `2` `3`, nút góc phải trên               | Nút góc phải trên                         |
| Xem lưới điều hướng ẩn | `F3`                                                  | —                                         |
| Về menu                | `Esc` (khi không xây / không chọn gì)                 | —                                         |

## Kiến trúc

```
src/
  sim/        Mô phỏng: ECS (bitECS), sinh map, lưới ẩn (terrain 16 px, nav 8 px), A*, spatial hash, đặt công trình — không phụ thuộc Phaser
  data/       Số liệu: địa hình, vật thể, công trình, bảng màu — data-driven
  core/       Event bus có kiểu giữa world ↔ UI
  render/     Vẽ bằng Phaser: dual-grid terrain, sprite y-sort, ghost đặt công trình, debug F3
  platform/   Input/camera (chuột, phím, cảm ứng, pinch)
  scenes/     Boot → Preload → MainMenu → World (+ Hud overlay)
  ui/         Theme, nút bấm
docs/         GDD, ART_STYLE, ROADMAP
```

Nguyên tắc: **sim tách khỏi render**, tick cố định 10/s, deterministic theo seed. Chi tiết ở [docs/GDD.md](docs/GDD.md).

## Tài liệu

- [docs/GDD.md](docs/GDD.md) — thiết kế game rút gọn
- [docs/ART_STYLE.md](docs/ART_STYLE.md) — quy chuẩn pixel art, dual-grid, y-sort, bảng màu
- [docs/ROADMAP.md](docs/ROADMAP.md) — kế hoạch đầy đủ theo phase

## Trạng thái

- [x] **Phase 0** — nền móng: Vite + TS + Phaser 4 + bitECS + Vitest + ESLint/Prettier + CI; camera pan/zoom/pinch; HUD; responsive mobile.
- [x] **Phase 0b** — bỏ lưới hex: thế giới tự do, địa hình liền mạch (dual-grid), cây/đá rải tự nhiên, đặt công trình tự do + snap/magnet, nav grid ẩn + A* + làm mượt đường.
- [ ] Phase 1 — core loop (colonist, job, di chuyển tự do: A* + steering trong worker, xây dựng)
