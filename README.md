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

Menu chính → **Tiếp tục** (khi có ván đang lưu) hoặc **Ván mới** → **Chọn vua** (Lúa Mì, Đá Núi hoặc Phép Thuật; seed ngẫu nhiên, đổi được) → ván 30 năm: mỗi năm rút 3 thẻ, chơi 1 thẻ lên bàn 5×5 (hoặc **bán** 1 thẻ lấy vàng), rồi bấm **Ra trận** và xem quân tự đánh; thẻ chưa dùng ở lại tay sang năm sau (chỉ rút thêm cho đủ 3 lá); có thể **Can Thiệp** giữa trận; mất hết 3 mạng thì thua, qua năm 30 thì thắng.

Luật ván đầy đủ (G3) ngắn gọn:

- **Vàng:** thu mỗi đầu năm (công trình kinh tế, Ngai) và thưởng sau trận thắng; dùng để **đổi bài** (giá 1, 2, 4, … mỗi lần trong năm), **mua ô khoá** kề ô đã mở (giá 4, 6, 8, …) và nuôi lính đánh thuê. Bán một thẻ được +2 vàng.
- **Cấp và Bùa:** chơi lại đúng thẻ công trình đã có thì lên cấp (tối đa 5); thẻ Bùa gắn lên công trình hợp loại (tối đa 4 stack); thẻ sách có hiệu ứng riêng (Dời Nhà, Gương Chép Bùa, Khai Hoang…). Công trình lân cận có thể cộng chỉ số cho nhau.
- **Lịch kẻ địch:** 30 năm, sáu vua địch (trong chín vua, trừ vua của bạn) mỗi vua tấn công 3 lần, xen Thổ Phỉ và **Liên Quân** hai vua (năm 23, 25, 27, 28, 29); thắng lần thứ 3 của một vua thì chinh phục vua đó và chọn 1 trong 3 thẻ của họ (mỗi vua mới có 9 thẻ chinh phục). Cờ hiệu của vua địch đổi quân của họ.
- **Hội đồng hoàng gia** (sau trận năm 5, 10, 15, 20, 25): chọn 1 trong 3 **sắc lệnh** (18 sắc lệnh, mỗi cái nhận một lần, có cái cần chọn thêm ô, thẻ hiếm hoặc bài để loại) rồi **Ban hành**.
- **Nhiệm vụ** (có thể xuất hiện đầu năm 3, 7, 12, 17, 22, 27; tối đa 2 nhiệm vụ cùng lúc; 13 nhiệm vụ): nhận hoặc từ chối; làm xong trong hạn thì có thưởng.
- **Boss** năm 10 (Ông Kẹ Đầm Lầy), 20 (Nữ Hoàng Ong Bắp Cày), 30 (Vua Không Ngai). Trận quá 900 tick tính là thắng, nhưng chỉ hạ được boss mới tính boss thắng; hạ Vua Không Ngai là **Vương Miện Vàng**.
- **Lưu ván:** trạng thái được ghi vào IndexedDB sau mỗi lệnh và khi vào/ra trận; tải lại trang rồi **Tiếp tục** khôi phục đúng chỗ (giữa trận thì trận bắt đầu lại từ đầu với cùng đội hình). Trình duyệt không lưu được thì ván vẫn chơi được nhưng không giữ qua lần tải lại (có một dòng báo).

Phím tắt:

- **Menu:** **Tiếp tục** mở ván đang lưu (nút tắt khi không có ván hợp lệ).
- **Chọn vua:** `1` `2` `3` chọn vua · `Enter` bắt đầu · `Esc` về menu.
- **Vương quốc (lên kế hoạch):** `1` `2` `3` chọn thẻ (hoặc kéo thẻ thả lên ô) · `S` bán lá đang chọn · `R` đổi bài · `D` mở **Bộ bài** · `L` mở bảng lịch 30 năm · `Enter` xác nhận ✓ khi đã ngắm ô, hoặc **Ra trận** khi đã chơi/bán · `Esc` huỷ thẻ đang chọn (hoặc đóng bảng đang mở) · `Enter` nhận phần thưởng/thẻ chinh phục khi bảng mở. Bấm ô khoá kề ô đã mở để mua (✓ Mua / ✕). Hội đồng và nhiệm vụ là quyết định bắt buộc: `Esc` không bỏ qua được; sắc lệnh đã ban hành và nhiệm vụ đang chạy xem ở cột bên trái (desktop rộng) hoặc nút **Sắc lệnh** (mobile). Với sắc lệnh Bàn Tay Thứ Tư, `4` chọn lá thứ tư.
- **Trận:** `P` tạm dừng · `1` `2` `3` tốc độ · `Space` hoặc `B` bật/tắt ngắm **Can Thiệp** · `Esc` huỷ ngắm (hoặc đóng bảng đợt địch) · `Enter` hoặc `Space` tiếp tục khi có bảng tổng kết. Nút **Tự bắn: Bật/Tắt** cho Đá Tảng tự rơi vào chỗ đông địch nhất (chung hồi chiêu với Can Thiệp); nút **Địch** xem lại các đợt quân; bấm vào nhà hoặc lính (khi không đang ngắm) để xem thông tin.
- **Lập kế hoạch:** bấm vào nhà trên bàn (khi không đang chọn thẻ) để xem thông tin.
- **Kết thúc ván:** `Enter` ván mới · `Esc` về menu (tóm tắt: năm hoàn thành, vua đã chinh phục, boss đã hạ).

## Kiến trúc

```
src/
  core/       Hạ tầng thuần: EventBus, Rng/hashSeed, SimClock, SpatialHash, geom, noise — không phụ thuộc Phaser
  data/       Dữ liệu và kiểu: bảng màu thế giới Hearth 32, bảng màu UI (vua, thẻ, đơn vị, hằng số ván/trận)
  game/       Luật: run/ (ván), cards/, battle/ (trận), save/ (mã hoá, kiểm và nâng cấp bản lưu), sim/ (headless + bot), testing/ — deterministic, không Phaser, không DOM
  platform/   Trình duyệt: kho IndexedDB (có dự phòng RAM), phiên chơi `createSession` — `src/game` không import
  render/     Art sinh bằng code (pixel, bitmap, dual-grid, art UI) và texture atlas
  ui/         Theme (khung 9-slice, nút gỗ), ContentBox, Tooltip, logic bố cục thuần
  scenes/     Boot → Preload → MainMenu → KingSelect → Realm + PlanningHud/BattleHud → RunEnd
docs/         GDD, ART_STYLE, ROADMAP, spec và plan (docs/superpowers)
```

Chạy một ván không giao diện (bot `random`, luật G1 mặc định): `runHeadless({ seed: 1, kingId: 'wheat' })` trong `src/game/sim/headless.ts`; ván đầy đủ: `runHeadless({ seed: 1, kingId: 'stone', rules: RULES_FULL })`. Bot `scripted` (`src/game/sim/bots/scripted.ts`) chơi theo kịch bản cố định, dùng để kiểm hành vi (xem `headless.test.ts`, `fullRun.test.ts`).

Nguyên tắc: **luật tách khỏi hiển thị**, tick cố định 10/s, deterministic theo seed. Chi tiết ở [docs/GDD.md](docs/GDD.md) và [spec tổng](docs/superpowers/specs/2026-10-16-crowned-kingdoms-design.md).

## Tài liệu

- [docs/GDD.md](docs/GDD.md) — thiết kế game rút gọn
- [docs/ART_STYLE.md](docs/ART_STYLE.md) — quy chuẩn pixel art, bảng màu Hearth 32, UI kiểu Stardew
- [docs/ROADMAP.md](docs/ROADMAP.md) — dự án con G0–G5

## Trạng thái

- [x] **G0** — nền UI & dọn dẹp: xoá colony sim, hạ tầng chuyển sang `src/core`, UI kiểu Stardew, menu chính, bảng màu Hearth 32, ESLint deterministic.
- [x] **G1** — lõi chơi được (ván 10 năm, Vua Lúa Mì, trận tự động + can thiệp, headless + bot `random`).
- [x] **G2** — bùa, lân cận, cấp, vàng, 3 vua (Lúa Mì, Đá Núi, Phép Thuật), lịch 15 năm, chinh phục, chọn vua; khung giao diện Kenney Pixel UI Pack (CC0).
- [x] **G3** — ván đầy đủ 30 năm: lịch Liên Quân, hội đồng (18 sắc lệnh), nhiệm vụ (13), 3 boss, dữ liệu địch + 54 thẻ chinh phục của 6 vua còn lại, lưu ván IndexedDB và nút Tiếp tục.
- [ ] **G4** — Ngai, bị động và perk của 6 vua mới, chọn đủ 9 vua, meta-progression.
- [ ] **G5** — cân bằng, âm thanh, juice, mobile, PWA.

Lịch sử colony sim (Phase 0–1) vẫn còn trong git, nhánh `phase1-core-loop`.
