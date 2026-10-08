# Ashen Hollow — Game Design Document (rút gọn)

> Bản tóm tắt sống của thiết kế. Khi một cơ chế thay đổi, sửa file này trước khi sửa code.
> Lộ trình chi tiết: [ROADMAP.md](ROADMAP.md) · Quy chuẩn hình ảnh: [ART_STYLE.md](ART_STYLE.md)

## Elevator pitch

Bạn dẫn một nhóm người sống sót tới một thung lũng bị nguyền. Ban ngày khai thác, xây dựng, nghiên cứu; ban đêm **Màn Sương (The Veil)** trồi lên, quái vật tấn công và tâm trí colonist bị bào mòn. Càng dùng sức mạnh hắc ám để sống sót, colony càng mạnh — và càng mục ruỗng.

**Thể loại:** Dark fantasy colony builder · 2D pixel art · **thế giới tự do, không lưới** · **real-time có active pause** · web-first, đa nền tảng (PWA, Tauri, Capacitor).

## 4 trụ cột

1. **Ngày/Đêm là nhịp chính** — ngày = kinh tế, đêm = sinh tồn.
2. **Sanity & Corruption** — mọi quyết định mạnh đều có cái giá tinh thần.
3. **Colonist có câu chuyện** — trait, quan hệ, chấn thương; lính là colonist thật, chết là mất người.
4. **Ánh sáng là tài nguyên** — vùng sáng an toàn, bóng tối nguy hiểm.

## Các hệ thống chính

| Hệ thống                 | Tóm tắt                                                                                                                                                                        | Phase       |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------- |
| Thế giới tự do           | 2048×2048 px liền mạch; nền đất lưu ở lưới 16 px vẽ bằng dual-grid (không thấy ô); cây/đá đặt tự do (Poisson); lãnh thổ & bonus lân cận theo bán kính                          | 0b, 1, 4    |
| Đặt công trình           | Đặt ở mọi vị trí; Shift/nút "Bám lưới" = snap 8 px; magnet hút sát công trình bên cạnh; tường kéo theo mọi góc                                                                 | 0b, 1       |
| Colonist                 | Nhu cầu (đói, ngủ, ấm), kỹ năng 0–20, trait, quan hệ, Scar, Utility AI + ma trận ưu tiên công việc                                                                             | 1, 3        |
| Ngày/Đêm & Mùa           | 1 ngày ≈ 8–10 phút; đêm = Veil; 4 mùa; Blood Moon                                                                                                                              | 2, 5        |
| Sanity / Corruption      | Sanity cá nhân (ngưỡng 70/40/15 → mental break); Corruption colony 0–100%                                                                                                      | 2, 4        |
| Quân đội kiểu RTS        | Di chuyển tự do (A* + làm mượt + steering), va chạm giữa lính, vùng giao chiến theo bán kính, Combat Strength, flank theo góc/khoảng cách, tầm bắn theo pixel + LOS, promotion | 2, 4        |
| Cây công nghệ kiểu Civ 6 | Lore (Tech) + Doctrine (Civics), 4 kỷ nguyên, Eureka/Inspiration −40–50%, hàng đợi, fog of tech                                                                                | 2 (mini), 4 |
| Chế độ & Policy Card     | Government + slot ⚔ ⚒ 🕯 🩸 + Wildcard; thẻ có lợi có hại kiểu Frostpunk                                                                                                        | 4           |
| Storyteller & Event      | Nhịp căng/nghỉ; 30–40 event có lựa chọn                                                                                                                                        | 5           |
| Expedition               | Gửi đội ra ngoài map tới POI                                                                                                                                                   | 5           |

## Quy tắc thế giới tự do

- Mọi thứ có toạ độ **pixel float** (`Position`). Không có ô nào hiện ra với người chơi.
- Lưới chỉ là cấu trúc tăng tốc, ẩn: **terrain 16 px** (loại đất), **nav 8 px** (đi được/không, chi phí), **spatial hash 64 px** (tìm lân cận).
- Đơn vị di chuyển: A* 8 hướng trên nav grid → làm mượt (string pulling) → steering. Tốc độ × hệ số `speed` của đất dưới chân (`src/data/terrain.ts`).
- Công trình có **footprint** (chữ nhật/tròn) — chặn nav grid và không được chồng lấn; chạm mép (flush) thì được.
- Cơ chế Civ cần "ô kề" (lãnh thổ, adjacency, ZOC, 1-lính/ô) đều đổi sang **bán kính/khoảng cách**.

## Thắng/ / Thua

- **Thua:** toàn bộ colonist chết/phát điên, hoặc Corruption = 100%.
- **Thắng (chiến dịch):** sống qua N mùa + nghi lễ Phong Ấn Màn Sương; kết thúc thay thế "Trở thành Bóng Tối".
- **Endless:** sống càng lâu càng tốt.

## Nguyên tắc kỹ thuật

- **Simulation tách khỏi render.** `src/sim`, `src/data`, `src/core` không được import Phaser (ESLint chặn). Sim chạy tick cố định 10 tick/s, deterministic theo seed.
- **Data-driven.** Số liệu gameplay nằm trong `src/data/*`, không rải trong system.
- **Không dùng `Math.random()` trong sim.** Dùng `Rng` (seeded) để tái hiện bug và replay.

## Phase 1 đã có

- **3 tài nguyên:** Gỗ, Đá, Thức ăn. Khởi đầu 30 / 10 / 30. HUD hiện bộ đếm kho; chỉ tính hàng nằm trong Lửa Thiêng/Kho (drop point). Colonist mang tối đa 20 mỗi chuyến.
- **Lệnh:** Chặt, Đào, Hái, Bỏ dấu (kéo khung hoặc chạm từng vật). Đặt công trình/tường tạo **bản thiết kế (blueprint)**; colonist lấy vật liệu ở Lửa Thiêng/Kho, chở tới và xây.
- **Ưu tiên việc** (`score = priority × 10 000 − khoảng cách`): đang mang hàng (6) > nhu cầu khẩn cấp < 15 (5) > xây (4) > chở vật liệu (3) > thu hoạch (2) > nhu cầu thấp < 30 (1) > rảnh. Khi cả hai khẩn cấp, **đói trước ngủ**.
- **Nhu cầu:** Đói và Ngủ (0–100), con số ở [`src/data/colonists.ts`](../src/data/colonists.ts): đói hết trong 1 ngày, ngủ hết sau 1,2 ngày, ngủ trong lều hồi nhanh gấp đôi ngủ ngoài trời. Một nhu cầu về 0 thì máu giảm (chết sau 1/3 ngày).
- **Lãnh thổ:** bán kính 192 px quanh Lửa Thiêng; chỉ xây trong vùng ("Ngoài lãnh thổ — đặt gần Lửa Thiêng hơn.").
- **Tường = cọc:** kéo một đường sinh chuỗi cọc nhỏ, mỗi cọc là một blueprint, xây từng cái một; không xoay sprite.
- **Hiệu năng:** benchmark 0,40 ms/tick với 50 colonist — chưa cần Web Worker.
