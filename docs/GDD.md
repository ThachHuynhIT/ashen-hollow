# Ashen Hollow — Game Design Document (rút gọn)

> Bản tóm tắt sống của thiết kế. Khi một cơ chế thay đổi, sửa file này trước khi sửa code.
> Lộ trình chi tiết: [ROADMAP.md](ROADMAP.md) · Quy chuẩn hình ảnh: [ART_STYLE.md](ART_STYLE.md)

## Elevator pitch

Bạn dẫn một nhóm người sống sót tới một thung lũng bị nguyền. Ban ngày khai thác, xây dựng, nghiên cứu; ban đêm **Màn Sương (The Veil)** trồi lên, quái vật tấn công và tâm trí colonist bị bào mòn. Càng dùng sức mạnh hắc ám để sống sót, colony càng mạnh — và càng mục ruỗng.

**Thể loại:** Dark fantasy colony builder · 2D pixel art · **lưới hex** · **real-time có active pause** · web-first, đa nền tảng (PWA, Tauri, Capacitor).

## 4 trụ cột

1. **Ngày/Đêm là nhịp chính** — ngày = kinh tế, đêm = sinh tồn.
2. **Sanity & Corruption** — mọi quyết định mạnh đều có cái giá tinh thần.
3. **Colonist có câu chuyện** — trait, quan hệ, chấn thương; lính là colonist thật, chết là mất người.
4. **Ánh sáng là tài nguyên** — vùng sáng an toàn, bóng tối nguy hiểm.

## Các hệ thống chính

| Hệ thống                 | Tóm tắt                                                                                                    | Phase       |
| ------------------------ | ---------------------------------------------------------------------------------------------------------- | ----------- |
| Bản đồ hex               | Pointy-top, 64×64, procedural (độ cao/độ ẩm/blight), lãnh thổ kiểu Civ, adjacency bonus                    | 0–1, 4      |
| Colonist                 | Nhu cầu (đói, ngủ, ấm), kỹ năng 0–20, trait, quan hệ, Scar, Utility AI + ma trận ưu tiên công việc         | 1, 3        |
| Ngày/Đêm & Mùa           | 1 ngày ≈ 8–10 phút; đêm = Veil; 4 mùa; Blood Moon                                                          | 2, 5        |
| Sanity / Corruption      | Sanity cá nhân (ngưỡng 70/40/15 → mental break); Corruption colony 0–100%                                  | 2, 4        |
| Quân đội bám ô           | 1 lính/hex (1UPT), chi phí địa hình → thời gian qua ô, ZOC, Combat Strength, flank/support, LOS, promotion | 2, 4        |
| Cây công nghệ kiểu Civ 6 | Lore (Tech) + Doctrine (Civics), 4 kỷ nguyên, Eureka/Inspiration −40–50%, hàng đợi, fog of tech            | 2 (mini), 4 |
| Chế độ & Policy Card     | Government + slot ⚔ ⚒ 🕯 🩸 + Wildcard; thẻ có lợi có hại kiểu Frostpunk                                    | 4           |
| Storyteller & Event      | Nhịp căng/nghỉ; 30–40 event có lựa chọn                                                                    | 5           |
| Expedition               | Gửi đội ra ngoài map tới POI                                                                               | 5           |

## Quy tắc di chuyển "bám ô" (real-time)

- Mọi đơn vị luôn thuộc **đúng 1 hex** (`HexPosition`), di chuyển = trượt từ tâm hex sang tâm hex kề.
- Trước khi bước, đơn vị **giữ chỗ** hex đích (reservation) → không bao giờ chồng quân vượt giới hạn.
- Thời gian qua ô = `moveCost × baseStepTime / speed`; `moveCost` lấy từ `src/data/terrain.ts`.
- Vào hex kề địch (ZOC) → chậm mạnh và dừng lại.

## Thắng / Thua

- **Thua:** toàn bộ colonist chết/phát điên, hoặc Corruption = 100%.
- **Thắng (chiến dịch):** sống qua N mùa + nghi lễ Phong Ấn Màn Sương; kết thúc thay thế "Trở thành Bóng Tối".
- **Endless:** sống càng lâu càng tốt.

## Nguyên tắc kỹ thuật

- **Simulation tách khỏi render.** `src/sim`, `src/hex`, `src/data`, `src/core` không được import Phaser (ESLint chặn). Sim chạy tick cố định 10 tick/s, deterministic theo seed.
- **Data-driven.** Số liệu gameplay nằm trong `src/data/*`, không rải trong system.
- **Không dùng `Math.random()` trong sim.** Dùng `Rng` (seeded) để tái hiện bug và replay.
